import db from '../db/index.js';
import type { Todo, TodoLocation, Comment, ListQuery, ListResult, CreateTodoInput, UpdateTodoInput, CreateCommentInput } from '../types/index.js';
import { nowInEast8 } from '../utils/time.js';

type TodoRow = Omit<Todo, 'locations'> & { locations: string | null };

const MAX_TODO_LOCATIONS = 5;

const todoSelect = `
  SELECT
    todos.*,
    owner.username AS creator_username,
    categories.name AS category_name,
    categories.icon AS category_icon,
    categories.color AS category_color
  FROM todos
  JOIN users AS owner ON owner.id = todos.user_id
  LEFT JOIN todo_categories AS categories ON categories.id = todos.category_id
`;

function normalizeCoordinate(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function normalizeLocationForInput(value: unknown): { location?: TodoLocation; error?: string } {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const raw = value as { name?: unknown; lat?: unknown; lng?: unknown };
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  const lat = normalizeCoordinate(raw.lat);
  const lng = normalizeCoordinate(raw.lng);

  if (!name && lat === null && lng === null) {
    return {};
  }
  if (!name) {
    return { error: '地点名称不能为空' };
  }
  if (name.length > 120) {
    return { error: '地点名称不能超过 120 个字符' };
  }
  if ((lat === null) !== (lng === null)) {
    return { error: '地点经纬度需要同时填写' };
  }

  return { location: { name, lat, lng } };
}

function normalizeLocationsForInput(value: unknown): { locations?: TodoLocation[]; error?: string } {
  if (value === undefined) {
    return {};
  }
  if (!Array.isArray(value)) {
    return { error: '地点格式不正确' };
  }

  const locations: TodoLocation[] = [];
  for (const item of value) {
    const result = normalizeLocationForInput(item);
    if (result.error) {
      return { error: result.error };
    }
    if (result.location) {
      locations.push(result.location);
    }
  }

  if (locations.length > MAX_TODO_LOCATIONS) {
    return { error: `地点最多只能选择 ${MAX_TODO_LOCATIONS} 个` };
  }

  return { locations };
}

function normalizeLocationForOutput(value: unknown): TodoLocation | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const raw = value as { name?: unknown; lat?: unknown; lng?: unknown };
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  const lat = normalizeCoordinate(raw.lat);
  const lng = normalizeCoordinate(raw.lng);

  if (!name) {
    return null;
  }

  return { name, lat, lng };
}

function parseLocations(row: TodoRow): TodoLocation[] {
  if (row.locations) {
    try {
      const parsed = JSON.parse(row.locations) as unknown;
      if (Array.isArray(parsed)) {
        const locations = parsed
          .map(normalizeLocationForOutput)
          .filter((location): location is TodoLocation => location !== null)
          .slice(0, MAX_TODO_LOCATIONS);
        if (locations.length > 0) {
          return locations;
        }
      }
    } catch {
      // Fall back to the legacy single-location columns below.
    }
  }

  if (!row.location) {
    return [];
  }

  return [{
    name: row.location,
    lat: row.location_lat,
    lng: row.location_lng,
  }];
}

function mapTodo(row: TodoRow | undefined): Todo | undefined {
  if (!row) {
    return undefined;
  }

  const { locations, ...todo } = row;
  return {
    ...todo,
    locations: parseLocations(row),
  };
}

function serializeLocations(locations: TodoLocation[]): string | null {
  return locations.length > 0 ? JSON.stringify(locations) : null;
}

function getPrimaryLocation(locations: TodoLocation[]) {
  return locations[0] ?? null;
}

function legacyInputToLocations(input: {
  location?: string;
  location_lat?: number | null;
  location_lng?: number | null;
}) {
  if (!input.location && input.location_lat === undefined && input.location_lng === undefined) {
    return [];
  }

  return [{
    name: input.location || '',
    lat: input.location_lat ?? null,
    lng: input.location_lng ?? null,
  }];
}

function getDefaultCategoryId(userId: number): number | null {
  const row = db.prepare(`
    SELECT categories.id
    FROM todo_categories AS categories
    JOIN users AS viewer ON viewer.organization_id = categories.organization_id
    WHERE viewer.id = ?
      AND categories.name = '其他'
    LIMIT 1
  `).get(userId) as { id: number } | undefined;
  return row?.id ?? null;
}

