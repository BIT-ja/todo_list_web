import db from './index.js';

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', '+8 hours'))
    );

    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      priority INTEGER NOT NULL DEFAULT 0,
      due_at TEXT,
      completed_at TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      location TEXT,
      location_lat REAL,
      location_lng REAL,
      is_urgent INTEGER NOT NULL DEFAULT 0,
      is_pinned INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now', '+8 hours')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', '+8 hours')),
      deleted_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      todo_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', '+8 hours')),
      FOREIGN KEY (todo_id) REFERENCES todos(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_todos_user_status ON todos(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_todos_deleted_at ON todos(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_todos_pinned_urgent ON todos(user_id, is_pinned, is_urgent);
    CREATE INDEX IF NOT EXISTS idx_comments_todo ON comments(todo_id);
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
  `);

  // Migrate existing databases: add new columns if missing
  const todoColumns = db.prepare("PRAGMA table_info('todos')").all() as { name: string }[];
  const existingCols = new Set(todoColumns.map(c => c.name));

  const newCols = [
    { name: 'location', sql: 'ALTER TABLE todos ADD COLUMN location TEXT' },
    { name: 'location_lat', sql: 'ALTER TABLE todos ADD COLUMN location_lat REAL' },
    { name: 'location_lng', sql: 'ALTER TABLE todos ADD COLUMN location_lng REAL' },
    { name: 'is_urgent', sql: 'ALTER TABLE todos ADD COLUMN is_urgent INTEGER NOT NULL DEFAULT 0' },
    { name: 'is_pinned', sql: 'ALTER TABLE todos ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0' },
  ];

  for (const col of newCols) {
    if (!existingCols.has(col.name)) {
      db.exec(col.sql);
    }
  }
}
