import { createContext } from 'react';
import type { AuthState, LoginPayload } from '../types/auth';
import type { PermissionMap } from '../types/api';

export interface AuthContextValue {
  auth: AuthState | null;
  permissions: PermissionMap | null;
  loading: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => void;
  refreshPermissions: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
