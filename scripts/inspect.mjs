// Temporary: render pages in a browser and save a screenshot, the visible text and the links of each.
import { chromium } from "playwright"; import fs from "fs";
const pairs = (process.env.URLS || "").split(/\s+/).filter(Boolean).map((p) => [p.slice(0, p.indexOf("=")), p.slice(p.indexOf("=") + 1)]);
const b = await chromium.launch(); fs.mkdirSync("out", { recursive: true });
for (const [n, u] of pairs) {
  const p = await b.newPage({ viewport: { width: 1280, height: 900 }, userAgent: "Mozilla/5.0 (compatible; agent-local)" });
  try { await p.goto(u, { waitUntil: "networkidle", timeout: 45000 }); } catch (e) {}
  await p.waitForTimeout(5000);
  await p.screenshot({ path: `out/${n}.png`, fullPage: true }).catch(() => {});
  const t = await p.evaluate(() => document.body ? document.body.innerText : "").catch(() => "");
  const l = await p.$$eval("a[href]", (as) => as.map((a) => a.textContent.trim().slice(0, 60) + " | " + a.href)).catch(() => []);
  const inputs = await p.$$eval("input,textarea", (is) => is.map((i) => (i.placeholder || i.name || i.type))).catch(() => []);
  fs.writeFileSync(`out/${n}.txt`, t.slice(0, 20000) + "\n\n--- links ---\n" + l.join("\n") + "\n\n--- inputs ---\n" + inputs.join("\n"));
  await p.close();
}
await b.close();
