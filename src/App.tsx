import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { api } from "./lib/api";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DatabasesPage } from "./pages/DatabasesPage";
import { DatabaseWizardPage } from "./pages/DatabaseWizardPage";
import { DatabaseEditPage } from "./pages/DatabaseEditPage";
import { ValidationPlansPage } from "./pages/ValidationPlansPage";
import { TeamPage } from "./pages/TeamPage";
import { RunnersPage } from "./pages/RunnersPage";
import { WorkflowsListPage } from "./pages/WorkflowsListPage";
import { WorkflowDetailPage } from "./pages/WorkflowDetailPage";
import { RunDetailPage } from "./pages/RunDetailPage";
import { SchedulesPage } from "./pages/SchedulesPage";
import { EvidenceVaultPage } from "./pages/EvidenceVaultPage";
import { WebhooksPage } from "./pages/WebhooksPage";
import { AuditLogPage } from "./pages/AuditLogPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-600">
        Loading…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function LegacyJobRedirect() {
  const { id } = useParams<{ id: string }>();
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    void api.getJob(id).then((res) => {
      setTarget(`/workflows/${res.job.databaseId}/runs/${res.job.id}`);
    });
  }, [id]);

  if (!target) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Loading…
      </div>
    );
  }
  return <Navigate to={target} replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/databases"
        element={
          <ProtectedRoute>
            <DatabasesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/databases/new"
        element={
          <ProtectedRoute>
            <DatabaseWizardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/databases/:id/edit"
        element={
          <ProtectedRoute>
            <DatabaseEditPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/workflows"
        element={
          <ProtectedRoute>
            <WorkflowsListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/workflows/:databaseId"
        element={
          <ProtectedRoute>
            <WorkflowDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/workflows/:databaseId/runs/:jobId"
        element={
          <ProtectedRoute>
            <RunDetailPage />
          </ProtectedRoute>
        }
      />
      <Route path="/jobs" element={<Navigate to="/workflows" replace />} />
      <Route
        path="/jobs/:id"
        element={
          <ProtectedRoute>
            <LegacyJobRedirect />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/validation-plans"
        element={
          <ProtectedRoute>
            <ValidationPlansPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/team"
        element={
          <ProtectedRoute>
            <TeamPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/runners"
        element={
          <ProtectedRoute>
            <RunnersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/schedules"
        element={
          <ProtectedRoute>
            <SchedulesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/evidence"
        element={
          <ProtectedRoute>
            <EvidenceVaultPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/webhooks"
        element={
          <ProtectedRoute>
            <WebhooksPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/audit-log"
        element={
          <ProtectedRoute>
            <AuditLogPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
