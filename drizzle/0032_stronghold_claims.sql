-- SF-049: additive schema only; no resets, moves or asset deletion.

CREATE TABLE IF NOT EXISTS stronghold_states(generation INTEGER PRIMARY KEY,data_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS stronghold_claims(generation INTEGER NOT NULL,id TEXT NOT NULL,galaxy TEXT NOT NULL,alliance_id TEXT NOT NULL,status TEXT NOT NULL,PRIMARY KEY(generation,id));
CREATE UNIQUE INDEX IF NOT EXISTS stronghold_galaxy_exclusive ON stronghold_claims(generation,galaxy) WHERE status IN ('active','inactive');
CREATE UNIQUE INDEX IF NOT EXISTS stronghold_alliance_exclusive ON stronghold_claims(generation,alliance_id) WHERE status IN ('active','inactive');
CREATE TABLE IF NOT EXISTS stronghold_operations(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,payload TEXT NOT NULL,response_json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS stronghold_audit(id TEXT PRIMARY KEY,generation INTEGER NOT NULL,user_id TEXT NOT NULL,action TEXT NOT NULL,data_json TEXT NOT NULL,created_at INTEGER NOT NULL);