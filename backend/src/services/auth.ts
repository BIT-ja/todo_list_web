import bcrypt from 'bcryptjs';
import db from '../db/index.js';
import type { PublicUser, User } from '../types/index.js';
import { nowInEast8 } from '../utils/time.js';

const SALT_ROUNDS = 10;

interface PublicUserRow {
  id: number;
  username: string;
  organization_id: number;
  organization_name: string;
  created_at: string;
}

const publicUserSelect = `
  SELECT
    users.id,
    users.username,
    users.created_at,
    organizations.id AS organization_id,
    organizations.name AS organization_name
  FROM users
  JOIN organizations ON organizations.id = users.organization_id
`;

function toPublicUser(row: PublicUserRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    organization: {
      id: row.organization_id,
      name: row.organization_name,
    },
    created_at: row.created_at,
  };
}

export function register(username: string, password: string, inviteCode: string): { user?: PublicUser; error?: string } {
  if (!username || username.length < 2 || username.length > 20) {
    return { error: '用户名长度应为 2-20 个字符' };
  }
  if (!password || password.length < 6 || password.length > 32) {
    return { error: '密码长度应为 6-32 个字符' };
  }
  if (!inviteCode.trim()) {
    return { error: '邀请码不能为空' };
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return { error: '用户名已存在' };
  }

  const organization = db
    .prepare('SELECT id FROM organizations WHERE invite_code = ?')
    .get(inviteCode.trim()) as { id: number } | undefined;
  if (!organization) {
    return { error: '邀请码无效' };
  }

  const passwordHash = bcrypt.hashSync(password, SALT_ROUNDS);
  const stmt = db.prepare(
    'INSERT INTO users (username, password_hash, organization_id, created_at) VALUES (?, ?, ?, ?)',
  );
  const result = stmt.run(username, passwordHash, organization.id, nowInEast8());
  const row = db.prepare(`${publicUserSelect} WHERE users.id = ?`).get(result.lastInsertRowid) as PublicUserRow;

  return {
    user: toPublicUser(row),
  };
}

export function login(username: string, password: string): { user?: PublicUser; error?: string } {
  if (!username || !password) {
    return { error: '用户名和密码不能为空' };
  }

  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined;
  if (!row) {
    return { error: '用户名或密码错误' };
  }

  if (!bcrypt.compareSync(password, row.password_hash)) {
    return { error: '用户名或密码错误' };
  }

  return {
    user: toPublicUser(
      db.prepare(`${publicUserSelect} WHERE users.id = ?`).get(row.id) as PublicUserRow,
    ),
  };
}

export function getUserById(id: number): PublicUser | null {
  const row = db.prepare(`${publicUserSelect} WHERE users.id = ?`).get(id) as PublicUserRow | undefined;
  return row ? toPublicUser(row) : null;
}
