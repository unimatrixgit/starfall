CREATE TABLE IF NOT EXISTS alliance_attack_targets(id TEXT PRIMARY KEY,alliance_id TEXT NOT NULL,target_coords TEXT NOT NULL,title TEXT NOT NULL,notes TEXT NOT NULL DEFAULT '',created_by TEXT NOT NULL,claim_user_id TEXT,claim_name TEXT,status TEXT NOT NULL DEFAULT 'Open',created_at INTEGER NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS alliance_attack_target_open ON alliance_attack_targets(alliance_id,target_coords) WHERE status='Open';
CREATE UNIQUE INDEX IF NOT EXISTS alliance_attack_claim_once ON alliance_attack_targets(claim_user_id) WHERE status='Open' AND claim_user_id IS NOT NULL;
