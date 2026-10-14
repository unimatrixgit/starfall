-- Schema only: activation is a separate, disabled-by-default privileged operation.
CREATE TABLE memorial_ghosts (
 id TEXT PRIMARY KEY,
 coords TEXT NOT NULL UNIQUE,
 name TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 memorial_url TEXT NOT NULL DEFAULT '',
 activated_at INTEGER NOT NULL
);