function validateCategoryId(userId: number, categoryId: number | null | undefined): { categoryId?: number | null; error?: string } {
  if (categoryId === undefined) {
    return {};
  }
  if (categoryId === null) {
    return { categoryId: null };
  }

  const row = db.prepare(`
    SELECT categories.id
    FROM todo_categories AS categories
    JOIN users AS viewer ON viewer.organization_id = categories.organization_id
    WHERE viewer.id = ?
      AND categories.id = ?
  `).get(userId, categoryId) as { id: number } | undefined;

  if (!row) {
    return { error: '分类不存在或不属于当前组织' };
  }

  return { categoryId: row.id };
}

function getAccessibleTodo(userId: number, todoId: number): Todo | undefined {
  const row = db.prepare(`
    ${todoSelect}
    JOIN users AS viewer ON viewer.id = ?
    WHERE todos.id = ?
      AND owner.organization_id = viewer.organization_id
      AND todos.deleted_at IS NULL
  `).get(userId, todoId) as TodoRow | undefined;
  return mapTodo(row);
}

export function list(userId: number, query: ListQuery): ListResult<Todo> {
  const { status, keyword, page = 1, pageSize = 20 } = query;
  const offset = (page - 1) * pageSize;

  let whereClause = `
    WHERE owner.organization_id = viewer.organization_id
      AND todos.deleted_at IS NULL
  `;
  const params: unknown[] = [userId];

  if (status) {
    whereClause += ' AND todos.status = ?';
    params.push(status);
  }
  if (keyword) {
    whereClause += ' AND (todos.title LIKE ? OR todos.content LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  const fromClause = `
    FROM todos
    JOIN users AS owner ON owner.id = todos.user_id
    JOIN users AS viewer ON viewer.id = ?
    LEFT JOIN todo_categories AS categories ON categories.id = todos.category_id
  `;
  const countRow = db.prepare(`SELECT COUNT(*) AS total ${fromClause} ${whereClause}`).get(...params) as { total: number };

  // Sorting: pinned > urgent > priority > earliest due date > sort_order > created_at
  const rows = db.prepare(`
    SELECT
      todos.*,
      owner.username AS creator_username,
      categories.name AS category_name,
      categories.icon AS category_icon,
      categories.color AS category_color
    ${fromClause}
    ${whereClause}
    ORDER BY
      todos.is_pinned DESC,
      todos.is_urgent DESC,
      todos.priority DESC,
      todos.due_at IS NULL ASC,
      todos.due_at ASC,
      todos.sort_order DESC,
      todos.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset) as TodoRow[];

  return { list: rows.map(row => mapTodo(row) as Todo), total: countRow.total };
}

export function getById(userId: number, todoId: number): { todo?: Todo; error?: string } {
  const todo = getAccessibleTodo(userId, todoId);
  if (!todo) {
    return { error: '待办不存在或已被删除' };
  }
  return { todo };
}

