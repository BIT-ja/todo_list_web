import db from '../db/index.js';
import type { Todo, Comment, ListQuery, ListResult, CreateTodoInput, UpdateTodoInput, CreateCommentInput } from '../types/index.js';
import { nowInEast8 } from '../utils/time.js';

const todoSelect = `
  SELECT todos.*, owner.username AS creator_username
  FROM todos
  JOIN users AS owner ON owner.id = todos.user_id
`;

function getAccessibleTodo(userId: number, todoId: number): Todo | undefined {
  return db.prepare(`
    ${todoSelect}
    JOIN users AS viewer ON viewer.id = ?
    WHERE todos.id = ?
      AND owner.organization_id = viewer.organization_id
      AND todos.deleted_at IS NULL
  `).get(userId, todoId) as Todo | undefined;
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
  `;
  const countRow = db.prepare(`SELECT COUNT(*) AS total ${fromClause} ${whereClause}`).get(...params) as { total: number };

  // Sorting: pinned > urgent > priority > sort_order > created_at
  const rows = db.prepare(`
    SELECT todos.*, owner.username AS creator_username
    ${fromClause}
    ${whereClause}
    ORDER BY
      todos.is_pinned DESC,
      todos.is_urgent DESC,
      todos.priority DESC,
      todos.sort_order DESC,
      todos.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset) as Todo[];

  return { list: rows, total: countRow.total };
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

  const stmt = db.prepare(
    `INSERT INTO todos (user_id, title, content, priority, due_at, location, location_lat, location_lng, is_urgent, is_pinned, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const now = nowInEast8();
  const result = stmt.run(
    userId,
    input.title.trim(),
    input.content || '',
    input.priority ?? 0,
    input.due_at || null,
    input.location || null,
    input.location_lat ?? null,
    input.location_lng ?? null,
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

  const allowedFields: (keyof UpdateTodoInput)[] = ['title', 'content', 'priority', 'due_at', 'sort_order', 'location', 'location_lat', 'location_lng', 'is_urgent', 'is_pinned'];
  const setClauses: string[] = ['updated_at = ?'];
  const params: unknown[] = [nowInEast8()];

  for (const field of allowedFields) {
    if (input[field] !== undefined) {
      setClauses.push(`${field} = ?`);
      params.push(input[field]);
    }
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
