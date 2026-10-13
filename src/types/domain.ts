import type { Database } from "./database.types";

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];

// Convenience Row Types
export type Organization = Tables<"organizations">;
export type OrganizationMember = Tables<"organization_members">;
export type Profile = Tables<"profiles">;
export type Customer = Tables<"customers">;
export type ServiceSite = Tables<"service_sites">;
export type EquipmentAsset = Tables<"equipment_assets">;
export type ServiceRequest = Tables<"service_requests">;
export type Job = Tables<"jobs">;
export type JobAssignment = Tables<"job_assignments">;
export type JobVisit = Tables<"job_visits">;
export type JobChecklist = Tables<"job_checklists">;
export type JobPartUsed = Tables<"job_parts_used">;
export type JobAttachment = Tables<"job_attachments">;
export type Quote = Tables<"quotes">;
export type QuoteItem = Tables<"quote_items">;
export type Invoice = Tables<"invoices">;
export type InvoiceItem = Tables<"invoice_items">;
export type Payment = Tables<"payments">;
export type ServiceContract = Tables<"service_contracts">;
export type ServiceContractAsset = Tables<"service_contract_assets">;
export type ServiceContractSchedule = Tables<"service_contract_schedules">;
export type ActivityLog = Tables<"activity_logs">;

// Status & Type Unions
export type UserRole = "owner" | "admin" | "dispatcher" | "technician" | "finance";

export type CustomerType = "residential" | "commercial" | "corporate";

export type EquipmentType =
  | "split_ac"
  | "cassette_ac"
  | "standing_ac"
  | "vrf_system"
  | "chiller"
  | "cold_room"
  | "refrigerator"
  | "deep_freezer"
  | "other";

export type RefrigerantType =
  | "R22"
  | "R32"
  | "R410A"
  | "R134a"
  | "R404A"
  | "R290"
  | "other";

export type JobType =
  | "repair"
  | "master_service"
  | "gas_charging"
  | "installation"
  | "uninstallation"
  | "inspection"
  | "amc_routine";

export type JobPriority = "low" | "medium" | "high" | "urgent";

export type JobStatus =
  | "new"
  | "scheduled"
  | "in_progress"
  | "on_hold"
  | "completed"
  | "cancelled";

export type VisitStatus =
  | "scheduled"
  | "en_route"
  | "started"
  | "completed"
  | "cancelled"
  | "rescheduled";

export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";

export type InvoiceStatus =
  | "draft"
  | "issued"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "void";

export type PaymentMethod =
  | "cash"
  | "bkash"
  | "nagad"
  | "rocket"
  | "bank_transfer"
  | "cheque"
  | "other";

export type ContractType = "comprehensive" | "non_comprehensive" | "labor_only";

export type BillingFrequency =
  | "monthly"
  | "quarterly"
  | "half_yearly"
  | "annually"
  | "one_time";
