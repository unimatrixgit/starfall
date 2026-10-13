-- One-time alliance-only reset explicitly requested on 2026-10-13.
DELETE FROM forum_posts WHERE thread_id IN (SELECT id FROM forum_threads WHERE scope='alliance');
DELETE FROM forum_threads WHERE scope='alliance';
DELETE FROM alliance_intel;
DELETE FROM alliance_fleet_commands;
DELETE FROM alliance_fleet_readiness;
DELETE FROM key_disclosure_attempts;
DELETE FROM alliance_key_disclosure;
DELETE FROM alliance_owner_keys;
DELETE FROM alliance_registry;
DELETE FROM planet_alliances;
DELETE FROM planet_directory WHERE kind='structure';
UPDATE planet_directory SET data_json=json_set(data_json,'$.alliance','Unaffiliated') WHERE kind='planet';
UPDATE planet_directory_meta SET revision=revision+1 WHERE id=1;
