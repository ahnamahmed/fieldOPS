export type ReminderType =
  | "visit_overdue"
  | "visit_due_today"
  | "visit_due_soon"
  | "contract_renewal"
  | "invoice_overdue";

export type ReminderStatus = "pending" | "delivered" | "dismissed";

export interface ServiceReminder {
  id: string;
  organizationId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  siteName?: string | null;
  reminderType: ReminderType;
  title: string;
  message: string;
  dueDate: string;
  status: ReminderStatus;
  channel: string;
  contractId?: string | null;
  contractNumber?: string | null;
  contractName?: string | null;
  plannedVisitId?: string | null;
  visitNumber?: number | null;
  jobId?: string | null;
  jobNumber?: string | null;
  deliveredAt?: string | null;
  deliveredBy?: string | null;
  deliveryDetails?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReminderStats {
  overdueCount: number;
  dueTodayCount: number;
  dueSoonCount: number;
  contractRenewalCount: number;
  totalPending: number;
}

export interface WhatsAppMessagePayload {
  recipientPhone: string;
  formattedText: string;
  encodedWhatsAppUrl: string;
  reminderId: string;
}
