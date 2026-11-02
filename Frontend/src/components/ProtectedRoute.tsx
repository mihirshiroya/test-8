
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireVerification?: boolean;
  redirectTo?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAuth = true,
  requireVerification = false,
  redirectTo = '/login',
}) => {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (requireAuth && !isAuthenticated) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  if (requireVerification && !user?.isEmailVerified) {
    return <Navigate to="/verify-email" replace />;
  }

  if (!requireAuth && isAuthenticated) {
    return <Navigate to="/overview" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
