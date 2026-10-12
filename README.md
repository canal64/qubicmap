# Qubic Ecosystem Map — https://qubicmap.org

Community directory of the Qubic ecosystem, hosted on Cloudflare Pages.
Every push to `main` is published automatically by Cloudflare.

- `public/` — the site (page, share image, sitemap, robots)
- `functions/` — server code: home page data (likes, blog headlines, link status), likes and suggestion API, redirect from the old address
- `lib/links.js` — list of links checked automatically (generated)
- `source/` — page source and the build script that produces `public/index.html` and `lib/links.js`
- `schema.sql` — database tables (already applied)
- `wrangler.toml` — Cloudflare configuration (D1 database binding `DB`)

Build after editing the source: `python3 source/build.py` (paths inside expect the working copy layout used to maintain the site).
