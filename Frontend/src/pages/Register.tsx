import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
import {
  registerUser,
  setCredentials,
} from '../store/slices/authSlice';

const registerSchema = Yup.object().shape({
  firstName: Yup.string()
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name must be less than 50 characters')
    .matches(
      /^[a-zA-Z\s]+$/,
      'First name can only contain letters and spaces'
    )
    .required('First name is required'),

  lastName: Yup.string()
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name must be less than 50 characters')
    .matches(
      /^[a-zA-Z\s]+$/,
      'Last name can only contain letters and spaces'
    )
    .required('Last name is required'),

  email: Yup.string()
    .email('Invalid email')
    .required('Email is required'),

  password: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .required('Password is required'),

  confirmPassword: Yup.string()
    .oneOf(
      [Yup.ref('password')],
      'Passwords must match'
    )
    .required('Confirm password is required'),
});

interface RegisterFormValues {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const Register: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
   const [googleLoading, setGoogleLoading] = useState(false);

  const handleSubmit = async (values: RegisterFormValues) => {
    try {
      const { confirmPassword, ...registerData } = values;
      const result = await dispatch(registerUser(registerData));
      if (registerUser.fulfilled.match(result)) {
        toast.success('Account created', {
          description: 'Check your inbox for a verification link to confirm your email.',
        });
        navigate('/dashboard');
      } else {
        toast.error('Could not create account', {
          description:
            (result.payload as string) ||
            'Please review your details and try again.',
        });
      }
    } catch (error) {
      toast.apiError(error, 'Could not create account');
    }
  };


   const handleGoogleLogin2 = () => {
      if (googleLoading) return;
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
  
      const channel = new BroadcastChannel("oauth_channel");
  
      channel.onmessage = (event) => {
        console.log("Message from popup:", event.data);
  
        if (event.data.type === "OAUTH_SUCCESS") {
          dispatch(
            setCredentials({
              user: event.data.user,
            })
          );
  
          if (popup && !popup.closed) popup.close();
          navigate("/dashboard");
  
          channel.close();
        }
  
        if (event.data.type === "OAUTH_ERROR") {
          console.error("OAuth failed:", event.data.error);
  setGoogleLoading(false);
  toast.error('Google sign up failed', {
    description:
      (typeof event.data.error === 'string' && event.data.error) ||
      'We could not create your account with Google. Please try again.',
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
      eyebrow="Get started"
      headline="Join us to get more done, every day"
      points={[
        'Create your free account in under a minute',
        'Plan tasks, notes and time in one workspace',
        'Verify your email to unlock every feature',
      ]}
      title="Create your account"
      description="Fill in your details to get started."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className={authLinkClass}>
            Sign in
          </Link>
        </>
      }
    >
      <Formik
        initialValues={{
          firstName: '',
          lastName: '',
          email: '',
          password: '',
          confirmPassword: '',
        }}
        validationSchema={registerSchema}
        onSubmit={handleSubmit}
      >
        {({ errors, touched, isSubmitting }) => (
          <Form className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field name="firstName">
                {({ field }: any) => (
                  <Input
                    {...field}
                    type="text"
                    label="First Name"
                    placeholder="First name"
                    error={touched.firstName && errors.firstName ? errors.firstName : undefined}
                  />
                )}
              </Field>

              <Field name="lastName">
                {({ field }: any) => (
                  <Input
                    {...field}
                    type="text"
                    label="Last Name"
                    placeholder="Last name"
                    error={touched.lastName && errors.lastName ? errors.lastName : undefined}
                  />
                )}
              </Field>
            </div>

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

            <Field name="confirmPassword">
              {({ field }: any) => (
                <Input
                  {...field}
                  type="password"
                  label="Confirm Password"
                  placeholder="Confirm your password"
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
              loading={isSubmitting}
              disabled={isSubmitting}
              className={authPrimaryButton}
            >
              {isSubmitting ? 'Creating account...' : 'Create Account'}
            </Button>
          </Form>
        )}
      </Formik>

      {/* <AuthDivider />

      <Button
        type="button"
        variant="outline"
        onClick={handleGoogleLogin2}
        loading={googleLoading}
        disabled={googleLoading}
        className={authOutlineButton}
      >
        {googleLoading ? (
          'Signing up...'
        ) : (
          <>
            <GoogleIcon />
            <span>Sign up with Google</span>
          </>
        )}
      </Button> */}
    </AuthLayout>
  );
};

export default Register;
