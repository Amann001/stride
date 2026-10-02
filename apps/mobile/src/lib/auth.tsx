import type { AuthResponse, User } from '@repo/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, ApiError, setAuthToken } from './api';
import { storage } from './storage';

// Keeps track of who is logged in. The login token is saved in the iPhone's
// secure keychain so you stay logged in after closing the app.

const TOKEN_KEY = 'auth_token';
// A copy of your profile, so the app can open instantly (and offline) without waiting for the server.
const USER_KEY = 'auth_user';

interface AuthState {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (input: { name: string; bio?: string; location?: string }) => Promise<void>;
  // Logs out every other phone; this one stays signed in with a fresh login.
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  // "Forgot password": the emailed code plus a new password signs you in.
  resetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Remembers the latest profile on the phone (failures are harmless: it's only a shortcut).
  const keepUser = useCallback((u: User) => {
    setUser(u);
    storage.set(USER_KEY, JSON.stringify(u)).catch(() => {});
  }, []);

  const forgetLogin = useCallback(async () => {
    await Promise.all([storage.remove(TOKEN_KEY), storage.remove(USER_KEY)]).catch(() => {});
    setAuthToken(null);
    setUser(null);
  }, []);

  // On app start: if you were logged in, open straight away with your saved profile, then
  // refresh it from the server in the background. Only a "not logged in" answer from the
  // server logs you out; no signal or a sleeping server never does.
  useEffect(() => {
    (async () => {
      let cached: User | null = null;
      try {
        const token = await storage.get(TOKEN_KEY);
        if (!token) return;
        setAuthToken(token);
        const saved = await storage.get(USER_KEY);
        cached = saved ? (JSON.parse(saved) as User) : null;
        if (cached) {
          setUser(cached);
          setLoading(false);
          api.me().then(keepUser, async (err) => {
            if (err instanceof ApiError && err.status === 401) await forgetLogin();
          });
          return;
        }
        // Logged in before this version (no saved profile yet): ask the server once.
        keepUser(await api.me());
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) await forgetLogin();
      } finally {
        if (!cached) setLoading(false);
      }
    })();
  }, [keepUser, forgetLogin]);

  const finishLogin = useCallback(
    async ({ token, user }: AuthResponse) => {
      await storage.set(TOKEN_KEY, token);
      setAuthToken(token);
      keepUser(user);
    },
    [keepUser],
  );

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      signIn: async (email, password) => finishLogin(await api.login(email, password)),
      signUp: async (name, email, password) => finishLogin(await api.register(name, email, password)),
      signOut: forgetLogin,
      updateProfile: async (input) => keepUser(await api.updateProfile(input)),
      changePassword: async (current, next) => finishLogin(await api.changePassword(current, next)),
      resetPassword: async (email, code, next) => finishLogin(await api.resetPassword(email, code, next)),
    }),
    [user, loading, finishLogin, forgetLogin, keepUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
