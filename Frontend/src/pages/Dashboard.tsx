
import React from 'react';
import { useAuth, useActiveSessions } from '../hooks/useAuth';
import { Card } from '../components/Ui/Card';
import { Button } from '../components/Ui/Button';

const Dashboard: React.FC = () => {
  const { user, resendVerification, revokeSession } = useAuth();
  const activeSessions = useActiveSessions();

  const handleResendVerification = () => {
    resendVerification.mutate();
  };

  const handleRevokeSession = (sessionId: string) => {
    revokeSession.mutate(sessionId);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {user?.firstName}!
        </h1>
        <p className="mt-2 text-gray-600">
          Here's an overview of your account activity.
        </p>
      </div>

      {!user?.isEmailVerified && (
        <div className="mb-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-yellow-800">
                Email verification required
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>Please verify your email address to access all features.</p>
              </div>
              <div className="mt-4">
                <Button
                  size="sm"
                  onClick={handleResendVerification}
                  loading={resendVerification.isPending}
                >
                  Resend verification email
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${user?.isActive ? 'bg-green-100' : 'bg-red-100'}`}>
                <svg className={`w-5 h-5 ${user?.isActive ? 'text-green-600' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {user?.isActive ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  )}
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-900">Account Status</h3>
              <p className={`text-sm ${user?.isActive ? 'text-green-600' : 'text-red-600'}`}>
                {user?.isActive ? 'Active' : 'Inactive'}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${user?.isEmailVerified ? 'bg-green-100' : 'bg-yellow-100'}`}>
                <svg className={`w-5 h-5 ${user?.isEmailVerified ? 'text-green-600' : 'text-yellow-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-900">Email Status</h3>
              <p className={`text-sm ${user?.isEmailVerified ? 'text-green-600' : 'text-yellow-600'}`}>
                {user?.isEmailVerified ? 'Verified' : 'Unverified'}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                {user?.provider === 'GOOGLE' ? (
                  <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                )}
              </div>
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-900">Login Provider</h3>
              <p className="text-sm text-gray-600">{user?.provider}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Profile Information</h2>
          <div className="space-y-4">
            <div className="flex items-center">
              {user?.avatar ? (
                <img src={user.avatar} alt="Avatar" className="w-12 h-12 rounded-full" />
              ) : (
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-primary-600 font-semibold">
                    {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                  </span>
                </div>
              )}
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {user?.firstName} {user?.lastName}
                </h3>
                <p className="text-sm text-gray-600">{user?.email}</p>
              </div>
            </div>
            <div className="border-t pt-4">
              <dl className="space-y-2">
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Role:</dt>
                  <dd className="text-sm text-gray-900">{user?.role}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Member since:</dt>
                  <dd className="text-sm text-gray-900">
                    {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Last login:</dt>
                  <dd className="text-sm text-gray-900">
                    {user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'N/A'}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Sessions</h2>
          {activeSessions.isLoading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          ) : activeSessions.data?.data.sessions.length ? (
            <div className="space-y-3">
              {activeSessions.data.data.sessions.map((session) => (
                <div key={session.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Session {session.id.slice(0, 8)}...
                    </p>
                    <p className="text-xs text-gray-500">
                      Created: {new Date(session.createdAt).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-500">
                      Expires: {new Date(session.expiresAt).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleRevokeSession(session.id)}
                    loading={revokeSession.isPending}
                  >
                    Revoke
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No active sessions found.</p>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
