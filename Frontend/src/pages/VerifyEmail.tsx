
import React, { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { toast } from '../lib/toast';
import { Button } from "../components/Ui/auth-controls";
import AuthLayout, {
  authLinkClass,
  authOutlineButton,
  authPrimaryButton,
} from "../components/Ui/auth-Layout";
import { useDispatch, useSelector } from "react-redux";
import { setCredentials } from "../store/slices/authSlice";
import axios from "axios";
import { API_BASE_URL } from "../lib/api-origin";

const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const dispatch = useDispatch();

  const user = useSelector((state: any) => state.auth.user);

  const [verifyState, setVerifyState] = useState<{
    isPending: boolean;
    isError: boolean;
    isSuccess: boolean;
  }>({
    isPending: false,
    isError: false,
    isSuccess: false,
  });

  const [resendState, setResendState] = useState<{ isPending: boolean }>({
    isPending: false,
  });

  useEffect(() => {
    const verify = async () => {
      if (!token) return;
      try {
        setVerifyState({ isPending: true, isError: false, isSuccess: false });

        const res = await axios.post(
          `${API_BASE_URL}/auth/verify-email`,
          { token },
          { withCredentials: true }
        );

        dispatch(setCredentials(res.data.data));
        console.log("credentials",res.data.data)
        setVerifyState({ isPending: false, isError: false, isSuccess: true });
        toast.success("Email verified", {
          description: "Your account is confirmed and ready to use.",
        });
      } catch (err: any) {
        console.error(err);
        setVerifyState({ isPending: false, isError: true, isSuccess: false });
        toast.error("Verification failed", {
          description:
            err.response?.data?.message ||
            "This link may be invalid or expired. Request a new verification email.",
        });
      }
    };
    verify();
  }, [token, dispatch]);

  const handleResendVerification = async () => {
    try {
      setResendState({ isPending: true });

      const res = await axios.post(
        `${API_BASE_URL}/auth/resend-verification`,
        {},
        { withCredentials: true }
      );

      toast.success("Verification email sent", {
        description: res.data.message || "Check your inbox (and spam folder) for the link.",
      });
    } catch (err: any) {
      console.error(err);
      toast.error("Could not resend email", {
        description:
          err.response?.data?.message ||
          "Please wait a moment and try again.",
      });
    } finally {
      setResendState({ isPending: false });
    }
  };

  const points = [
    "Click the link we emailed you",
    "Check your spam folder if it's missing",
    "Resend the email any time",
  ];

  if (token && verifyState.isPending) {
    return (
      <AuthLayout
        eyebrow="Email verification"
        headline="Verifying your email address"
        points={points}
        title="Verifying your email..."
        description="Please wait while we verify your email address."
      >
        <div className="flex justify-center py-2">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-[rgb(var(--color-text-primary))]" />
        </div>
      </AuthLayout>
    );
  }

  if (token && verifyState.isError) {
    return (
      <AuthLayout
        eyebrow="Email verification"
        headline="That link didn't work"
        points={points}
        title="Verification Failed"
        description="The verification link is invalid or has expired."
      >
        <Link to="/dashboard" className={`${authOutlineButton} block text-center`}>
          Go to Dashboard
        </Link>
      </AuthLayout>
    );
  }

  if (token && verifyState.isSuccess) {
    return (
      <AuthLayout
        eyebrow="Email verification"
        headline="You're verified and ready to go"
        points={points}
        title="Email Verified!"
        description="Your email address has been successfully verified. You now have access to all features of your account."
      >
        <Link to="/dashboard">
          <Button className={authPrimaryButton}>Go to Dashboard</Button>
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      eyebrow="Email verification"
      headline="One quick step to verify your email"
      points={points}
      title="Check Your Email"
      description={`We've sent a verification link to ${user?.email ?? 'your email'}`}
      footer={
        <Link to="/dashboard" className={authLinkClass}>
          Skip for now (limited access)
        </Link>
      }
    >
      <p className="mb-5 text-center font-[var(--font-notion)] text-sm text-[rgb(var(--color-steel))]">
        Click the link in your email to verify your account. If you don&apos;t see the
        email, check your spam folder.
      </p>

      <Button
        onClick={handleResendVerification}
        loading={resendState.isPending}
        variant="outline"
        className={authOutlineButton}
      >
        Resend Verification Email
      </Button>
    </AuthLayout>
  );
};

export default VerifyEmail;
