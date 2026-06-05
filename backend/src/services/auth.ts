import bcrypt from 'bcryptjs';
import db from '../db/index.js';
import type { User } from '../types/index.js';

const SALT_ROUNDS = 10;

export function register(username: string, password: string): { user?: Omit<User, 'password_hash'>; error?: string } {
  if (!username || username.length < 2 || username.length > 20) {
    return { error: '用户名长度应为 2-20 个字符' };
  }
  if (!password || password.length < 6 || password.length > 32) {
    return { error: '密码长度应为 6-32 个字符' };
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return { error: '用户名已存在' };
  }

  const passwordHash = bcrypt.hashSync(password, SALT_ROUNDS);
  const stmt = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
  const result = stmt.run(username, passwordHash);
  const row = db.prepare('SELECT id, username, created_at FROM users WHERE id = ?').get(result.lastInsertRowid) as Omit<User, 'password_hash'>;

  return {
    user: row,
  };
}

export function login(username: string, password: string): { user?: Omit<User, 'password_hash'>; error?: string } {
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
    user: {
      id: row.id,
      username: row.username,
      created_at: row.created_at,
    },
  };
}

export function getUserById(id: number): Omit<User, 'password_hash'> | null {
  const row = db.prepare('SELECT id, username, created_at FROM users WHERE id = ?').get(id) as Omit<User, 'password_hash'> | undefined;
  return row || null;
}
