import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type {
  AcceptInviteRequest,
  AuthUser,
  LoginRequest,
  RegisterRequest,
} from "../types/api";
import { api } from "./api";

const TOKEN_KEY = "revenant_token"; // fallback if cookie blocked; API also sets httpOnly cookie

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  login: (body: LoginRequest) => Promise<AuthUser>;
  register: (body: RegisterRequest) => Promise<AuthUser>;
  acceptInvite: (body: AcceptInviteRequest) => Promise<AuthUser>;
  logout: () => void;
  /** Re-fetch /me — picks up plan changes from DB (e.g. manual Pro grant) */
  refreshUser: () => Promise<AuthUser | null>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async (): Promise<AuthUser | null> => {
    try {
      const { user } = await api.me();
      setUser(user);
      return user;
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    refreshSession().finally(() => setLoading(false));
  }, [refreshSession]);

  useEffect(() => {
    const sync = () => {
      void refreshSession();
    };
    window.addEventListener("focus", sync);
    return () => window.removeEventListener("focus", sync);
  }, [refreshSession]);

  const login = useCallback(async (body: LoginRequest) => {
    const res = await api.login(body);
    localStorage.setItem(TOKEN_KEY, res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(async (body: RegisterRequest) => {
    const res = await api.register(body);
    localStorage.setItem(TOKEN_KEY, res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const acceptInvite = useCallback(async (body: AcceptInviteRequest) => {
    const res = await api.acceptInvite(body);
    localStorage.setItem(TOKEN_KEY, res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    await api.logout();
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      acceptInvite,
      logout,
      refreshUser: refreshSession,
    }),
    [user, loading, login, register, acceptInvite, logout, refreshSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
