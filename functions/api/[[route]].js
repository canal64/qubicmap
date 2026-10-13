// Likes API for the Qubic Ecosystem Map (Cloudflare Pages Function + D1).
//   GET  /api/likes          -> { counts: {project: n}, week: {project: n} }   (cached 60 s)
//   POST /api/like {id, on}  -> { count }
//   POST /api/suggest {kind, name, url, note, contact} -> { ok }   (project proposals and problem reports)
//   GET  /api/game/board     -> { epoch, endsAt, players, top: [{name, score}], me, ladder: [[name, score, isMe]], champions: [{epoch, name, score}] }   (Flappy Qubic, one board per Qubic epoch)
//   POST /api/game/start     -> { token }   (signed start time, used to reject impossible scores)
//   POST /api/game/score {token, score, name} -> { rank, best, top }
// One like per project per visitor. A visitor is a salted hash of the IP address; the address is never stored.

const DAY = 86400000;
const MAX_LIKES_PER_DAY = 60;
const MAX_SUGGESTIONS_PER_DAY = 5;          // per visitor
const MAX_SUGGESTIONS_TOTAL_PER_DAY = 300;   // whole site, protects the free database quota
const ID = /^[a-z0-9][a-z0-9-]{0,47}$/;

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...extra } });

async function voterOf(request, env) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const data = new TextEncoder().encode(ip + "|" + (env.SALT || "qubic-ecosystem-map"));
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  return [...hash.slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("");
}


// ---- Flappy Qubic weekly board -------------------------------------------------
// One board per Qubic epoch (epochs turn every Wednesday 12:00 UTC; epoch 234 began 7 Oct 2026).
const EPOCH0 = Date.UTC(2026, 9, 7, 12, 0, 0), EPOCH0_N = 234, WEEK = 7 * DAY;
const epochNow = (t = Date.now()) => { const k = Math.floor((t - EPOCH0) / WEEK); return { n: EPOCH0_N + k, endsAt: EPOCH0 + (k + 1) * WEEK }; };
const MAX_SCORE = 2000, MS_PER_TICK = 800, MAX_GAME_MS = 45 * 60 * 1000;
const BLOCK = /(fuck|shit|bitch|cunt|nigg|fagg|whore|slut|nazi|hitler|porn|pute|salope|connard|encul|merde|bite)/i;

