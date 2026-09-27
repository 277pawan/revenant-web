import type { RecoveryGateResult, RecoveryReadinessResult } from "../types/api";

/** Mirrors API evaluateRecoveryGate — keep in sync with revenant-cloud shared package. */
export function evaluateRecoveryGateClient(
  readiness: RecoveryReadinessResult,
  options?: { minScore?: number }
): RecoveryGateResult {
  const minScore = options?.minScore ?? 70;
  const blockers: string[] = [];

  if (!readiness.lastVerifiedAt) {
    blockers.push("No passing restore drill yet");
  }
  if (readiness.status === "not_ready") {
    blockers.push("Workflow is not recovery-ready");
  }
  if (readiness.score < minScore) {
    blockers.push(`Readiness score ${readiness.score} is below minimum ${minScore}`);
  }

  for (const dim of readiness.dimensions) {
    if (dim.status === "fail") {
      blockers.push(`${dim.label} failed`);
    }
  }

  if (readiness.regression?.detected && readiness.regression.severity === "critical") {
    blockers.push(readiness.regression.message ?? "Recovery regression detected");
  }

  if (readiness.driftStatus === "recovery_invalidated") {
    blockers.push(readiness.driftSummary ?? "Recovery capability invalidated by drift");
  }

  const allowed =
    blockers.length === 0 &&
    readiness.status !== "unknown" &&
    readiness.status !== "not_ready";

  return {
    allowed,
    status: readiness.status,
    score: readiness.score,
    minScore,
    blockers,
    checkedAt: new Date().toISOString(),
  };
}
