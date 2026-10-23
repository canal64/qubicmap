// Worker entry: serves the site from public/ and runs the same server code that
// used to run as Pages Functions (functions/), so both layouts stay in sync.
import { onRequest as home, githubIfStale } from "../functions/index.js";
import { onRequest as api } from "../functions/api/[[route]].js";
import { serveMedia, mediaBatch } from "../functions/media.js";
import { refreshWhales } from "../functions/whales.js";

const MAIN = "qubicmap.org";

export default {
  // Cron: fills and refreshes the tile previews and logos a few sites at a time.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(mediaBatch(env, true).catch(() => {}));
    ctx.waitUntil(githubIfStale(env).catch(() => {}));
    ctx.waitUntil(refreshWhales(env).catch(() => {}));
  },
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // One public address: preview hosts send visitors to qubicmap.org.
    if (url.hostname.endsWith(".pages.dev") || url.hostname.endsWith(".workers.dev")) {
      url.protocol = "https:";
      url.hostname = MAIN;
      url.port = "";
      return Response.redirect(url.toString(), 301);
    }
    // Never serve the site over plain HTTP (someone could alter a page on the way, e.g. /check).
    if (url.protocol === "http:" && !/^(localhost|127\.0\.0\.1)$/.test(url.hostname)) {
      url.protocol = "https:";
      return Response.redirect(url.toString(), 301);
    }
    const res = await route(request, env, ctx, url);
    // HSTS: browsers then always use HTTPS for qubicmap.org
    const out = new Response(res.body, res);
    out.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    return out;
  },
};

async function route(request, env, ctx, url) {
    const waitUntil = (p) => ctx.waitUntil(p);
    if (url.pathname.startsWith("/api/")) return api({ request, env, waitUntil });
    if (url.pathname.startsWith("/m/")) return serveMedia(request, env, waitUntil);
    if (url.pathname === "/" || url.pathname === "/index.html")
      return home({ request, env, waitUntil, next: () => env.ASSETS.fetch(request) });
    return env.ASSETS.fetch(request);
}
