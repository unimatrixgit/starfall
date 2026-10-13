CREATE TABLE IF NOT EXISTS alliance_fleet_readiness(planet_id TEXT PRIMARY KEY,user_id TEXT NOT NULL,alliance_name TEXT NOT NULL,data_json TEXT NOT NULL,updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS alliance_fleet_commands(id TEXT PRIMARY KEY,planet_id TEXT NOT NULL,alliance_name TEXT NOT NULL,created_by TEXT NOT NULL,data_json TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'Pending',created_at INTEGER NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS alliance_fleet_one_pending ON alliance_fleet_commands(planet_id,alliance_name) WHERE status='Pending';
