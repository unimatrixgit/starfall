ALTER TABLE alliance_intel ADD COLUMN target_alliance TEXT NOT NULL DEFAULT '';
ALTER TABLE alliance_intel ADD COLUMN relation TEXT NOT NULL DEFAULT 'Neutral';
