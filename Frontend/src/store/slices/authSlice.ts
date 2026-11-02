
import { createSlice, createAsyncThunk,type PayloadAction } from '@reduxjs/toolkit';
import type { AuthState, LoginRequest, RegisterRequest, GoogleAuthRequest, User } from '../../types';
import { authApi } from '../../api/auth';
import { holdAllInProgress } from './taskSlice';

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
};

// Async thunks
export const loginUser = createAsyncThunk(
  'auth/login',
  async (data: LoginRequest, { rejectWithValue }) => {
    try {
      const response = await authApi.login(data);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Login failed');
    }
  }
);

export const registerUser = createAsyncThunk(
  'auth/register',
  async (data: RegisterRequest, { rejectWithValue }) => {
    try {
      const response = await authApi.register(data);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Registration failed');
    }
  }
);

export const googleAuth = createAsyncThunk(
  'auth/googleAuth',
  async (data: GoogleAuthRequest, { rejectWithValue }) => {
    try {
      const response = await authApi.googleRegisterLogin(data);
      return response;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Google authentication failed');
    }
  }
);

export const logoutUser = createAsyncThunk(
  'auth/logout',
  async (logoutAll: boolean = false, { dispatch, rejectWithValue }) => {
    // Move any running task to ON_HOLD while the session is still valid.
    await (dispatch as any)(holdAllInProgress());

    try {
      if (logoutAll) {
        await authApi.logoutAll();
      } else {
        await authApi.logout();
      }
      return true;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Logout failed');
    }
  }
);


export const getProfile = createAsyncThunk(
  'auth/getProfile',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authApi.getProfile();
      return response.data.user;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch profile');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action: PayloadAction<{ user: User}>) => {
      const { user } = action.payload;
      state.user = user;
      state.isAuthenticated = true;
    },
    updateUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
    },
    clearAuth: (state) => {
      state.user = null;
      state.isAuthenticated = false;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.data.user;
        state.isAuthenticated = true;
      })
      .addCase(loginUser.rejected, (state) => {
        state.isLoading = false;
      })
      .addCase(registerUser.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.data.user;
        state.isAuthenticated = true;
      })
      .addCase(registerUser.rejected, (state) => {
        state.isLoading = false;
      })
      .addCase(googleAuth.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(googleAuth.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.data.user;
        state.isAuthenticated = true;
      })
      .addCase(googleAuth.rejected, (state) => {
        state.isLoading = false;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.isAuthenticated = false;
      })
      .addCase(getProfile.fulfilled, (state, action) => {
        state.user = action.payload;
      });
  },
});

export const { setCredentials, updateUser, clearAuth, setLoading } = authSlice.actions;
export default authSlice.reducer;
