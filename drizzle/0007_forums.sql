CREATE TABLE IF NOT EXISTS forum_threads (id TEXT PRIMARY KEY,scope TEXT NOT NULL,alliance_name TEXT NOT NULL DEFAULT '',title TEXT NOT NULL,author_id TEXT NOT NULL,author_name TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS forum_posts (id TEXT PRIMARY KEY,thread_id TEXT NOT NULL,author_id TEXT NOT NULL,author_name TEXT NOT NULL,body TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS forum_posts_thread ON forum_posts(thread_id,created_at);
CREATE INDEX IF NOT EXISTS forum_threads_scope ON forum_threads(scope,alliance_name,updated_at);
