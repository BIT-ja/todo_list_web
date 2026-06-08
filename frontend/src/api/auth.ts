import request from './request'

export interface AuthUser {
  id: number
  username: string
  organization: {
    id: number
    name: string
  }
  created_at: string
}

interface AuthResponse {
  user: AuthUser
  token: string
}

export function register(username: string, password: string, inviteCode: string) {
  return request.post('/auth/register', { username, password, inviteCode }) as Promise<AuthResponse>
}

export function login(username: string, password: string) {
  return request.post('/auth/login', { username, password }) as Promise<AuthResponse>
}

export function getMe() {
  return request.get('/auth/me') as Promise<AuthUser>
}
