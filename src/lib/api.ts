import type {
  AuditEventResource,
  AuthUser,
  CreateDatabaseRequest,
  CreateJobRequest,
  CreateScheduleRequest,
  CreateWebhookRequest,
  CreateWebhookResponse,
  AuthProvidersResponse,
  DashboardOverview,
  DashboardRpoTrend,
  DashboardRtoTrend,
  RecoveryChallengeResource,
  ReadinessHistoryPoint,
  AcceptInviteRequest,
  ValidationPlanTemplateResource,
  ValidationPlanTemplateDetail,
  TeamInviteResource,
  EvidenceArtifactResource,
  GenerateValidationYamlRequest,
  GenerateValidationYamlResponse,
  InvitePreviewResponse,
  PlanServicesResponse,
  IssueRunnerTokenResponse,
  DatabaseResource,
  InviteTeamMemberRequest,
  JobDetailResource,
  JobResource,
  LoginRequest,
  LoginResponse,
  Paginated,
  RegisterRequest,
  ScheduleResource,
  TeamMemberResource,
  UpdateDatabaseRequest,
  UpdateScheduleRequest,
  UpdateTeamMemberRequest,
  UpsertValidationPlanRequest,
  ValidationPlanResource,
  YamlComposerStatus,
  WebhookEndpointResource,
} from "../types/api";

import { site } from "./site";

const API_URL = site.apiUrl;
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

