import request from './request'

export function register(username: string, password: string) {
  return request.post('/auth/register', { username, password }) as Promise<{ user: { id: number; username: string }; token: string }>
}

export function login(username: string, password: string) {
  return request.post('/auth/login', { username, password }) as Promise<{ user: { id: number; username: string }; token: string }>
}

export function getMe() {
  return request.get('/auth/me') as Promise<{ id: number; username: string }>
}
