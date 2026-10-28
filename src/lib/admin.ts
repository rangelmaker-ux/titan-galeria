export const ADMIN_EMAIL = "rangelmaker@gmail.com";
export function isAdmin(user: { email?: string | null } | null | undefined) { return user?.email?.toLowerCase() === ADMIN_EMAIL; }
