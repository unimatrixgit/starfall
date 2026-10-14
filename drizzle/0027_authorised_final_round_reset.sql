-- Explicitly requested round reset for the completed diagnostics and world feature release; explicitly requested after implementation. Accounts and Owner keys remain.
CREATE TABLE IF NOT EXISTS planet_enrolments(user_id TEXT PRIMARY KEY,generation INTEGER NOT NULL,planet_type TEXT NOT NULL,confirmed INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS galaxy_distribution(id INTEGER PRIMARY KEY,generation INTEGER NOT NULL,shuffled INTEGER NOT NULL DEFAULT 0,at_tick INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS galaxy_development(galaxy TEXT PRIMARY KEY,generation INTEGER NOT NULL,data_json TEXT NOT NULL);
INSERT INTO planet_enrolments(user_id,generation,planet_type,confirmed,rerolls,unique_key,previous_type)
SELECT u.id,(SELECT reset_generation+1 FROM planet_directory_meta WHERE id=1),'',0,0,NULL,COALESCE(json_extract(p.data_json,'$.planetType'),e.planet_type,'') FROM portal_users u LEFT JOIN planet_directory p ON p.owner_id=u.id AND p.kind='planet' LEFT JOIN planet_enrolments e ON e.user_id=u.id WHERE 1
ON CONFLICT(user_id) DO UPDATE SET generation=excluded.generation,planet_type='',confirmed=0,rerolls=0,unique_key=NULL,previous_type=excluded.previous_type;
UPDATE alliance_registry SET attributes_json=json_set(attributes_json,'$.description',(SELECT json_extract(a.data_json,'$.description') FROM planet_alliances a WHERE a.name=alliance_registry.name),'$.motd',(SELECT json_extract(a.data_json,'$.motd') FROM planet_alliances a WHERE a.name=alliance_registry.name),'$.recruitmentMessage',(SELECT json_extract(a.data_json,'$.recruitmentMessage') FROM planet_alliances a WHERE a.name=alliance_registry.name)) WHERE name IN (SELECT name FROM planet_alliances);
DELETE FROM alliance_signals;
DELETE FROM alliance_attack_targets;
DELETE FROM alliance_fleet_commands;
DELETE FROM alliance_fleet_readiness;
DELETE FROM alliance_intel;
DELETE FROM shared_scans;
DELETE FROM scan_sharing;
DELETE FROM forum_posts WHERE thread_id IN (SELECT id FROM forum_threads WHERE scope IN ('galaxy','alliance'));
DELETE FROM forum_threads WHERE scope IN ('galaxy','alliance');
DELETE FROM planet_alliances;
DELETE FROM planet_directory;
DELETE FROM galaxy_development;
DELETE FROM galaxy_distribution;
UPDATE planet_directory_meta SET reset_generation=reset_generation+1,revision=revision+1,player_only=1 WHERE id=1;
