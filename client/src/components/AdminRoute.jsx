import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function AdminRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (user?.role !== 'admin') return <Navigate to="/" replace />;

  return children;
}
