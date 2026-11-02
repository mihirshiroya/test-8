
import api from './config';
import type { UserFilters, UpdateUserPayload } from '../types/index';

export const adminApi = {
  getAllUsers: (filters: UserFilters) => {
    const params = new URLSearchParams();
    
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.search) params.append('search', filters.search);
    if (filters.role) params.append('role', filters.role);
    if (filters.provider) params.append('provider', filters.provider);
    if (filters.verified !== undefined) params.append('verified', filters.verified.toString());

    return api.get(`/users?${params.toString()}`);
  },

  getUserById: (userId: string) => {
    return api.get(`/users/${userId}`);
  },

  updateUser: (userId: string, data: UpdateUserPayload) => {
    return api.put(`/users/${userId}`, data);
  },

  deleteUser: (userId: string) => {
    return api.delete(`/users/${userId}`);
  },

  deactivateUser: (userId: string) => {
    return api.patch(`/users/${userId}/deactivate`);
  },

  activateUser: (userId: string) => {
    return api.patch(`/users/${userId}/activate`);
  },

  updateUserRole: (userId: string, role: 'USER' | 'ADMIN') => {
    return api.patch(`/users/${userId}/role`, { role });
  },

  getUserStats: () => {
    return api.get('/users/stats');
  }
};