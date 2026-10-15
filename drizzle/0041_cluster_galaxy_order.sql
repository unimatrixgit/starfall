-- SF-121: preserve planets and progress; runtime repair moves legacy galaxy keys atomically.
ALTER TABLE planet_directory_meta ADD COLUMN galaxy_numbering_version INTEGER NOT NULL DEFAULT 0;
