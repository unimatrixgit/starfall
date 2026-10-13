CREATE TABLE scan_sharing (
  owner_id TEXT PRIMARY KEY NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
CREATE TABLE shared_scans (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  scan_id TEXT NOT NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  target_name TEXT NOT NULL,
  coords TEXT NOT NULL DEFAULT '',
  report TEXT NOT NULL,
  tick INTEGER NOT NULL,
  saved_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  anonymous INTEGER NOT NULL DEFAULT 0,
  UNIQUE(owner_id, scan_id)
);
CREATE INDEX shared_scans_recent ON shared_scans(saved_at DESC, id);
CREATE INDEX shared_scans_expiry ON shared_scans(expires_at);
CREATE INDEX shared_scans_planet ON shared_scans(coords, type);
CREATE TABLE portal_users (
  id TEXT PRIMARY KEY NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'player',
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE portal_sessions (
  token_hash TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES portal_users(id)
);
CREATE INDEX portal_sessions_expiry ON portal_sessions(expires_at);
