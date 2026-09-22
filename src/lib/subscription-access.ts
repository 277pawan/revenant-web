import type { AuthUser } from "../types/api";

/** Cloud dashboard + managed drills require active Starter (or paid) subscription. */
export function canAccessCloudDashboard(
  user: Pick<AuthUser, "subscriptionActive"> | null | undefined
): boolean {
  return user?.subscriptionActive === true;
}
