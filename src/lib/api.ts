import type { AuthUser, LoginRequest, LoginResponse, RegisterRequest } from "../types/api";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";
const TOKEN_KEY = "revenant_token";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...options.headers,
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  login(body: LoginRequest): Promise<LoginResponse> {
    return request("/api/v1/auth/login", { method: "POST", body: JSON.stringify(body) });
  },

  register(body: RegisterRequest): Promise<LoginResponse> {
    return request("/api/v1/auth/register", { method: "POST", body: JSON.stringify(body) });
  },

  me(): Promise<{ user: AuthUser }> {
    return request("/api/v1/me");
  },

  logout(): Promise<{ ok: boolean }> {
    return request("/api/v1/auth/logout", { method: "POST" });
  },
};
