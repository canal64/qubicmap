// Home page: inlines the like totals, the latest Qubic blog headlines and the
// result of the link checks into the HTML, so the page can draw them on first paint without a layout jump.
// Any failure here falls back to serving the page untouched.

import LIST from "../lib/links.js";
import { mediaBatch, mediaIndex } from "./media.js";

const DAY = 86400000;
const NEWS_URL = "https://qubic.org/blog-grid";
const NEWS_MAX_AGE = 3600000;      // re-read the blog at most once an hour
const NEWS_RETRY = 600000;         // after a failed read, wait ten minutes

async function likes(request, env, waitUntil) {
  const origin = new URL(request.url).origin;
  const cache = typeof caches !== "undefined" && caches.default;
  const key = new Request(origin + "/api/likes");
  const hit = cache && (await cache.match(key));
  if (hit) return await hit.json();
  const all = await env.DB.prepare("SELECT project, count(*) AS n FROM likes GROUP BY project").all();
  const recent = await env.DB.prepare("SELECT project, count(*) AS n FROM likes WHERE ts > ?1 GROUP BY project").bind(Date.now() - 7 * DAY).all();
  const counts = {}, week = {};
  for (const r of all.results) counts[r.project] = r.n;
  for (const r of recent.results) week[r.project] = r.n;
  const body = { counts, week };
  if (cache)
    waitUntil(cache.put(key, new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60" } })));
  return body;
}

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", hellip: "…" };
const decode = (s) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);

// Reads the post cards of the blog listing: each is a link to /blog-detail/<slug>
// whose text holds the title and a date such as "Oct 4, 2026".
export function parseNews(html) {
  const out = [], seen = new Set();
  const link = /<a\b[^>]*\bhref=["'](?:https?:\/\/(?:www\.)?qubic\.org)?\.?\/?blog-detail\/([a-z0-9-]+)\/?["'][^>]*>([\s\S]*?)<\/a>/gi;
  const date = /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},\s*\d{4})\b/;
  let m;
  while ((m = link.exec(html)) && out.length < 12) {
    const slug = m[1];
    if (seen.has(slug)) continue;
    const text = decode(m[2].replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    const all = [...text.matchAll(new RegExp(date.source, "g"))];
    if (!all.length) continue;
    const d = all[all.length - 1];  // the card's own date comes after the title, which may itself contain a date
    const title = (text.slice(0, d.index).trim() || text.slice(d.index + d[0].length).trim());
    const when = new Date(d[1].replace(".", "") + " UTC");
    if (title.length < 6 || title.length > 220 || isNaN(when)) continue;
    seen.add(slug);
    out.push({ t: title, d: when.toISOString().slice(0, 10), u: "https://qubic.org/blog-detail/" + slug });
  }
  return out.sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0)).slice(0, 5);
}

async function refreshNews(env) {
  let items = null, note = "";
  try {
    const r = await fetch(NEWS_URL, { headers: { "User-Agent": "Mozilla/5.0 (compatible; QubicEcosystemMap/1.0; +https://qubicmap.org)", Accept: "text/html" }, signal: AbortSignal.timeout(8000) });
    if (r.ok) { const p = parseNews(await r.text()); if (p.length >= 3) items = p; note = "http 200, " + p.length + " posts read"; }
    else note = "http " + r.status;
  } catch (e) { note = "error: " + String((e && e.message) || e).slice(0, 120); }
  const now = Date.now();
  const log = env.DB.prepare("INSERT INTO kv (k, v, ts) VALUES ('news_status', ?1, ?2) ON CONFLICT(k) DO UPDATE SET v = ?1, ts = ?2").bind((items ? "ok: " : "failed: ") + note, now);
  if (items)
    await env.DB.batch([log, env.DB.prepare("INSERT INTO kv (k, v, ts) VALUES ('news', ?1, ?2) ON CONFLICT(k) DO UPDATE SET v = ?1, ts = ?2").bind(JSON.stringify(items), now)]);
  else  // keep the last good list, just push the next attempt back
    await env.DB.batch([log, env.DB.prepare("UPDATE kv SET ts = ?1 WHERE k = 'news'").bind(now - NEWS_MAX_AGE + NEWS_RETRY)]);
}

