import { Spin } from 'antd';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';

export const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { auth, loading } = useAuth();

  if (loading) {
    return <Spin style={{ margin: 48 }} />;
  }

  if (!auth) {
    return <Navigate to="/login" replace />;
  }

  return children;
};
