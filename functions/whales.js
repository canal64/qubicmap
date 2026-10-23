// Whales: the latest large QU transfers, read from a public Bob node.
// Bob's qubic_getLogs returns every QU_TRANSFER of a tick range in one call, so the 2-minute cron
// needs only a handful of requests (well inside the free plan) to cover every tick.
const BOB = "https://bob.qubic.li/qubic";
const UA = { "User-Agent": "qubicmap-whales", "Content-Type": "application/json" };
const MIN_QU = 10_000_000_000;      // what counts as a whale transfer
const CHUNK = 100;                  // ticks per getLogs call
const MAX_TICKS = 600;              // per cron run; older backlog is skipped
const KEEP = 30;                    // transfers kept for the home page
const LAG = 5;                      // stay a few ticks behind Bob's indexer

// Smart contract identities: the contract index sits in the first 14 letters, all others are "A".
const SC = { 1: "QX", 2: "Quottery", 4: "QUtil", 5: "My Last Match", 8: "CCF", 9: "Qearn", 11: "MSVault", 12: "QubicBay", 13: "QSwap",
  14: "Nostromo", 16: "Random Lottery", 17: "QBond", 18: "ICO Portal", 19: "QRaffle", 20: "qMine", 26: "Qusino" };
export function label(id) {
  if (!/^[A-Z]{60}$/.test(id || "") || !/^A+$/.test(id.slice(14, 56))) return "";
  let n = 0;
  for (let i = 13; i >= 0; i--) n = n * 26 + (id.charCodeAt(i) - 65);
  if (n === 0) return "burn";
  return SC[n] || "SC " + n;
}

async function call(method, params) {
  const r = await fetch(BOB, { method: "POST", headers: UA, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error("bob http " + r.status);
  const j = await r.json();
  if (j.error) throw new Error("bob " + (j.error.message || "error"));
  return j.result;
}
async function logs(from, to, out, depth = 0) {
  const res = await call("qubic_getLogs", [{ fromTick: from, toTick: to, logType: 0 }]);
  const list = Array.isArray(res) ? res : [];
  // If Bob ever caps a reply, split the range so nothing is missed.
  if (list.length >= 1000 && to > from && depth < 3) {
    const mid = Math.floor((from + to) / 2);
    await logs(from, mid, out, depth + 1);
    await logs(mid + 1, to, out, depth + 1);
    return;
  }
  for (const l of list) {
    const amt = Number(l.amount);
    if (l.logType === 0 && amt >= MIN_QU && l.source && l.destination)
      out.push({ h: String(l.transactionHash || ""), t: l.tick, f: l.source, d: l.destination, a: amt, id: l.logId });
  }
}

export async function refreshWhales(env) {
  const now = Date.now();
  const st = await env.DB.prepare("SELECT v FROM kv WHERE k = 'whale_state'").first();
  const state = st ? JSON.parse(st.v) : {};
  const tip = Number(await call("qubic_getTickNumber", [])) - LAG;
  if (!tip) return;
  let from = state.last ? state.last + 1 : tip - 300;
  if (tip - from > MAX_TICKS) from = tip - MAX_TICKS;
  const found = [];
  let ok = from - 1;
  try {
    for (let a = from; a <= tip; a += CHUNK) { await logs(a, Math.min(tip, a + CHUNK - 1), found); ok = Math.min(tip, a + CHUNK - 1); }
  } catch (e) {
    if (ok < from) throw e;     // keep what was read; the next run resumes from there
  }
  const row = await env.DB.prepare("SELECT v FROM kv WHERE k = 'whales'").first();
  const prev = row ? JSON.parse(row.v) : [];
  const seen = new Set(prev.map((w) => w.h + ":" + w.id));
  // Approximate time: Bob's log entries carry no timestamp, so place each tick back from now at ~2 ticks a second.
  const fresh = found.filter((w) => !seen.has(w.h + ":" + w.id)).map((w) => ({ ...w, s: now - Math.max(0, tip - w.t) * 500, fl: label(w.f), dl: label(w.d) }));
  const list = [...fresh, ...prev].sort((x, y) => y.t - x.t).slice(0, KEEP);
  // Biggest transfer of each epoch, for the weekly recap (/week).
  const ep = 234 + Math.floor((now - Date.UTC(2026, 9, 7, 12, 0, 0)) / (7 * 86400000));
  const top = fresh.reduce((m, w) => (!m || w.a > m.a ? w : m), null);
  if (top) {
    const mx = await env.DB.prepare("SELECT v FROM kv WHERE k = ?1").bind("whale_max:" + ep).first();
    if (!mx || JSON.parse(mx.v).a < top.a)
      await env.DB.prepare("INSERT INTO kv (k, v, ts) VALUES (?1, ?2, ?3) ON CONFLICT(k) DO UPDATE SET v = ?2, ts = ?3").bind("whale_max:" + ep, JSON.stringify(top), now).run();
  }
  const stmts = [env.DB.prepare("INSERT INTO kv (k, v, ts) VALUES ('whale_state', ?1, ?2) ON CONFLICT(k) DO UPDATE SET v = ?1, ts = ?2").bind(JSON.stringify({ last: ok, run: now, n: found.length }), now)];
  if (fresh.length || !row) stmts.push(env.DB.prepare("INSERT INTO kv (k, v, ts) VALUES ('whales', ?1, ?2) ON CONFLICT(k) DO UPDATE SET v = ?1, ts = ?2").bind(JSON.stringify(list), now));
  await env.DB.batch(stmts);
}

export async function whales(env) {
  const [row, st] = await Promise.all([env.DB.prepare("SELECT v FROM kv WHERE k = 'whales'").first(), env.DB.prepare("SELECT v FROM kv WHERE k = 'whale_state'").first()]);
  const state = st ? JSON.parse(st.v) : {};
  return { l: row ? JSON.parse(row.v).slice(0, 12) : [], t: state.last || 0, r: state.run || 0 };
}
