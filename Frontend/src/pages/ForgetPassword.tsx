
import React from 'react';
import { Link } from 'react-router-dom';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';

import { Button, Input } from '../components/Ui/auth-controls';

import AuthLayout, {
  authLinkClass,
  authPrimaryButton,
} from '../components/Ui/auth-Layout';

import { useAuth } from '../hooks/useAuth';

const forgotPasswordSchema = Yup.object().shape({
  email: Yup.string()
    .email('Invalid email')
    .required('Email is required'),
});

const ForgotPassword: React.FC = () => {
  const { forgotPassword } = useAuth();

  const handleSubmit = async (values: { email: string }) => {
    forgotPassword.mutate(values);
  };

  return (
    <AuthLayout
      eyebrow="Account recovery"
      headline="Locked out? We'll get you back in"
      points={[
        'Enter the email you signed up with',
        'We send a secure reset link',
        'Choose a new password and sign in',
      ]}
      title="Forgot your password?"
      description="Enter your email address and we'll send you a link to reset your password."
      footer={
        <Link to="/login" className={authLinkClass}>
          Back to Sign In
        </Link>
      }
    >
      <Formik
        initialValues={{ email: '' }}
        validationSchema={forgotPasswordSchema}
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
                  error={
                    touched.email && errors.email
                      ? errors.email
                      : undefined
                  }
                />
              )}
            </Field>

            <Button
              type="submit"
              loading={isSubmitting || forgotPassword.isPending}
              disabled={isSubmitting || forgotPassword.isPending}
              className={authPrimaryButton}
            >
              Send Reset Link
            </Button>
          </Form>
        )}
      </Formik>
    </AuthLayout>
  );
};

export default ForgotPassword;
