import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import { adminApi } from '../../api/admin';
import type {
  AdminState,
  User,
  UserStats,
  PaginatedUsers,
  UserFilters,
  UpdateUserPayload,
  UpdateRolePayload
} from '../../types/index';

const initialState: AdminState = {
  users: [],
  currentUser: null,
  stats: null,
  pagination: {
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    limit: 10
  },
  filters: {
    page: 1,
    limit: 10,
    search: '',
    role: undefined,
    provider: undefined,
    verified: undefined
  },
  isLoading: false,
  error: null
};

export const getAllUsers = createAsyncThunk(
  'admin/getAllUsers',
  async (filters: UserFilters, { rejectWithValue }) => {
    try {
      const response = await adminApi.getAllUsers(filters);
      return response.data.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch users');
    }
  }
);

export const getUserById = createAsyncThunk(
  'admin/getUserById',
  async (userId: string, { rejectWithValue }) => {
    try {
      const response = await adminApi.getUserById(userId);
      return response.data.data.user;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch user');
    }
  }
);

export const updateUser = createAsyncThunk(
  'admin/updateUser',
  async ({ userId, data }: { userId: string; data: UpdateUserPayload }, { rejectWithValue }) => {
    try {
      const response = await adminApi.updateUser(userId, data);
      return response.data.user;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update user');
    }
  }
);

export const deleteUser = createAsyncThunk(
  'admin/deleteUser',
  async (userId: string, { rejectWithValue }) => {
    try {
      await adminApi.deleteUser(userId);
      return userId;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete user');
    }
  }
);

export const deactivateUser = createAsyncThunk(
  'admin/deactivateUser',
  async (userId: string, { rejectWithValue }) => {
    try {
      const response = await adminApi.deactivateUser(userId);
      return response.data.user;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to deactivate user');
    }
  }
);

export const activateUser = createAsyncThunk(
  'admin/activateUser',
  async (userId: string, { rejectWithValue }) => {
    try {
      const response = await adminApi.activateUser(userId);
      return response.data.user;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to activate user');
    }
  }
);

export const updateUserRole = createAsyncThunk(
  'admin/updateUserRole',
  async ({ userId, role }: UpdateRolePayload, { rejectWithValue }) => {
    try {
      const response = await adminApi.updateUserRole(userId, role);
      return response.data.user;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update user role');
    }
  }
);

export const getUserStats = createAsyncThunk(
  'admin/getUserStats',
  async (_, { rejectWithValue }) => {
    try {
      const response = await adminApi.getUserStats();
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch stats');
    }
  }
);

const adminSlice = createSlice({
  name: 'admin',
  initialState,
  reducers: {
    setFilters: (state, action: PayloadAction<Partial<UserFilters>>) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearFilters: (state) => {
      state.filters = initialState.filters;
    },
    clearCurrentUser: (state) => {
      state.currentUser = null;
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(getAllUsers.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getAllUsers.fulfilled, (state, action: PayloadAction<PaginatedUsers>) => {
        state.isLoading = false;
        state.users = action.payload.users;
        state.pagination = action.payload.pagination;
      })
      .addCase(getAllUsers.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(getUserById.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getUserById.fulfilled, (state, action: PayloadAction<User>) => {
        state.isLoading = false;
        console.log("user details",action.payload)
        state.currentUser = action.payload;
      })
      .addCase(getUserById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(updateUser.fulfilled, (state, action: PayloadAction<User>) => {
        const index = state.users.findIndex(u => u.id === action.payload.id);
        if (index !== -1) {
          state.users[index] = action.payload;
        }
        if (state.currentUser?.id === action.payload.id) {
          state.currentUser = action.payload;
        }
      })
      .addCase(deleteUser.fulfilled, (state, action: PayloadAction<string>) => {
        state.users = state.users.filter(u => u.id !== action.payload);
        if (state.currentUser?.id === action.payload) {
          state.currentUser = null;
        }
      })
      .addCase(deactivateUser.fulfilled, (state, action: PayloadAction<User>) => {
        const index = state.users.findIndex(u => u.id === action.payload.id);
        if (index !== -1) {
          state.users[index] = action.payload;
        }
        if (state.currentUser?.id === action.payload.id) {
          state.currentUser = action.payload;
        }
      })
      .addCase(activateUser.fulfilled, (state, action: PayloadAction<User>) => {
        const index = state.users.findIndex(u => u.id === action.payload.id);
        if (index !== -1) {
          state.users[index] = action.payload;
        }
        if (state.currentUser?.id === action.payload.id) {
          state.currentUser = action.payload;
        }
      })
      .addCase(updateUserRole.fulfilled, (state, action: PayloadAction<User>) => {
        const index = state.users.findIndex(u => u.id === action.payload.id);
        if (index !== -1) {
          state.users[index] = action.payload;
        }
        if (state.currentUser?.id === action.payload.id) {
          state.currentUser = action.payload;
        }
      })
      .addCase(getUserStats.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getUserStats.fulfilled, (state, action) => {
        state.isLoading = false;
        state.stats = action.payload.data;
      })
      .addCase(getUserStats.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  }
});

export const { setFilters, clearFilters, clearCurrentUser, clearError } = adminSlice.actions;
export default adminSlice.reducer;