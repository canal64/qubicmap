// Likes API for the Qubic Ecosystem Map (Cloudflare Pages Function + D1).
//   GET  /api/likes          -> { counts: {project: n}, week: {project: n} }   (cached 60 s)
//   POST /api/like {id, on}  -> { count }
//   POST /api/suggest {kind, name, url, note, contact} -> { ok }   (project proposals and problem reports)
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
    return json({ error: "not found" }, 404);
  } catch (e) {
    return json({ error: String((e && e.message) || e) }, 500);
  }
}

