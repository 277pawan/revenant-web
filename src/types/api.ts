// API contract types — keep in sync with revenant-cloud/packages/shared
// When API changes, update this file (or generate from OpenAPI later).

export type UserRole = "admin" | "executor" | "viewer";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  organizationId: string;
  organizationName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface RegisterRequest {
  organizationName: string;
  email: string;
  password: string;
}
