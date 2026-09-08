import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { AuthUser, LoginRequest, RegisterRequest } from "../types/api";
import { api } from "./api";

const TOKEN_KEY = "revenant_token"; // fallback if cookie blocked; API also sets httpOnly cookie

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  login: (body: LoginRequest) => Promise<void>;
  register: (body: RegisterRequest) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const { user } = await api.me();
      setUser(user);
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshSession().finally(() => setLoading(false));
  }, [refreshSession]);

  const login = useCallback(
    async (body: LoginRequest) => {
      const res = await api.login(body);
      localStorage.setItem(TOKEN_KEY, res.token);
      setUser(res.user);
    },
    []
  );

  const register = useCallback(
    async (body: RegisterRequest) => {
      const res = await api.register(body);
      localStorage.setItem(TOKEN_KEY, res.token);
      setUser(res.user);
    },
    []
  );

  const logout = useCallback(async () => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    await api.logout();
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
