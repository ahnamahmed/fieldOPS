/**
 * FieldOps BD — Role Definitions and Server-Side Permission Rules
 */

export type UserRole = "owner" | "admin" | "dispatcher" | "technician" | "finance";

export const ALL_ROLES: UserRole[] = ["owner", "admin", "dispatcher", "technician", "finance"];

export function isOwner(role: UserRole | string | null | undefined): boolean {
  return role === "owner";
}

export function isAdminOrOwner(role: UserRole | string | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

export function canManageTeam(role: UserRole | string | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

export function canManageCustomers(role: UserRole | string | null | undefined): boolean {
  return role === "owner" || role === "admin" || role === "dispatcher";
}

export function canManageJobs(role: UserRole | string | null | undefined): boolean {
  return role === "owner" || role === "admin" || role === "dispatcher";
}

export function canViewAllJobs(role: UserRole | string | null | undefined): boolean {
  return role === "owner" || role === "admin" || role === "dispatcher" || role === "finance";
}

export function isTechnician(role: UserRole | string | null | undefined): boolean {
  return role === "technician";
}

export function canManageQuotes(role: UserRole | string | null | undefined): boolean {
  return role === "owner" || role === "admin" || role === "finance";
}

export function canManageInvoices(role: UserRole | string | null | undefined): boolean {
  return role === "owner" || role === "admin" || role === "finance";
}

export function canRecordPayments(role: UserRole | string | null | undefined): boolean {
  return role === "owner" || role === "admin" || role === "finance";
}

export function canViewFinancialReports(role: UserRole | string | null | undefined): boolean {
  return role === "owner" || role === "admin" || role === "finance";
}

export function getRoleBadgeVariant(role: UserRole | string | null | undefined): {
  label: string;
  className: string;
} {
  switch (role) {
    case "owner":
      return { label: "Owner", className: "bg-purple-100 text-purple-800 border-purple-200" };
    case "admin":
      return { label: "Admin", className: "bg-blue-100 text-blue-800 border-blue-200" };
    case "dispatcher":
      return { label: "Dispatcher", className: "bg-amber-100 text-amber-800 border-amber-200" };
    case "technician":
      return { label: "Technician", className: "bg-emerald-100 text-emerald-800 border-emerald-200" };
    case "finance":
      return { label: "Finance", className: "bg-teal-100 text-teal-800 border-teal-200" };
    default:
      return { label: "Member", className: "bg-slate-100 text-slate-800 border-slate-200" };
  }
}
