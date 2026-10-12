# Qubic Ecosystem Map — https://qubicmap.org

Community directory of the Qubic ecosystem, deployed as a Cloudflare Worker.
Every push to `main` is built and published automatically by Cloudflare (Workers Builds, `npx wrangler deploy`).

- `public/` — the site (page, share image, sitemap, robots), served as static assets
- `src/worker.js` — entry point: redirects preview hosts to qubicmap.org, routes `/api/*` and the home page
- `functions/index.js` — home page data injected into the HTML (likes, Qubic blog headlines, link status, link checks)
- `functions/api/[[route]].js` — likes (`/api/likes`, `/api/like`) and suggestion form (`/api/suggest`)
- `lib/links.js` — list of links checked automatically (generated)
- `source/` — page source and the build script that produces `public/index.html` and `lib/links.js`
- `schema.sql` — D1 tables (already applied to the `qubicmap` database)
