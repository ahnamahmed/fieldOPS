"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { roundMoney } from "@/lib/formatters";
import type {
  ReportFilterParams,
  FullOperationalReport,
  JobsOverviewReport,
  TechnicianProductivityItem,
  MaintenanceReport,
  FinancialSummaryReport,
  CustomerHistoryItem,
} from "./types";

/**
 * Calculates start and end ISO dates based on preset
 */
function resolveDateRange(params?: ReportFilterParams): { startIso?: string; endIso?: string } {
  const now = new Date();

  if (params?.dateRange === "custom" && (params.startDate || params.endDate)) {
    return {
      startIso: params.startDate ? new Date(params.startDate).toISOString() : undefined,
      endIso: params.endDate ? new Date(params.endDate).toISOString() : undefined,
    };
  }

  if (params?.dateRange === "7d") {
    const start = new Date(now);
    start.setDate(now.getDate() - 7);
    return { startIso: start.toISOString(), endIso: now.toISOString() };
  }

  if (params?.dateRange === "30d") {
    const start = new Date(now);
    start.setDate(now.getDate() - 30);
    return { startIso: start.toISOString(), endIso: now.toISOString() };
  }

  if (params?.dateRange === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return { startIso: start.toISOString(), endIso: end.toISOString() };
  }

  if (params?.dateRange === "last_month") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    return { startIso: start.toISOString(), endIso: end.toISOString() };
  }

  if (params?.dateRange === "this_year") {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    return { startIso: start.toISOString(), endIso: end.toISOString() };
  }

  // default / "all"
  return {};
}

/**
 * Retrieves comprehensive operational reports scoped to the user's organization
 */
