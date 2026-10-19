"use client";

import * as React from "react";
import Link from "next/link";
import {
  BarChart3,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  FileCheck2,
  Users,
  CreditCard,
  Building2,
  RefreshCw,
  Filter,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { formatBDT } from "@/lib/formatters";
import { getOperationalReports } from "@/features/reports/actions";
import type { FullOperationalReport, DateRangePreset } from "@/features/reports/types";

export default function ReportsPage() {
  const { toast } = useToast();

  const [dateRange, setDateRange] = React.useState<DateRangePreset>("30d");
  const [activeTab, setActiveTab] = React.useState<
    "operations" | "technicians" | "maintenance" | "financial" | "customers"
  >("operations");

  const [isLoading, setIsLoading] = React.useState(true);
  const [report, setReport] = React.useState<FullOperationalReport | null>(null);

  const reloadReports = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getOperationalReports({ dateRange });
      if (res.success && res.data) {
        setReport(res.data);
      } else {
        toast({
          title: "Reports Error",
          description: res.error || "Failed to load operational reports",
          type: "error",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Network or server failure loading reports",
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, toast]);

  React.useEffect(() => {
    let active = true;
    getOperationalReports({ dateRange }).then((res) => {
      if (active) {
        if (res.success && res.data) {
          setReport(res.data);
        }
        setIsLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [dateRange]);

  const jobs = report?.jobs || {
    totalJobs: 0,
    scheduledJobs: 0,
    inProgressJobs: 0,
    completedJobs: 0,
    cancelledJobs: 0,
    onHoldJobs: 0,
    completionRatePercent: 0,
    jobsByPriority: [],
    jobsByDay: [],
  };

  const finance = report?.finance || {
    totalInvoicedBDT: 0,
    totalCollectedBDT: 0,
    totalOutstandingBDT: 0,
    invoiceCount: 0,
    paymentCount: 0,
    collectionRatePercent: 0,
    overdueInvoicesCount: 0,
    overdueBalanceBDT: 0,
    invoicesByStatus: [],
  };

  const maintenance = report?.maintenance || {
    upcomingVisitsCount: 0,
    dueTodayVisitsCount: 0,
    overdueVisitsCount: 0,
    completedVisitsCount: 0,
    expiringContractsCount: 0,
    upcomingVisits: [],
    expiringContracts: [],
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operational & Financial Reports"
        description="Live data intelligence across field work orders, technician productivity, preventative AMC schedules, and revenue collections."
        badge={
          <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-800">
            Analytics & Insights
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white border border-slate-200/90 rounded-lg px-2 py-1 shadow-2xs">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as DateRangePreset)}
                className="text-xs bg-transparent text-slate-700 font-semibold focus:outline-none"
              >
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="this_month">This Month</option>
                <option value="last_month">Last Month</option>
                <option value="this_year">This Year</option>
                <option value="all">All Time</option>
              </select>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={reloadReports}
              disabled={isLoading}
              className="text-xs border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        }
      />

      {/* Primary KPI Header */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Field Jobs Executed"
          value={jobs.totalJobs}
          subtitle={`${jobs.completedJobs} completed (${jobs.completionRatePercent}% rate)`}
          icon={<CheckCircle className="h-5 w-5" />}
          iconBgColor="bg-blue-50 text-blue-700"
        />
        <MetricCard
          title="Total Billed"
          value={formatBDT(finance.totalInvoicedBDT)}
          subtitle={`${finance.invoiceCount} invoices issued`}
          icon={<CreditCard className="h-5 w-5" />}
          iconBgColor="bg-purple-50 text-purple-700"
        />
        <MetricCard
          title="Revenue Collected"
          value={formatBDT(finance.totalCollectedBDT)}
          subtitle={`${finance.collectionRatePercent}% realization rate`}
          icon={<TrendingUp className="h-5 w-5" />}
          iconBgColor="bg-emerald-50 text-emerald-700"
        />
        <MetricCard
          title="Maintenance Queue"
          value={maintenance.upcomingVisitsCount + maintenance.overdueVisitsCount}
          subtitle={`${maintenance.overdueVisitsCount} overdue visits`}
          icon={<Clock className="h-5 w-5" />}
          iconBgColor={maintenance.overdueVisitsCount > 0 ? "bg-rose-50 text-rose-700" : "bg-teal-50 text-teal-700"}
          badge={maintenance.overdueVisitsCount > 0 ? "Attention" : undefined}
        />
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200 flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { key: "operations", label: "Operations & Jobs", icon: BarChart3 },
          { key: "technicians", label: "Technician Productivity", icon: Users },
          { key: "maintenance", label: "AMC & Preventative", icon: FileCheck2 },
          { key: "financial", label: "Financials & Dues", icon: CreditCard },
          { key: "customers", label: "Customer History", icon: Building2 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 whitespace-nowrap transition-colors ${
                isActive
                  ? "border-blue-600 text-blue-700 bg-blue-50/50"
                  : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* CONTENT SECTIONS */}
      {isLoading && !report ? (
        <div className="py-24 text-center text-slate-500 text-sm">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-600" />
          Aggregating operational database metrics...
        </div>
      ) : (
        <>
          {/* TAB 1: OPERATIONS & JOBS */}
          {activeTab === "operations" && (
            <div className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Status Breakdown */}
                <Card className="border-slate-200/90 shadow-2xs">
                  <CardHeader className="pb-3 border-b border-slate-100">
                    <CardTitle className="text-sm font-bold text-slate-900">
                      Work Orders by Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-3">
                    <div className="space-y-2 text-xs">
                      {[
                        { label: "Completed", count: jobs.completedJobs, color: "bg-emerald-500" },
                        { label: "In Progress", count: jobs.inProgressJobs, color: "bg-amber-500" },
                        { label: "Scheduled", count: jobs.scheduledJobs, color: "bg-blue-500" },
                        { label: "On Hold", count: jobs.onHoldJobs, color: "bg-slate-400" },
                        { label: "Cancelled", count: jobs.cancelledJobs, color: "bg-rose-400" },
                      ].map((item) => {
                        const pct = jobs.totalJobs > 0 ? Math.round((item.count / jobs.totalJobs) * 100) : 0;
                        return (
                          <div key={item.label} className="space-y-1">
                            <div className="flex justify-between font-medium">
                              <span className="text-slate-700">{item.label}</span>
                              <span className="text-slate-900 font-bold">
                                {item.count} ({pct}%)
                              </span>
                            </div>
                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${item.color} rounded-full`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Priority Breakdown */}
                <Card className="border-slate-200/90 shadow-2xs">
                  <CardHeader className="pb-3 border-b border-slate-100">
                    <CardTitle className="text-sm font-bold text-slate-900">
                      Work Orders by Priority
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-3">
                    <div className="space-y-2 text-xs">
                      {jobs.jobsByPriority.map((p) => {
                        const pct = jobs.totalJobs > 0 ? Math.round((p.count / jobs.totalJobs) * 100) : 0;
                        const barColor =
                          p.priority === "urgent"
                            ? "bg-rose-500"
                            : p.priority === "high"
                            ? "bg-amber-500"
                            : "bg-blue-500";
                        return (
                          <div key={p.priority} className="space-y-1">
                            <div className="flex justify-between font-medium">
                              <span className="text-slate-700 capitalize">{p.priority} Priority</span>
                              <span className="text-slate-900 font-bold">
                                {p.count} ({pct}%)
                              </span>
                            </div>
                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${barColor} rounded-full`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Daily Trend */}
              <Card className="border-slate-200/90 shadow-2xs">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Daily Operational Activity
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  {jobs.jobsByDay.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-6">
                      No jobs recorded in this date range.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 text-xs">
                      {jobs.jobsByDay.map((d) => (
                        <div
                          key={d.date}
                          className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/70 text-center space-y-1"
                        >
                          <span className="font-mono text-[11px] text-slate-500 block">
                            {d.date.slice(5)}
                          </span>
                          <span className="text-xs font-bold text-blue-700 block">
                            {d.scheduled} Scheduled
                          </span>
                          <span className="text-[11px] font-semibold text-emerald-700 block">
                            {d.completed} Done
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 2: TECHNICIAN PRODUCTIVITY */}
          {activeTab === "technicians" && (
            <Card className="border-slate-200/90 shadow-2xs">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-slate-900">
                  Technician Assignment & Completion Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {(report?.technicians || []).length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">
                    No technician assignments found.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3 font-semibold">Technician</th>
                          <th className="py-2.5 px-3 font-semibold">Total Assigned</th>
                          <th className="py-2.5 px-3 font-semibold">In Progress</th>
                          <th className="py-2.5 px-3 font-semibold">Completed</th>
                          <th className="py-2.5 px-3 font-semibold">Completion Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {report?.technicians.map((tech) => (
                          <tr key={tech.technicianId} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3 font-bold text-slate-800">
                              {tech.technicianName}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-semibold text-slate-700">
                              {tech.totalAssigned}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-amber-600 font-semibold">
                              {tech.inProgressCount}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-emerald-600 font-semibold">
                              {tech.completedCount}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                                {tech.completionRatePercent}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* TAB 3: AMC & PREVENTATIVE MAINTENANCE */}
          {activeTab === "maintenance" && (
            <div className="space-y-6">
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  title="Upcoming Visits"
                  value={maintenance.upcomingVisitsCount}
                  subtitle="Scheduled next 30 days"
                  icon={<Calendar className="h-5 w-5" />}
                  iconBgColor="bg-teal-50 text-teal-700"
                />
                <MetricCard
                  title="Visits Due Today"
                  value={maintenance.dueTodayVisitsCount}
                  subtitle="Field appointments"
                  icon={<Clock className="h-5 w-5" />}
                  iconBgColor="bg-amber-50 text-amber-700"
                />
                <MetricCard
                  title="Overdue Visits"
                  value={maintenance.overdueVisitsCount}
                  subtitle="Require immediate attention"
                  icon={<AlertTriangle className="h-5 w-5" />}
                  iconBgColor="bg-rose-50 text-rose-700"
                  badge={maintenance.overdueVisitsCount > 0 ? "Overdue" : undefined}
                />
                <MetricCard
                  title="Expiring Contracts"
                  value={maintenance.expiringContractsCount}
                  subtitle="Renewals in next 60 days"
                  icon={<FileCheck2 className="h-5 w-5" />}
                  iconBgColor="bg-purple-50 text-purple-700"
                />
              </div>

              {/* Upcoming / Overdue Visits Table */}
              <Card className="border-slate-200/90 shadow-2xs">
                <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Planned AMC Maintenance Visits Queue
                  </CardTitle>
                  <Link
                    href="/app/contracts"
                    className="text-xs text-blue-600 font-semibold hover:underline"
                  >
                    View All Contracts
                  </Link>
                </CardHeader>
                <CardContent className="pt-4">
                  {maintenance.upcomingVisits.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-6">
                      No upcoming planned visits.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-3 font-semibold">Planned Date</th>
                            <th className="py-2 px-3 font-semibold">Contract</th>
                            <th className="py-2 px-3 font-semibold">Client & Site</th>
                            <th className="py-2 px-3 font-semibold">Status</th>
                            <th className="py-2 px-3 font-semibold">Work Order</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {maintenance.upcomingVisits.map((v) => (
                            <tr key={v.id} className="hover:bg-slate-50/50">
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                                {v.plannedDate}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="font-mono text-teal-700 font-semibold">
                                  {v.contractNumber}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <p className="font-bold text-slate-800">{v.customerName}</p>
                                <p className="text-[11px] text-slate-500">{v.siteName}</p>
                              </td>
                              <td className="py-2.5 px-3">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    v.status === "overdue"
                                      ? "bg-rose-100 text-rose-800"
                                      : v.status === "due_today"
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-blue-50 text-blue-700"
                                  }`}
                                >
                                  {v.status.replace("_", " ")}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                {v.jobId ? (
                                  <Link
                                    href={`/tech/jobs/${v.jobId}`}
                                    className="text-blue-600 font-mono font-bold hover:underline"
                                  >
                                    {v.jobNumber || "View Job"}
                                  </Link>
                                ) : (
                                  <span className="text-slate-400 italic">Not dispatched</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Expiring Contracts */}
              {maintenance.expiringContracts.length > 0 && (
                <Card className="border-slate-200/90 shadow-2xs">
                  <CardHeader className="pb-3 border-b border-slate-100">
                    <CardTitle className="text-sm font-bold text-slate-900">
                      Contracts Nearing Renewal (Next 60 Days)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-3 font-semibold">Contract</th>
                            <th className="py-2 px-3 font-semibold">Customer</th>
                            <th className="py-2 px-3 font-semibold">Expiry Date</th>
                            <th className="py-2 px-3 font-semibold">Remaining</th>
                            <th className="py-2 px-3 font-semibold">Contract Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {maintenance.expiringContracts.map((c) => (
                            <tr key={c.id} className="hover:bg-slate-50/50">
                              <td className="py-2.5 px-3">
                                <span className="font-mono text-teal-700 font-bold block">
                                  {c.contractNumber}
                                </span>
                                <span className="text-[11px] text-slate-500">{c.contractName}</span>
                              </td>
                              <td className="py-2.5 px-3 font-bold text-slate-800">
                                {c.customerName}
                              </td>
                              <td className="py-2.5 px-3 font-mono">{c.endDate}</td>
                              <td className="py-2.5 px-3">
                                <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                                  {c.daysRemaining} Days
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-bold text-slate-900">
                                {formatBDT(c.contractAmount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* TAB 4: FINANCIALS & DUES */}
          {activeTab === "financial" && (
            <div className="space-y-6">
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  title="Invoiced Amount"
                  value={formatBDT(finance.totalInvoicedBDT)}
                  subtitle={`${finance.invoiceCount} invoices`}
                  icon={<CreditCard className="h-5 w-5" />}
                  iconBgColor="bg-blue-50 text-blue-700"
                />
                <MetricCard
                  title="Collected Payments"
                  value={formatBDT(finance.totalCollectedBDT)}
                  subtitle={`${finance.paymentCount} payments recorded`}
                  icon={<CheckCircle className="h-5 w-5" />}
                  iconBgColor="bg-emerald-50 text-emerald-700"
                />
                <MetricCard
                  title="Outstanding Dues"
                  value={formatBDT(finance.totalOutstandingBDT)}
                  subtitle="Receivables balance"
                  icon={<AlertCircle className="h-5 w-5" />}
                  iconBgColor="bg-amber-50 text-amber-700"
                />
                <MetricCard
                  title="Overdue Accounts"
                  value={formatBDT(finance.overdueBalanceBDT)}
                  subtitle={`${finance.overdueInvoicesCount} overdue bills`}
                  icon={<AlertTriangle className="h-5 w-5" />}
                  iconBgColor="bg-rose-50 text-rose-700"
                  badge={finance.overdueInvoicesCount > 0 ? "Past Due" : undefined}
                />
              </div>

              {/* Invoice status breakdown */}
              <Card className="border-slate-200/90 shadow-2xs">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Invoices Portfolio by Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  {finance.invoicesByStatus.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-6">
                      No invoices found in this period.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs">
                      {finance.invoicesByStatus.map((st) => (
                        <div
                          key={st.status}
                          className="p-3 rounded-lg border border-slate-200/80 bg-slate-50/60"
                        >
                          <span className="text-[11px] font-semibold text-slate-500 uppercase block">
                            {st.status.replace("_", " ")}
                          </span>
                          <span className="text-sm font-bold text-slate-900 mt-1 block">
                            {formatBDT(st.totalAmount)}
                          </span>
                          <span className="text-[11px] text-slate-500 block mt-0.5">
                            {st.count} invoices
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* TAB 5: CUSTOMER & EQUIPMENT SERVICE HISTORY */}
          {activeTab === "customers" && (
            <Card className="border-slate-200/90 shadow-2xs">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-slate-900">
                  Customer Portfolio & Equipment Service Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {(report?.customerHistory || []).length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">
                    No customer history records available.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3 font-semibold">Customer</th>
                          <th className="py-2.5 px-3 font-semibold">Phone</th>
                          <th className="py-2.5 px-3 font-semibold">Sites / Units</th>
                          <th className="py-2.5 px-3 font-semibold">Contracts</th>
                          <th className="py-2.5 px-3 font-semibold">Total Jobs</th>
                          <th className="py-2.5 px-3 font-semibold">Billed</th>
                          <th className="py-2.5 px-3 font-semibold">Balance Due</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {report?.customerHistory.map((cust) => (
                          <tr key={cust.customerId} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3 font-bold text-slate-800">
                              {cust.companyName
                                ? `${cust.companyName} (${cust.customerName})`
                                : cust.customerName}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-600">
                              {cust.phone}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700">
                              {cust.totalSites} sites • {cust.totalEquipment} units
                            </td>
                            <td className="py-2.5 px-3 text-teal-700 font-semibold">
                              {cust.totalContracts} AMC
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-800">
                              {cust.totalJobs}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-medium text-slate-900">
                              {formatBDT(cust.totalInvoiced)}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold">
                              {cust.outstandingBalance > 0 ? (
                                <span className="text-rose-600">
                                  {formatBDT(cust.outstandingBalance)}
                                </span>
                              ) : (
                                <span className="text-emerald-600">৳0.00</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
