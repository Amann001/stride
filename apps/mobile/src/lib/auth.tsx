import type { AuthResponse, User } from '@repo/shared';
import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, ApiError, setAuthToken } from './api';

// Keeps track of who is logged in. The login token is saved in the iPhone's
// secure keychain so you stay logged in after closing the app.

const TOKEN_KEY = 'auth_token';

interface AuthState {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // On app start, reuse a saved token if it is still valid.
  useEffect(() => {
    (async () => {
      try {
        const token = await SecureStore.getItemAsync(TOKEN_KEY);
        if (token) {
          setAuthToken(token);
          setUser(await api.me());
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          await SecureStore.deleteItemAsync(TOKEN_KEY);
          setAuthToken(null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const finishLogin = useCallback(async ({ token, user }: AuthResponse) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    setAuthToken(token);
    setUser(user);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      signIn: async (email, password) => finishLogin(await api.login(email, password)),
      signUp: async (name, email, password) => finishLogin(await api.register(name, email, password)),
      signOut: async () => {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        setAuthToken(null);
        setUser(null);
      },
    }),
    [user, loading, finishLogin],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
