CREATE TABLE IF NOT EXISTS alliance_registry (
 name_key TEXT PRIMARY KEY,
 alliance_id TEXT NOT NULL,
 name TEXT NOT NULL,
 attributes_json TEXT NOT NULL,
 created_by TEXT NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS alliance_registry_id ON alliance_registry(alliance_id);
CREATE TABLE IF NOT EXISTS alliance_owner_keys (
 alliance_id TEXT NOT NULL,
 owner_user_id TEXT NOT NULL,
 key_hash TEXT NOT NULL UNIQUE,
 key_encrypted TEXT NOT NULL,
 revoked_at INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL,
 PRIMARY KEY(alliance_id,owner_user_id)
);
