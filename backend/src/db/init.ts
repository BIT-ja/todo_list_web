import db from './index.js';

const DEFAULT_ORGANIZATION_NAME = 'for-love';
const DEFAULT_ORGANIZATION_INVITE_CODE = '201124Cc';

function createPreservationSnapshots() {
  db.exec(`
    DROP TABLE IF EXISTS temp.migration_existing_user_ids;
    DROP TABLE IF EXISTS temp.migration_existing_todo_ids;
    DROP TABLE IF EXISTS temp.migration_existing_comment_ids;

    CREATE TEMP TABLE migration_existing_user_ids AS SELECT id FROM users;
    CREATE TEMP TABLE migration_existing_todo_ids AS SELECT id FROM todos;
    CREATE TEMP TABLE migration_existing_comment_ids AS SELECT id FROM comments;
  `);
}

function assertExistingRowsPreserved() {
  const checks = [
    {
      label: '用户',
      sql: `
        SELECT COUNT(*) AS count
        FROM migration_existing_user_ids AS existing
        LEFT JOIN users ON users.id = existing.id
        WHERE users.id IS NULL
      `,
    },
    {
      label: '待办事项',
      sql: `
        SELECT COUNT(*) AS count
        FROM migration_existing_todo_ids AS existing
        LEFT JOIN todos ON todos.id = existing.id
        WHERE todos.id IS NULL
      `,
    },
    {
      label: '评论',
      sql: `
        SELECT COUNT(*) AS count
        FROM migration_existing_comment_ids AS existing
        LEFT JOIN comments ON comments.id = existing.id
        WHERE comments.id IS NULL
      `,
    },
  ];

  for (const check of checks) {
    const result = db.prepare(check.sql).get() as { count: number };
    if (result.count > 0) {
      throw new Error(`组织迁移检测到 ${result.count} 条${check.label}记录缺失，已回滚`);
    }
  }

  const usersWithoutOrganization = db.prepare(`
    SELECT COUNT(*) AS count
    FROM users
    LEFT JOIN organizations ON organizations.id = users.organization_id
    WHERE organizations.id IS NULL
  `).get() as { count: number };
  if (usersWithoutOrganization.count > 0) {
    throw new Error(`组织迁移后仍有 ${usersWithoutOrganization.count} 个用户未绑定有效组织，已回滚`);
  }

  const foreignKeyViolations = db.prepare('PRAGMA foreign_key_check').all();
  if (foreignKeyViolations.length > 0) {
    throw new Error(`组织迁移检测到 ${foreignKeyViolations.length} 个外键错误，已回滚`);
  }

  db.exec(`
    DROP TABLE temp.migration_existing_user_ids;
    DROP TABLE temp.migration_existing_todo_ids;
    DROP TABLE temp.migration_existing_comment_ids;
  `);
}

export function initDatabase() {
  const migrate = db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS organizations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        invite_code TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT (datetime('now', '+8 hours'))
      );
    `);

    const existingOrganization = db
      .prepare('SELECT id, invite_code FROM organizations WHERE name = ?')
      .get(DEFAULT_ORGANIZATION_NAME) as { id: number; invite_code: string } | undefined;

    let defaultOrganizationId: number;
    if (existingOrganization) {
      if (existingOrganization.invite_code !== DEFAULT_ORGANIZATION_INVITE_CODE) {
        throw new Error(`组织 ${DEFAULT_ORGANIZATION_NAME} 的邀请码配置不正确`);
      }
      defaultOrganizationId = existingOrganization.id;
    } else {
      const result = db
        .prepare('INSERT INTO organizations (name, invite_code) VALUES (?, ?)')
        .run(DEFAULT_ORGANIZATION_NAME, DEFAULT_ORGANIZATION_INVITE_CODE);
      defaultOrganizationId = Number(result.lastInsertRowid);
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        organization_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now', '+8 hours')),
        FOREIGN KEY (organization_id) REFERENCES organizations(id)
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
    `);

    // Preserve legacy tables in place. Rebuilding users would put its todo and
    // comment foreign-key relationships at unnecessary risk.
    createPreservationSnapshots();

    const userColumns = db.prepare("PRAGMA table_info('users')").all() as { name: string }[];
    const existingUserColumns = new Set(userColumns.map(column => column.name));
    if (!existingUserColumns.has('organization_id')) {
      db.exec('ALTER TABLE users ADD COLUMN organization_id INTEGER REFERENCES organizations(id)');
    }

    db.prepare('UPDATE users SET organization_id = ? WHERE organization_id IS NULL').run(defaultOrganizationId);

    const todoColumns = db.prepare("PRAGMA table_info('todos')").all() as { name: string }[];
    const existingTodoColumns = new Set(todoColumns.map(column => column.name));
    const newTodoColumns = [
      { name: 'location', sql: 'ALTER TABLE todos ADD COLUMN location TEXT' },
      { name: 'location_lat', sql: 'ALTER TABLE todos ADD COLUMN location_lat REAL' },
      { name: 'location_lng', sql: 'ALTER TABLE todos ADD COLUMN location_lng REAL' },
      { name: 'is_urgent', sql: 'ALTER TABLE todos ADD COLUMN is_urgent INTEGER NOT NULL DEFAULT 0' },
      { name: 'is_pinned', sql: 'ALTER TABLE todos ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0' },
    ];

    for (const column of newTodoColumns) {
      if (!existingTodoColumns.has(column.name)) {
        db.exec(column.sql);
      }
    }

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_todos_user_status ON todos(user_id, status);
      CREATE INDEX IF NOT EXISTS idx_todos_deleted_at ON todos(deleted_at);
      CREATE INDEX IF NOT EXISTS idx_todos_pinned_urgent ON todos(user_id, is_pinned, is_urgent);
      CREATE INDEX IF NOT EXISTS idx_comments_todo ON comments(todo_id);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_organization ON users(organization_id);

      CREATE TRIGGER IF NOT EXISTS prevent_organization_invite_code_update
      BEFORE UPDATE OF invite_code ON organizations
      FOR EACH ROW
      WHEN NEW.invite_code IS NOT OLD.invite_code
      BEGIN
        SELECT RAISE(ABORT, 'organization invite code cannot be changed');
      END;

      CREATE TRIGGER IF NOT EXISTS require_user_organization
      BEFORE INSERT ON users
      FOR EACH ROW
      WHEN NEW.organization_id IS NULL
      BEGIN
        SELECT RAISE(ABORT, 'user organization is required');
      END;

      CREATE TRIGGER IF NOT EXISTS prevent_user_organization_update
      BEFORE UPDATE OF organization_id ON users
      FOR EACH ROW
      WHEN NEW.organization_id IS NOT OLD.organization_id
      BEGIN
        SELECT RAISE(ABORT, 'user organization cannot be changed');
      END;
    `);

    assertExistingRowsPreserved();
  });

  migrate();
}
