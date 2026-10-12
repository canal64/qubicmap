// Worker entry: serves the site from public/ and runs the same server code that
// used to run as Pages Functions (functions/), so both layouts stay in sync.
import { onRequest as home } from "../functions/index.js";
import { onRequest as api } from "../functions/api/[[route]].js";

const MAIN = "qubicmap.org";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // One public address: preview hosts send visitors to qubicmap.org.
    if (url.hostname.endsWith(".pages.dev") || url.hostname.endsWith(".workers.dev")) {
      url.protocol = "https:";
      url.hostname = MAIN;
      url.port = "";
      return Response.redirect(url.toString(), 301);
    }
    const waitUntil = (p) => ctx.waitUntil(p);
    if (url.pathname.startsWith("/api/")) return api({ request, env, waitUntil });
    if (url.pathname === "/" || url.pathname === "/index.html")
      return home({ request, env, waitUntil, next: () => env.ASSETS.fetch(request) });
    return env.ASSETS.fetch(request);
  },
};
