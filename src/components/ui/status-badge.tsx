import * as React from "react";
import { cn } from "@/lib/utils";

export type StatusType =
  // Job Statuses
  | "scheduled"
  | "in_progress"
  | "completed"
  | "on_hold"
  | "cancelled"
  | "new"
  // Priorities
  | "low"
  | "medium"
  | "high"
  | "urgent"
  // Invoice / Payment Statuses
  | "paid"
  | "partially_paid"
  | "issued"
  | "overdue"
  | "draft"
  // Quote Statuses
  | "sent"
  | "accepted"
  | "rejected"
  | "expired"
  | "void"
  // Equipment Condition
  | "operational"
  | "needs_service"
  | "under_repair"
  | "decommissioned"
  // Contract
  | "active"
  | "renewal_due";

interface StatusBadgeProps {
  status: StatusType | string;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const norm = status.toLowerCase();

  let styles = "bg-slate-100 text-slate-700 border-slate-200";
  let displayLabel = label || status.replace(/_/g, " ");

  switch (norm) {
    // Green / Success
    case "completed":
    case "paid":
    case "accepted":
    case "operational":
    case "active":
      styles = "bg-emerald-50 text-emerald-700 border-emerald-200";
      break;

    // Blue / Info
    case "scheduled":
    case "issued":
    case "sent":
    case "new":
    case "low":
      styles = "bg-blue-50 text-blue-700 border-blue-200";
      break;

    // Amber / Warning / In-Progress
    case "in_progress":
    case "medium":
    case "partially_paid":
    case "needs_service":
    case "renewal_due":
      styles = "bg-amber-50 text-amber-700 border-amber-200";
      if (norm === "in_progress" && !label) displayLabel = "In Progress";
      if (norm === "partially_paid" && !label) displayLabel = "Partially Paid";
      if (norm === "needs_service" && !label) displayLabel = "Needs Service";
      if (norm === "renewal_due" && !label) displayLabel = "Renewal Due";
      break;

    // Red / High / Urgent / Overdue / Rejected / Void
    case "high":
    case "urgent":
    case "overdue":
    case "rejected":
    case "void":
    case "under_repair":
      styles = "bg-rose-50 text-rose-700 border-rose-200";
      if (norm === "under_repair" && !label) displayLabel = "Under Repair";
      break;

    // Neutral / Draft / On Hold / Cancelled
    case "draft":
    case "on_hold":
    case "cancelled":
    case "expired":
    case "decommissioned":
      styles = "bg-slate-100 text-slate-700 border-slate-200";
      if (norm === "on_hold" && !label) displayLabel = "On Hold";
      break;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize tracking-tight",
        styles,
        className
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {displayLabel}
    </span>
  );
}
