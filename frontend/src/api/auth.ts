import { api } from './client'
import type {
  LoginRequest,
  RegisterRequest,
  SendOtpRequest,
  SendOtpResponse,
  TokenResponse,
  VerifyOtpRequest,
  VerifyOtpResponse,
} from '@/types/api'

export const authApi = {
  sendOtp: (body: SendOtpRequest) =>
    api.post<SendOtpResponse>('/auth/send-otp', body),

  verifyOtp: (body: VerifyOtpRequest) =>
    api.post<VerifyOtpResponse>('/auth/verify-otp', body),

  register: (body: RegisterRequest, registrationToken?: string) =>
    registrationToken
      ? api.postWithToken<TokenResponse>('/auth/register', body, registrationToken)
      : api.post<TokenResponse>('/auth/register', body),

  login: (body: LoginRequest) =>
    api.post<TokenResponse>('/auth/login', body),

  logout: (token: string) =>
    api.post<void>('/auth/logout', { token }),
}
