

import api from './config';
import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  GoogleAuthRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  ChangePasswordRequest,
  UpdateProfileRequest,
  VerifyEmailRequest,
  RefreshTokenRequest,
  ApiResponse,
  User,
  UserSession,
  GoogleAuthStatus
} from '../types';

export const authApi = {
  async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await api.post('/auth/login', data);
    return response.data;
  },

  async register(data: RegisterRequest): Promise<AuthResponse> {
    const response = await api.post('/auth/register', data);
    return response.data;
  },

  async logout(): Promise<ApiResponse> {
    const response = await api.post('/auth/logout');
    return response.data;
  },

  async logoutAll(): Promise<ApiResponse> {
    const response = await api.post('/auth/logout-all');
    return response.data;
  },

  async refreshToken(data?: RefreshTokenRequest): Promise<AuthResponse> {
    const response = await api.post('/auth/refresh-token', data || {});
    return response.data;
  },

  async verifyEmail(data: VerifyEmailRequest): Promise<ApiResponse<{ data: { token: string } }>> {
    const response = await api.post('/auth/verify-email', data);
    return response.data;
  },

  async resendVerificationEmail(): Promise<ApiResponse> {
    const response = await api.post('/auth/resend-verification');
    return response.data;
  },

  async forgotPassword(data: ForgotPasswordRequest): Promise<ApiResponse> {
    const response = await api.post('/auth/forgot-password', data);
    return response.data;
  },

  async resetPassword(data: ResetPasswordRequest): Promise<ApiResponse> {
    const response = await api.post('/auth/reset-password', data);
    return response.data;
  },

  async changePassword(data: ChangePasswordRequest): Promise<ApiResponse> {
    const response = await api.post('/auth/change-password', data);
    return response.data;
  },

  async getProfile(): Promise<ApiResponse<{ user: User; activeDevices: number }>> {
    const response = await api.get('/auth/profile');
    return response.data;
  },

  async updateProfile(data: UpdateProfileRequest): Promise<ApiResponse<{ user: User }>> {
    const response = await api.put('/auth/profile', data);
    return response.data;
  },

  async googleRegisterLogin(data: GoogleAuthRequest): Promise<AuthResponse> {
    const response = await api.post('/auth/google/register-login', data);
    return response.data;
  },

  async linkGoogle(data: { googleId: string; googleEmail: string }): Promise<ApiResponse<{ user: User }>> {
    const response = await api.post('/auth/google/link', data);
    return response.data;
  },

  async unlinkGoogle(): Promise<ApiResponse<{ user: User }>> {
    const response = await api.delete('/auth/google/unlink');
    return response.data;
  },

  async getGoogleAuthStatus(): Promise<ApiResponse<GoogleAuthStatus>> {
    const response = await api.get('/auth/google/status');
    return response.data;
  },

  async getActiveSessions(): Promise<ApiResponse<UserSession>> {
    const response = await api.get('/users/me/sessions');
    return response.data;
  },

  async revokeSession(sessionId: string): Promise<ApiResponse> {
    const response = await api.delete(`/users/me/sessions/${sessionId}`);
    return response.data;
  }
};