export async function getOperationalReports(
  filters: ReportFilterParams = { dateRange: "30d" }
): Promise<{
  success: boolean;
  data?: FullOperationalReport;
  error?: string;
}> {
  try {
    const session = await getCurrentUser();
    if (!session || !session.membership) return { success: false, error: "Unauthorized" };

    const orgId = session.membership.organizationId;
    const supabase = await createClient();
    const { startIso, endIso } = resolveDateRange(filters);

    // -------------------------------------------------------------
    // 1. JOBS REPORT
    // -------------------------------------------------------------
    let jobsQuery = supabase
      .from("jobs")
      .select(`
        id,
        job_number,
        title,
        status,
        priority,
        created_at,
        scheduled_start,
        completed_at,
        customer_id
      `)
      .eq("organization_id", orgId);

    if (filters.customerId) {
      jobsQuery = jobsQuery.eq("customer_id", filters.customerId);
    }
    if (filters.status && filters.status !== "all") {
      jobsQuery = jobsQuery.eq("status", filters.status);
    }
    if (startIso) {
      jobsQuery = jobsQuery.gte("created_at", startIso);
    }
    if (endIso) {
      jobsQuery = jobsQuery.lte("created_at", endIso);
    }

    const { data: rawJobs, error: jobsErr } = await jobsQuery;
    if (jobsErr) return { success: false, error: jobsErr.message };

    const jobs = rawJobs || [];
    let scheduledCount = 0;
    let inProgressCount = 0;
    let completedCount = 0;
    let cancelledCount = 0;
    let onHoldCount = 0;

    const priorityCounts: Record<string, number> = {
      urgent: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    const daysMap: Record<string, { scheduled: number; completed: number }> = {};

    for (const j of jobs) {
      if (j.status === "scheduled") scheduledCount++;
      else if (j.status === "in_progress") inProgressCount++;
      else if (j.status === "completed") completedCount++;
      else if (j.status === "cancelled") cancelledCount++;
      else if (j.status === "on_hold") onHoldCount++;

      const p = (j.priority || "medium").toLowerCase();
      priorityCounts[p] = (priorityCounts[p] || 0) + 1;

      const dayKey = (j.scheduled_start || j.created_at || "").split("T")[0];
      if (dayKey) {
        if (!daysMap[dayKey]) daysMap[dayKey] = { scheduled: 0, completed: 0 };
        daysMap[dayKey].scheduled++;
        if (j.status === "completed") daysMap[dayKey].completed++;
      }
    }

    const totalJobs = jobs.length;
    const completedOrActive = completedCount + inProgressCount + scheduledCount;
    const completionRatePercent =
      completedOrActive > 0 ? Math.round((completedCount / completedOrActive) * 100) : 0;

    const jobsReport: JobsOverviewReport = {
      totalJobs,
      scheduledJobs: scheduledCount,
      inProgressJobs: inProgressCount,
      completedJobs: completedCount,
      cancelledJobs: cancelledCount,
      onHoldJobs: onHoldCount,
      completionRatePercent,
      jobsByPriority: Object.entries(priorityCounts).map(([priority, count]) => ({
        priority,
        count,
      })),
      jobsByDay: Object.entries(daysMap)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-14)
        .map(([date, d]) => ({
          date,
          scheduled: d.scheduled,
          completed: d.completed,
        })),
    };

    // -------------------------------------------------------------
    // 2. TECHNICIAN PRODUCTIVITY
    // -------------------------------------------------------------
    const { data: rawAssignments } = await supabase
      .from("job_assignments")
      .select(`
        id,
        technician_id,
        job_id,
        profiles ( id, full_name ),
        jobs!inner ( status, organization_id )
      `)
      .eq("organization_id", orgId);

    const techMap = new Map<string, { name: string; total: number; completed: number; inProgress: number }>();

    for (const a of rawAssignments || []) {
      const techId = a.technician_id;
      const techName = (a.profiles as { full_name?: string } | null)?.full_name || "Technician";
      const jobStatus = (a.jobs as { status?: string } | null)?.status;

      if (!techMap.has(techId)) {
        techMap.set(techId, { name: techName, total: 0, completed: 0, inProgress: 0 });
      }
      const entry = techMap.get(techId)!;
      entry.total++;
      if (jobStatus === "completed") entry.completed++;
      else if (jobStatus === "in_progress") entry.inProgress++;
    }

    const technicianReport: TechnicianProductivityItem[] = Array.from(techMap.entries()).map(
      ([technicianId, data]) => ({
        technicianId,
        technicianName: data.name,
        totalAssigned: data.total,
        completedCount: data.completed,
        inProgressCount: data.inProgress,
        completionRatePercent:
          data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
      })
    );

    // -------------------------------------------------------------
    // 3. MAINTENANCE & AMC REPORT
    // -------------------------------------------------------------
    const todayStr = new Date().toISOString().split("T")[0];

    const { data: rawVisits } = await supabase
      .from("contract_planned_visits")
      .select(`
        id,
        planned_date,
        status,
        title,
        job_id,
        service_contracts (
          contract_number,
          contract_name,
          customers ( contact_name, company_name ),
          service_sites ( site_name )
        ),
        jobs ( job_number )
      `)
      .eq("organization_id", orgId)
      .order("planned_date", { ascending: true });

    let upcomingVisitsCount = 0;
    let dueTodayVisitsCount = 0;
    let overdueVisitsCount = 0;
    let completedVisitsCount = 0;

    const upcomingVisitsList = [];

    for (const v of rawVisits || []) {
      const contract = v.service_contracts as {
        contract_number?: string;
        contract_name?: string;
        customers?: { contact_name?: string; company_name?: string } | null;
        service_sites?: { site_name?: string } | null;
      } | null;

      const custName = contract?.customers?.company_name
        ? `${contract.customers.company_name} (${contract.customers.contact_name})`
        : contract?.customers?.contact_name || "Customer";

      const isCompleted = v.status === "completed";
      const isOverdue = !isCompleted && v.planned_date < todayStr;
      const isDueToday = !isCompleted && v.planned_date === todayStr;
      const isDueSoon = !isCompleted && v.planned_date > todayStr;

      if (isCompleted) completedVisitsCount++;
      if (isOverdue) overdueVisitsCount++;
      if (isDueToday) dueTodayVisitsCount++;
      if (isDueSoon) upcomingVisitsCount++;

      if (!isCompleted) {
        upcomingVisitsList.push({
          id: v.id,
          plannedDate: v.planned_date,
          contractNumber: contract?.contract_number || "AMC",
          contractName: contract?.contract_name || "Maintenance",
          customerName: custName,
          siteName: contract?.service_sites?.site_name || "Main Site",
          status: isOverdue ? "overdue" : isDueToday ? "due_today" : "planned",
          jobId: v.job_id,
          jobNumber: (v.jobs as { job_number?: string } | null)?.job_number || null,
        });
      }
    }

    // Expiring contracts
    const sixtyDaysLater = new Date();
    sixtyDaysLater.setDate(sixtyDaysLater.getDate() + 60);
    const sixtyDaysLaterStr = sixtyDaysLater.toISOString().split("T")[0];

    const { data: rawContracts } = await supabase
      .from("service_contracts")
      .select(`
        id,
        contract_number,
        contract_name,
        end_date,
        contract_amount,
        status,
        customers ( contact_name, company_name )
      `)
      .eq("organization_id", orgId)
      .lte("end_date", sixtyDaysLaterStr)
      .neq("status", "archived")
      .order("end_date", { ascending: true });

    type RawExpiringContract = {
      id: string;
      contract_number: string;
      contract_name: string | null;
      end_date: string;
      contract_amount: number | null;
      status: string;
      customers: { contact_name?: string; company_name?: string } | null;
    };

    const expiringContractsList = (
      (rawContracts as unknown as RawExpiringContract[]) || []
    ).map((c: RawExpiringContract) => {
      const cust = c.customers as { contact_name?: string; company_name?: string } | null;
      const custName = cust?.company_name
        ? `${cust.company_name} (${cust.contact_name})`
        : cust?.contact_name || "Customer";

      const endMs = new Date(c.end_date).getTime();
      const nowMs = new Date().getTime();
      const daysRemaining = Math.max(0, Math.ceil((endMs - nowMs) / (1000 * 60 * 60 * 24)));

      return {
        id: c.id,
        contractNumber: c.contract_number,
        contractName: c.contract_name || "AMC Contract",
        customerName: custName,
        endDate: c.end_date,
        daysRemaining,
        contractAmount: Number(c.contract_amount || 0),
        status: c.status,
      };
    });

    const maintenanceReport: MaintenanceReport = {
      upcomingVisitsCount,
      dueTodayVisitsCount,
      overdueVisitsCount,
      completedVisitsCount,
      expiringContractsCount: expiringContractsList.length,
      upcomingVisits: upcomingVisitsList.slice(0, 15),
      expiringContracts: expiringContractsList,
    };

    // -------------------------------------------------------------
    // 4. FINANCIAL SUMMARY (Separated queries to avoid join inflation)
    // -------------------------------------------------------------
    let invoiceQuery = supabase
      .from("invoices")
      .select("id, invoice_number, total_amount, paid_amount, balance_due, status, due_date")
      .eq("organization_id", orgId);

    if (startIso) {
      invoiceQuery = invoiceQuery.gte("issue_date", startIso.split("T")[0]);
    }
    if (endIso) {
      invoiceQuery = invoiceQuery.lte("issue_date", endIso.split("T")[0]);
    }

    const { data: rawInvoices } = await invoiceQuery;
    const invoices = rawInvoices || [];

    let totalInvoicedBDT = 0;
    let totalOutstandingBDT = 0;
    let overdueInvoicesCount = 0;
    let overdueBalanceBDT = 0;

    const invoiceStatusMap: Record<string, { count: number; total: number }> = {};

    for (const inv of invoices) {
      const total = Number(inv.total_amount || 0);
      const balance = Number(inv.balance_due || 0);

      totalInvoicedBDT += total;
      totalOutstandingBDT += balance;

      const st = inv.status;
      if (!invoiceStatusMap[st]) invoiceStatusMap[st] = { count: 0, total: 0 };
      invoiceStatusMap[st].count++;
      invoiceStatusMap[st].total += total;

      if (inv.due_date < todayStr && balance > 0) {
        overdueInvoicesCount++;
        overdueBalanceBDT += balance;
      }
    }

    // Separate payment query for accurate collected sum
    let paymentQuery = supabase
      .from("payments")
      .select("amount, status, payment_date")
      .eq("organization_id", orgId)
      .eq("status", "completed");

    if (startIso) {
      paymentQuery = paymentQuery.gte("payment_date", startIso.split("T")[0]);
    }
    if (endIso) {
      paymentQuery = paymentQuery.lte("payment_date", endIso.split("T")[0]);
    }

    const { data: rawPayments } = await paymentQuery;
    const payments = rawPayments || [];

    const totalCollectedBDT = payments.reduce(
      (acc: number, p: { amount: number | null }) => acc + Number(p.amount || 0),
      0
    );

    const collectionRatePercent =
      totalInvoicedBDT > 0
        ? Math.round((totalCollectedBDT / totalInvoicedBDT) * 100)
        : 0;

    const financeReport: FinancialSummaryReport = {
      totalInvoicedBDT: roundMoney(totalInvoicedBDT),
      totalCollectedBDT: roundMoney(totalCollectedBDT),
      totalOutstandingBDT: roundMoney(totalOutstandingBDT),
      invoiceCount: invoices.length,
      paymentCount: payments.length,
      collectionRatePercent,
      overdueInvoicesCount,
      overdueBalanceBDT: roundMoney(overdueBalanceBDT),
      invoicesByStatus: Object.entries(invoiceStatusMap).map(([status, d]) => ({
        status,
        count: d.count,
        totalAmount: roundMoney(d.total),
      })),
    };

    // -------------------------------------------------------------
    // 5. CUSTOMER & EQUIPMENT SERVICE HISTORY
    // -------------------------------------------------------------
    const { data: rawCustomers } = await supabase
      .from("customers")
      .select(`
        id,
        contact_name,
        company_name,
        phone,
        service_sites ( id ),
        equipment_assets ( id ),
        service_contracts ( id ),
        jobs (
          id,
          job_number,
          title,
          status,
          created_at,
          scheduled_start,
          equipment_assets ( brand, model_number )
        ),
        invoices (
          total_amount,
          paid_amount,
          balance_due
        )
      `)
      .eq("organization_id", orgId)
      .limit(20);

    type RawCustomerHistoryRow = {
      id: string;
      contact_name: string;
      company_name: string | null;
      phone: string;
      service_sites: unknown[];
      equipment_assets: unknown[];
      service_contracts: unknown[];
      jobs: Array<{
        id: string;
        job_number: string;
        title: string;
        status: string;
        created_at: string;
        scheduled_start?: string | null;
        equipment_assets?: { brand?: string; model_number?: string } | null;
      }>;
      invoices: Array<{
        total_amount: number;
        paid_amount: number;
        balance_due: number;
      }>;
    };

    const customerHistory: CustomerHistoryItem[] = (
      (rawCustomers as unknown as RawCustomerHistoryRow[]) || []
    ).map((c: RawCustomerHistoryRow) => {
      const sites = (c.service_sites as unknown[]) || [];
      const assets = (c.equipment_assets as unknown[]) || [];
      const contracts = (c.service_contracts as unknown[]) || [];
      const rawCustomerJobs = (c.jobs as Array<{
        id: string;
        job_number: string;
        title: string;
        status: string;
        created_at: string;
        scheduled_start?: string | null;
        equipment_assets?: { brand?: string; model_number?: string } | null;
      }>) || [];
      const rawCustomerInvoices = (c.invoices as Array<{
        total_amount: number;
        paid_amount: number;
        balance_due: number;
      }>) || [];

      let custInvoiced = 0;
      let custPaid = 0;
      let custBalance = 0;

      for (const inv of rawCustomerInvoices) {
        custInvoiced += Number(inv.total_amount || 0);
        custPaid += Number(inv.paid_amount || 0);
        custBalance += Number(inv.balance_due || 0);
      }

      const recentJobs = rawCustomerJobs
        .sort((a, b) => (b.scheduled_start || b.created_at).localeCompare(a.scheduled_start || a.created_at))
        .slice(0, 5)
        .map((j) => ({
          id: j.id,
          jobNumber: j.job_number,
          title: j.title,
          status: j.status,
          date: (j.scheduled_start || j.created_at).split("T")[0],
          assetName: j.equipment_assets
            ? `${j.equipment_assets.brand || ""} ${j.equipment_assets.model_number || ""}`.trim()
            : null,
        }));

      return {
        customerId: c.id,
        customerName: c.contact_name,
        companyName: c.company_name,
        phone: c.phone,
        totalSites: sites.length,
        totalEquipment: assets.length,
        totalContracts: contracts.length,
        totalJobs: rawCustomerJobs.length,
        totalInvoiced: roundMoney(custInvoiced),
        totalPaid: roundMoney(custPaid),
        outstandingBalance: roundMoney(custBalance),
        recentJobs,
      };
    });

    return {
      success: true,
      data: {
        filter: filters,
        jobs: jobsReport,
        technicians: technicianReport,
        maintenance: maintenanceReport,
        finance: financeReport,
        customerHistory,
        generatedAt: new Date().toISOString(),
      },
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to generate operational reports",
    };
  }
}

