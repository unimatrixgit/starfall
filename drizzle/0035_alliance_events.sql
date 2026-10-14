CREATE TABLE IF NOT EXISTS alliance_events(id TEXT PRIMARY KEY,generation INTEGER NOT NULL,alliance_id TEXT NOT NULL,actor_id TEXT NOT NULL,type TEXT NOT NULL,data_json TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS alliance_events_scope ON alliance_events(generation,alliance_id,created_at);
CREATE TABLE IF NOT EXISTS alliance_event_recipients(event_id TEXT NOT NULL,user_id TEXT NOT NULL,PRIMARY KEY(event_id,user_id));
CREATE TABLE IF NOT EXISTS alliance_policy_operations(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,payload TEXT NOT NULL,response_json TEXT NOT NULL);
