ALTER TABLE portal_users ADD COLUMN account_id TEXT;
UPDATE portal_users SET account_id=printf('%05X',rowid) WHERE account_id IS NULL;
CREATE UNIQUE INDEX portal_public_account_id ON portal_users(account_id);