// Never waits for the blog: serves the last good list and refreshes in the background.
async function news(request, env, waitUntil) {
  const origin = new URL(request.url).origin;
  const cache = typeof caches !== "undefined" && caches.default;
  const key = new Request(origin + "/api/news-cache");
  const hit = cache && (await cache.match(key));
  if (hit) return await hit.json();
  const row = await env.DB.prepare("SELECT v, ts FROM kv WHERE k = 'news'").first();
  let items = [];
  try { items = row ? JSON.parse(row.v) : []; } catch (e) {}
  if (!row || Date.now() - row.ts > NEWS_MAX_AGE) waitUntil(refreshNews(env));
  if (cache)
    waitUntil(cache.put(key, new Response(JSON.stringify(items), { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" } })));
  return items;
}

// ---------- link checks ----------
// Pages has no scheduled jobs, so visits drive the checks: at most one small batch
// every ten minutes, each site about once a day, a failing site again after an hour.
// A site is only shown as "not responding" after two failed checks in a row
// (three when it gave no answer at all).
const CHECK_EVERY = 600000, CHECK_BATCH = 12, RECHECK_OK = DAY, RECHECK_FAIL = 3600000;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 QubicEcosystemMap-linkcheck (+https://qubicmap.org)";

// Refusals aimed at robots (401, 403, 429...) still prove the site is up.
const isDown = (code) => code === 0 || code === 404 || code === 410 || code >= 500;

async function probe(url) {
  try {
    const r = await fetch(url, { method: "GET", redirect: "follow", headers: { "User-Agent": UA, Accept: "text/html,*/*;q=0.8" }, signal: AbortSignal.timeout(9000) });
    try { r.body && (await r.body.cancel()); } catch (e) {}
    return r.status;
  } catch (e) {
    return 0;
  }
}

async function checkBatch(env) {
  const now = Date.now();
  const gate = await env.DB.prepare("SELECT ts FROM kv WHERE k = 'linkrun'").first();
  if (gate && now - gate.ts < CHECK_EVERY) return;
  await env.DB.prepare("INSERT INTO kv (k, v, ts) VALUES ('linkrun', '', ?1) ON CONFLICT(k) DO UPDATE SET ts = ?1").bind(now).run();
  const rows = (await env.DB.prepare("SELECT slug, url, ok, ts, fails, since FROM links").all()).results;
  const known = new Map(rows.map((r) => [r.slug, r]));
  const due = LIST
    .map(([slug, url]) => ({ slug, url, prev: known.get(slug) }))
    .filter((x) => !x.prev || x.prev.url !== x.url || now - x.prev.ts > (x.prev.fails > 0 ? RECHECK_FAIL : RECHECK_OK))
    .sort((a, b) => (a.prev ? a.prev.ts : 0) - (b.prev ? b.prev.ts : 0))
    .slice(0, CHECK_BATCH);
  if (!due.length) return;
  const codes = await Promise.all(due.map((x) => probe(x.url)));
  const stmt = env.DB.prepare("INSERT INTO links (slug, url, ok, code, ts, fails, since) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) ON CONFLICT(slug) DO UPDATE SET url = ?2, ok = ?3, code = ?4, ts = ?5, fails = ?6, since = ?7");
  await env.DB.batch(due.map((x, i) => {
    const same = x.prev && x.prev.url === x.url ? x.prev : null;
    const down = isDown(codes[i]);
    const fails = down ? (same ? same.fails : 0) + 1 : 0;
    const since = down ? (same && same.since) || now : null;
    // no answer at all can be our side of the network: ask for a third failure before flagging
    return stmt.bind(x.slug, x.url, fails >= (codes[i] === 0 ? 3 : 2) ? 0 : 1, codes[i], now, fails, since);
  }));
}

// { slug: [1, time of last good check] } or { slug: [0, time it stopped answering] }, in seconds.
async function links(request, env, waitUntil) {
  const origin = new URL(request.url).origin;
  const cache = typeof caches !== "undefined" && caches.default;
  const key = new Request(origin + "/api/links-cache");
  const hit = cache && (await cache.match(key));
  if (hit) return await hit.json();
  waitUntil(checkBatch(env).catch(() => {}));
  const rows = (await env.DB.prepare("SELECT slug, ok, ts, since FROM links WHERE ts > ?1").bind(Date.now() - 3 * DAY).all()).results;
  const out = {};
  for (const r of rows) out[r.slug] = r.ok ? [1, Math.round(r.ts / 1000)] : [0, Math.round((r.since || r.ts) / 1000)];
  if (cache)
    waitUntil(cache.put(key, new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=600" } })));
  return out;
}

// Which tiles have a site preview and a logo yet; refreshes a few sites in the background.
async function media(request, env, waitUntil) {
  waitUntil(mediaBatch(env).catch(() => {}));
  const origin = new URL(request.url).origin;
  const cache = typeof caches !== "undefined" && caches.default;
  const key = new Request(origin + "/api/media-cache");
  const hit = cache && (await cache.match(key));
  if (hit) return await hit.json();
  const out = await mediaIndex(env);
  if (cache)
    waitUntil(cache.put(key, new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" } })));
  return out;
}

// ---- Qubic GitHub activity: core releases and the most recently pushed repositories ----------
const GH_MAX_AGE = 3600000, GH_RETRY = 900000;
const GH_HEAD = { "User-Agent": "QubicEcosystemMap/1.0 (+https://qubicmap.org)", Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
async function ghJson(path, env) {
  const h = { ...GH_HEAD };
  if (env.GITHUB_TOKEN) h.Authorization = "Bearer " + env.GITHUB_TOKEN;
  const r = await fetch("https://api.github.com/" + path, { headers: h, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error("http " + r.status + " on " + path);
  return r.json();
}
const firstLine = (m) => String(m || "").split("\n")[0].replace(/\s+/g, " ").trim().slice(0, 160);
export async function atom(url, kind) {
  const r = await fetch(url, { headers: { "User-Agent": GH_HEAD["User-Agent"], Accept: "application/atom+xml" }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error("http " + r.status);
  const xml = await r.text(), out = [];
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const e = m[1];
    const title = decode(((e.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1] || "").replace(/<[^>]+>/g, "")).trim();
    const link = (e.match(/<link[^>]*href="([^"]+)"/) || [])[1];
    const date = (e.match(/<updated>([^<]+)<\/updated>/) || [])[1];
    if (!title || !link || !date) continue;
    out.push({ k: kind, t: "qubic/core · " + (kind === "rel" ? (/^v?\d/.test(title) ? "Release " : "") + title : firstLine(title)), d: date, u: link.startsWith("http") ? link : "https://github.com" + link });
    if (out.length >= 4) break;
  }
  return out;
}
// Latest qubic/core release with its epoch and notes, for the release box on the home page.
const relNotes = (lines) => lines.map((x) => decode(x.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 8).map((x) => x.slice(0, 160));
const relItem = (title, tag, date, url, notes) => ({ ep: +((String(title).match(/\bEP\s?(\d{2,4})\b/i) || [])[1] || 0) || null, v: tag, t: String(title).slice(0, 200), d: date, u: url, n: notes });
async function latestRelease(env) {
  try {
    const r = (await ghJson("repos/qubic/core/releases?per_page=5", env)).find((x) => !x.draft && !x.prerelease && x.published_at);
    if (r) return relItem(r.name || r.tag_name, r.tag_name, r.published_at, r.html_url,
      relNotes(String(r.body || "").split("\n").filter((l) => /^\s*[-*] /.test(l)).map((l) => l.replace(/^\s*[-*] /, "").replace(/[*_`]/g, ""))));
  } catch (e) {}
  const res = await fetch("https://github.com/qubic/core/releases.atom", { headers: { "User-Agent": GH_HEAD["User-Agent"], Accept: "application/atom+xml" }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  const e = ((await res.text()).match(/<entry>([\s\S]*?)<\/entry>/) || [])[1];
  if (!e) return null;
  const title = decode(((e.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1] || "").replace(/<[^>]+>/g, "")).trim();
  const link = (e.match(/<link[^>]*href="([^"]+)"/) || [])[1] || "";
  const date = (e.match(/<updated>([^<]+)<\/updated>/) || [])[1];
  const html = decode((e.match(/<content[^>]*>([\s\S]*?)<\/content>/) || [])[1] || "");
  const url = link.startsWith("http") ? link : "https://github.com" + link;
  return title && date ? relItem(title, (url.match(/\/tag\/([^/?#]+)/) || [])[1] || "", date, url, relNotes([...html.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) => m[1]))) : null;
}
async function refreshRelease(env) {
  const r = await latestRelease(env).catch(() => null);
  if (r && /^https:\/\/github\.com\/qubic\/core\//.test(r.u))
    await env.DB.prepare("INSERT INTO kv (k, v, ts) VALUES ('ghrel', ?1, ?2) ON CONFLICT(k) DO UPDATE SET v = ?1, ts = ?2").bind(JSON.stringify(r), Date.now()).run();
}
export async function refreshGithub(env) {
  await refreshRelease(env).catch(() => {});
  let items = null, note = "";
  try {
    const [rel, repos] = await Promise.all([
      ghJson("repos/qubic/core/releases?per_page=4", env).catch(() => []),
      ghJson("orgs/qubic/repos?sort=pushed&direction=desc&per_page=6", env),
    ]);
    const out = [];
    for (const r of rel || []) if (!r.draft && r.published_at)
      out.push({ k: "rel", t: "qubic/core · " + (r.name && r.name !== r.tag_name ? r.tag_name + " · " + r.name : "Release " + r.tag_name), d: r.published_at, u: r.html_url });
    const top = (repos || []).filter((r) => !r.private && r.pushed_at).slice(0, 4);
    const commits = await Promise.all(top.map((r) =>
      ghJson("repos/qubic/" + r.name + "/commits?per_page=1&sha=" + encodeURIComponent(r.default_branch || "main"), env).then((c) => c && c[0]).catch(() => null)));
    top.forEach((r, i) => {
      const c = commits[i];
      out.push({ k: "push", t: "qubic/" + r.name + " · " + (c ? firstLine(c.commit && c.commit.message) : "updated"), d: (c && c.commit && c.commit.committer && c.commit.committer.date) || r.pushed_at, u: c ? c.html_url : r.html_url });
    });
    out.sort((a, b) => (a.d < b.d ? 1 : -1));
    if (out.length) items = out.slice(0, 6);
    note = (rel || []).length + " releases, " + top.length + " repos";
  } catch (e) { note = String((e && e.message) || e).slice(0, 140); }
  // GitHub limits its API for unauthenticated calls from shared hosts: fall back to the public Atom feeds of qubic/core.
  if (!items) {
    try {
      const out = [...(await atom("https://github.com/qubic/core/releases.atom", "rel")), ...(await atom("https://github.com/qubic/core/commits/main.atom", "push"))];
      out.sort((a, b) => (a.d < b.d ? 1 : -1));
      if (out.length) { items = out.slice(0, 6); note += " · atom feeds: " + out.length + " entries"; }
    } catch (e) { note += " · atom: " + String((e && e.message) || e).slice(0, 80); }
  }
  const now = Date.now();
  const log = env.DB.prepare("INSERT INTO kv (k, v, ts) VALUES ('gh_status', ?1, ?2) ON CONFLICT(k) DO UPDATE SET v = ?1, ts = ?2").bind((items ? "ok: " : "failed: ") + note, now);
  if (items)
    await env.DB.batch([log, env.DB.prepare("INSERT INTO kv (k, v, ts) VALUES ('gh', ?1, ?2) ON CONFLICT(k) DO UPDATE SET v = ?1, ts = ?2").bind(JSON.stringify(items), now)]);
  else
    await env.DB.batch([log, env.DB.prepare("INSERT INTO kv (k, v, ts) VALUES ('gh', '[]', ?1) ON CONFLICT(k) DO UPDATE SET ts = ?1").bind(now - GH_MAX_AGE + GH_RETRY)]);
}
export async function githubIfStale(env) {
  const row = await env.DB.prepare("SELECT ts FROM kv WHERE k = 'gh'").first();
  if (!row || Date.now() - row.ts > GH_MAX_AGE) await refreshGithub(env);
}
async function github(request, env, waitUntil) {
  const origin = new URL(request.url).origin;
  const cache = typeof caches !== "undefined" && caches.default;
  const key = new Request(origin + "/api/gh-cache");
  const hit = cache && (await cache.match(key));
  if (hit) return await hit.json();
  const row = await env.DB.prepare("SELECT v, ts FROM kv WHERE k = 'gh'").first();
  if (!row || Date.now() - row.ts > GH_MAX_AGE) waitUntil(refreshGithub(env).catch(() => {}));
  const out = row ? JSON.parse(row.v || "[]") : [];
  if (cache)
    waitUntil(cache.put(key, new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" } })));
  return out;
}

async function release(request, env) {
  const row = await env.DB.prepare("SELECT v FROM kv WHERE k = 'ghrel'").first();
  return row ? JSON.parse(row.v) : null;
}

const safe = (v) => JSON.stringify(v).replace(/</g, "\\u003c").replace(/[\u2028\u2029]/g, "");

export async function onRequest(context) {
  const { request, env, next, waitUntil } = context;
  const res = await next();
  try {
    if (request.method !== "GET" || !(res.headers.get("content-type") || "").includes("text/html")) return res;
    const [l, n, k, m, g, r] = await Promise.all([
      likes(request, env, waitUntil).catch(() => null),
      news(request, env, waitUntil).catch(() => null),
      links(request, env, waitUntil).catch(() => null),
      media(request, env, waitUntil).catch(() => null),
      github(request, env, waitUntil).catch(() => null),
      release(request, env).catch(() => null),
    ]);
    let script = "";
    if (l) script += "window.__LIKES=" + safe(l) + ";";
    if (n && n.length) script += "window.__NEWS=" + safe(n) + ";";
    if (k && Object.keys(k).length) script += "window.__LINKS=" + safe(k) + ";";
    if (m && Object.keys(m).length) script += "window.__MEDIA=" + safe(m) + ";";
    if (g && g.length) script += "window.__GH=" + safe(g) + ";";
    if (r && r.v) script += "window.__REL=" + safe(r) + ";";
    if (!script) return res;
    const out = new HTMLRewriter()
      .on("head", { element(el) { el.append("<script>" + script + "</script>", { html: true }); } })
      .transform(res);
    const headers = new Headers(out.headers);
    headers.set("Cache-Control", "public, max-age=0, must-revalidate");
    return new Response(out.body, { status: out.status, headers });
  } catch (e) {
    return res;
  }
}
