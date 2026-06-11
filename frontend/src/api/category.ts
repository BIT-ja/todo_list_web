import request from './request'

export interface TodoCategory {
  id: number
  organization_id: number
  name: string
  icon: string
  color: string
  created_at: string
  updated_at: string
}

export interface TodoCategoryPayload {
  name?: string
  icon?: string
  color?: string
}

export function getCategories() {
  return request.get('/categories') as Promise<TodoCategory[]>
}

export function createCategory(data: TodoCategoryPayload & { name: string; icon: string }) {
  return request.post('/categories', data) as Promise<TodoCategory>
}

export function updateCategory(id: number, data: TodoCategoryPayload) {
  return request.patch(`/categories/${id}`, data) as Promise<TodoCategory>
}

export function deleteCategory(id: number) {
  return request.delete(`/categories/${id}`) as Promise<null>
}
