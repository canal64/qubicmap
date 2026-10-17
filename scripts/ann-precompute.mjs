// Rebuilds one miner's best network with the live page (scan + replay checked against the chain)
// and saves it as public/ann/data/<id>.json so visitors get it instantly.
// Usage: node scripts/ann-precompute.mjs <identity> <epoch> <outDir>
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const [ID, EPOCH, OUT = "out"] = process.argv.slice(2);
if (!/^[A-Z]{60}$/.test(ID || "") || !/^\d+$/.test(EPOCH || "")) { console.error("usage: <identity> <epoch> [outDir]"); process.exit(2); }
const PORT = 8800 + Math.floor(Math.random() * 100), LIMIT_MIN = +process.env.ANN_MINUTES || 80;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const srv = createServer(async (q, r) => {
  try {
    const p = normalize(decodeURIComponent(new URL(q.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
    const body = await readFile(join("public", p));
    r.writeHead(200, { "Content-Type": TYPES[extname(p)] || "application/octet-stream" }); r.end(body);
  } catch { r.writeHead(404); r.end(); }
}).listen(PORT);

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1280, height: 800 } });
await page.route("**/api/ann/featured*", r => r.fulfill({ json: { items: [] } }));
await page.route("**/ann/data/**", r => r.fulfill({ status: 404, body: "" })); // force the live path
// a hash makes the viewer load this identity live; the qubicmap layer then replays the best leaf
await page.goto(`http://127.0.0.1:${PORT}/ann.html#${ID}/${EPOCH}`);
const t0 = Date.now(); let last = "";
for (;;) {
  await page.waitForTimeout(5000);
  const s = await page.evaluate(() => ({ pill: (document.getElementById("qmPillT") || {}).textContent || "", ann: (document.getElementById("annStatus") || {}).textContent || "" }));
  if (s.pill !== last) { console.log(Math.round((Date.now() - t0) / 1000) + "s", s.pill); last = s.pill; }
  if (/MISMATCH/.test(s.ann)) die("replay does not match the chain");
  if (/^✓ Network rebuilt/.test(s.pill)) break;
  if (/Couldn’t reach|replay stopped|No replayable|new epoch started/.test(s.pill)) die(s.pill);
  if (Date.now() - t0 > LIMIT_MIN * 60000) die("time limit");
}

const data = await page.evaluate(() => {
  const flat = a => [...a.links, ...a.init, ...a.lut];
  const path = annState.path, root = annCache.get(rootKey());
  let prev = flat(root.ann);
  const steps = path.map(x => {
    // changed cells as text: per change, the gap since the previous changed index (base-32 varint,
    // chars 'a'.. with continuation 'A'..) followed by the new value (one char of B64, values < 64)
    const c = annCache.get(x.key), cur = flat(c.ann), B64 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";
    let d = "", last = -1;
    for (let i = 0; i < cur.length; i++) if (cur[i] !== prev[i]) {
      if (cur[i] < 0 || cur[i] > 63) throw new Error("value out of range");
      let g = i - last - 1; last = i;
      while (g >= 32) { d += String.fromCharCode(65 + (g & 31)); g >>= 5; }
      d += String.fromCharCode(97 + g) + B64[cur[i]];
    }
    prev = cur;
    if (c.error !== x.s.log.score) throw new Error("mismatch at " + x.key);
    return { e: c.error, sh: c.shift, f: c.flips ? [c.flips.imp, c.flips.wor, c.flips.inert] : null, d };
  });
  const sols = path.map(x => { const s = JSON.parse(JSON.stringify(x.s)); if (s.log) { delete s.log.pubkey; if (s.log.nonce === s.nonce) delete s.log.nonce; } return s; });
  const all = [...treeData.nodes.values()];
  return { v: 3, id: curId, epoch: curEpoch.epoch, ctl: [ANN_CTRL, ANN_OUT], initialTick: curEpoch.initialTick, built: new Date().toISOString(),
    sizes: [root.ann.links.length, root.ann.init.length, root.ann.lut.length], root: flat(root.ann), sols, steps,
    tree: { solutions: all.length, accepted: all.filter(n => n.accepted).length } };
});
await mkdir(OUT, { recursive: true });
const json = JSON.stringify(data);
await writeFile(join(OUT, ID + ".json"), json);
console.log(`saved ${ID.slice(0, 8)}… epoch ${data.epoch}: ${data.steps.length} steps, ${(json.length / 1024).toFixed(0)} KB`);
await b.close(); srv.close(); process.exit(0);

async function die(m) { console.log("::error::FAIL " + m); await b.close(); srv.close(); process.exit(1); }
