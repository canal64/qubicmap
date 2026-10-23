// Server-rendered pages: one page per project (/p/<slug>), the weekly epoch recap (/week) and an RSS feed (/feed.xml).
import P, { CATS } from "../lib/projects.js";

const SITE = "https://qubicmap.org";
const EPOCH0 = Date.UTC(2026, 9, 7, 12, 0, 0), EPOCH0_N = 234, WEEK = 7 * 86400000;
const epochNow = (t = Date.now()) => EPOCH0_N + Math.floor((t - EPOCH0) / WEEK);
const epochStart = (n) => EPOCH0 + (n - EPOCH0_N) * WEEK;
const ST = { live: "Live", test: "Testnet", hold: "Upgrading", chain: "Contract only", early: "Early stage", na: "Not checked", dev: "In development" };
const CAT = Object.fromEntries(CATS.map((c) => [c[0], c]));
const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
const fmt = (n) => Number(n || 0).toLocaleString("en-US");
const short = (id) => String(id || "").slice(0, 6) + "…" + String(id || "").slice(-6);

// Shared look: the site's dark theme, plus the light theme chosen on the home page (stored as qem.theme).
const HEAD = (title, desc, url, img) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${url}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Qubic Ecosystem Map"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${img}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${img}">
<meta name="theme-color" content="#04070c"><link rel="manifest" href="/manifest.webmanifest"><link rel="apple-touch-icon" href="/icons/icon-180.png"><link rel="alternate" type="application/rss+xml" title="Qubic Ecosystem Map" href="/feed.xml">
<script>try{if(localStorage.getItem("qem.theme")==="light")document.documentElement.setAttribute("data-theme","light")}catch(e){}</script>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@600;700&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500&display=swap">
<style>
:root{color-scheme:dark;--void:#04070c;--panel:#0a1019;--rule:#182434;--ink:#dfe9f3;--muted:#7f93a8;--ice:#cfe6ff;--live:#62d6a0;--warn:#f1bb5c;
  --display:"Chakra Petch",system-ui,sans-serif;--sans:"IBM Plex Sans",system-ui,-apple-system,"Segoe UI",sans-serif;--mono:"IBM Plex Mono",ui-monospace,Menlo,monospace}
