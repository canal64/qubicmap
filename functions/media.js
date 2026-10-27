// Site previews and logos for the tiles.
// Screenshots come from WordPress mShots, logos from the site's own apple-touch-icon (or a large
// declared icon), with Google's favicon service as a fallback. Everything is stored in D1 and served
// from qubicmap.org, so visitors never load anything from a third party. A tile keeps its sigil
// until its preview or logo exists.

import LIST from "../lib/media.js";

const DAY = 86400000;
const RUN_EVERY = 90000;            // at most one refresh batch every 90 s (cron every 2 min, plus visits)
const BATCH = 5;                    // sites handled per batch (each costs a few fetches)
const SHOT_TTL = DAY, LOGO_TTL = 30 * DAY;     // previews follow the sites daily (new articles, prices, banners)
const SHOT_RETRY = 4 * 60000;       // mShots needs a minute or two to render a new page
const LOGO_RETRY = DAY;
const MAX_SHOT = 900000, MAX_LOGO = 300000;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

// mShots keeps serving its first capture of a URL, so the address carries the day (qm=YYYYMMDD):
// a new capture each day, and the retry a few minutes later asks for the same one.
const dayTag = () => new Date().toISOString().slice(0, 10).replace(/-/g, "");
const fresh = (u) => { try { const x = new URL(u); x.searchParams.set("qm", dayTag()); return x.toString(); } catch (e) { return u; } };
const shotUrl = (u) => "https://s.wordpress.com/mshots/v1/" + encodeURIComponent(fresh(u)) + "?w=600&h=900&vpw=1280&vph=1920";
const googleIcon = (host) => "https://s2.googleusercontent.com/s2/favicons?domain=" + encodeURIComponent(host) + "&sz=128";

// ---- image sniffing -------------------------------------------------------------------------
const OK_TYPES = { png: "image/png", jpg: "image/jpeg", gif: "image/gif", webp: "image/webp", ico: "image/x-icon" };
export function sniff(b) {
  const u = new Uint8Array(b);
  if (u.length < 12) return null;
  if (u[0] === 0x89 && u[1] === 0x50 && u[2] === 0x4e && u[3] === 0x47) return { type: "png", w: (u[16] << 24 | u[17] << 16 | u[18] << 8 | u[19]) >>> 0 };
  if (u[0] === 0xff && u[1] === 0xd8) return { type: "jpg", w: jpegWidth(u) };
  if (u[0] === 0x47 && u[1] === 0x49 && u[2] === 0x46) return { type: "gif", w: u[6] | (u[7] << 8) };
  if (u[0] === 0x52 && u[1] === 0x49 && u[2] === 0x46 && u[3] === 0x46 && u[8] === 0x57 && u[9] === 0x45) return { type: "webp", w: webpWidth(u) };
  if (u[0] === 0 && u[1] === 0 && u[2] === 1 && u[3] === 0) {         // .ico: take the widest entry
    const n = u[4] | (u[5] << 8); let w = 0;
    for (let i = 0; i < n && 6 + i * 16 < u.length; i++) w = Math.max(w, u[6 + i * 16] || 256);
    return { type: "ico", w };
  }
  return null;
}
function jpegWidth(u) {
  let i = 2;
  while (i + 9 < u.length) {
    if (u[i] !== 0xff) { i++; continue; }
    const m = u[i + 1], len = (u[i + 2] << 8) | u[i + 3];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return (u[i + 7] << 8) | u[i + 8];
    i += 2 + len;
  }
  return 0;
}
function webpWidth(u) {
  const f = String.fromCharCode(u[12], u[13], u[14], u[15]);
  if (f === "VP8X") return 1 + (u[24] | (u[25] << 8) | (u[26] << 16));
  if (f === "VP8 ") return (u[26] | (u[27] << 8)) & 0x3fff;
  if (f === "VP8L") return 1 + (((u[22] & 0x3f) << 8) | u[21]);
  return 0;
}

