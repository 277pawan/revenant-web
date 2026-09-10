import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DatabasesPage } from "./pages/DatabasesPage";
import { DatabaseWizardPage } from "./pages/DatabaseWizardPage";
import { DatabaseEditPage } from "./pages/DatabaseEditPage";
import { ValidationPlansPage } from "./pages/ValidationPlansPage";
import { TeamPage } from "./pages/TeamPage";
import { JobsPage } from "./pages/JobsPage";
import { JobDetailPage } from "./pages/JobDetailPage";
import { RunnersPage } from "./pages/RunnersPage";

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
        path="/jobs"
        element={
          <ProtectedRoute>
            <JobsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/jobs/:id"
        element={
          <ProtectedRoute>
            <JobDetailPage />
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
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
