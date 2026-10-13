CREATE TABLE IF NOT EXISTS staff_planet_audit(id TEXT PRIMARY KEY,actor_id TEXT NOT NULL,actor_name TEXT NOT NULL,planet_id TEXT NOT NULL,planet_name TEXT NOT NULL,coords TEXT NOT NULL,action TEXT NOT NULL,changes_json TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS staff_planet_audit_time ON staff_planet_audit(created_at);
