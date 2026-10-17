// Moves the rebuilt networks into public/ann/data and writes index.json (ranked as in $LIST).
// Networks that failed to rebuild today are left out; files of miners no longer listed are removed.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
const dir = process.argv[2] || "new", out = "public/ann/data";
const list = JSON.parse(process.env.LIST || "[]");
mkdirSync(out, { recursive: true });
const items = [];
for (const m of list) {
  const f = `${dir}/${m.id}.json`;
  if (!existsSync(f)) { console.log("missing", m.rank, m.id.slice(0, 8)); continue; }
  const d = JSON.parse(readFileSync(f, "utf8"));
  writeFileSync(`${out}/${m.id}.json`, JSON.stringify(d));
  items.push({ rank: m.rank, id: m.id, epoch: d.epoch, score: m.score, steps: d.steps.length, built: d.built, solutions: d.tree.solutions });
}
if (!items.length) { console.log("no network rebuilt"); process.exit(1); }
for (const f of readdirSync(out)) if (f.endsWith(".json") && f !== "index.json" && !items.some(i => f === i.id + ".json")) rmSync(`${out}/${f}`);
writeFileSync(`${out}/index.json`, JSON.stringify({ epoch: items[0].epoch, built: new Date().toISOString(), items }, null, 1) + "\n");
console.log("published", items.length, "networks");
