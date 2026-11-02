
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/auth';
import { useAppDispatch, useAppSelector } from './redux';
import { clearAuth, updateUser } from '../store/slices/authSlice';
import { holdAllInProgress } from '../store/slices/taskSlice';
import type {
  ChangePasswordRequest,
  UpdateProfileRequest,
  VerifyEmailRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest
} from '../types';
import { toast } from '../lib/toast';

export const useAuth = () => {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, isLoading } = useAppSelector((state) => state.auth);

  const logout = useMutation({
    mutationFn: async (logoutAll: boolean = false) => {
      await (dispatch as any)(holdAllInProgress());
      return logoutAll ? authApi.logoutAll() : authApi.logout();
    },
    onSuccess: () => {
      dispatch(clearAuth());
      queryClient.clear();
      toast.success('Signed out', { description: 'See you next time!' });
    },
    onError: (error: any) => {
      toast.apiError(error, 'Sign out failed');
    }
  });

  const changePassword = useMutation({
    mutationFn: (data: ChangePasswordRequest) => authApi.changePassword(data),
    onSuccess: () => {
      toast.success('Password changed', {
        description: 'Use your new password the next time you sign in.',
      });
    },
    onError: (error: any) => {
      toast.apiError(error, 'Could not change password');
    }
  });

  const updateProfile = useMutation({
    mutationFn: (data: UpdateProfileRequest) => authApi.updateProfile(data),
    onSuccess: (response:any) => {
      dispatch(updateUser(response.data.user));
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      toast.success('Profile updated', {
        description: response?.message || 'Your changes have been saved.',
      });
    },
    onError: (error: any) => {
      toast.apiError(error, 'Could not update profile');
    }
  });

  const verifyEmail = useMutation({
    mutationFn: (data: VerifyEmailRequest) => authApi.verifyEmail(data),
    onSuccess: (response) => {
      dispatch(updateUser(response.data!.user));
      toast.success('Email verified', {
        description: 'Your account is confirmed and ready to use.',
      });
    },
    onError: (error: any) => {
      toast.apiError(error, 'Email verification failed');
    }
  });

  const resendVerification = useMutation({
    mutationFn: () => authApi.resendVerificationEmail(),
    onSuccess: () => {
      toast.success('Verification email sent', {
        description: 'Check your inbox (and spam folder) for the link.',
      });
    },
    onError: (error: any) => {
      toast.apiError(error, 'Could not send verification email');
    }
  });

  const forgotPassword = useMutation({
    mutationFn: (data: ForgotPasswordRequest) => authApi.forgotPassword(data),
    onSuccess: () => {
      toast.success('Reset link sent', {
        description: 'If an account exists for that email, a reset link is on its way.',
      });
    },
    onError: (error: any) => {
      toast.apiError(error, 'Could not send reset link');
    }
  });

  const resetPassword = useMutation({
    mutationFn: (data: ResetPasswordRequest) => authApi.resetPassword(data),
    onSuccess: () => {
      // Success toast is shown by the ResetPassword page.
    },
    onError: (error: any) => {
      toast.apiError(error, 'Could not reset password');
    }
  });

  const linkGoogle = useMutation({
    mutationFn: (data: { googleId: string; googleEmail: string }) => authApi.linkGoogle(data),
    onSuccess: (response:any) => {
      dispatch(updateUser(response.data.user));
      queryClient.invalidateQueries({ queryKey: ['googleAuthStatus'] });
      toast.success('Google account linked', {
        description: 'You can now sign in with Google.',
      });
    },
    onError: (error: any) => {
      toast.apiError(error, 'Could not link Google account');
    }
  });

  const unlinkGoogle = useMutation({
    mutationFn: () => authApi.unlinkGoogle(),
    onSuccess: (response:any) => {
      dispatch(updateUser(response.data.user));
      queryClient.invalidateQueries({ queryKey: ['googleAuthStatus'] });
      toast.success('Google account unlinked', {
        description: 'Google sign in is no longer connected to your account.',
      });
    },
    onError: (error: any) => {
      toast.apiError(error, 'Could not unlink Google account');
    }
  });

  const revokeSession = useMutation({
    mutationFn: (sessionId: string) => authApi.revokeSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeSessions'] });
      toast.success('Session revoked', {
        description: 'That device has been signed out.',
      });
    },
    onError: (error: any) => {
      toast.apiError(error, 'Could not revoke session');
    }
  });

  return {
    user,
    isAuthenticated,
    isLoading,
    logout,
    changePassword,
    updateProfile,
    verifyEmail,
    resendVerification,
    forgotPassword,
    resetPassword,
    linkGoogle,
    unlinkGoogle,
    revokeSession,
  };
};

/*
 * Data queries live in their own hooks so they only run on the screens that
 * render them. useAuth() is used app-wide (route guards, navbar, header), and
 * queries inside it fired on every page.
 */

export const useActiveSessions = () => {
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  return useQuery({
    queryKey: ['activeSessions'],
    queryFn: () => authApi.getActiveSessions(),
    enabled: isAuthenticated,
    staleTime: 30_000,
  });
};

export const useGoogleAuthStatus = () => {
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  return useQuery({
    queryKey: ['googleAuthStatus'],
    queryFn: () => authApi.getGoogleAuthStatus(),
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  });
};
