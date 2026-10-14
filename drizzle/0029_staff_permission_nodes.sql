CREATE TABLE IF NOT EXISTS staff_role_permissions(role TEXT PRIMARY KEY,revision INTEGER NOT NULL DEFAULT 0,data_json TEXT NOT NULL,updated_by TEXT,updated_at INTEGER,operation_id TEXT);
CREATE TABLE IF NOT EXISTS staff_permission_audit(id TEXT PRIMARY KEY,actor_id TEXT NOT NULL,role TEXT NOT NULL,before_json TEXT NOT NULL,after_json TEXT NOT NULL,created_at INTEGER NOT NULL);
