// One-off: open each smart-contract project's homepage and list the public contact links it shows.
import { chromium } from "playwright";
const SITES = [["Quottery","https://app.quottery.org"],["My Last Match","https://mylastmatch.net/"],["Qearn","https://qearn.org"],["MSVault","https://msvault.org/"],
 ["QubicBay","https://qubicbay.io/"],["QSwap","https://qubicswap.com/"],["Nostromo","https://nostromo-qubic.com/"],["Random Lottery","https://www.qubicrl.org/"],
 ["QBond","https://www.qbond.org"],["Qubic ICO Portal","https://qubicico.com/"],["QRaffle","https://www.qraffles.com/"],["qMine / qRWA","https://qmine.io/"],["Qusino","https://qusino.com"]];
const KEEP = /(x\.com|twitter\.com|t\.me|telegram\.(me|org)|discord\.(gg|com\/invite)|github\.com|medium\.com|youtube\.com|linkedin\.com|mailto:)/i;
const b = await chromium.launch(); const out = [];
for (const [name, url] of SITES) {
  const p = await b.newPage({ userAgent: "Mozilla/5.0 (compatible; agent-local)" }); let links = [], emails = [], err = "";
  try {
    await p.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 }); await p.waitForTimeout(4000);
    links = await p.$$eval("a[href]", (as) => as.map((a) => a.href));
    const txt = await p.evaluate(() => document.body ? document.body.innerText : "");
    emails = [...new Set((txt.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/g) || []))];
  } catch (e) { err = String(e.message || e).slice(0, 120); }
  out.push({ name, url, links: [...new Set(links.filter((h) => KEEP.test(h)))], emails, err });
  await p.close();
}
await b.close();
console.log(JSON.stringify(out, null, 1));
