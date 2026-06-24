import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import db from '../db/index.js';
import type { PublicUser, User } from '../types/index.js';
import { nowInEast8 } from '../utils/time.js';

const SALT_ROUNDS = 10;
const ADMIN_USERNAME = 'facai';
const WECHAT_CODE2SESSION_URL = 'https://api.weixin.qq.com/sns/jscode2session';

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
    is_admin: row.username === ADMIN_USERNAME,
    created_at: row.created_at,
  };
}

interface WechatSession {
  openid?: string;
  session_key?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

async function getWechatOpenId(code: string): Promise<{ openid?: string; error?: string }> {
  const appId = process.env.WECHAT_APP_ID?.trim();
  const appSecret = process.env.WECHAT_APP_SECRET?.trim();
  const loginCode = code.trim();

  if (!loginCode) {
    return { error: '微信登录凭证不能为空' };
  }
  if (!appId || !appSecret) {
    return { error: '微信登录未配置 AppID 或 AppSecret' };
  }

  const params = new URLSearchParams({
    appid: appId,
    secret: appSecret,
    js_code: loginCode,
    grant_type: 'authorization_code',
  });

  try {
    const response = await fetch(`${WECHAT_CODE2SESSION_URL}?${params.toString()}`);
    const data = await response.json() as WechatSession;
    if (!response.ok || data.errcode || !data.openid) {
      return { error: data.errmsg || '微信登录校验失败' };
    }
    return { openid: data.openid };
  } catch {
    return { error: '微信登录服务暂不可用' };
  }
}

function getUserByWechatOpenId(openid: string): PublicUser | null {
  const row = db.prepare(`${publicUserSelect} WHERE users.wechat_openid = ?`).get(openid) as PublicUserRow | undefined;
  return row ? toPublicUser(row) : null;
}

function getWechatBoundUser(openid: string): Pick<User, 'id' | 'username'> | undefined {
  return db.prepare('SELECT id, username FROM users WHERE wechat_openid = ?').get(openid) as Pick<User, 'id' | 'username'> | undefined;
}

function createUnusablePasswordHash() {
  return bcrypt.hashSync(randomBytes(32).toString('hex'), SALT_ROUNDS);
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

export function isAdminUser(id: number): boolean {
  const row = db.prepare('SELECT username FROM users WHERE id = ?').get(id) as Pick<User, 'username'> | undefined;
  return row?.username === ADMIN_USERNAME;
}

export async function wechatLogin(code: string): Promise<{ user?: PublicUser; registered: boolean; error?: string }> {
  const session = await getWechatOpenId(code);
  if (session.error || !session.openid) {
    return { registered: false, error: session.error || '微信登录失败' };
  }

  const user = getUserByWechatOpenId(session.openid);
  if (!user) {
    return { registered: false };
  }

  return { user, registered: true };
}

export async function registerByWechat(username: string, inviteCode: string, code: string): Promise<{ user?: PublicUser; error?: string }> {
  if (!username || username.length < 2 || username.length > 20) {
    return { error: '用户名长度应为 2-20 个字符' };
  }
  if (!inviteCode.trim()) {
    return { error: '邀请码不能为空' };
  }

  const session = await getWechatOpenId(code);
  if (session.error || !session.openid) {
    return { error: session.error || '微信登录失败' };
  }

  const boundUser = getWechatBoundUser(session.openid);
  if (boundUser) {
    return { error: '当前微信已绑定其他账号' };
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return { error: '用户名已存在，可绑定已有账号' };
  }

  const organization = db
    .prepare('SELECT id FROM organizations WHERE invite_code = ?')
    .get(inviteCode.trim()) as { id: number } | undefined;
  if (!organization) {
    return { error: '邀请码无效' };
  }

  const result = db.prepare(`
    INSERT INTO users (username, password_hash, wechat_openid, organization_id, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(username, createUnusablePasswordHash(), session.openid, organization.id, nowInEast8());

  const row = db.prepare(`${publicUserSelect} WHERE users.id = ?`).get(result.lastInsertRowid) as PublicUserRow;
  return { user: toPublicUser(row) };
}

export async function bindWechat(username: string, password: string, code: string): Promise<{ user?: PublicUser; error?: string }> {
  const loginResult = login(username, password);
  if (loginResult.error || !loginResult.user) {
    return { error: loginResult.error || '用户名或密码错误' };
  }

  const session = await getWechatOpenId(code);
  if (session.error || !session.openid) {
    return { error: session.error || '微信登录失败' };
  }

  const boundUser = getWechatBoundUser(session.openid);
  if (boundUser && boundUser.id !== loginResult.user.id) {
    return { error: '当前微信已绑定其他账号' };
  }

  const row = db.prepare('SELECT id, wechat_openid FROM users WHERE id = ?').get(loginResult.user.id) as Pick<User, 'id' | 'wechat_openid'> | undefined;
  if (row?.wechat_openid && row.wechat_openid !== session.openid) {
    return { error: '该账号已绑定其他微信' };
  }

  db.prepare('UPDATE users SET wechat_openid = ? WHERE id = ?').run(session.openid, loginResult.user.id);
  return { user: getUserById(loginResult.user.id) || loginResult.user };
}
