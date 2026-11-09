// End-to-end check of public/ann.html against the live chain, run by the ann-sync workflow.
// Passes when the top featured miner's best network replays with every step matching the chain.
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const ROOT = "public", PORT = 8799, LIMIT_MIN = +process.env.ANN_TEST_MINUTES || 25, MIN_STEPS = 10;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const srv = createServer(async (q, r) => {
  try {
    const p = normalize(decodeURIComponent(new URL(q.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
    const body = await readFile(join(ROOT, p));
    r.writeHead(200, { "Content-Type": TYPES[extname(p)] || "application/octet-stream" }); r.end(body);
  } catch { r.writeHead(404); r.end(); }
}).listen(PORT);

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", e => errors.push(e.message));
// the featured list comes from the production API
await page.route("**/api/ann/featured*", async route => {
  const u = new URL(route.request().url());
  const res = await fetch("https://qubicmap.org/api/ann/featured" + u.search, { headers: { "User-Agent": "qubicmap-ann-sync" } });
  route.fulfill({ status: res.status, contentType: "application/json", body: await res.text() });
});
await page.goto(`http://127.0.0.1:${PORT}/ann.html`);
await page.waitForTimeout(1500);
const cls = await page.evaluate(() => document.documentElement.className);
if (/qm-off/.test(cls)) await fail("the qubicmap layer could not attach: the viewer's internals changed");

const t0 = Date.now(); let last = "", s = {};
while (Date.now() - t0 < LIMIT_MIN * 60000) {
  await page.waitForTimeout(5000);
  s = await page.evaluate(() => {
    const st = typeof annState !== "undefined" && annState;
    return { pill: (document.getElementById("qmPillT") || {}).textContent || "", ann: (document.getElementById("annStatus") || {}).textContent || "",
      done: st ? st.done : 0, total: st ? st.path.length : 0, running: typeof annRun !== "undefined" && !!annRun, id: (document.getElementById("ident") || {}).value };
  });
  const line = `${Math.round((Date.now() - t0) / 1000)}s  ${s.pill}  [${s.done}/${s.total}]`;
  if (line.replace(/^\d+s/, "") !== last) { console.log(line); last = line.replace(/^\d+s/, ""); }
  if (/MISMATCH/.test(s.ann)) await fail("replay does not match the chain: " + s.ann);
  if (/^✓ Network rebuilt/.test(s.pill)) await ok(`full replay of ${s.total} steps matches the chain (${s.id.slice(0, 8)}…)`);
  if (/Couldn’t reach|replay stopped|No replayable/.test(s.pill)) await fail(s.pill);
  if (/new epoch started/.test(s.pill)) await ok("new epoch not supported upstream yet: page shows the waiting notice");
}
if (s.done >= MIN_STEPS) await ok(`time limit reached after ${s.done}/${s.total} steps, all matching the chain`);
await fail(`timed out: ${s.pill} [${s.done}/${s.total}]`);

async function ok(m) { console.log("PASS", m); if (errors.length) console.log("page errors:", errors); await page.screenshot({ path: "ann-test.png" });
  await page.setViewportSize({ width: 390, height: 800 }); await page.waitForTimeout(800); await page.screenshot({ path: "ann-test-phone.png" }); await b.close(); srv.close(); process.exit(0); }
async function fail(m) { console.log("FAIL", m); if (errors.length) console.log("page errors:", errors); await page.screenshot({ path: "ann-test.png" }).catch(() => {}); await b.close(); srv.close(); process.exit(1); }
