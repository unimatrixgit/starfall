ALTER TABLE planet_directory_meta ADD COLUMN reset_generation INTEGER NOT NULL DEFAULT 0;
CREATE TABLE portal_profiles(user_id TEXT PRIMARY KEY,display_name TEXT NOT NULL DEFAULT '',theme TEXT NOT NULL DEFAULT 'Neutral');
CREATE UNIQUE INDEX portal_users_username_ci ON portal_users(lower(username));
