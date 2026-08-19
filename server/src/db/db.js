import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'tasks.db');

const raw = new DatabaseSync(dbPath);
raw.exec('PRAGMA journal_mode = WAL');

raw.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'todo',
    assignee TEXT DEFAULT '',
    attachment_key TEXT,
    attachment_name TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(
    title, description, assignee, content='tasks', content_rowid='id'
  );

  CREATE TRIGGER IF NOT EXISTS tasks_ai AFTER INSERT ON tasks BEGIN
    INSERT INTO tasks_fts(rowid, title, description, assignee)
    VALUES (new.id, new.title, new.description, new.assignee);
  END;

  CREATE TRIGGER IF NOT EXISTS tasks_ad AFTER DELETE ON tasks BEGIN
    INSERT INTO tasks_fts(tasks_fts, rowid, title, description, assignee)
    VALUES ('delete', old.id, old.title, old.description, old.assignee);
  END;

  CREATE TRIGGER IF NOT EXISTS tasks_au AFTER UPDATE ON tasks BEGIN
    INSERT INTO tasks_fts(tasks_fts, rowid, title, description, assignee)
    VALUES ('delete', old.id, old.title, old.description, old.assignee);
    INSERT INTO tasks_fts(rowid, title, description, assignee)
    VALUES (new.id, new.title, new.description, new.assignee);
  END;

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'employee',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Each task belongs to exactly one user — added after the `tasks` table
// already existed, so it's a migration rather than part of CREATE TABLE.
const hasUserId = raw
  .prepare("SELECT 1 FROM pragma_table_info('tasks') WHERE name = 'user_id'")
  .get();
if (!hasUserId) {
  raw.exec('ALTER TABLE tasks ADD COLUMN user_id INTEGER REFERENCES users(id)');
  raw.exec('CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id)');
}

// HR fields — added after `users` already existed, so migrated in rather
// than part of CREATE TABLE.
const userColumns = raw.prepare("SELECT name FROM pragma_table_info('users')").all().map((c) => c.name);
if (!userColumns.includes('employee_code')) {
  raw.exec('ALTER TABLE users ADD COLUMN employee_code TEXT');
}
if (!userColumns.includes('designation')) {
  raw.exec('ALTER TABLE users ADD COLUMN designation TEXT');
}

export const db = raw;

// The one real account the system is seeded with — the PluginHive admin.
// Every other account (employees, and any additional admins) is created
// through the app itself, from the Employees page (POST /api/users) —
// there are no placeholder/demo logins.
const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users (username, password_hash, name, role, employee_code, designation)
  VALUES (?, ?, ?, ?, ?, ?)
`);
insertUser.run('sakshi12', bcrypt.hashSync('plunghive12', 10), 'Sakshi', 'admin', 'PH-0001', 'Admin');

// Backfill for the case where sakshi12 already existed from an earlier
// version of this app (before employee_code/designation existed).
db.prepare(`
  UPDATE users SET employee_code = 'PH-0001', designation = 'Admin'
  WHERE username = 'sakshi12' AND employee_code IS NULL
`).run();

const soleAdmin = db.prepare("SELECT id FROM users WHERE username = 'sakshi12'").get();

// One-time cleanup: earlier versions of this app seeded placeholder
// "admin"/"employee" demo accounts. Remove them and hand any tasks they
// owned to the real admin account instead of deleting that data.
for (const placeholderUsername of ['admin', 'employee']) {
  const placeholder = db.prepare('SELECT id FROM users WHERE username = ?').get(placeholderUsername);
  if (!placeholder) continue;
  if (soleAdmin) {
    db.prepare('UPDATE tasks SET user_id = ? WHERE user_id = ?').run(soleAdmin.id, placeholder.id);
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(placeholder.id);
}

// Any tasks left without an owner (e.g. from the user_id migration above,
// on a database that predates per-user ownership entirely) go to the admin
// so they don't become permanently invisible.
if (soleAdmin) {
  db.prepare('UPDATE tasks SET user_id = ? WHERE user_id IS NULL').run(soleAdmin.id);
}
