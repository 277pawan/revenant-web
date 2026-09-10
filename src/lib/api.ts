import type {
  AuthUser,
  CreateDatabaseRequest,
  CreateJobRequest,
  CreateRunnerRequest,
  DatabaseResource,
  InviteTeamMemberRequest,
  JobDetailResource,
  JobResource,
  LoginRequest,
  LoginResponse,
  Paginated,
  RegisterRequest,
  RunnerResource,
  TeamMemberResource,
  UpdateDatabaseRequest,
  UpdateTeamMemberRequest,
  UpsertValidationPlanRequest,
  ValidationPlanResource,
} from "../types/api";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";
const TOKEN_KEY = "revenant_token";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function withQuery(path: string, query?: Record<string, string | number | undefined>) {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== "") params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...authHeaders(),
    ...(options.headers as Record<string, string> | undefined),
  };
  // Fastify rejects empty bodies when Content-Type is application/json
  if (options.body !== undefined && options.body !== null) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers,
  });

  if (res.status === 204) {
    return undefined as T;
  }

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

  listDatabases(page = 1, pageSize = 20): Promise<Paginated<DatabaseResource>> {
    return request(withQuery("/api/v1/databases", { page, pageSize }));
  },

  getDatabase(id: string): Promise<{ database: DatabaseResource }> {
    return request(`/api/v1/databases/${id}`);
  },

  createDatabase(body: CreateDatabaseRequest): Promise<{ database: DatabaseResource }> {
    return request("/api/v1/databases", { method: "POST", body: JSON.stringify(body) });
  },

  updateDatabase(
    id: string,
    body: UpdateDatabaseRequest
  ): Promise<{ database: DatabaseResource }> {
    return request(`/api/v1/databases/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  deleteDatabase(id: string): Promise<void> {
    return request(`/api/v1/databases/${id}`, { method: "DELETE" });
  },

  listValidationPlans(page = 1, pageSize = 20): Promise<Paginated<ValidationPlanResource>> {
    return request(withQuery("/api/v1/validation-plans", { page, pageSize }));
  },

  getValidationPlan(databaseId: string): Promise<{ plan: ValidationPlanResource }> {
    return request(`/api/v1/databases/${databaseId}/validation-plan`);
  },

  upsertValidationPlan(
    databaseId: string,
    body: UpsertValidationPlanRequest
  ): Promise<{ plan: ValidationPlanResource }> {
    return request(`/api/v1/databases/${databaseId}/validation-plan`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },

  deleteValidationPlan(databaseId: string): Promise<void> {
    return request(`/api/v1/databases/${databaseId}/validation-plan`, {
      method: "DELETE",
    });
  },

  listTeamMembers(page = 1, pageSize = 20): Promise<Paginated<TeamMemberResource>> {
    return request(withQuery("/api/v1/team/members", { page, pageSize }));
  },

  inviteTeamMember(body: InviteTeamMemberRequest): Promise<{ member: TeamMemberResource }> {
    return request("/api/v1/team/members", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  updateTeamMember(
    id: string,
    body: UpdateTeamMemberRequest
  ): Promise<{ member: TeamMemberResource }> {
    return request(`/api/v1/team/members/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  removeTeamMember(id: string): Promise<void> {
    return request(`/api/v1/team/members/${id}`, { method: "DELETE" });
  },

  listJobs(page = 1, pageSize = 20): Promise<Paginated<JobResource>> {
    return request(withQuery("/api/v1/jobs", { page, pageSize }));
  },

  getJob(id: string): Promise<{ job: JobDetailResource }> {
    return request(`/api/v1/jobs/${id}`);
  },

  createJob(body: CreateJobRequest): Promise<{ job: JobResource }> {
    return request("/api/v1/jobs", { method: "POST", body: JSON.stringify(body) });
  },

  listRunners(page = 1, pageSize = 20): Promise<Paginated<RunnerResource>> {
    return request(withQuery("/api/v1/runners", { page, pageSize }));
  },

  createRunner(
    body: CreateRunnerRequest
  ): Promise<{ runner: RunnerResource & { token: string } }> {
    return request("/api/v1/runners", { method: "POST", body: JSON.stringify(body) });
  },

  revokeRunner(id: string): Promise<void> {
    return request(`/api/v1/runners/${id}`, { method: "DELETE" });
  },
};
