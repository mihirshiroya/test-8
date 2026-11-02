import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { API_BASE_URL } from '../lib/api-origin';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import { toast } from '../lib/toast';

import { Button, Input } from '../components/Ui/auth-controls';
import AuthLayout, {
  AuthDivider,
  GoogleIcon,
  authLinkClass,
  authOutlineButton,
  authPrimaryButton,
} from '../components/Ui/auth-Layout';

import { useAppDispatch } from '../hooks/redux';
import { loginUser, setCredentials } from '../store/slices/authSlice';

const loginSchema = Yup.object().shape({
  email: Yup.string()
    .email('Invalid email')
    .required('Email is required'),

  password: Yup.string()
    .required('Password is required'),
});

const Login: React.FC = () => {
   const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [googleLoading, setGoogleLoading] = useState(false);

  const from = (location.state as any)?.from?.pathname || '/dashboard';

  const handleSubmit = async (values: { email: string; password: string }) => {
    try {
      const result = await dispatch(loginUser(values));
      if (loginUser.fulfilled.match(result)) {
        const name = (result.payload as any)?.user?.firstName;
        toast.success(name ? `Welcome back, ${name}!` : 'Welcome back!', {
          description: 'You have signed in successfully.',
        });
        navigate(from, { replace: true });
      } else {
        toast.error('Sign in failed', {
          description:
            (result.payload as string) ||
            'Incorrect email or password. Please check your details and try again.',
        });
      }
    } catch (error) {
      toast.apiError(error, 'Sign in failed');
    }
  };



  const handleGoogleLogin2 = () => {
    if (googleLoading) return; // prevent double-click
    setGoogleLoading(true);

    const popup = window.open(
        `${API_BASE_URL}/auth/google`,
      "Google Login",
      "width=500,height=600"
    );

    if (!popup) {
      setGoogleLoading(false);
      toast.warning('Popup blocked', {
        description: 'Allow popups for this site to continue with Google.',
      });
      return;
    }

    // Setup BroadcastChannel listener
    const channel = new BroadcastChannel("oauth_channel");

    channel.onmessage = (event) => {
      console.log("Message from popup:", event.data);

      if (event.data.type === "OAUTH_SUCCESS") {
        dispatch(
          setCredentials({
            user: event.data.user,
          })
        );

        // Close popup and navigate
        if (popup && !popup.closed) popup.close();
        navigate("/dashboard");

        channel.close();
      }

      if (event.data.type === "OAUTH_ERROR") {
        console.error("OAuth failed:", event.data.error);
        setGoogleLoading(false);
        toast.error('Google sign in failed', {
          description:
            (typeof event.data.error === 'string' && event.data.error) ||
            'We could not sign you in with Google. Please try again.',
        });
        if (popup && !popup.closed) popup.close();
        channel.close();
      }
     
        if (popup.closed) {
          setGoogleLoading(false);
          channel.close();
        }

    };
  };


  return (
    <AuthLayout
      eyebrow="Welcome back"
      headline="Pick up right where you left off"
      points={[
        'Your tasks, notes and calendar in one place',
        'Track time and see your progress daily',
        'Stay in sync across every workspace',
      ]}
      title="Sign in to your account"
      description="Enter your credentials to continue."
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link to="/register" className={authLinkClass}>
            Sign up
          </Link>
        </>
      }
    >
      <Formik
        initialValues={{ email: '', password: '' }}
        validationSchema={loginSchema}
        onSubmit={handleSubmit}
      >
        {({ errors, touched, isSubmitting }) => (
          <Form className="space-y-4">
            <Field name="email">
              {({ field }: any) => (
                <Input
                  {...field}
                  type="email"
                  label="Email address"
                  placeholder="Enter your email"
                  error={touched.email && errors.email ? errors.email : undefined}
                />
              )}
            </Field>

            <Field name="password">
              {({ field }: any) => (
                <Input
                  {...field}
                  type="password"
                  label="Password"
                  placeholder="Enter your password"
                  error={touched.password && errors.password ? errors.password : undefined}
                />
              )}
            </Field>

            <div className="flex justify-end">
              <Link
                to="/forgot-password"
                className=" text-sm font-medium text-[rgb(var(--color-link-blue))] transition-colors duration-150 hover:text-[rgb(var(--color-link-blue-pressed))]"
              >
                Forgot your password?
              </Link>
            </div>

            <Button
              type="submit"
              loading={isSubmitting}
              disabled={isSubmitting}
              className={authPrimaryButton}
            >
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </Button>
          </Form>
        )}
      </Formik>

      <AuthDivider />

      <Button
        type="button"
        variant="outline"
        onClick={handleGoogleLogin2}
        loading={googleLoading}
        disabled={googleLoading}
        className={authOutlineButton}
      >
        {googleLoading ? (
          'Signing in...'
        ) : (
          <>
            <GoogleIcon />
            <span>Sign in with Google</span>
          </>
        )}
      </Button>
    </AuthLayout>
  );
};

export default Login;
