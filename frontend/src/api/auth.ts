import { api } from './client'
import type { LoginRequest, RegisterRequest, TokenResponse } from '@/types/api'

export const authApi = {
  register: (body: RegisterRequest) =>
    api.post<TokenResponse>('/auth/register', body),

  login: (body: LoginRequest) =>
    api.post<TokenResponse>('/auth/login', body),

  logout: (token: string) =>
    api.post<void>('/auth/logout', { token }),
}
