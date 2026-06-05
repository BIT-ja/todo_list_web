import type { ApiResponse } from '../types/index.js';

export function success<T>(data: T, message = 'ok'): ApiResponse<T> {
  return { code: 0, message, data };
}

export function error(message: string, code = 400): ApiResponse<null> {
  return { code, message, data: null };
}
