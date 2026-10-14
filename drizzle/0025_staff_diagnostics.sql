CREATE TABLE IF NOT EXISTS staff_diagnostic_reports (id TEXT PRIMARY KEY, author_id TEXT NOT NULL, author_name TEXT NOT NULL, created_at INTEGER NOT NULL, version TEXT NOT NULL, status TEXT NOT NULL, report_json TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS staff_diagnostic_reports_created ON staff_diagnostic_reports(created_at DESC);
