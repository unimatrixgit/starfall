CREATE TABLE IF NOT EXISTS alliance_key_disclosure(alliance_id TEXT NOT NULL,owner_user_id TEXT NOT NULL,phrase_hash TEXT NOT NULL,salt TEXT NOT NULL,updated_at INTEGER NOT NULL,PRIMARY KEY(alliance_id,owner_user_id));
CREATE TABLE IF NOT EXISTS key_disclosure_attempts(alliance_id TEXT NOT NULL,owner_user_id TEXT NOT NULL,admin_user_id TEXT NOT NULL,attempts INTEGER NOT NULL,started_at INTEGER NOT NULL,PRIMARY KEY(alliance_id,owner_user_id,admin_user_id));
CREATE TABLE IF NOT EXISTS account_access_logs(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,ip TEXT,path TEXT NOT NULL,method TEXT NOT NULL,status INTEGER NOT NULL,created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS account_access_log_date ON account_access_logs(created_at);
CREATE TABLE IF NOT EXISTS account_ip_history(user_id TEXT NOT NULL,ip TEXT NOT NULL,first_seen INTEGER NOT NULL,last_seen INTEGER NOT NULL,hits INTEGER NOT NULL,PRIMARY KEY(user_id,ip));
