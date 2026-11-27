// Like totals for the whole map ({ counts, week }), kept as one row in kv.
// Counting the likes table on every visit read ~1,700 rows each time and used most of the free D1 quota;
// now the totals are counted again only after a like changes, or once an hour for the 7-day window.
const DAY = 86400000, MAX_AGE = 3600000;
export async function likeTotals(env) {
  const row = await env.DB.prepare("SELECT v, ts FROM kv WHERE k = 'likes_agg'").first().catch(() => null);
  if (row && row.v && Date.now() - row.ts < MAX_AGE) { try { return JSON.parse(row.v); } catch (e) {} }
  const [all, recent] = await Promise.all([
    env.DB.prepare("SELECT project, count(*) AS n FROM likes GROUP BY project").all(),
    env.DB.prepare("SELECT project, count(*) AS n FROM likes WHERE ts > ?1 GROUP BY project").bind(Date.now() - 7 * DAY).all(),
  ]);
  const counts = {}, week = {};
  for (const r of all.results) counts[r.project] = r.n;
  for (const r of recent.results) week[r.project] = r.n;
  const body = { counts, week };
  await env.DB.prepare("INSERT INTO kv (k, v, ts) VALUES ('likes_agg', ?1, ?2) ON CONFLICT(k) DO UPDATE SET v = ?1, ts = ?2")
    .bind(JSON.stringify(body), Date.now()).run().catch(() => {});
  return body;
}
// after a like or unlike: the next read counts again
export const dropLikeTotals = (env) => env.DB.prepare("UPDATE kv SET ts = 0 WHERE k = 'likes_agg'").run().catch(() => {});
