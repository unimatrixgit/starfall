CREATE TABLE IF NOT EXISTS alliance_battlegroups (
 alliance_id TEXT NOT NULL,
 generation INTEGER NOT NULL,
 revision INTEGER NOT NULL DEFAULT 0,
 data_json TEXT NOT NULL,
 PRIMARY KEY (alliance_id,generation)
);
