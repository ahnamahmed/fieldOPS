export type DateRangePreset =
  | "7d"
  | "30d"
  | "this_month"
  | "last_month"
  | "this_year"
  | "custom"
  | "all";

export interface ReportFilterParams {
  dateRange?: DateRangePreset;
  startDate?: string;
  endDate?: string;
  technicianId?: string;
  status?: string;
  customerId?: string;
}

export interface JobsOverviewReport {
  totalJobs: number;
  scheduledJobs: number;
  inProgressJobs: number;
  completedJobs: number;
  cancelledJobs: number;
  onHoldJobs: number;
  completionRatePercent: number;
  jobsByPriority: { priority: string; count: number }[];
  jobsByDay: { date: string; scheduled: number; completed: number }[];
}

export interface TechnicianProductivityItem {
  technicianId: string;
  technicianName: string;
  totalAssigned: number;
  completedCount: number;
  inProgressCount: number;
  completionRatePercent: number;
}

export interface UpcomingVisitReportItem {
  id: string;
  plannedDate: string;
  contractNumber: string;
  contractName: string;
  customerName: string;
  siteName: string;
  status: string;
  jobId?: string | null;
  jobNumber?: string | null;
}

export interface ExpiringContractReportItem {
  id: string;
  contractNumber: string;
  contractName: string;
  customerName: string;
  endDate: string;
  daysRemaining: number;
  contractAmount: number;
  status: string;
}

export interface MaintenanceReport {
  upcomingVisitsCount: number;
  dueTodayVisitsCount: number;
  overdueVisitsCount: number;
  completedVisitsCount: number;
  expiringContractsCount: number;
  upcomingVisits: UpcomingVisitReportItem[];
  expiringContracts: ExpiringContractReportItem[];
}

export interface FinancialSummaryReport {
  totalInvoicedBDT: number;
  totalCollectedBDT: number;
  totalOutstandingBDT: number;
  invoiceCount: number;
  paymentCount: number;
  collectionRatePercent: number;
  overdueInvoicesCount: number;
  overdueBalanceBDT: number;
  invoicesByStatus: { status: string; count: number; totalAmount: number }[];
}

export interface CustomerHistoryItem {
  customerId: string;
  customerName: string;
  companyName?: string | null;
  phone: string;
  totalSites: number;
  totalEquipment: number;
  totalContracts: number;
  totalJobs: number;
  totalInvoiced: number;
  totalPaid: number;
  outstandingBalance: number;
  recentJobs: {
    id: string;
    jobNumber: string;
    title: string;
    status: string;
    date: string;
    assetName?: string | null;
  }[];
}

export interface FullOperationalReport {
  filter: ReportFilterParams;
  jobs: JobsOverviewReport;
  technicians: TechnicianProductivityItem[];
  maintenance: MaintenanceReport;
  finance: FinancialSummaryReport;
  customerHistory: CustomerHistoryItem[];
  generatedAt: string;
}
