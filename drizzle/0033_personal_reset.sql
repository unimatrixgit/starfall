CREATE TABLE IF NOT EXISTS personal_reset_rounds (
 generation INTEGER PRIMARY KEY,
 started_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS personal_reset_requests (
 planet_id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL,
 generation INTEGER NOT NULL,
 requested_at INTEGER NOT NULL,
 ready_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS personal_reset_snapshots (
 planet_id TEXT PRIMARY KEY,
 generation INTEGER NOT NULL,
 epoch INTEGER NOT NULL,
 state_json TEXT NOT NULL
);
