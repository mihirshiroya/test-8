import React from 'react';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import { useAuth, useActiveSessions } from '../hooks/useAuth';
import { Button } from '../components/Ui/Button';
import { Input } from '../components/Ui/Input';
import { Card } from '../components/Ui/Card';

const changePasswordSchema = Yup.object().shape({
  currentPassword: Yup.string().required('Current password is required'),
  newPassword: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .required('New password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('newPassword')], 'Passwords must match')
    .required('Confirm password is required'),
});

const Security: React.FC = () => {
  const { user, changePassword, logout, revokeSession } = useAuth();
  const activeSessions = useActiveSessions();

  const handleChangePassword = async (values: any, { resetForm }: any) => {
    changePassword.mutate(values, {
      onSuccess: () => {
        resetForm();
      }
    });
  };

  const handleLogoutAll = () => {
    logout.mutate(true);
  };

  const handleRevokeSession = (sessionId: string) => {
    revokeSession.mutate(sessionId);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Security Settings</h1>
        <p className="mt-2 text-gray-600">
          Manage your password and security preferences.
        </p>
      </div>

      <div className="space-y-8">
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Change Password</h2>
          
          {user?.provider === 'GOOGLE' ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex">
                <svg className="flex-shrink-0 w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">
                    Google Account Only
                  </h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <p>You're using Google to sign in. Set a password to enable local authentication as a backup.</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <Formik
              initialValues={{
                currentPassword: '',
                newPassword: '',
                confirmPassword: '',
              }}
              validationSchema={changePasswordSchema}
              onSubmit={handleChangePassword}
            >
              {({ errors, touched, isSubmitting }) => (
                <Form className="space-y-6">
                  <Field name="currentPassword">
                    {({ field }: any) => (
                      <Input
                        {...field}
                        type="password"
                        label="Current Password"
                        placeholder="Enter your current password"
                        error={touched.currentPassword && errors.currentPassword ? errors.currentPassword : undefined}
                      />
                    )}
                  </Field>

                  <Field name="newPassword">
                    {({ field }: any) => (
                      <Input
                        {...field}
                        type="password"
                        label="New Password"
                        placeholder="Enter your new password"
                        error={touched.newPassword && errors.newPassword ? errors.newPassword : undefined}
                        helperText="Must contain uppercase, lowercase, number and special character"
                      />
                    )}
                  </Field>

                  <Field name="confirmPassword">
                    {({ field }: any) => (
                      <Input
                        {...field}
                        type="password"
                        label="Confirm New Password"
                        placeholder="Confirm your new password"
                        error={touched.confirmPassword && errors.confirmPassword ? errors.confirmPassword : undefined}
                      />
                    )}
                  </Field>

                  <Button
                    type="submit"
                    loading={isSubmitting || changePassword.isPending}
                    className='bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors font-medium'
                  >
                    Update Password
                  </Button>
                </Form>
              )}
            </Formik>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Active Sessions</h2>
            <Button
              variant="danger"
              onClick={handleLogoutAll}
              loading={logout.isPending}
            >
              Sign Out All Devices
            </Button>
          </div>

          {activeSessions.isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/3 mb-1"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                    </div>
                    <div className="h-8 bg-gray-200 rounded w-16"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : activeSessions.data?.data.sessions.length ? (
            <div className="space-y-4">
              {activeSessions.data.data.sessions.map((session, index) => (
                <div key={session.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center mb-2">
                      <svg className="w-5 h-5 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span className="font-medium text-gray-900">
                        {index === 0 ? 'Current Session' : `Session ${session.id.slice(0, 8)}...`}
                      </span>
                      {index === 0 && (
                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>Created: {new Date(session.createdAt).toLocaleString()}</p>
                      <p>Expires: {new Date(session.expiresAt).toLocaleString()}</p>
                      {session.isExpired && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Expired
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRevokeSession(session.id)}
                      loading={revokeSession.isPending}
                      disabled={index === 0} 
                    >
                      Revoke
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No active sessions</h3>
              <p className="mt-1 text-sm text-gray-500">You don't have any active sessions.</p>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Security Information</h2>
          
          <div className="space-y-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className={`w-5 h-5 mt-0.5 ${user?.isEmailVerified ? 'text-green-500' : 'text-yellow-500'}`} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-gray-900">Email Verification</h3>
                <p className="text-sm text-gray-600">
                  Your email address is {user?.isEmailVerified ? 'verified' : 'not verified'}
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 mt-0.5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-gray-900">Authentication Method</h3>
                <p className="text-sm text-gray-600">
                  You're using {user?.provider === 'GOOGLE' ? 'Google OAuth' : 'Email and Password'} to sign in
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className={`w-5 h-5 mt-0.5 ${user?.isActive ? 'text-green-500' : 'text-red-500'}`} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-gray-900">Account Status</h3>
                <p className="text-sm text-gray-600">
                  Your account is {user?.isActive ? 'active' : 'inactive'}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Security;
