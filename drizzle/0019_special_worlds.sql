CREATE TABLE IF NOT EXISTS planet_enrolments(user_id TEXT PRIMARY KEY,generation INTEGER NOT NULL,planet_type TEXT NOT NULL,confirmed INTEGER NOT NULL DEFAULT 0);
ALTER TABLE planet_enrolments ADD COLUMN rerolls INTEGER NOT NULL DEFAULT 0;
ALTER TABLE planet_enrolments ADD COLUMN unique_key TEXT;
CREATE UNIQUE INDEX enrolment_unique_world ON planet_enrolments(generation,unique_key) WHERE unique_key IS NOT NULL;
CREATE TABLE world_announcements(id TEXT PRIMARY KEY,generation INTEGER NOT NULL,world_id TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE earth_salvage_receipts(id TEXT PRIMARY KEY,generation INTEGER NOT NULL,earth_id TEXT NOT NULL,metal INTEGER NOT NULL,crystal INTEGER NOT NULL,eonium INTEGER NOT NULL,created_at INTEGER NOT NULL);

ALTER TABLE planet_enrolments ADD COLUMN previous_type TEXT NOT NULL DEFAULT '';
