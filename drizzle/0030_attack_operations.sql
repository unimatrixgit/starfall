CREATE TABLE IF NOT EXISTS alliance_attack_operations(id TEXT PRIMARY KEY,alliance_id TEXT NOT NULL,generation INTEGER NOT NULL,revision INTEGER NOT NULL DEFAULT 0,data_json TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS alliance_attack_operations_scope ON alliance_attack_operations(alliance_id,generation,created_at);