async function sign(text, env) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode((env.SALT || "qubic-ecosystem-map") + "|game"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text)));
  return [...mac.slice(0, 12)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function cleanName(v) {
  const n = String(v == null ? "" : v).normalize("NFC").replace(/[^\p{L}\p{N} _.\-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 16);
  return n.length && !BLOCK.test(n.replace(/[\s_.\-]/g, "")) ? n : "";
}
async function board(env, voter) {
  const ep = epochNow();
  const top = await env.DB.prepare("SELECT name, score FROM scores WHERE epoch = ?1 ORDER BY score DESC, ts ASC LIMIT 10").bind(ep.n).all();
  let me = null;
  if (voter) {
    const row = await env.DB.prepare("SELECT name, score, ts FROM scores WHERE epoch = ?1 AND voter = ?2").bind(ep.n, voter).first();
    if (row) {
      const above = await env.DB.prepare("SELECT count(*) AS c FROM scores WHERE epoch = ?1 AND (score > ?2 OR (score = ?2 AND ts < ?3))").bind(ep.n, row.score, row.ts).first();
      me = { name: row.name, score: row.score, rank: above.c + 1 };
    }
  }
  const players = await env.DB.prepare("SELECT count(*) AS c FROM scores WHERE epoch = ?1").bind(ep.n).first();
  // Every score this epoch (for the "rival to beat" markers in the game), own row flagged.
  const ladder = await env.DB.prepare("SELECT name, score, (voter = ?2) AS me FROM scores WHERE epoch = ?1 ORDER BY score DESC, ts ASC LIMIT 300").bind(ep.n, voter || "").all();
  // Hall of fame: the winner of each finished epoch.
  const champs = await env.DB.prepare(
    "SELECT epoch, name, score FROM (SELECT epoch, name, score, ROW_NUMBER() OVER (PARTITION BY epoch ORDER BY score DESC, ts ASC) AS r FROM scores WHERE epoch < ?1) WHERE r = 1 ORDER BY epoch DESC LIMIT 20"
  ).bind(ep.n).all();
  return { epoch: ep.n, endsAt: ep.endsAt, players: players.c, top: top.results, me,
           ladder: ladder.results.map((r) => [r.name, r.score, r.me ? 1 : 0]), champions: champs.results };
}
async function game(url, request, env) {
  if (url.pathname === "/api/game/board" && request.method === "GET") {
    return json(await board(env, await voterOf(request, env)), 200, { "Cache-Control": "no-store" });
  }
  if (request.method !== "POST") return null;
  const origin = request.headers.get("Origin");
  if (origin && new URL(origin).host !== url.host) return json({ error: "forbidden" }, 403);
  const voter = await voterOf(request, env), now = Date.now();
  if (url.pathname === "/api/game/start") {
    return json({ token: now + "." + (await sign(now + "|" + voter, env)) });
  }
  if (url.pathname === "/api/game/score") {
    let b; try { b = await request.json(); } catch { return json({ error: "bad request" }, 400); }
    const [t, mac] = String((b && b.token) || "").split(".");
    const started = Number(t), score = Number(b && b.score), name = cleanName(b && b.name);
    if (!started || mac !== (await sign(started + "|" + voter, env))) return json({ error: "bad token" }, 400);
    if (!Number.isInteger(score) || score < 1 || score > MAX_SCORE) return json({ error: "bad score" }, 400);
    const took = now - started;
    if (took > MAX_GAME_MS || took < 1000 + score * MS_PER_TICK) return json({ error: "score not accepted" }, 400);
    if (!name) return json({ error: "pick another name" }, 400);
    const ep = epochNow(started);
    if (ep.n !== epochNow(now).n) return json({ error: "the epoch changed during this game" }, 409);
    await env.DB.prepare(
      "INSERT INTO scores (epoch, voter, name, score, ts) VALUES (?1, ?2, ?3, ?4, ?5) " +
      "ON CONFLICT(epoch, voter) DO UPDATE SET name = excluded.name, " +
      "ts = CASE WHEN excluded.score > scores.score THEN excluded.ts ELSE scores.ts END, " +
      "score = max(scores.score, excluded.score)"
    ).bind(ep.n, voter, name, score, now).run();
    return json(await board(env, voter));
  }
  return null;
}

export async function onRequest({ request, env, waitUntil }) {
  const url = new URL(request.url);
  try {
    if (url.pathname === "/api/likes" && request.method === "GET") {
      const cache = typeof caches !== "undefined" && caches.default;
      const key = new Request(url.origin + "/api/likes");
      const hit = cache && (await cache.match(key));
      if (hit) return hit;
      const all = await env.DB.prepare("SELECT project, count(*) AS n FROM likes GROUP BY project").all();
      const recent = await env.DB.prepare("SELECT project, count(*) AS n FROM likes WHERE ts > ?1 GROUP BY project").bind(Date.now() - 7 * DAY).all();
      const counts = {}, week = {};
      for (const r of all.results) counts[r.project] = r.n;
      for (const r of recent.results) week[r.project] = r.n;
      const res = json({ counts, week }, 200, { "Cache-Control": "public, max-age=60" });
      if (cache) waitUntil(cache.put(key, res.clone()));
      return res;
    }
    if (url.pathname === "/api/like" && request.method === "POST") {
      const origin = request.headers.get("Origin");
      if (origin && new URL(origin).host !== url.host) return json({ error: "forbidden" }, 403);
      let body; try { body = await request.json(); } catch { return json({ error: "bad request" }, 400); }
      const id = String((body && body.id) || ""), on = !!(body && body.on);
      if (!ID.test(id)) return json({ error: "bad id" }, 400);
      const voter = await voterOf(request, env), now = Date.now();
      if (on) {
        const today = await env.DB.prepare("SELECT count(*) AS c FROM likes WHERE voter = ?1 AND ts > ?2").bind(voter, now - DAY).first();
        if (today.c >= MAX_LIKES_PER_DAY) return json({ error: "too many likes today" }, 429);
        await env.DB.prepare("INSERT OR IGNORE INTO likes (project, voter, ts) VALUES (?1, ?2, ?3)").bind(id, voter, now).run();
      } else {
        await env.DB.prepare("DELETE FROM likes WHERE project = ?1 AND voter = ?2").bind(id, voter).run();
      }
      const row = await env.DB.prepare("SELECT count(*) AS n FROM likes WHERE project = ?1").bind(id).first();
      return json({ count: row ? row.n : 0 });
    }
    if (url.pathname === "/api/suggest" && request.method === "POST") {
      const origin = request.headers.get("Origin");
      if (origin && new URL(origin).host !== url.host) return json({ error: "forbidden" }, 403);
      let b; try { b = await request.json(); } catch { return json({ error: "bad request" }, 400); }
      const str = (v, max) => String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b-\u001f]/g, "").trim().slice(0, max);
      if (str(b && b.website, 50)) return json({ ok: true });            // filled by bots only
      const kind = ["new", "broken", "other"].includes(b && b.kind) ? b.kind : "other";
      const name = str(b && b.name, 80), link = str(b && b.url, 300), note = str(b && b.note, 1000), contact = str(b && b.contact, 120), lang = str(b && b.lang, 5);
      if (name.length < 2) return json({ error: "name required" }, 400);
      if (link && !/^https?:\/\/\S+\.\S+/i.test(link)) return json({ error: "bad link" }, 400);
      const voter = await voterOf(request, env), now = Date.now();
      const mine = await env.DB.prepare("SELECT count(*) AS c FROM suggestions WHERE voter = ?1 AND ts > ?2").bind(voter, now - DAY).first();
      if (mine.c >= MAX_SUGGESTIONS_PER_DAY) return json({ error: "too many today" }, 429);
      const all = await env.DB.prepare("SELECT count(*) AS c FROM suggestions WHERE ts > ?1").bind(now - DAY).first();
      if (all.c >= MAX_SUGGESTIONS_TOTAL_PER_DAY) return json({ error: "try again tomorrow" }, 429);
      await env.DB.prepare("INSERT INTO suggestions (ts, kind, name, url, note, contact, lang, voter) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)").bind(now, kind, name, link, note, contact, lang, voter).run();
      return json({ ok: true });
    }
    if (url.pathname.startsWith("/api/game/")) {
      const r = await game(url, request, env);
      if (r) return r;
    }
    return json({ error: "not found" }, 404);
  } catch (e) {
    return json({ error: String((e && e.message) || e) }, 500);
  }
}

