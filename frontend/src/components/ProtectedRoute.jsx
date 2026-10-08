import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import Loading from './Loading';

export default function ProtectedRoute({ children, allowedRoles = null }) {
  const { user, loading } = useAuth();
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const verifyAuth = async () => {
      const token = localStorage.getItem('auth_token');

      if (!token) {
        setIsAuthenticated(false);
        setIsLoading(false);
        return;
      }

      try {
        await api.post('/auth/verify', {}, { headers: { Authorization: `Bearer ${token}` } });
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Invalid or expired token', error);
        localStorage.removeItem('auth_token');
        setIsAuthenticated(false);
      } finally {
        setIsLoading(false);
      }
    };

    verifyAuth();
  }, []);

  if (isLoading || loading) {
    return <Loading fullScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Their own home, not "/": that would bounce members off admin routes forever.
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === 'admin' ? '/' : '/member-home'} replace />;
  }

  return children;
}