export function create(userId: number, input: CreateTodoInput): { todo?: Todo; error?: string } {
  if (!input.title || input.title.trim().length === 0) {
    return { error: '待办标题不能为空' };
  }
  if (input.title.length > 100) {
    return { error: '待办标题不能超过 100 个字符' };
  }
  if (input.priority !== undefined && (input.priority < 0 || input.priority > 3)) {
    return { error: '优先级应为 0-3' };
  }
  const category = validateCategoryId(
    userId,
    input.category_id !== undefined ? input.category_id : getDefaultCategoryId(userId)
  );
  if (category.error) {
    return { error: category.error };
  }

  const normalizedLocations = normalizeLocationsForInput(
    input.locations !== undefined ? input.locations : legacyInputToLocations(input)
  );
  if (normalizedLocations.error) {
    return { error: normalizedLocations.error };
  }
  const locations = normalizedLocations.locations ?? [];
  const primaryLocation = getPrimaryLocation(locations);

  const stmt = db.prepare(
    `INSERT INTO todos (user_id, category_id, title, content, priority, due_at, location, location_lat, location_lng, locations, is_urgent, is_pinned, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const now = nowInEast8();
  const result = stmt.run(
    userId,
    category.categoryId ?? null,
    input.title.trim(),
    input.content || '',
    input.priority ?? 0,
    input.due_at || null,
    primaryLocation?.name ?? null,
    primaryLocation?.lat ?? null,
    primaryLocation?.lng ?? null,
    serializeLocations(locations),
    input.is_urgent ?? 0,
    input.is_pinned ?? 0,
    now,
    now
  );

  return { todo: getAccessibleTodo(userId, Number(result.lastInsertRowid)) };
}

export function update(userId: number, todoId: number, input: UpdateTodoInput): { todo?: Todo; error?: string } {
  const existing = getAccessibleTodo(userId, todoId);
  if (!existing) {
    return { error: '待办不存在或已被删除' };
  }

  if (input.priority !== undefined && (input.priority < 0 || input.priority > 3)) {
    return { error: '优先级应为 0-3' };
  }

  const allowedFields: (keyof UpdateTodoInput)[] = ['title', 'content', 'priority', 'due_at', 'sort_order', 'is_urgent', 'is_pinned'];
  const setClauses: string[] = ['updated_at = ?'];
  const params: unknown[] = [nowInEast8()];

  for (const field of allowedFields) {
    if (input[field] !== undefined) {
      setClauses.push(`${field} = ?`);
      params.push(input[field]);
    }
  }

  if (input.category_id !== undefined) {
    const category = validateCategoryId(userId, input.category_id);
    if (category.error) {
      return { error: category.error };
    }
    setClauses.push('category_id = ?');
    params.push(category.categoryId ?? null);
  }

  const hasLocationsInput = input.locations !== undefined;
  const hasLegacyLocationInput =
    input.location !== undefined || input.location_lat !== undefined || input.location_lng !== undefined;

  if (hasLocationsInput || hasLegacyLocationInput) {
    const nextLocationsInput = hasLocationsInput
      ? input.locations
      : legacyInputToLocations({
        location: input.location ?? existing.location ?? undefined,
        location_lat: input.location_lat !== undefined ? input.location_lat : existing.location_lat,
        location_lng: input.location_lng !== undefined ? input.location_lng : existing.location_lng,
      });
    const normalizedLocations = normalizeLocationsForInput(nextLocationsInput);
    if (normalizedLocations.error) {
      return { error: normalizedLocations.error };
    }

    const locations = normalizedLocations.locations ?? [];
    const primaryLocation = getPrimaryLocation(locations);
    setClauses.push('location = ?', 'location_lat = ?', 'location_lng = ?', 'locations = ?');
    params.push(
      primaryLocation?.name ?? null,
      primaryLocation?.lat ?? null,
      primaryLocation?.lng ?? null,
      serializeLocations(locations)
    );
  }

  if (setClauses.length === 1) {
    return { todo: existing };
  }

  params.push(todoId);
  db.prepare(`UPDATE todos SET ${setClauses.join(', ')} WHERE id = ?`).run(...params);

  return { todo: getAccessibleTodo(userId, todoId) };
}

export function complete(userId: number, todoId: number): { todo?: Todo; error?: string } {
  const existing = getAccessibleTodo(userId, todoId);
  if (!existing) {
    return { error: '待办不存在或已被删除' };
  }
  if (existing.status === 'completed') {
    return { error: '待办已完成' };
  }

  const now = nowInEast8();
  db.prepare(
    `UPDATE todos SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?`
  ).run(now, now, todoId);

  return { todo: getAccessibleTodo(userId, todoId) };
}

export function uncomplete(userId: number, todoId: number): { todo?: Todo; error?: string } {
  const existing = getAccessibleTodo(userId, todoId);
  if (!existing) {
    return { error: '待办不存在或已被删除' };
  }
  if (existing.status === 'active') {
    return { error: '待办未完成' };
  }

  db.prepare(
    `UPDATE todos SET status = 'active', completed_at = NULL, updated_at = ? WHERE id = ?`
  ).run(nowInEast8(), todoId);

  return { todo: getAccessibleTodo(userId, todoId) };
}

export function remove(userId: number, todoId: number): { error?: string } {
  const existing = getAccessibleTodo(userId, todoId);
  if (!existing) {
    return { error: '待办不存在或已被删除' };
  }

  const now = nowInEast8();
  db.prepare(
    `UPDATE todos SET deleted_at = ?, updated_at = ? WHERE id = ?`
  ).run(now, now, todoId);

  return {};
}

export function pin(userId: number, todoId: number): { todo?: Todo; error?: string } {
  const existing = getAccessibleTodo(userId, todoId);
  if (!existing) return { error: '待办不存在或已被删除' };
  if (existing.is_pinned === 1) return { error: '待办已置顶' };
  db.prepare('UPDATE todos SET is_pinned = 1, updated_at = ? WHERE id = ?').run(nowInEast8(), todoId);
  return { todo: getAccessibleTodo(userId, todoId) };
}

export function unpin(userId: number, todoId: number): { todo?: Todo; error?: string } {
  const existing = getAccessibleTodo(userId, todoId);
  if (!existing) return { error: '待办不存在或已被删除' };
  if (existing.is_pinned === 0) return { error: '待办未置顶' };
  db.prepare('UPDATE todos SET is_pinned = 0, updated_at = ? WHERE id = ?').run(nowInEast8(), todoId);
  return { todo: getAccessibleTodo(userId, todoId) };
}

export function urgent(userId: number, todoId: number): { todo?: Todo; error?: string } {
  const existing = getAccessibleTodo(userId, todoId);
  if (!existing) return { error: '待办不存在或已被删除' };
  if (existing.is_urgent === 1) return { error: '待办已加急' };
  db.prepare('UPDATE todos SET is_urgent = 1, updated_at = ? WHERE id = ?').run(nowInEast8(), todoId);
  return { todo: getAccessibleTodo(userId, todoId) };
}

export function unurgent(userId: number, todoId: number): { todo?: Todo; error?: string } {
  const existing = getAccessibleTodo(userId, todoId);
  if (!existing) return { error: '待办不存在或已被删除' };
  if (existing.is_urgent === 0) return { error: '待办未加急' };
  db.prepare('UPDATE todos SET is_urgent = 0, updated_at = ? WHERE id = ?').run(nowInEast8(), todoId);
  return { todo: getAccessibleTodo(userId, todoId) };
}

// Comment functions
function getCommentById(commentId: number) {
  return db.prepare(
    `SELECT comments.*, users.username
     FROM comments
     JOIN users ON users.id = comments.user_id
     WHERE comments.id = ?`
  ).get(commentId) as Comment | undefined;
}

export function listComments(userId: number, todoId: number): { comments?: Comment[]; error?: string } {
  const todo = getAccessibleTodo(userId, todoId);
  if (!todo) return { error: '待办不存在或已被删除' };
  return {
    comments: db.prepare(
      `SELECT comments.*, users.username
       FROM comments
       JOIN users ON users.id = comments.user_id
       WHERE comments.todo_id = ?
       ORDER BY comments.created_at ASC`
    ).all(todoId) as Comment[],
  };
}

export function addComment(userId: number, todoId: number, input: CreateCommentInput): { comment?: Comment; error?: string } {
  if (!input.content || input.content.trim().length === 0) return { error: '评论内容不能为空' };
  if (input.content.length > 500) return { error: '评论不能超过 500 个字符' };
  const todo = getAccessibleTodo(userId, todoId);
  if (!todo) return { error: '待办不存在或已被删除' };
  const result = db.prepare('INSERT INTO comments (todo_id, user_id, content, created_at) VALUES (?, ?, ?, ?)').run(todoId, userId, input.content.trim(), nowInEast8());
  return { comment: getCommentById(Number(result.lastInsertRowid)) };
}

export function deleteComment(userId: number, todoId: number, commentId: number): { error?: string } {
  const comment = db.prepare(`
    SELECT comments.id
    FROM comments
    JOIN todos ON todos.id = comments.todo_id
    JOIN users AS owner ON owner.id = todos.user_id
    JOIN users AS viewer ON viewer.id = ?
    WHERE comments.id = ?
      AND comments.todo_id = ?
      AND comments.user_id = ?
      AND owner.organization_id = viewer.organization_id
      AND todos.deleted_at IS NULL
  `).get(userId, commentId, todoId, userId) as Pick<Comment, 'id'> | undefined;
  if (!comment) return { error: '评论不存在' };
  db.prepare('DELETE FROM comments WHERE id = ?').run(commentId);
  return {};
}
