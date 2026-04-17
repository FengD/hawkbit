import axios from 'axios';
import { buildApiUrl } from '../config/env';
import type { AuthState } from '../types/auth';

const STORAGE_KEY = 'hawkbit-react-ui-auth';

const getStoredAuth = (): AuthState | null => {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthState;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
};

export const storeAuth = (auth: AuthState | null): void => {
  if (!auth) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
};

export const readStoredAuth = (): AuthState | null => getStoredAuth();

export const httpClient = axios.create({
  baseURL: import.meta.env.DEV ? '/rest/v1' : buildApiUrl('/rest/v1'),
  timeout: 30000,
});

httpClient.interceptors.request.use((config) => {
  const auth = getStoredAuth();
  if (!auth) {
    return config;
  }

  if (auth.username && auth.password) {
    config.headers.Authorization = `Basic ${window.btoa(`${auth.username}:${auth.password}`)}`;
  }

  return config;
});
