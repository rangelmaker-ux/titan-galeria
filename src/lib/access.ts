export type AccountAccess = { plan_source?: string | null; manual_plan?: string | null; paid_until?: string | null; trial_started_at?: string | null; trial_ends_at?: string | null };
export function accountAccess(account: AccountAccess | null | undefined, now = Date.now()): "active" | "trial" | "welcome" | "expired" {
  if (!account) return "expired";
  if (account.plan_source === "admin" || account.manual_plan === "titan") return "active";
  if (account.paid_until && Date.parse(account.paid_until) > now) return "active";
  if (!account.trial_started_at) return "welcome";
  return account.trial_ends_at && Date.parse(account.trial_ends_at) > now ? "trial" : "expired";
}
export const ACCESS_COLUMNS = "plan_source, manual_plan, paid_until, trial_started_at, trial_ends_at";
