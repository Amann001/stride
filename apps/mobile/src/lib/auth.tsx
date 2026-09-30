import type { AuthResponse, User } from '@repo/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, ApiError, setAuthToken } from './api';
import { storage } from './storage';

// Keeps track of who is logged in. The login token is saved in the iPhone's
// secure keychain so you stay logged in after closing the app.

const TOKEN_KEY = 'auth_token';

interface AuthState {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (input: { name: string; bio?: string; location?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // On app start, reuse a saved token if it is still valid.
  useEffect(() => {
    (async () => {
      try {
        const token = await storage.get(TOKEN_KEY);
        if (token) {
          setAuthToken(token);
          setUser(await api.me());
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          await storage.remove(TOKEN_KEY);
          setAuthToken(null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const finishLogin = useCallback(async ({ token, user }: AuthResponse) => {
    await storage.set(TOKEN_KEY, token);
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
        await storage.remove(TOKEN_KEY);
        setAuthToken(null);
        setUser(null);
      },
      updateProfile: async (input) => setUser(await api.updateProfile(input)),
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
