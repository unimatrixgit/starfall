-- SF-100 schema only. The runtime never performs DDL.
CREATE TABLE alliance_shipyards (
 alliance_id TEXT NOT NULL,
 generation INTEGER NOT NULL,
 revision INTEGER NOT NULL DEFAULT 0,
 data_json TEXT NOT NULL,
 PRIMARY KEY(alliance_id,generation)
);
CREATE TABLE alliance_shipyard_commands (
 id TEXT PRIMARY KEY,
 alliance_id TEXT NOT NULL,
 generation INTEGER NOT NULL,
 user_id TEXT NOT NULL,
 request_json TEXT NOT NULL,
 response_json TEXT NOT NULL,
 created_at INTEGER NOT NULL
);
CREATE INDEX alliance_shipyard_command_history ON alliance_shipyard_commands(alliance_id,generation,created_at);
-- Existing Launch Bay tables are reused, never a second fleet.
-- Schema-only bootstrap replaces any need for Shipyards request-time DDL.
CREATE TABLE IF NOT EXISTS alliance_fleet_readiness(
 planet_id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL,
 alliance_name TEXT NOT NULL,
 data_json TEXT NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS alliance_fleet_commands(
 id TEXT PRIMARY KEY,
 planet_id TEXT NOT NULL,
 alliance_name TEXT NOT NULL,
 created_by TEXT NOT NULL,
 data_json TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'Pending',
 created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS alliance_fleet_one_pending
 ON alliance_fleet_commands(planet_id,alliance_name) WHERE status='Pending';