/**
 * Retrieves real live aggregates and metrics for the dashboard
 */
export async function getDashboardData(): Promise<{
  success: boolean;
  data?: {
    kpis: {
      scheduledToday: number;
      activeInProgress: number;
      completedWeek: number;
      outstandingDues: number;
    };
    todayJobs: Array<{
      id: string;
      jobNumber: string;
      title: string;
      description?: string | null;
      status: string;
      priority: string;
      scheduledTime: string;
      customerName: string;
      siteLandmark?: string | null;
      leadTechnicianName?: string | null;
    }>;
    technicians: Array<{
      id: string;
      fullName: string;
      phone?: string | null;
      avatarInitials: string;
      activeJobsCount: number;
    }>;
    upcomingAMC: Array<{
      id: string;
      contractNumber: string;
      customerName: string;
      siteName: string;
      nextScheduledVisit: string;
      serviceFrequency: string;
      coveredUnitsCount: number;
    }>;
    pendingRemindersCount: number;
  };
  error?: string;
}> {
  try {
    const session = await getCurrentUser();
    if (!session || !session.membership) return { success: false, error: "Unauthorized" };

    const orgId = session.membership.organizationId;
    const supabase = await createClient();

    const todayStr = new Date().toISOString().split("T")[0];

    // 1. Jobs scheduled today or in progress
    const { data: rawTodayJobs } = await supabase
      .from("jobs")
      .select(`
        id,
        job_number,
        title,
        description,
        status,
        priority,
        scheduled_start,
        customers ( contact_name, company_name ),
        service_sites ( site_name, landmark, area ),
        job_assignments!job_assignments_job_id_fkey (
          is_lead,
          profiles ( full_name )
        )
      `)
      .eq("organization_id", orgId)
      .order("scheduled_start", { ascending: true });

    const allJobs = rawTodayJobs || [];

    let scheduledToday = 0;
    let activeInProgress = 0;
    const todayJobsList = [];

    for (const j of allJobs) {
      const schedDate = j.scheduled_start ? j.scheduled_start.split("T")[0] : null;
      const isToday = schedDate === todayStr;

      if (isToday && j.status === "scheduled") scheduledToday++;
      if (j.status === "in_progress") activeInProgress++;

      // Lead technician
      const assignments = (j.job_assignments as unknown as Array<{
        is_lead: boolean;
        profiles?: { full_name?: string } | null;
      }>) || [];
      const lead = assignments.find((a) => a.is_lead) || assignments[0];
      const leadTechName = lead?.profiles?.full_name || "Unassigned";

      const cust = j.customers as { contact_name?: string; company_name?: string } | null;
      const customerName = cust?.company_name
        ? `${cust.company_name} (${cust.contact_name})`
        : cust?.contact_name || "Customer";

      const site = j.service_sites as { site_name?: string; landmark?: string; area?: string } | null;
      const landmark = site?.landmark || site?.area || site?.site_name || "Dhaka";

      // Time formatting
      let scheduledTime = "Today";
      if (j.scheduled_start) {
        try {
          const dt = new Date(j.scheduled_start);
          scheduledTime = dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
        } catch {
          scheduledTime = j.scheduled_start;
        }
      }

      todayJobsList.push({
        id: j.id,
        jobNumber: j.job_number,
        title: j.title,
        description: j.description,
        status: j.status,
        priority: j.priority,
        scheduledTime,
        customerName,
        siteLandmark: landmark,
        leadTechnicianName: leadTechName,
      });
    }

    // Completed past 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { count: completedWeekCount } = await supabase
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "completed")
      .gte("completed_at", sevenDaysAgo.toISOString());

    // 2. Outstanding Dues
    const { data: rawInvoices } = await supabase
      .from("invoices")
      .select("balance_due")
      .eq("organization_id", orgId)
      .neq("status", "paid")
      .neq("status", "cancelled");

    const outstandingDues = (rawInvoices || []).reduce(
      (acc: number, inv: { balance_due: number | null }) => acc + Number(inv.balance_due || 0),
      0
    );

    // 3. Technicians
    const { data: rawMembers } = await supabase
      .from("organization_members")
      .select(`
        user_id,
        role,
        profiles ( id, full_name, phone )
      `)
      .eq("organization_id", orgId)
      .eq("role", "technician");

    type RawMemberRow = {
      user_id: string;
      role: string;
      profiles: { id?: string; full_name?: string; phone?: string } | null;
    };
    const techniciansList = (
      (rawMembers as unknown as RawMemberRow[]) || []
    ).map((m: RawMemberRow) => {
      const prof = m.profiles as { id?: string; full_name?: string; phone?: string } | null;
      const name = prof?.full_name || "Technician";
      const initials = name
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase() || "TC";

      return {
        id: m.user_id,
        fullName: name,
        phone: prof?.phone || null,
        avatarInitials: initials,
        activeJobsCount: 0, // Computed below
      };
    });

    // Count active jobs for each technician
    const { data: activeAssignments } = await supabase
      .from("job_assignments")
      .select(`
        technician_id,
        jobs!inner ( status, organization_id )
      `)
      .eq("organization_id", orgId)
      .in("jobs.status", ["scheduled", "in_progress"]);

    const activeCountMap = new Map<string, number>();
    for (const a of activeAssignments || []) {
      activeCountMap.set(a.technician_id, (activeCountMap.get(a.technician_id) || 0) + 1);
    }

    for (const t of techniciansList) {
      t.activeJobsCount = activeCountMap.get(t.id) || 0;
    }

    // 4. Upcoming AMC Visits
    const { data: rawUpcomingVisits } = await supabase
      .from("contract_planned_visits")
      .select(`
        id,
        planned_date,
        service_contracts (
          id,
          contract_number,
          service_frequency,
          customers ( contact_name, company_name ),
          service_sites ( site_name ),
          service_contract_assets ( count )
        )
      `)
      .eq("organization_id", orgId)
      .eq("status", "planned")
      .gte("planned_date", todayStr)
      .order("planned_date", { ascending: true })
      .limit(5);

    type RawUpcomingAMCVisit = {
      id: string;
      planned_date: string;
      service_contracts: {
        id: string;
        contract_number: string;
        service_frequency?: string;
        customers?: { contact_name?: string; company_name?: string } | null;
        service_sites?: { site_name?: string } | null;
        service_contract_assets?: [{ count: number }];
      } | null;
    };
    const upcomingAMC = (
      (rawUpcomingVisits as unknown as RawUpcomingAMCVisit[]) || []
    ).map((v: RawUpcomingAMCVisit) => {
      const contract = v.service_contracts as {
        id: string;
        contract_number: string;
        service_frequency?: string;
        customers?: { contact_name?: string; company_name?: string } | null;
        service_sites?: { site_name?: string } | null;
        service_contract_assets?: [{ count: number }];
      } | null;

      const custName = contract?.customers?.company_name
        ? `${contract.customers.company_name} (${contract.customers.contact_name})`
        : contract?.customers?.contact_name || "Customer";

      const unitsCount = contract?.service_contract_assets?.[0]?.count || 1;

      return {
        id: v.id,
        contractNumber: contract?.contract_number || "AMC",
        customerName: custName,
        siteName: contract?.service_sites?.site_name || "Facility",
        nextScheduledVisit: v.planned_date,
        serviceFrequency: contract?.service_frequency || "Quarterly",
        coveredUnitsCount: unitsCount,
      };
    });

    // 5. Pending Reminders Count
    const { count: pendingRemindersCount } = await supabase
      .from("service_reminders")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "pending");

    return {
      success: true,
      data: {
        kpis: {
          scheduledToday,
          activeInProgress,
          completedWeek: completedWeekCount || 0,
          outstandingDues: roundMoney(outstandingDues),
        },
        todayJobs: todayJobsList,
        technicians: techniciansList,
        upcomingAMC,
        pendingRemindersCount: pendingRemindersCount || 0,
      },
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load dashboard data",
    };
  }
}
