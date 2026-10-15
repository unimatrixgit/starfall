CREATE TABLE galaxy_fund_trades (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL,
 galaxy TEXT NOT NULL,
 generation INTEGER NOT NULL,
 data_json TEXT NOT NULL,
 created_at INTEGER NOT NULL
);
CREATE INDEX galaxy_fund_trades_history ON galaxy_fund_trades(user_id,generation,galaxy,created_at);
