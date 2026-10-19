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
  RefreshCw,
  MessageSquare,
  Copy,
  ExternalLink,
  Check,
  Wrench,
  AlertTriangle,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { MetricCard } from "@/components/ui/metric-card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { formatBDT } from "@/lib/formatters";
import { getDashboardData } from "@/features/reports/actions";
import {
  getUpcomingServiceReminders,
  buildWhatsAppMessage,
  markReminderCopiedToWhatsApp,
  dismissReminder,
} from "@/features/reminders/actions";
import { convertVisitToJob } from "@/features/contracts/actions";
import type { ServiceReminder, ReminderStats, WhatsAppMessagePayload } from "@/features/reminders/types";

export default function DashboardPage() {
  const { toast } = useToast();

  const [isLoading, setIsLoading] = React.useState(true);
  const [data, setData] = React.useState<Awaited<ReturnType<typeof getDashboardData>>["data"] | null>(null);
  const [reminders, setReminders] = React.useState<ServiceReminder[]>([]);
  const [reminderStats, setReminderStats] = React.useState<ReminderStats>({
    overdueCount: 0,
    dueTodayCount: 0,
    dueSoonCount: 0,
    contractRenewalCount: 0,
    totalPending: 0,
  });

  const [activeTab, setActiveTab] = React.useState<"reminders" | "jobs">("reminders");
  const [filterJobStatus, setFilterJobStatus] = React.useState<string>("all");

  // WhatsApp copy modal
  const [whatsAppModalPayload, setWhatsAppModalPayload] = React.useState<WhatsAppMessagePayload | null>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [convertingVisitId, setConvertingVisitId] = React.useState<string | null>(null);

  const reloadData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [dashRes, remRes] = await Promise.all([
        getDashboardData(),
        getUpcomingServiceReminders({ limit: 20 }),
      ]);

      if (dashRes.success && dashRes.data) {
        setData(dashRes.data);
      }
      if (remRes.success) {
        setReminders(remRes.reminders);
        setReminderStats(remRes.stats);
      }
    } catch {
      toast({
        title: "Dashboard",
        description: "Failed to load live database metrics",
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    let active = true;
    Promise.all([
      getDashboardData(),
      getUpcomingServiceReminders({ limit: 20 }),
    ]).then(([dashRes, remRes]) => {
      if (active) {
        if (dashRes.success && dashRes.data) {
          setData(dashRes.data);
        }
        if (remRes.success) {
          setReminders(remRes.reminders);
          setReminderStats(remRes.stats);
        }
        setIsLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  // Open WhatsApp template helper
  const handleOpenWhatsAppHelper = async (reminder: ServiceReminder) => {
    try {
      const res = await buildWhatsAppMessage(reminder.id);
      if (res.success && res.payload) {
        setWhatsAppModalPayload(res.payload);
      } else {
        toast({
          title: "Notice Error",
          description: res.error || "Could not generate WhatsApp template",
          type: "error",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to prepare WhatsApp message",
        type: "error",
      });
    }
  };

  // Copy text to clipboard and record audit
  const handleCopyNotice = async (payload: WhatsAppMessagePayload) => {
    try {
      await navigator.clipboard.writeText(payload.formattedText);
      setCopiedId(payload.reminderId);
      await markReminderCopiedToWhatsApp(payload.reminderId);

      toast({
        title: "Message Copied!",
        description: "Message template copied to clipboard. Recorded in audit log.",
        type: "success",
      });

      // Refresh list
      reloadData();
      setTimeout(() => setCopiedId(null), 3000);
    } catch {
      toast({
        title: "Copy Failed",
        description: "Could not write to clipboard",
        type: "error",
      });
    }
  };

  // Convert planned visit to job directly from reminder
  const handleConvertVisit = async (visitId: string) => {
    setConvertingVisitId(visitId);
    try {
      const res = await convertVisitToJob({ visitId });
      if (res.success) {
        toast({
          title: "Work Order Dispatched!",
          description: "Created field service Job Card with AC inspection checklist.",
          type: "success",
        });
        reloadData();
      } else {
        toast({
          title: "Conversion Failed",
          description: res.error || "Could not convert visit",
          type: "error",
        });
      }
    } finally {
      setConvertingVisitId(null);
    }
  };

  // Dismiss reminder
  const handleDismissReminder = async (reminderId: string) => {
    await dismissReminder(reminderId);
    toast({
      title: "Reminder Dismissed",
      description: "Item removed from staff queue",
      type: "info",
    });
    reloadData();
  };

  const kpis = data?.kpis || {
    scheduledToday: 0,
    activeInProgress: 0,
    completedWeek: 0,
    outstandingDues: 0,
  };

  const todayJobs = data?.todayJobs || [];
  const filteredJobs =
    filterJobStatus === "all"
      ? todayJobs
      : todayJobs.filter((j) => j.status === filterJobStatus);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operational Dashboard"
        description="Daily dispatch command center, upcoming service queue, and live field operations across Dhaka."
        badge={
          <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
            Live Supabase Aggregates
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={reloadData}
              disabled={isLoading}
              className="text-xs border-slate-200 text-slate-700 hover:bg-slate-50"
              title="Refresh live metrics"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
              Sync
            </Button>
            <Link href="/app/jobs">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white shadow-xs text-xs">
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
          value={kpis.scheduledToday}
          subtitle="Assigned for today's field run"
          icon={<Calendar className="h-5 w-5" />}
          iconBgColor="bg-blue-50 text-blue-700"
        />
        <MetricCard
          title="Active in Progress"
          value={kpis.activeInProgress}
          subtitle="Technicians currently on-site"
          icon={<Clock className="h-5 w-5" />}
          iconBgColor="bg-amber-50 text-amber-700"
          badge={kpis.activeInProgress > 0 ? "Live Work" : undefined}
        />
        <MetricCard
          title="Jobs Completed (Week)"
          value={kpis.completedWeek}
          subtitle="Verified service completions"
          icon={<CheckCircle className="h-5 w-5" />}
          iconBgColor="bg-emerald-50 text-emerald-700"
        />
        <MetricCard
          title="Outstanding Dues"
          value={formatBDT(kpis.outstandingDues)}
          subtitle="Uncollected client invoices"
          icon={<AlertCircle className="h-5 w-5" />}
          iconBgColor="bg-rose-50 text-rose-700"
          badge={kpis.outstandingDues > 0 ? "Pending" : undefined}
        />
      </div>

      {/* Main Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column (2 Cols): Tabs for Reminders Queue vs Today's Jobs */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab("reminders")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                  activeTab === "reminders"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                Upcoming Service Queue
                {reminderStats.totalPending > 0 && (
                  <span className="ml-1 bg-amber-500 text-slate-900 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold">
                    {reminderStats.totalPending}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab("jobs")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                  activeTab === "jobs"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Calendar className="h-3.5 w-3.5 text-blue-400" />
                Today&apos;s Field Work ({todayJobs.length})
              </button>
            </div>

            {activeTab === "jobs" && (
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                {["all", "in_progress", "scheduled", "completed"].map((st) => (
                  <button
                    key={st}
                    onClick={() => setFilterJobStatus(st)}
                    className={`px-2 py-0.5 text-[11px] font-semibold rounded-md transition-colors ${
                      filterJobStatus === st
                        ? "bg-white text-slate-900 shadow-2xs"
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
            )}
          </div>

          {/* TAB 1: UPCOMING SERVICE QUEUE */}
          {activeTab === "reminders" && (
            <div className="space-y-3">
              {reminders.length === 0 ? (
                <EmptyState
                  title="All Services Up to Date"
                  description="No overdue visits, due-soon maintenance, or pending contract renewals in your queue."
                />
              ) : (
                reminders.map((rem) => {
                  const isOverdue = rem.reminderType === "visit_overdue";
                  const isDueToday = rem.reminderType === "visit_due_today";
                  const isRenewal = rem.reminderType === "contract_renewal";

                  return (
                    <Card
                      key={rem.id}
                      className={`border transition-colors ${
                        isOverdue
                          ? "border-rose-200 bg-rose-50/20"
                          : isDueToday
                          ? "border-amber-200 bg-amber-50/20"
                          : isRenewal
                          ? "border-purple-200 bg-purple-50/20"
                          : "border-slate-200/90"
                      }`}
                    >
                      <div className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                                isOverdue
                                  ? "bg-rose-100 text-rose-800 border-rose-300"
                                  : isDueToday
                                  ? "bg-amber-100 text-amber-800 border-amber-300"
                                  : isRenewal
                                  ? "bg-purple-100 text-purple-800 border-purple-300"
                                  : "bg-blue-50 text-blue-700 border-blue-200"
                              }`}
                            >
                              {rem.reminderType.replace(/_/g, " ")}
                            </span>

                            {rem.contractNumber && (
                              <span className="font-mono text-xs font-semibold text-slate-700">
                                {rem.contractNumber}
                              </span>
                            )}

                            {rem.siteName && (
                              <span className="text-xs text-slate-500 flex items-center gap-1">
                                <MapPin className="h-3 w-3 text-slate-400" />
                                {rem.siteName}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Clock className="h-3.5 w-3.5 text-slate-400" />
                            <span>Target: {rem.dueDate}</span>
                          </div>
                        </div>

                        <div className="mt-2.5">
                          <h4 className="font-bold text-slate-900 text-sm">{rem.title}</h4>
                          <p className="text-xs text-slate-600 mt-0.5">{rem.message}</p>
                          <div className="mt-2 text-xs text-slate-700 font-medium flex items-center gap-2">
                            <span>Client: <strong>{rem.customerName}</strong></span>
                            {rem.customerPhone && (
                              <span className="text-slate-500 font-mono">
                                ({rem.customerPhone})
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            {rem.deliveredAt && (
                              <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                                <Check className="h-3 w-3" />
                                WhatsApp Copied on {new Date(rem.deliveredAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {rem.plannedVisitId && !rem.jobId && (
                              <Button
                                size="sm"
                                onClick={() => handleConvertVisit(rem.plannedVisitId!)}
                                disabled={convertingVisitId === rem.plannedVisitId}
                                className="h-7 text-xs bg-teal-600 hover:bg-teal-700 text-white"
                              >
                                <Wrench className="h-3 w-3 mr-1" />
                                {convertingVisitId === rem.plannedVisitId
                                  ? "Dispatching..."
                                  : "Convert to Job"}
                              </Button>
                            )}

                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenWhatsAppHelper(rem)}
                              className="h-7 text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50 font-medium"
                            >
                              <MessageSquare className="h-3 w-3 mr-1 text-emerald-600" />
                              WhatsApp Notice
                            </Button>

                            <button
                              onClick={() => handleDismissReminder(rem.id)}
                              className="text-slate-400 hover:text-slate-600 p-1"
                              title="Dismiss reminder"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: TODAY'S FIELD WORK ORDERS */}
          {activeTab === "jobs" && (
            <div className="space-y-3">
              {filteredJobs.length === 0 ? (
                <EmptyState
                  title="No Jobs Scheduled"
                  description="No work orders matching this filter today. Dispatch a new job card or convert a maintenance visit."
                  action={
                    <Link href="/app/jobs">
                      <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                        <Plus className="h-4 w-4 mr-1" />
                        Create Job
                      </Button>
                    </Link>
                  }
                />
              ) : (
                filteredJobs.map((job) => (
                  <Card
                    key={job.id}
                    className="border-slate-200/90 shadow-2xs hover:border-blue-300 transition-colors"
                  >
                    <div className="p-4 sm:p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            {job.jobNumber}
                          </span>
                          <StatusBadge status={job.status} />
                          <StatusBadge status={job.priority} />
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
                        {job.description && (
                          <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                            {job.description}
                          </p>
                        )}
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
                              {job.leadTechnicianName || "Unassigned"}
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
                ))
              )}
            </div>
          )}
        </div>

        {/* Right Column (1 Col): Technician Roster & Upcoming AMC */}
        <div className="space-y-6">
          {/* Technician Workload Card */}
          <Card className="border-slate-200 shadow-2xs">
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
              {(data?.technicians || []).length === 0 ? (
                <p className="py-4 text-xs text-slate-500 text-center">
                  No technicians assigned yet.
                </p>
              ) : (
                data?.technicians.map((tech) => (
                  <div key={tech.id} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-xs font-bold border border-slate-200">
                        {tech.avatarInitials}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 leading-tight">
                          {tech.fullName}
                        </p>
                        <p className="text-xs text-slate-500">{tech.phone || "No phone"}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        {tech.activeJobsCount} Active
                      </span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Upcoming AMC Maintenance Reminders */}
          <Card className="border-slate-200 shadow-2xs">
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
              {(data?.upcomingAMC || []).length === 0 ? (
                <p className="py-4 text-xs text-slate-500 text-center">
                  No upcoming planned visits.
                </p>
              ) : (
                data?.upcomingAMC.map((amc) => (
                  <div
                    key={amc.id}
                    className="p-3 rounded-lg border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-slate-700">
                        {amc.contractNumber}
                      </span>
                      <span className="font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                        Due: {amc.nextScheduledVisit}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-900 mt-1">
                      {amc.customerName}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {amc.siteName} • {amc.serviceFrequency}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Quick Collections Notice */}
          <Card className="border-slate-200 bg-gradient-to-br from-white to-slate-50 shadow-2xs">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                  Payment Collections
                </span>
                <span className="text-xs font-bold text-rose-600">
                  {formatBDT(kpis.outstandingDues)} Due
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Track client balances, invoice aging, and record manual bKash, Nagad, Cash, or Bank deposits.
              </p>
              <Link href="/app/invoices" className="block">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs font-semibold border-slate-200"
                >
                  Review Invoices & Payments
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* WHATSAPP MESSAGE POPUP MODAL */}
      {whatsAppModalPayload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl relative space-y-4">
            <button
              onClick={() => setWhatsAppModalPayload(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="h-5 w-5" />
            </button>

            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-emerald-600" />
                Service Notice Template for WhatsApp
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Recipient: <strong className="text-slate-800">{whatsAppModalPayload.recipientPhone || "Customer"}</strong>
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-lg">
              <pre className="text-xs text-slate-800 whitespace-pre-wrap font-sans leading-relaxed">
                {whatsAppModalPayload.formattedText}
              </pre>
            </div>

            <p className="text-[11px] text-slate-500 italic">
              Note: Staff copies this formatted message into WhatsApp or clicks &apos;Open in WhatsApp Web&apos;. No external automated dispatch occurs without confirmed API credentials.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopyNotice(whatsAppModalPayload)}
                className="text-xs"
              >
                {copiedId === whatsAppModalPayload.reminderId ? (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    Copy Notice
                  </>
                )}
              </Button>

              {whatsAppModalPayload.encodedWhatsAppUrl ? (
                <a
                  href={whatsAppModalPayload.encodedWhatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleCopyNotice(whatsAppModalPayload)}
                >
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
                    <ExternalLink className="h-3.5 w-3.5 mr-1" />
                    Open in WhatsApp
                  </Button>
                </a>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