async function downloadAttachment(path: string, filename: string): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Download failed (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const api = {
  getAuthProviders(): Promise<AuthProvidersResponse> {
    return request("/api/v1/auth/providers");
  },

  getInvitePreview(token: string): Promise<{ invite: InvitePreviewResponse }> {
    return request(`/api/v1/auth/invite/${encodeURIComponent(token)}`);
  },

  login(body: LoginRequest): Promise<LoginResponse> {
    return request("/api/v1/auth/login", { method: "POST", body: JSON.stringify(body) });
  },

  register(body: RegisterRequest): Promise<LoginResponse> {
    return request("/api/v1/auth/register", { method: "POST", body: JSON.stringify(body) });
  },

  acceptInvite(body: AcceptInviteRequest): Promise<LoginResponse> {
    return request("/api/v1/auth/accept-invite", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  forgotPassword(email: string): Promise<{ ok: true }> {
    return request("/api/v1/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  resetPassword(token: string, password: string): Promise<{ ok: true }> {
    return request("/api/v1/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    });
  },

  me(): Promise<{ user: AuthUser }> {
    return request("/api/v1/me");
  },

  getDashboardOverview(): Promise<{ overview: DashboardOverview }> {
    return request("/api/v1/dashboard/overview");
  },

  getDashboardRtoTrends(): Promise<{ trends: DashboardRtoTrend }> {
    return request("/api/v1/dashboard/rto-trends");
  },

  getDashboardRpoTrends(): Promise<{ trends: DashboardRpoTrend }> {
    return request("/api/v1/dashboard/rpo-trends");
  },

  getReadinessHistory(databaseId: string): Promise<{ history: ReadinessHistoryPoint[] }> {
    return request(`/api/v1/databases/${databaseId}/readiness/history`);
  },

  listRecoveryChallenges(
    databaseId: string
  ): Promise<{ challenges: RecoveryChallengeResource[] }> {
    return request(`/api/v1/databases/${databaseId}/challenges`);
  },

  createRecoveryChallenge(
    databaseId: string,
    body: { name: string; strategy: "latest" | "days_ago"; daysAgo?: number }
  ): Promise<{ challenge: RecoveryChallengeResource }> {
    return request(`/api/v1/databases/${databaseId}/challenges`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  runRecoveryChallenge(challengeId: string): Promise<{ jobId: string }> {
    return request(`/api/v1/challenges/${challengeId}/run`, { method: "POST" });
  },

  deleteRecoveryChallenge(challengeId: string): Promise<void> {
    return request(`/api/v1/challenges/${challengeId}`, { method: "DELETE" });
  },

  listValidationPlanTemplates(): Promise<{ templates: ValidationPlanTemplateResource[] }> {
    return request("/api/v1/validation-plans/templates");
  },

  getValidationPlanTemplate(
    templateId: string
  ): Promise<{ template: ValidationPlanTemplateDetail }> {
    return request(`/api/v1/validation-plans/templates/${templateId}`);
  },

  logout(): Promise<{ ok: boolean }> {
    return request("/api/v1/auth/logout", { method: "POST" });
  },

  listDatabases(
    page = 1,
    pageSize = 20,
    search?: string
  ): Promise<Paginated<DatabaseResource>> {
    return request(withQuery("/api/v1/databases", { page, pageSize, search }));
  },

  getDatabaseReadiness(
    id: string
  ): Promise<{ readiness: import("../types/api").RecoveryReadinessResource }> {
    return request(`/api/v1/databases/${id}/readiness`);
  },

  getRecoveryContract(
    databaseId: string
  ): Promise<{ contract: import("../types/api").RecoveryContractResource }> {
    return request(`/api/v1/databases/${databaseId}/recovery-contract`);
  },

  upsertRecoveryContract(
    databaseId: string,
    body: { yamlText: string }
  ): Promise<{ contract: import("../types/api").RecoveryContractResource }> {
    return request(`/api/v1/databases/${databaseId}/recovery-contract`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },

  getRecoveryDrift(
    databaseId: string
  ): Promise<{ drift: { events: import("../types/api").DriftEventResource[] } }> {
    return request(`/api/v1/databases/${databaseId}/drift`);
  },

  async downloadRecoveryPassportPdf(jobId: string): Promise<void> {
    await downloadAttachment(
      `/api/v1/jobs/${jobId}/passport/pdf`,
      `recovery-passport-${jobId}.pdf`
    );
  },

  async downloadRecoveryPassport(jobId: string): Promise<void> {
    const token = localStorage.getItem("revenant_token");
    const res = await fetch(`${API_URL}/api/v1/jobs/${jobId}/passport`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: "include",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const body = err as { error?: string; code?: string };
      if (body.code === "MIGRATION_REQUIRED" || body.code === "PASSPORT_UNAVAILABLE") {
        throw new Error(
          body.error ??
            "Recovery passport requires migration 0016_recovery_readiness on the API database."
        );
      }
      if (body.code === "NOT_READY") {
        throw new Error(
          "Recovery passport is only available for runs that finish with Pass status."
        );
      }
      throw new Error(body.error ?? "Recovery passport not found for this run");
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recovery-passport-${jobId}.json`;
    a.click();
    URL.revokeObjectURL(url);
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

  listValidationPlans(
    page = 1,
    pageSize = 10,
    search?: string
  ): Promise<Paginated<ValidationPlanResource>> {
    return request(
      withQuery("/api/v1/validation-plans", { page, pageSize, search })
    );
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

  getYamlComposerStatus(): Promise<YamlComposerStatus> {
    return request("/api/v1/validation-plans/composer");
  },

  composeValidationYaml(
    body: GenerateValidationYamlRequest
  ): Promise<GenerateValidationYamlResponse> {
    return request("/api/v1/validation-plans/compose", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  listTeamMembers(page = 1, pageSize = 20): Promise<Paginated<TeamMemberResource>> {
    return request(withQuery("/api/v1/team/members", { page, pageSize }));
  },

  inviteTeamMember(body: InviteTeamMemberRequest): Promise<{ invite: TeamInviteResource }> {
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

  listJobs(
    page = 1,
    pageSize = 20,
    filters?: { databaseId?: string; search?: string }
  ): Promise<Paginated<JobResource>> {
    return request(
      withQuery("/api/v1/jobs", {
        page,
        pageSize,
        databaseId: filters?.databaseId,
        search: filters?.search,
      })
    );
  },

  getJob(id: string): Promise<{ job: JobDetailResource }> {
    return request(`/api/v1/jobs/${id}`);
  },

  createJob(body: CreateJobRequest): Promise<{ job: JobResource }> {
    return request("/api/v1/jobs", { method: "POST", body: JSON.stringify(body) });
  },

  listPlanServices(): Promise<PlanServicesResponse> {
    return request("/api/v1/runners/services");
  },

  issueRunnerToken(databaseId: string): Promise<IssueRunnerTokenResponse> {
    return request(`/api/v1/runners/databases/${databaseId}/issue-token`, {
      method: "POST",
    });
  },

  listSchedules(page = 1, pageSize = 20): Promise<Paginated<ScheduleResource>> {
    return request(withQuery("/api/v1/schedules", { page, pageSize }));
  },

  createSchedule(body: CreateScheduleRequest): Promise<{ schedule: ScheduleResource }> {
    return request("/api/v1/schedules", { method: "POST", body: JSON.stringify(body) });
  },

  updateSchedule(
    id: string,
    body: UpdateScheduleRequest
  ): Promise<{ schedule: ScheduleResource }> {
    return request(`/api/v1/schedules/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  deleteSchedule(id: string): Promise<void> {
    return request(`/api/v1/schedules/${id}`, { method: "DELETE" });
  },

  listEvidence(
    page = 1,
    pageSize = 20,
    search?: string
  ): Promise<Paginated<EvidenceArtifactResource>> {
    return request(withQuery("/api/v1/evidence", { page, pageSize, search }));
  },

  async downloadJobReport(jobId: string): Promise<void> {
    await downloadAttachment(
      `/api/v1/jobs/${jobId}/evidence/download`,
      `revenant-report-${jobId}.json`
    );
  },

  async downloadJobReportPdf(jobId: string): Promise<void> {
    await downloadAttachment(
      `/api/v1/jobs/${jobId}/evidence/pdf`,
      `revenant-evidence-${jobId}.pdf`
    );
  },

  async downloadEvidence(id: string): Promise<void> {
    await downloadAttachment(
      `/api/v1/evidence/${id}/download`,
      `evidence-${id}.json`
    );
  },

  async downloadEvidencePdf(id: string): Promise<void> {
    await downloadAttachment(
      `/api/v1/evidence/${id}/pdf`,
      `revenant-evidence-${id}.pdf`
    );
  },

  listWebhooks(page = 1, pageSize = 20): Promise<Paginated<WebhookEndpointResource>> {
    return request(withQuery("/api/v1/webhooks", { page, pageSize }));
  },

  createWebhook(body: CreateWebhookRequest): Promise<CreateWebhookResponse> {
    return request("/api/v1/webhooks", { method: "POST", body: JSON.stringify(body) });
  },

  listWebhookProviders(): Promise<{ providers: Array<{ id: string; name: string; description: string; setupHint: string }> }> {
    return request("/api/v1/webhooks/providers");
  },

  updateWebhook(
    id: string,
    body: Partial<CreateWebhookRequest>
  ): Promise<{ endpoint: WebhookEndpointResource }> {
    return request(`/api/v1/webhooks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  deleteWebhook(id: string): Promise<void> {
    return request(`/api/v1/webhooks/${id}`, { method: "DELETE" });
  },

  listAuditEvents(
    page = 1,
    pageSize = 20,
    search?: string
  ): Promise<Paginated<AuditEventResource>> {
    return request(withQuery("/api/v1/audit", { page, pageSize, search }));
  },

  getOrganizationSettings(): Promise<{ organization: import("../types/api").OrganizationSettingsResource }> {
    return request("/api/v1/settings/organization");
  },

  updateOrganizationSettings(
    body: import("../types/api").UpdateOrganizationRequest
  ): Promise<{ organization: import("../types/api").OrganizationSettingsResource }> {
    return request("/api/v1/settings/organization", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  getSubscription(): Promise<{ subscription: import("../types/api").OrgSubscriptionSummary }> {
    return request("/api/v1/billing/subscription");
  },

};
