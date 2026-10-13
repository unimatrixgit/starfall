CREATE TABLE IF NOT EXISTS support_tickets(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,category TEXT NOT NULL,title TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'Open',created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS support_ticket_messages(id TEXT PRIMARY KEY,ticket_id TEXT NOT NULL,user_id TEXT NOT NULL,author_name TEXT NOT NULL,is_staff INTEGER NOT NULL DEFAULT 0,body TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS support_ticket_owner ON support_tickets(user_id,updated_at);
CREATE INDEX IF NOT EXISTS support_ticket_message_parent ON support_ticket_messages(ticket_id,created_at);
