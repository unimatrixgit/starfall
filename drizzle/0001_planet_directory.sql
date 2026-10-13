CREATE TABLE planet_directory_meta (
 id INTEGER PRIMARY KEY CHECK(id=1),
 revision INTEGER NOT NULL DEFAULT 0,
 operation_id TEXT NOT NULL DEFAULT ''
);
INSERT INTO planet_directory_meta(id) VALUES (1);
CREATE TABLE planet_directory (
 id TEXT PRIMARY KEY,
 kind TEXT NOT NULL CHECK(kind IN ('planet','structure')),
 coords TEXT NOT NULL UNIQUE,
 owner_id TEXT,
 data_json TEXT NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE INDEX planet_directory_owner ON planet_directory(owner_id);
CREATE TABLE planet_alliances (
 name TEXT PRIMARY KEY,
 data_json TEXT NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE TABLE alliance_intel (
 alliance_name TEXT NOT NULL,
 coords TEXT NOT NULL,
 status TEXT NOT NULL,
 note TEXT NOT NULL,
 tick INTEGER NOT NULL,
 updated_by TEXT NOT NULL,
 updated_at INTEGER NOT NULL,
 PRIMARY KEY(alliance_name,coords)
);