// ---- logo discovery ------------------------------------------------------------------------
// Candidates from the page head: apple-touch-icon first (usually 180x180), then any icon that
// declares a size of 96 px or more. SVG is skipped: it is never served from our origin.
export function iconCandidates(html, base) {
  const out = [];
  const tags = html.match(/<link\b[^>]*>/gi) || [];
  for (const t of tags) {
    const rel = (t.match(/\brel\s*=\s*["']?([^"'>]+)/i) || [])[1];
    const href = (t.match(/\bhref\s*=\s*["']?([^"' >]+)/i) || [])[1];
    if (!rel || !href || /\.svg(\?|$)/i.test(href) || /svg/i.test((t.match(/\btype\s*=\s*["']?([^"'>]+)/i) || [])[1] || "")) continue;
    const r = rel.toLowerCase(), sizes = (t.match(/\bsizes\s*=\s*["']?([^"'>]+)/i) || [])[1] || "";
    const size = Math.max(0, ...sizes.split(/\s+/).map((s) => parseInt(s, 10) || 0));
    let rank = -1;
    if (r.includes("apple-touch-icon")) rank = 2000 + (size || 180);
    else if (/\bicon\b/.test(r) && size >= 96) rank = 1000 + size;
    if (rank < 0) continue;
    try { out.push({ url: new URL(href.replace(/&amp;/g, "&"), base).href, rank }); } catch (e) {}
  }
  out.sort((a, b) => b.rank - a.rank);
  out.push({ url: new URL("/apple-touch-icon.png", base).href, rank: 0 });   // conventional location
  return out.filter((c, i, a) => a.findIndex((d) => d.url === c.url) === i).slice(0, 4);
}

async function getBytes(url, max, timeout) {
  try {
    const r = await fetch(url, { redirect: "follow", headers: { "User-Agent": UA, Accept: "image/*,*/*;q=0.5" }, signal: AbortSignal.timeout(timeout || 9000) });
    if (!r.ok) { try { r.body && (await r.body.cancel()); } catch (e) {} return null; }
    const b = await r.arrayBuffer();
    return b.byteLength > 0 && b.byteLength <= max ? b : null;
  } catch (e) { return null; }
}

async function findLogo(site) {
  let html = "", base = site;
  try {
    const r = await fetch(site, { redirect: "follow", headers: { "User-Agent": UA, Accept: "text/html" }, signal: AbortSignal.timeout(9000) });
    base = r.url || site;
    if (r.ok && (r.headers.get("content-type") || "").includes("html")) html = (await r.text()).slice(0, 400000);
    else try { r.body && (await r.body.cancel()); } catch (e) {}
  } catch (e) {}
  let best = null;
  for (const c of iconCandidates(html, base)) {
    const b = await getBytes(c.url, MAX_LOGO);
    const s = b && sniff(b);
    if (!s) continue;
    if (s.w >= 96) return { data: b, ct: OK_TYPES[s.type], src: "site" };
    if (!best || s.w > best.w) best = { data: b, ct: OK_TYPES[s.type], src: "site", w: s.w };
  }
  const g = await getBytes(googleIcon(new URL(base).hostname), MAX_LOGO);
  const gs = g && sniff(g);
  if (gs && gs.w >= 32 && (!best || gs.w > best.w)) return { data: g, ct: OK_TYPES[gs.type], src: "google" };
  return best && best.w >= 32 ? best : null;
}

// mShots answers with a "generating" placeholder (a GIF or a tiny image) until the capture is ready.
async function findShot(site) {
  let r;
  try { r = await fetch(shotUrl(site), { redirect: "follow", headers: { "User-Agent": UA, Accept: "image/*" }, signal: AbortSignal.timeout(12000) }); }
  catch (e) { return { fail: "fetch error" }; }
  const b = r.ok ? await r.arrayBuffer() : (r.body && (await r.body.cancel().catch(() => {})), null);
  const s = b && sniff(b);
  if (!s || s.type !== "jpg" || b.byteLength < 12000 || s.w < 300 || b.byteLength > MAX_SHOT)
    return { fail: "http " + r.status + " " + (s ? s.type + " w" + s.w : "?") + " " + (b ? b.byteLength : 0) + "B" };
  return { data: b, ct: "image/jpeg" };
}

// ---- refresh batch (driven by page visits, like the link checker) ---------------------------
export async function mediaBatch(env, force) {
  const now = Date.now();
  const gate = await env.DB.prepare("SELECT ts FROM kv WHERE k = 'mediarun'").first();
  if (!force && gate && now - gate.ts < RUN_EVERY) return;
  await env.DB.prepare("INSERT INTO kv (k, v, ts) VALUES ('mediarun', '', ?1) ON CONFLICT(k) DO UPDATE SET ts = ?1").bind(now).run();
  const rows = (await env.DB.prepare("SELECT slug, url, shot_ts, shot_try, logo_ts, logo_try FROM media").all()).results;
  const known = new Map(rows.map((r) => [r.slug, r]));
  const due = LIST.map(([slug, url]) => {
    const p = known.get(slug) || {}, same = p.url === url;
    const needShot = !same || (!p.shot_ts && now - (p.shot_try || 0) > SHOT_RETRY) || (p.shot_ts && now - p.shot_ts > SHOT_TTL && now - (p.shot_try || 0) > SHOT_RETRY);
    const needLogo = !same || (!p.logo_ts && now - (p.logo_try || 0) > LOGO_RETRY) || (p.logo_ts && now - p.logo_ts > LOGO_TTL && now - (p.logo_try || 0) > LOGO_RETRY);
    return { slug, url, same, needShot, needLogo, order: Math.min(p.shot_try || 0, p.logo_try || 0) };
  }).filter((x) => x.needShot || x.needLogo).sort((a, b) => a.order - b.order).slice(0, BATCH);
  if (!due.length) return;
  for (const x of due) {
    const [shot, logo] = await Promise.all([x.needShot ? findShot(x.url) : null, x.needLogo ? findLogo(x.url) : null]);
    if (!x.same) await env.DB.prepare("INSERT INTO media (slug, url) VALUES (?1, ?2) ON CONFLICT(slug) DO UPDATE SET url = ?2, shot = NULL, shot_ts = NULL, shot_try = 0, logo = NULL, logo_ts = NULL, logo_try = 0").bind(x.slug, x.url).run();
    const st = [];
    if (x.needShot) st.push(shot && shot.data
      ? env.DB.prepare("UPDATE media SET shot = ?2, shot_ct = ?3, shot_ts = ?4, shot_try = ?4 WHERE slug = ?1").bind(x.slug, shot.data, shot.ct, now)
      : env.DB.prepare("UPDATE media SET shot_try = ?2, shot_ct = CASE WHEN shot IS NULL THEN ?3 ELSE shot_ct END WHERE slug = ?1").bind(x.slug, now, "fail: " + ((shot && shot.fail) || "")));
    if (x.needLogo) st.push(logo
      ? env.DB.prepare("UPDATE media SET logo = ?2, logo_ct = ?3, logo_src = ?4, logo_ts = ?5, logo_try = ?5 WHERE slug = ?1").bind(x.slug, logo.data, logo.ct, logo.src, now)
      : env.DB.prepare("UPDATE media SET logo_try = ?2 WHERE slug = ?1").bind(x.slug, now));
    if (st.length) await env.DB.batch(st);
  }
}

// { slug: [shot version, logo version] } in seconds, 0 when missing. Read by the page to decide what to show.
export async function mediaIndex(env) {
  const rows = (await env.DB.prepare("SELECT slug, shot_ts, logo_ts FROM media WHERE shot_ts IS NOT NULL OR logo_ts IS NOT NULL").all()).results;
  const out = {};
  for (const r of rows) out[r.slug] = [r.shot_ts ? Math.round(r.shot_ts / 1000) : 0, r.logo_ts ? Math.round(r.logo_ts / 1000) : 0];
  return out;
}

// GET /m/s/<slug>.jpg and /m/l/<slug>
export async function serveMedia(request, env, waitUntil) {
  const url = new URL(request.url);
  const m = url.pathname.match(/^\/m\/(s|l)\/([a-z0-9-]{1,48})(?:\.jpg)?$/);
  if (!m || request.method !== "GET") return new Response("Not found", { status: 404 });
  const cache = typeof caches !== "undefined" && caches.default;
  const key = new Request(url.toString());
  const hit = cache && (await cache.match(key));
  if (hit) return hit;
  const col = m[1] === "s" ? "shot" : "logo";
  const row = await env.DB.prepare(`SELECT ${col} AS data, ${col}_ct AS ct FROM media WHERE slug = ?1 AND ${col} IS NOT NULL`).bind(m[2]).first();
  if (!row || !row.data) return new Response("Not found", { status: 404, headers: { "Cache-Control": "public, max-age=300" } });
  const body = row.data instanceof ArrayBuffer ? row.data : new Uint8Array(row.data).buffer;
  const res = new Response(body, { headers: {
    "Content-Type": row.ct || "application/octet-stream",
    "Cache-Control": url.searchParams.has("v") ? "public, max-age=31536000, immutable" : "public, max-age=86400",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  } });
  if (cache) waitUntil(cache.put(key, res.clone()));
  return res;
}
