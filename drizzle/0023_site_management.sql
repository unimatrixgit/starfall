CREATE TABLE site_management(id INTEGER PRIMARY KEY,revision INTEGER NOT NULL DEFAULT 0,data_json TEXT NOT NULL,updated_by TEXT,updated_at INTEGER);
INSERT INTO site_management(id,data_json) VALUES(1,'{"roundHistoryDemo":true,"battleCalcTest":true}');
