"use client";

import type { AuthResponse, User } from "@repo/shared";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { api, ApiError, setAuthToken } from "./api";

// Keeps track of who is logged in on the website. The token is kept in localStorage
// for simplicity; a production site would move it to an httpOnly cookie.

const TOKEN_KEY = "auth_token";

interface AuthState {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    setAuthToken(token);
    api
      .me()
      .then(setUser)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          localStorage.removeItem(TOKEN_KEY);
          setAuthToken(null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const finishLogin = useCallback(({ token, user }: AuthResponse) => {
    localStorage.setItem(TOKEN_KEY, token);
    setAuthToken(token);
    setUser(user);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      signIn: async (email, password) => finishLogin(await api.login(email, password)),
      signUp: async (name, email, password) => finishLogin(await api.register(name, email, password)),
      signOut: () => {
        localStorage.removeItem(TOKEN_KEY);
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
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
