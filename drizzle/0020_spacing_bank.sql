CREATE TABLE spacing_bank_settings(id INTEGER PRIMARY KEY,data_json TEXT NOT NULL);
CREATE TABLE spacing_bank_round(generation INTEGER PRIMARY KEY,revision INTEGER NOT NULL DEFAULT 0,data_json TEXT NOT NULL);
CREATE TABLE spacing_bank_trades(id TEXT PRIMARY KEY,generation INTEGER NOT NULL,user_id TEXT NOT NULL,data_json TEXT NOT NULL,created_at INTEGER NOT NULL);
