export type ContractStatus =
  | "draft"
  | "active"
  | "renewal_due"
  | "expired"
  | "terminated"
  | "renewed"
  | "archived";

export type ContractType = "comprehensive" | "non_comprehensive" | "labor_only";

export type BillingFrequency =
  | "monthly"
  | "quarterly"
  | "half_yearly"
  | "annually"
  | "one_time";

export type ServiceFrequency =
  | "monthly"
  | "bi_monthly"
  | "quarterly"
  | "half_yearly"
  | "annually"
  | "custom";

export type PlannedVisitStatus =
  | "planned"
  | "due_soon"
  | "due_today"
  | "overdue"
  | "job_created"
  | "completed"
  | "cancelled"
  | "skipped";

export interface CoveredAsset {
  id: string;
  assetId: string;
  assetTag: string | null;
  equipmentType: string;
  brand: string;
  model: string | null;
  serialNumber: string | null;
  capacity: string | null;
  locationDescription: string | null;
  notes: string | null;
}

export interface PlannedVisit {
  id: string;
  contractId: string;
  visitNumber: number;
  plannedDate: string;
  title: string;
  description: string | null;
  status: PlannedVisitStatus;
  jobId: string | null;
  jobNumber: string | null;
  notes: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface ContractSummary {
  id: string;
  contractNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  serviceSiteId: string | null;
  siteName: string | null;
  siteAddress: string | null;
  contractName: string;
  title: string;
  description: string | null;
  contractType: ContractType;
  billingFrequency: BillingFrequency;
  serviceFrequency: ServiceFrequency;
  serviceIntervalMonths: number;
  startDate: string;
  endDate: string;
  contractAmount: number;
  totalContractValue: number;
  status: ContractStatus;
  terms: string | null;
  coveredAssetsCount: number;
  plannedVisitsCount: number;
  completedVisitsCount: number;
  nextScheduledVisit: string | null;
  remainingVisitsCount: number;
  renewedFromId: string | null;
  renewedToId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContractDetail extends ContractSummary {
  customerEmail: string | null;
  coveredAssets: CoveredAsset[];
  plannedVisits: PlannedVisit[];
}
