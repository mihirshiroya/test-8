
import React, { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import { toast } from '../lib/toast';
import { Button } from '../components/Ui/Button';
import { Input } from '../components/Ui/Input';
import AuthLayout, {
  authLinkClass,
  authPrimaryButton,
} from '../components/Ui/auth-Layout';
import { useAuth } from '../hooks/useAuth';

const resetPasswordSchema = Yup.object().shape({
  password: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .required('Password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password')], 'Passwords must match')
    .required('Confirm password is required'),
});

const ResetPassword: React.FC = () => {
  const { resetPassword } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      toast.error('Invalid reset link', {
        description: 'This link is missing or broken. Request a new password reset email.',
      });
      navigate('/forgot-password');
    }
  }, [token, navigate]);

  const handleSubmit = async (values: { password: string; confirmPassword: string }) => {
    if (!token) return;
    
    resetPassword.mutate(
      { token, password: values.password },
      {
        onSuccess: () => {
          toast.success('Password updated', {
            description: 'You can now sign in with your new password.',
          });
          navigate('/login');
        }
      }
    );
  };

  if (!token) return null;

  return (
    <AuthLayout
      eyebrow="Account recovery"
      headline="Set a new password and keep going"
      points={[
        'Use at least 8 characters',
        'Mix uppercase, lowercase, numbers and symbols',
        'You can sign in right after resetting',
      ]}
      title="Reset your password"
      description="Enter your new password below."
      footer={
        <Link to="/login" className={authLinkClass}>
          Back to Sign In
        </Link>
      }
    >
      <Formik
        initialValues={{ password: '', confirmPassword: '' }}
        validationSchema={resetPasswordSchema}
        onSubmit={handleSubmit}
      >
        {({ errors, touched, isSubmitting }) => (
          <Form className="space-y-4">
            <Field name="password">
              {({ field }: any) => (
                <Input
                  {...field}
                  type="password"
                  label="New Password"
                  placeholder="Enter your new password"
                  error={touched.password && errors.password ? errors.password : undefined}
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
                  error={
                    touched.confirmPassword && errors.confirmPassword
                      ? errors.confirmPassword
                      : undefined
                  }
                />
              )}
            </Field>

            <Button
              type="submit"
              loading={isSubmitting || resetPassword.isPending}
              className={authPrimaryButton}
            >
              Reset Password
            </Button>
          </Form>
        )}
      </Formik>
    </AuthLayout>
  );
};

export default ResetPassword;