:root[data-theme="light"]{color-scheme:light;--void:#f4f6f9;--panel:#ffffff;--rule:#d5dde6;--ink:#0b1220;--muted:#566577;--ice:#1f5fa8;--live:#14865a;--warn:#a86b00}
*{box-sizing:border-box}body{margin:0;background:var(--void);color:var(--ink);font:16px/1.55 var(--sans)}
a{color:var(--ice);text-underline-offset:3px}
.wrap{max-width:860px;margin:0 auto;padding:22px 16px 60px}
.back{font:13px var(--mono);color:var(--muted)}.back a{color:inherit}
.k{font:500 12px var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
h1{margin:10px 0 6px;font:700 clamp(36px,8vw,64px)/1.02 var(--display);letter-spacing:.01em}
.tags{display:flex;flex-wrap:wrap;gap:8px 16px;font:13px var(--mono);color:var(--muted);margin-top:8px}
.tags b{font-weight:500;color:var(--ink)}.tags .live{color:var(--live)}
.shot{margin-top:22px;border:1px solid var(--rule);background:var(--panel);aspect-ratio:16/9;overflow:hidden}
.shot img{width:100%;display:block}
p.d{font-size:18px;max-width:62ch;margin:20px 0 0}
.btns{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}
.btn{font:600 13px var(--display);letter-spacing:.1em;text-transform:uppercase;text-decoration:none;border:1px solid var(--rule);background:var(--panel);color:var(--ink);padding:12px 16px;cursor:pointer}
.btn.main{background:var(--ice);color:var(--void);border-color:var(--ice)}
section{margin-top:40px;border-top:1px solid var(--rule);padding-top:18px}
h2{margin:0 0 10px;font:700 18px var(--display);letter-spacing:.08em;text-transform:uppercase}
pre{white-space:pre-wrap;word-break:break-all;font:12.5px/1.5 var(--mono);background:var(--panel);border:1px solid var(--rule);padding:12px;margin:12px 0 0;color:var(--muted)}
.row{display:grid;grid-template-columns:minmax(120px,max-content) 1fr;gap:8px 18px;font-size:15px}
.row dt{font:12px var(--mono);color:var(--muted);padding-top:3px;text-transform:uppercase;letter-spacing:.1em}.row dd{margin:0;overflow-wrap:anywhere}
canvas{width:100%;height:auto;display:block;border:1px solid var(--rule);margin-top:16px}
footer{margin-top:40px;font:12.5px var(--mono);color:var(--muted)}
</style></head><body><div class="wrap">`;
const FOOT = `<footer>Qubic Ecosystem Map · community register, not affiliated with the Qubic team · <a href="/feed.xml">RSS</a></footer></div></body></html>`;
const html = (body, status = 200, maxAge = 300) => new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": `public, max-age=${maxAge}` } });

export async function projectPage(request, env, slug) {
  const p = P.find((x) => x.s === slug);
  if (!p) return null;
  const c = CAT[p.c] || [p.c, p.c, ""];
  const [m, lk] = await Promise.all([
    env.DB.prepare("SELECT shot_ts, logo_ts FROM media WHERE slug = ?1").bind(slug).first().catch(() => null),
    env.DB.prepare("SELECT count(*) AS n FROM likes WHERE project = ?1").bind(slug).first().catch(() => null),
  ]);
  const url = SITE + "/p/" + slug, title = p.n + " · Qubic Ecosystem Map";
  const snippet = `<a href="${url}"><img src="${SITE}/badge.svg" alt="Listed on qubicmap.org" width="190" height="40"></a>`;
  const shot = m && m.shot_ts ? `<div class="shot"><img src="/m/s/${slug}.jpg?v=${Math.round(m.shot_ts / 1000)}" alt="${esc(p.n)} website" loading="lazy"></div>` : "";
  const xText = `${p.n} on the Qubic Ecosystem Map: ${p.d}`.slice(0, 220);
  return html(HEAD(title, p.d, url, SITE + "/og/" + slug + ".png") + `
<div class="back"><a href="/#${slug}">← Qubic Ecosystem Map</a></div>
<div class="k" style="margin-top:26px">${esc(c[1])}</div>
<h1>${esc(p.n)}</h1>
<div class="tags"><span class="${p.st === "live" ? "live" : ""}">● ${esc(ST[p.st] || p.st)}</span>${p.sc ? `<span>Smart contract <b>SC ${String(p.sc).padStart(2, "0")}</b> of the Qubic core</span>` : ""}<span>♥ <b>${fmt(lk && lk.n)}</b> likes</span>${p.a ? `<span>On the map since <b>${esc(p.a)}</b></span>` : ""}</div>
${shot}
<p class="d">${esc(p.d)}</p>
<div class="btns"><a class="btn main" href="${esc(p.u)}" target="_blank" rel="noopener">Open ${esc(host(p.u))} ↗</a><a class="btn" href="/#${slug}">See it on the map</a><button class="btn" type="button" id="cp">Copy link</button><a class="btn" href="https://x.com/intent/post?text=${encodeURIComponent(xText)}&url=${encodeURIComponent(url)}" target="_blank" rel="noopener">Post on X</a></div>
<section><h2>${esc(c[1])}</h2><p style="margin:0;color:var(--muted)">${esc(c[2])}</p></section>
<section><h2>Listed on qubicmap.org</h2><p style="margin:0;color:var(--muted)">Is this your project? Add this badge to your site. It links back to this page.</p>
<p style="margin:14px 0 0"><img src="/badge.svg" alt="Listed on qubicmap.org" width="190" height="40"> &nbsp; <img src="/badge-light.svg" alt="Listed on qubicmap.org (light)" width="190" height="40"></p>
<pre id="snip">${esc(snippet)}</pre><div class="btns"><button class="btn" type="button" id="cps">Copy badge code</button></div>
<p style="margin:10px 0 0;font:12.5px var(--mono);color:var(--muted)">For a light background, use badge-light.svg instead of badge.svg.</p></section>
<script>
function cp(t,b,l){function ok(){b.textContent="Copied ✓";setTimeout(function(){b.textContent=l},1800)}try{navigator.clipboard.writeText(t).then(ok)}catch(e){}}
document.getElementById("cp").onclick=function(){cp(${JSON.stringify(url)},this,"Copy link")};
document.getElementById("cps").onclick=function(){cp(document.getElementById("snip").textContent,this,"Copy badge code")};
</script>` + FOOT);
}

async function weekData(env, ep) {
  const start = epochStart(ep), end = start + WEEK;
  const [champ, teams, wmax, rel] = await Promise.all([
    env.DB.prepare("SELECT name, score, team FROM bubble_scores WHERE epoch = ?1 ORDER BY score DESC, ts ASC LIMIT 1").bind(ep).first().catch(() => null),
    env.DB.prepare("SELECT team, sum(score) AS score, count(*) AS players FROM bubble_scores WHERE epoch = ?1 AND team != '' GROUP BY team ORDER BY score DESC LIMIT 1").bind(ep).first().catch(() => null),
    env.DB.prepare("SELECT v FROM kv WHERE k = ?1").bind("whale_max:" + ep).first().catch(() => null),
    env.DB.prepare("SELECT v FROM kv WHERE k = 'ghrel'").first().catch(() => null),
  ]);
  const added = P.filter((p) => p.a && Date.parse(p.a + "T12:00:00Z") >= start && Date.parse(p.a + "T12:00:00Z") < end);
  return { ep, start, end, champ, team: teams, whale: wmax ? JSON.parse(wmax.v) : null, rel: rel ? JSON.parse(rel.v) : null, added };
}

export async function weekPage(request, env) {
  const u = new URL(request.url), cur = epochNow();
  let ep = Number(u.searchParams.get("epoch")) || cur - 1;
  if (ep < EPOCH0_N || ep > cur) ep = cur - 1;
  const w = await weekData(env, ep);
  const live = ep === cur;
  const d = (t) => new Date(t).toUTCString().slice(5, 16);
  const rows = [];
  if (w.rel) rows.push(["Core release", `<a href="${esc(w.rel.u)}" target="_blank" rel="noopener">${esc(w.rel.v)}</a>${w.rel.ep ? " · for epoch " + w.rel.ep : ""}`]);
  rows.push(["Qubic Bubble", w.champ ? `${live ? "Leader" : "Champion"}: <b>${esc(w.champ.name)}</b>${w.champ.team ? " (Team " + esc(w.champ.team) + ")" : ""} · ${fmt(w.champ.score)} pts` : "No score this epoch"]);
  if (w.team) rows.push(["Best team", `Team <b>${esc(w.team.team)}</b> · ${fmt(w.team.score)} pts from ${w.team.players} player${w.team.players > 1 ? "s" : ""}`]);
  rows.push(["Biggest whale", w.whale ? `<b>${fmt(w.whale.a)} QU</b> · ${esc(w.whale.fl ? "[" + w.whale.fl + "]" : short(w.whale.f))} → ${esc(w.whale.dl ? "[" + w.whale.dl + "]" : short(w.whale.d))} · <a href="https://explorer.qubic.org/network/tx/${esc(w.whale.h)}" target="_blank" rel="noopener">tx ↗</a>` : "Not tracked for this epoch"]);
  rows.push(["New on the map", w.added.length ? w.added.map((p) => `<a href="/p/${p.s}">${esc(p.n)}</a>`).join(", ") : "No new project"]);
  const card = { ep, live, dates: d(w.start) + " → " + d(w.end), rel: w.rel ? w.rel.v : "", champ: w.champ ? w.champ.name + (w.champ.team ? " · " + w.champ.team : "") + " · " + fmt(w.champ.score) : "", team: w.team ? w.team.team : "", whale: w.whale ? fmt(w.whale.a) + " QU" : "", added: w.added.map((p) => p.n) };
  const nav = `<div class="btns" style="margin-top:12px">${ep > EPOCH0_N ? `<a class="btn" href="/week?epoch=${ep - 1}">← Epoch ${ep - 1}</a>` : ""}${ep < cur ? `<a class="btn" href="/week?epoch=${ep + 1}">Epoch ${ep + 1}${ep + 1 === cur ? " (so far)" : ""} →</a>` : ""}</div>`;
  const xText = `Qubic epoch ${ep} ${live ? "so far" : "recap"} on the Qubic Ecosystem Map` + (card.rel ? ` · core ${card.rel}` : "") + (card.whale ? ` · biggest whale ${card.whale}` : "") + (card.champ ? ` · Qubic Bubble ${live ? "leader" : "champion"} ${w.champ.name}` : "");
  return html(HEAD(`Qubic epoch ${ep} ${live ? "so far" : "recap"} · Qubic Ecosystem Map`, `What happened on Qubic in epoch ${ep}: core release, biggest whale, arcade champion and new projects.`, SITE + "/week?epoch=" + ep, SITE + "/cover.jpg") + `
<div class="back"><a href="/">← Qubic Ecosystem Map</a></div>
<div class="k" style="margin-top:26px">${live ? "Epoch in progress" : "Weekly recap"} · ${esc(card.dates)}</div>
<h1>Epoch ${ep}</h1>${nav}
<section><dl class="row">${rows.map((r) => `<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join("")}</dl></section>
<section><h2>Share card</h2><canvas id="cv" width="1200" height="675" aria-label="Epoch ${ep} recap card"></canvas>
<div class="btns"><button class="btn main" type="button" id="dl">Download image</button><a class="btn" href="https://x.com/intent/post?text=${encodeURIComponent(xText)}&url=${encodeURIComponent(SITE + "/week?epoch=" + ep)}" target="_blank" rel="noopener">Post on X</a></div></section>
<script>
var C=${JSON.stringify(card).replace(/</g, "\\u003c").replace(/[\u2028\u2029]/g, "")};
function draw(){var k=document.getElementById("cv"),g=k.getContext("2d"),W=1200,H=675,D="'Chakra Petch',system-ui,sans-serif",M="'IBM Plex Mono',monospace";
  g.fillStyle="#04070c";g.fillRect(0,0,W,H);g.strokeStyle="#0c131d";for(var x=0;x<=W;x+=60){g.beginPath();g.moveTo(x+.5,0);g.lineTo(x+.5,H);g.stroke()}for(var y=0;y<=H;y+=60){g.beginPath();g.moveTo(0,y+.5);g.lineTo(W,y+.5);g.stroke()}
  g.fillStyle="#3ef0ff";g.fillRect(0,0,W,8);
  g.font="500 22px "+M;g.fillStyle="#7f93a8";g.fillText((C.live?"EPOCH IN PROGRESS":"WEEKLY RECAP")+"  ·  "+C.dates.toUpperCase(),70,80);
  g.font="700 96px "+D;g.fillStyle="#dfe9f3";g.fillText("EPOCH "+C.ep,64,180);
  var rows=[["CORE RELEASE",C.rel||"—"],["BIGGEST WHALE",C.whale||"—"],["QUBIC BUBBLE "+(C.live?"LEADER":"CHAMPION"),C.champ||"—"],["BEST TEAM",C.team?"Team "+C.team:"—"],["NEW ON THE MAP",C.added.length?C.added.join(", "):"—"]],y0=250;
  rows.forEach(function(r,i){var y=y0+i*64;g.font="500 18px "+M;g.fillStyle="#3ef0ff";g.fillText(r[0],70,y);g.font="600 30px "+D;g.fillStyle="#dfe9f3";var t=r[1];while(g.measureText(t).width>1000&&t.length>4)t=t.slice(0,-2);if(t!==r[1])t+="…";g.fillText(t,70,y+34)});
  g.fillStyle="#cfe6ff";g.fillRect(1040,560,24,58);g.fillRect(1072,560,24,78);
  g.font="700 26px "+D;g.fillStyle="#dfe9f3";g.fillText("QUBIC ECOSYSTEM MAP",70,632);g.font="400 22px "+M;g.fillStyle="#7f93a8";g.fillText("qubicmap.org/week",440,632)}
(document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(draw);draw();
document.getElementById("dl").onclick=function(){document.getElementById("cv").toBlob(function(b){var u=URL.createObjectURL(b),a=document.createElement("a");a.href=u;a.download="qubic-epoch-"+C.ep+".png";document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(u)},4000)},"image/png")};
</script>` + FOOT, 200, 120);
}

export async function feed(request, env) {
  const items = [];
  const rel = await env.DB.prepare("SELECT v FROM kv WHERE k = 'ghrel'").first().catch(() => null);
  if (rel) { const r = JSON.parse(rel.v); items.push({ t: `Qubic core ${r.v}${r.ep ? " for epoch " + r.ep : ""}`, l: r.u, d: (r.n || []).join(" · ") || r.t, at: Date.parse(r.d) || Date.now() }); }
  const cur = epochNow();
  for (let ep = cur - 1; ep >= Math.max(EPOCH0_N, cur - 6); ep--)
    items.push({ t: `Epoch ${ep} recap`, l: SITE + "/week?epoch=" + ep, d: `What happened on Qubic in epoch ${ep}: core release, biggest whale, arcade champion and new projects.`, at: epochStart(ep + 1) });
  for (const p of P.filter((x) => x.a)) items.push({ t: `New on the map: ${p.n}`, l: SITE + "/p/" + p.s, d: p.d, at: Date.parse(p.a + "T12:00:00Z") });
  items.sort((a, b) => b.at - a.at);
  const x = (v) => esc(v);
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>Qubic Ecosystem Map</title><link>${SITE}/</link><atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/><description>New Qubic projects, core releases and weekly epoch recaps from the Qubic Ecosystem Map.</description><language>en</language>
${items.slice(0, 40).map((i) => `<item><title>${x(i.t)}</title><link>${x(i.l)}</link><guid isPermaLink="false">${x(i.l)}#${i.at}</guid><pubDate>${new Date(i.at).toUTCString()}</pubDate><description>${x(i.d)}</description></item>`).join("\n")}
</channel></rss>`;
  return new Response(body, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=600" } });
}
