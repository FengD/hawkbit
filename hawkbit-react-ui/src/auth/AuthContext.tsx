import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { managementApi } from '../api/managementApi';
import { readStoredAuth, storeAuth } from '../api/httpClient';
import type { AuthState, LoginPayload } from '../types/auth';
import type { PermissionMap } from '../types/api';
import { AuthContext } from './context';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [auth, setAuth] = useState<AuthState | null>(readStoredAuth());
  const [permissions, setPermissions] = useState<PermissionMap | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshPermissions = useCallback(async () => {
    if (!auth) {
      setPermissions(null);
      return;
    }

    const nextPermissions = await managementApi.loadPermissions();
    setPermissions(nextPermissions);
  }, [auth]);

  useEffect(() => {
    const init = async () => {
      if (!auth) {
        setLoading(false);
        return;
      }

      try {
        await managementApi.probeSession();
        await refreshPermissions();
      } catch {
        storeAuth(null);
        setAuth(null);
        setPermissions(null);
      } finally {
        setLoading(false);
      }
    };

    void init();
  }, [auth, refreshPermissions]);

  const login = useCallback(async (payload: LoginPayload) => {
    const nextAuth: AuthState = {
      username: payload.username,
      password: payload.password,
    };

    storeAuth(nextAuth);
    setAuth(nextAuth);
    await managementApi.probeSession();
    const nextPermissions = await managementApi.loadPermissions();
    setPermissions(nextPermissions);
  }, []);

  const logout = useCallback(() => {
    storeAuth(null);
    setAuth(null);
    setPermissions(null);
  }, []);

  const value = useMemo(
    () => ({
      auth,
      permissions,
      loading,
      login,
      logout,
      refreshPermissions,
    }),
    [auth, permissions, loading, login, logout, refreshPermissions],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
