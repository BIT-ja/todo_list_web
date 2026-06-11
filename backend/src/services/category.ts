import db from '../db/index.js';
import type { TodoCategory } from '../types/index.js';
import { nowInEast8 } from '../utils/time.js';

const DEFAULT_CATEGORY_COLOR = '#7d8da6';
const CATEGORY_NAME_MAX_LENGTH = 12;
const CATEGORY_ICON_PATTERN = /^[a-z0-9-]{1,40}$/;
const CATEGORY_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

interface CategoryInput {
  name?: string;
  icon?: string;
  color?: string;
}

function getUserOrganizationId(userId: number): number | null {
  const row = db.prepare('SELECT organization_id FROM users WHERE id = ?').get(userId) as { organization_id: number } | undefined;
  return row?.organization_id ?? null;
}

function getCategoryForUser(userId: number, categoryId: number): TodoCategory | undefined {
  return db.prepare(`
    SELECT categories.*
    FROM todo_categories AS categories
    JOIN users AS viewer ON viewer.organization_id = categories.organization_id
    WHERE viewer.id = ?
      AND categories.id = ?
  `).get(userId, categoryId) as TodoCategory | undefined;
}

function normalizeInput(input: CategoryInput, partial = false): { category?: Required<CategoryInput>; error?: string } {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const icon = typeof input.icon === 'string' ? input.icon.trim() : '';
  const color = typeof input.color === 'string' ? input.color.trim() : '';

  if (!partial || input.name !== undefined) {
    if (!name) return { error: '分类名称不能为空' };
    if (name.length > CATEGORY_NAME_MAX_LENGTH) return { error: `分类名称不能超过 ${CATEGORY_NAME_MAX_LENGTH} 个字符` };
  }

  if (!partial || input.icon !== undefined) {
    if (!icon) return { error: '分类图标不能为空' };
    if (!CATEGORY_ICON_PATTERN.test(icon)) return { error: '分类图标格式不正确' };
  }

  if (color && !CATEGORY_COLOR_PATTERN.test(color)) {
    return { error: '分类颜色格式不正确' };
  }

  return {
    category: {
      name,
      icon,
      color: color || DEFAULT_CATEGORY_COLOR,
    },
  };
}

export function list(userId: number): { categories?: TodoCategory[]; error?: string } {
  const organizationId = getUserOrganizationId(userId);
  if (!organizationId) return { error: '用户组织不存在' };

  const categories = db.prepare(`
    SELECT *
    FROM todo_categories
    WHERE organization_id = ?
    ORDER BY id ASC
  `).all(organizationId) as TodoCategory[];

  return { categories };
}

export function create(userId: number, input: CategoryInput): { category?: TodoCategory; error?: string } {
  const organizationId = getUserOrganizationId(userId);
  if (!organizationId) return { error: '用户组织不存在' };

  const normalized = normalizeInput(input);
  if (normalized.error) return { error: normalized.error };
  const category = normalized.category!;

  const existing = db.prepare(
    'SELECT id FROM todo_categories WHERE organization_id = ? AND name = ?'
  ).get(organizationId, category.name);
  if (existing) return { error: '分类名称已存在' };

  const now = nowInEast8();
  const result = db.prepare(`
    INSERT INTO todo_categories (organization_id, name, icon, color, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(organizationId, category.name, category.icon, category.color, now, now);

  return {
    category: getCategoryForUser(userId, Number(result.lastInsertRowid)),
  };
}

export function update(userId: number, categoryId: number, input: CategoryInput): { category?: TodoCategory; error?: string } {
  const existing = getCategoryForUser(userId, categoryId);
  if (!existing) return { error: '分类不存在' };

  const normalized = normalizeInput(input, true);
  if (normalized.error) return { error: normalized.error };

  const nextCategory = {
    name: input.name !== undefined ? normalized.category!.name : existing.name,
    icon: input.icon !== undefined ? normalized.category!.icon : existing.icon,
    color: input.color !== undefined ? normalized.category!.color : existing.color,
  };

  const duplicated = db.prepare(`
    SELECT id
    FROM todo_categories
    WHERE organization_id = ?
      AND name = ?
      AND id <> ?
  `).get(existing.organization_id, nextCategory.name, categoryId);
  if (duplicated) return { error: '分类名称已存在' };

  db.prepare(`
    UPDATE todo_categories
    SET name = ?, icon = ?, color = ?, updated_at = ?
    WHERE id = ?
  `).run(nextCategory.name, nextCategory.icon, nextCategory.color, nowInEast8(), categoryId);

  return {
    category: getCategoryForUser(userId, categoryId),
  };
}

export function remove(userId: number, categoryId: number): { error?: string } {
  const existing = getCategoryForUser(userId, categoryId);
  if (!existing) return { error: '分类不存在' };

  const fallback = db.prepare(`
    SELECT id
    FROM todo_categories
    WHERE organization_id = ?
      AND name = '其他'
      AND id <> ?
    LIMIT 1
  `).get(existing.organization_id, categoryId) as { id: number } | undefined;

  const clearCategory = db.transaction(() => {
    db.prepare('UPDATE todos SET category_id = ?, updated_at = ? WHERE category_id = ?')
      .run(fallback?.id ?? null, nowInEast8(), categoryId);
    db.prepare('DELETE FROM todo_categories WHERE id = ?').run(categoryId);
  });
  clearCategory();

  return {};
}
