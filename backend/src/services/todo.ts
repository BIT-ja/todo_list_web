import db from '../db/index.js';
import type { Todo, Comment, ListQuery, ListResult, CreateTodoInput, UpdateTodoInput, CreateCommentInput } from '../types/index.js';
import { nowInEast8 } from '../utils/time.js';

export function list(userId: number, query: ListQuery): ListResult<Todo> {
  const { status, keyword, page = 1, pageSize = 20 } = query;
  const offset = (page - 1) * pageSize;

  let whereClause = 'WHERE user_id = ? AND deleted_at IS NULL';
  const params: unknown[] = [userId];

  if (status) {
    whereClause += ' AND status = ?';
    params.push(status);
  }
  if (keyword) {
    whereClause += ' AND (title LIKE ? OR content LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM todos ${whereClause}`).get(...params) as { total: number };

  // Sorting: pinned > urgent > priority > sort_order > created_at
  const rows = db.prepare(
    `SELECT * FROM todos ${whereClause} ORDER BY is_pinned DESC, is_urgent DESC, priority DESC, sort_order DESC, created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, pageSize, offset) as Todo[];

  return { list: rows, total: countRow.total };
}

export function getById(userId: number, todoId: number): { todo?: Todo; error?: string } {
  const todo = db.prepare('SELECT * FROM todos WHERE id = ? AND user_id = ? AND deleted_at IS NULL').get(todoId, userId) as Todo | undefined;
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

  const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(result.lastInsertRowid) as Todo;
  return { todo };
}

export function update(userId: number, todoId: number, input: UpdateTodoInput): { todo?: Todo; error?: string } {
  const existing = db.prepare('SELECT * FROM todos WHERE id = ? AND user_id = ? AND deleted_at IS NULL').get(todoId, userId) as Todo | undefined;
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

  const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(todoId) as Todo;
  return { todo };
}

export function complete(userId: number, todoId: number): { todo?: Todo; error?: string } {
  const existing = db.prepare('SELECT * FROM todos WHERE id = ? AND user_id = ? AND deleted_at IS NULL').get(todoId, userId) as Todo | undefined;
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

  const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(todoId) as Todo;
  return { todo };
}

export function uncomplete(userId: number, todoId: number): { todo?: Todo; error?: string } {
  const existing = db.prepare('SELECT * FROM todos WHERE id = ? AND user_id = ? AND deleted_at IS NULL').get(todoId, userId) as Todo | undefined;
  if (!existing) {
    return { error: '待办不存在或已被删除' };
  }
  if (existing.status === 'active') {
    return { error: '待办未完成' };
  }

  db.prepare(
    `UPDATE todos SET status = 'active', completed_at = NULL, updated_at = ? WHERE id = ?`
  ).run(nowInEast8(), todoId);

  const todo = db.prepare('SELECT * FROM todos WHERE id = ?').get(todoId) as Todo;
  return { todo };
}

export function remove(userId: number, todoId: number): { error?: string } {
  const existing = db.prepare('SELECT * FROM todos WHERE id = ? AND user_id = ? AND deleted_at IS NULL').get(todoId, userId) as Todo | undefined;
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
  const existing = db.prepare('SELECT * FROM todos WHERE id = ? AND user_id = ? AND deleted_at IS NULL').get(todoId, userId) as Todo | undefined;
  if (!existing) return { error: '待办不存在或已被删除' };
  if (existing.is_pinned === 1) return { error: '待办已置顶' };
  db.prepare('UPDATE todos SET is_pinned = 1, updated_at = ? WHERE id = ?').run(nowInEast8(), todoId);
  return { todo: db.prepare('SELECT * FROM todos WHERE id = ?').get(todoId) as Todo };
}

export function unpin(userId: number, todoId: number): { todo?: Todo; error?: string } {
  const existing = db.prepare('SELECT * FROM todos WHERE id = ? AND user_id = ? AND deleted_at IS NULL').get(todoId, userId) as Todo | undefined;
  if (!existing) return { error: '待办不存在或已被删除' };
  if (existing.is_pinned === 0) return { error: '待办未置顶' };
  db.prepare('UPDATE todos SET is_pinned = 0, updated_at = ? WHERE id = ?').run(nowInEast8(), todoId);
  return { todo: db.prepare('SELECT * FROM todos WHERE id = ?').get(todoId) as Todo };
}

export function urgent(userId: number, todoId: number): { todo?: Todo; error?: string } {
  const existing = db.prepare('SELECT * FROM todos WHERE id = ? AND user_id = ? AND deleted_at IS NULL').get(todoId, userId) as Todo | undefined;
  if (!existing) return { error: '待办不存在或已被删除' };
  if (existing.is_urgent === 1) return { error: '待办已加急' };
  db.prepare('UPDATE todos SET is_urgent = 1, updated_at = ? WHERE id = ?').run(nowInEast8(), todoId);
  return { todo: db.prepare('SELECT * FROM todos WHERE id = ?').get(todoId) as Todo };
}

export function unurgent(userId: number, todoId: number): { todo?: Todo; error?: string } {
  const existing = db.prepare('SELECT * FROM todos WHERE id = ? AND user_id = ? AND deleted_at IS NULL').get(todoId, userId) as Todo | undefined;
  if (!existing) return { error: '待办不存在或已被删除' };
  if (existing.is_urgent === 0) return { error: '待办未加急' };
  db.prepare('UPDATE todos SET is_urgent = 0, updated_at = ? WHERE id = ?').run(nowInEast8(), todoId);
  return { todo: db.prepare('SELECT * FROM todos WHERE id = ?').get(todoId) as Todo };
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
  const todo = db.prepare('SELECT * FROM todos WHERE id = ? AND user_id = ? AND deleted_at IS NULL').get(todoId, userId) as Todo | undefined;
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
  const todo = db.prepare('SELECT * FROM todos WHERE id = ? AND user_id = ? AND deleted_at IS NULL').get(todoId, userId) as Todo | undefined;
  if (!todo) return { error: '待办不存在或已被删除' };
  const result = db.prepare('INSERT INTO comments (todo_id, user_id, content, created_at) VALUES (?, ?, ?, ?)').run(todoId, userId, input.content.trim(), nowInEast8());
  return { comment: getCommentById(Number(result.lastInsertRowid)) };
}

export function deleteComment(userId: number, commentId: number): { error?: string } {
  const comment = db.prepare('SELECT * FROM comments WHERE id = ? AND user_id = ?').get(commentId, userId) as Comment | undefined;
  if (!comment) return { error: '评论不存在' };
  db.prepare('DELETE FROM comments WHERE id = ?').run(commentId);
  return {};
}
