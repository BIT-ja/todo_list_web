import request from './request'

export interface TodoItem {
  id: number
  user_id: number
  creator_username: string
  title: string
  content: string
  status: 'active' | 'completed'
  priority: number
  due_at: string | null
  completed_at: string | null
  sort_order: number
  location: string | null
  location_lat: number | null
  location_lng: number | null
  is_urgent: number
  is_pinned: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface TodoComment {
  id: number
  todo_id: number
  user_id: number
  username: string
  content: string
  created_at: string
}

export interface TodoListResult {
  list: TodoItem[]
  total: number
}

export interface TodoPayload {
  title?: string
  content?: string
  priority?: number
  due_at?: string
  location?: string
  location_lat?: number | null
  location_lng?: number | null
  is_urgent?: number
  is_pinned?: number
}

export function getTodoList(params?: { status?: string; keyword?: string; page?: number; pageSize?: number }) {
  return request.get('/todos', { params }) as Promise<TodoListResult>
}

export function getTodoById(id: number) {
  return request.get(`/todos/${id}`) as Promise<TodoItem>
}

export function createTodo(data: TodoPayload & { title: string }) {
  return request.post('/todos', data) as Promise<TodoItem>
}

export function updateTodo(id: number, data: TodoPayload) {
  return request.patch(`/todos/${id}`, data) as Promise<TodoItem>
}

export function completeTodo(id: number) {
  return request.post(`/todos/${id}/complete`) as Promise<TodoItem>
}

export function uncompleteTodo(id: number) {
  return request.post(`/todos/${id}/uncomplete`) as Promise<TodoItem>
}

export function deleteTodo(id: number) {
  return request.delete(`/todos/${id}`) as Promise<null>
}

export function pinTodo(id: number) {
  return request.post(`/todos/${id}/pin`) as Promise<TodoItem>
}

export function unpinTodo(id: number) {
  return request.post(`/todos/${id}/unpin`) as Promise<TodoItem>
}

export function urgentTodo(id: number) {
  return request.post(`/todos/${id}/urgent`) as Promise<TodoItem>
}

export function unurgentTodo(id: number) {
  return request.post(`/todos/${id}/unurgent`) as Promise<TodoItem>
}

export function getTodoComments(id: number) {
  return request.get(`/todos/${id}/comments`) as Promise<TodoComment[]>
}

export function addTodoComment(id: number, content: string) {
  return request.post(`/todos/${id}/comments`, { content }) as Promise<TodoComment>
}

export function deleteTodoComment(id: number, commentId: number) {
  return request.delete(`/todos/${id}/comments/${commentId}`) as Promise<null>
}
