export interface User {
  id: number;
  username: string;
  password_hash: string;
  created_at: string;
}

export interface Todo {
  id: number;
  user_id: number;
  title: string;
  content: string;
  status: 'active' | 'completed';
  priority: number;
  due_at: string | null;
  completed_at: string | null;
  sort_order: number;
  location: string | null;
  location_lat: number | null;
  location_lng: number | null;
  is_urgent: number;
  is_pinned: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Comment {
  id: number;
  todo_id: number;
  user_id: number;
  username: string;
  content: string;
  created_at: string;
}

export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

export interface JwtPayload {
  userId: number;
  username: string;
}

export interface ListQuery {
  status?: 'active' | 'completed';
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export interface ListResult<T> {
  list: T[];
  total: number;
}

export interface CreateTodoInput {
  title: string;
  content?: string;
  priority?: number;
  due_at?: string;
  location?: string;
  location_lat?: number;
  location_lng?: number;
  is_urgent?: number;
  is_pinned?: number;
}

export interface UpdateTodoInput {
  title?: string;
  content?: string;
  priority?: number;
  due_at?: string;
  sort_order?: number;
  location?: string;
  location_lat?: number;
  location_lng?: number;
  is_urgent?: number;
  is_pinned?: number;
}

export interface CreateCommentInput {
  content: string;
}
