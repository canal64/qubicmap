-- Likes for the Qubic Ecosystem Map. One row per project and per visitor (a salted hash of the IP address, never the address itself).
CREATE TABLE IF NOT EXISTS likes (
  project TEXT NOT NULL, voter TEXT NOT NULL, ts INTEGER NOT NULL,
  PRIMARY KEY (project, voter)
);
CREATE INDEX IF NOT EXISTS likes_ts ON likes (ts);
CREATE INDEX IF NOT EXISTS likes_voter ON likes (voter, ts);
CREATE TABLE IF NOT EXISTS counts (project TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL, ts INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS suggestions (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, kind TEXT NOT NULL, name TEXT NOT NULL, url TEXT, note TEXT, contact TEXT, lang TEXT, voter TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS suggestions_ts ON suggestions (ts);
CREATE TABLE IF NOT EXISTS links (slug TEXT PRIMARY KEY, url TEXT NOT NULL, ok INTEGER NOT NULL, code INTEGER NOT NULL, ts INTEGER NOT NULL, fails INTEGER NOT NULL DEFAULT 0, since INTEGER);

-- Flappy Qubic: best score per visitor per Qubic epoch (weekly board).
CREATE TABLE IF NOT EXISTS scores (epoch INTEGER NOT NULL, voter TEXT NOT NULL, name TEXT NOT NULL, score INTEGER NOT NULL, ts INTEGER NOT NULL, PRIMARY KEY (epoch, voter));
CREATE INDEX IF NOT EXISTS scores_rank ON scores (epoch, score DESC);
