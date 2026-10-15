-- SF-111: explicitly requested cleanup of ALL ingame forum posts after the prior round reset.
-- No round-generation update: do not reset newly registered colonies again.
DELETE FROM forum_posts;
DELETE FROM forum_threads;
