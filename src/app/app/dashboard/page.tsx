"use client";

import * as React from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  FileCheck2,
  Plus,
  MapPin,
  ChevronRight,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  DEMO_JOBS,
  DEMO_INVOICES,
  DEMO_CONTRACTS,
  DEMO_TEAM,
} from "@/lib/demo-data";
import { formatBDT } from "@/lib/formatters";

export default function DashboardPage() {
  const [filterJobStatus, setFilterJobStatus] = React.useState<string>("all");

  const todayJobs = DEMO_JOBS.filter(
    (j) => j.status === "scheduled" || j.status === "in_progress"
  );

  const overdueInvoices = DEMO_INVOICES.filter(
    (inv) => inv.status === "overdue" || inv.status === "issued"
  );

  const filteredJobs =
    filterJobStatus === "all"
      ? DEMO_JOBS
      : DEMO_JOBS.filter((j) => j.status === filterJobStatus);

  const totalOutstanding = DEMO_INVOICES.reduce(
    (acc, inv) => acc + inv.balanceDue,
    0
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operational Dashboard"
        description="Daily dispatch command center for AC & refrigeration maintenance operations across Dhaka."
        badge={
          <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">
            Live Dispatch
          </span>
        }
        actions={
          <div className="flex items-center gap-2.5">
            <Link href="/app/jobs">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white shadow-xs">
                <Plus className="h-4 w-4 mr-1" />
                New Job Card
              </Button>
            </Link>
          </div>
        }
      />

      {/* KPI Metrics Summary Grid */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Jobs Scheduled Today"
          value={todayJobs.length}
          subtitle="4 Assigned to field teams"
          icon={<Calendar className="h-5 w-5" />}
          iconBgColor="bg-blue-50 text-blue-700"
        />
        <MetricCard
          title="Active in Progress"
          value={DEMO_JOBS.filter((j) => j.status === "in_progress").length}
          subtitle="Technicians on-site now"
          icon={<Clock className="h-5 w-5" />}
          iconBgColor="bg-amber-50 text-amber-700"
          badge="Live"
        />
        <MetricCard
          title="Jobs Completed (Week)"
          value={18}
          subtitle="98% on-time completion"
          icon={<CheckCircle className="h-5 w-5" />}
          iconBgColor="bg-emerald-50 text-emerald-700"
        />
        <MetricCard
          title="Outstanding Dues"
          value={formatBDT(totalOutstanding)}
          subtitle="Across 3 corporate clients"
          icon={<AlertCircle className="h-5 w-5" />}
          iconBgColor="bg-rose-50 text-rose-700"
        />
      </div>

      {/* Two Column Layout: Active Work Order Feed + Technician Workload */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column (2 Cols): Active Work Orders */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Today&apos;s Field Work Orders
            </h2>
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
              {["all", "in_progress", "scheduled", "completed"].map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterJobStatus(st)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                    filterJobStatus === st
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {st === "all"
                    ? "All"
                    : st === "in_progress"
                    ? "In Progress"
                    : st === "scheduled"
                    ? "Scheduled"
                    : "Completed"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filteredJobs.map((job) => (
              <Card
                key={job.id}
                className="border-slate-200/90 shadow-xs hover:border-blue-300 transition-colors"
              >
                <div className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {job.jobNumber}
                      </span>
                      <StatusBadge status={job.status} />
                      <StatusBadge status={job.priority} />
                      <span className="text-xs text-slate-500 font-medium">
                        {job.jobTypeLabel}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      {job.scheduledTime}
                    </span>
                  </div>

                  <div className="mt-3">
                    <h3 className="font-semibold text-slate-900 text-base">
                      {job.title}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                      {job.description}
                    </p>
                  </div>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600 pt-3 border-t border-slate-100">
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-800">
                        {job.customerName}
                      </p>
                      <p className="flex items-center gap-1 text-slate-500">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{job.siteLandmark}</span>
                      </p>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3">
                      <div className="text-right">
                        <p className="text-slate-400 text-[11px]">Lead Tech</p>
                        <p className="font-semibold text-slate-800">
                          {job.technicianName}
                        </p>
                      </div>
                      <Link href={`/tech/jobs/${job.id}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-8 px-3 border-slate-200 hover:bg-slate-50 text-slate-700"
                        >
                          View Card
                          <ChevronRight className="h-3.5 w-3.5 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Right Column (1 Col): Technician Workload & Upcoming AMC */}
        <div className="space-y-6">
          {/* Technician Workload Card */}
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold text-slate-900">
                  Technician Roster
                </CardTitle>
                <Link
                  href="/app/team"
                  className="text-xs text-blue-600 font-semibold hover:underline"
                >
                  Manage Roster
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-3 divide-y divide-slate-100">
              {DEMO_TEAM.filter((m) => m.role === "technician").map((tech) => (
                <div
                  key={tech.id}
                  className="py-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-bold border border-slate-200">
                      {tech.avatarInitials}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 leading-tight">
                        {tech.fullName}
                      </p>
                      <p className="text-xs text-slate-500">{tech.phone}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                      {tech.activeJobsCount} Active
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Upcoming AMC Maintenance Reminders */}
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCheck2 className="h-4 w-4 text-teal-600" />
                  <CardTitle className="text-base font-bold text-slate-900">
                    Upcoming AMC Visits
                  </CardTitle>
                </div>
                <Link
                  href="/app/contracts"
                  className="text-xs text-blue-600 font-semibold hover:underline"
                >
                  All Contracts
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-3 space-y-3">
              {DEMO_CONTRACTS.map((contract) => (
                <div
                  key={contract.id}
                  className="p-3 rounded-lg border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-slate-700">
                      {contract.contractNumber}
                    </span>
                    <span className="font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                      Due: {contract.nextScheduledVisit}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-900 mt-1">
                    {contract.customerName}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {contract.coveredUnitsCount} Units • {contract.interval}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Quick Collections Notice */}
          <Card className="border-slate-200 bg-gradient-to-br from-white to-slate-50 shadow-xs">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                  Payment Collection Status
                </span>
                <span className="text-xs font-bold text-rose-600">
                  {overdueInvoices.length} Pending
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Total outstanding client balance is{" "}
                <strong className="text-slate-900">
                  {formatBDT(totalOutstanding)}
                </strong>
                . Manual payments can be registered with bKash TrxID or Cash.
              </p>
              <Link href="/app/invoices" className="block">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs font-semibold border-slate-200"
                >
                  Review Invoices & Record Payment
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
