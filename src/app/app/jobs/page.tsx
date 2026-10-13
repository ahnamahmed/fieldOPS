"use client";

import * as React from "react";
import Link from "next/link";
import {
  Briefcase,
  Plus,
  Clock,
  MapPin,
  Calendar,
  Eye,
  X,
  Search,
  Loader2,
  RefreshCw,
  AlertTriangle,
  User,
  ShieldAlert,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import {
  getJobs,
  createJob,
  transitionJobStatus,
  cancelJob,
  getAssignableTechnicians,
  checkTechnicianScheduleConflicts,
  type JobListItem,
  type ScheduleConflict,
} from "@/features/jobs/actions";
import { getCustomers, type CustomerListItem } from "@/features/customers/actions";
import { getServiceSites, type ServiceSiteItem } from "@/features/service-sites/actions";
import { getEquipmentAssets, type EquipmentAssetItem } from "@/features/equipment/actions";
import { formatDhakaDate, formatDhakaTime } from "@/lib/formatters";
import type { JobPriority, JobStatus, JobType } from "@/schemas/job";

export default function JobsPage() {
  const { toast } = useToast();
  const [jobs, setJobs] = React.useState<JobListItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [priorityFilter, setPriorityFilter] = React.useState("all");
  const [technicianFilter, setTechnicianFilter] = React.useState("all");

  // Auxiliary data for filters and modals
  const [customers, setCustomers] = React.useState<CustomerListItem[]>([]);
  const [technicians, setTechnicians] = React.useState<
    Array<{ id: string; fullName: string; phone: string | null; role: string }>
  >([]);
  const [availableSites, setAvailableSites] = React.useState<ServiceSiteItem[]>([]);
  const [availableAssets, setAvailableAssets] = React.useState<EquipmentAssetItem[]>([]);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [jobToCancel, setJobToCancel] = React.useState<JobListItem | null>(null);
  const [cancelReason, setCancelReason] = React.useState("");
  const [conflictWarnings, setConflictWarnings] = React.useState<ScheduleConflict[]>([]);

  // New Job Form State
  const [formCustomerId, setFormCustomerId] = React.useState("");
  const [formSiteId, setFormSiteId] = React.useState("");
  const [formAssetId, setFormAssetId] = React.useState("");
  const [formTitle, setFormTitle] = React.useState("");
  const [formDescription, setFormDescription] = React.useState("");
  const [formJobType, setFormJobType] = React.useState<JobType>("repair");
  const [formPriority, setFormPriority] = React.useState<JobPriority>("medium");
  const [formStartDate, setFormStartDate] = React.useState("");
  const [formStartTime, setFormStartTime] = React.useState("10:00");
  const [formDurationMinutes, setFormDurationMinutes] = React.useState(120);
  const [formAssignedTechIds, setFormAssignedTechIds] = React.useState<string[]>([]);
  const [formAssignedNotes, setFormAssignedNotes] = React.useState("");

  // Load jobs with active filters
  const loadJobsList = React.useCallback(async () => {
    setIsLoading(true);
    const res = await getJobs({
      search: searchQuery,
      status: statusFilter,
      priority: priorityFilter,
      technicianId: technicianFilter,
    });
    if (res.error) {
      toast({
        title: "Error Loading Jobs",
        description: res.error,
        type: "error",
      });
    } else if (res.data) {
      setJobs(res.data);
    }
    setIsLoading(false);
  }, [searchQuery, statusFilter, priorityFilter, technicianFilter, toast]);

  // Initial and reactive fetch
  React.useEffect(() => {
    let active = true;
    getJobs({
      search: searchQuery,
      status: statusFilter,
      priority: priorityFilter,
      technicianId: technicianFilter,
    }).then((res) => {
      if (active) {
        if (res.data) setJobs(res.data);
        setIsLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [searchQuery, statusFilter, priorityFilter, technicianFilter]);

  // Load customers and technicians for modal selectors
  React.useEffect(() => {
    getCustomers().then((res) => {
      if (res.data && res.data.length > 0) {
        setCustomers(res.data);
        setFormCustomerId(res.data[0].id);
      }
    });
    getAssignableTechnicians().then((res) => {
      if (res.data) {
        setTechnicians(res.data);
      }
    });
  }, []);

  // When customer changes in modal, load their sites
  React.useEffect(() => {
    if (!formCustomerId) return;
    let active = true;
    getServiceSites({ customerId: formCustomerId }).then((res) => {
      if (active && res.data) {
        setAvailableSites(res.data);
        if (res.data.length > 0) {
          setFormSiteId(res.data[0].id);
        } else {
          setFormSiteId("");
        }
      }
    });
    return () => {
      active = false;
    };
  }, [formCustomerId]);

  // When site changes in modal, load its equipment
  React.useEffect(() => {
    if (!formCustomerId) return;
    let active = true;
    getEquipmentAssets({ customerId: formCustomerId }).then((res) => {
      if (active && res.data) {
        // filter for this site or all customer assets
        const siteAssets = formSiteId
          ? res.data.filter((a) => a.serviceSiteId === formSiteId)
          : res.data;
        setAvailableAssets(siteAssets);
        setFormAssetId("");
      }
    });
    return () => {
      active = false;
    };
  }, [formCustomerId, formSiteId]);

  // Check conflicts when technician or scheduled time changes in create form
  React.useEffect(() => {
    let active = true;

    async function checkConflicts() {
      if (!formStartDate || !formStartTime || formAssignedTechIds.length === 0) {
        if (active) setConflictWarnings([]);
        return;
      }

      const startDateTime = new Date(`${formStartDate}T${formStartTime}:00+06:00`);
      const endDateTime = new Date(startDateTime.getTime() + formDurationMinutes * 60000);

      const results = await Promise.all(
        formAssignedTechIds.map((techId) =>
          checkTechnicianScheduleConflicts(
            techId,
            startDateTime.toISOString(),
            endDateTime.toISOString()
          )
        )
      );

      if (active) {
        const allConflicts = results.flatMap((r) => r.conflicts || []);
        setConflictWarnings(allConflicts);
      }
    }

    void checkConflicts();

    return () => {
      active = false;
    };
  }, [formStartDate, formStartTime, formDurationMinutes, formAssignedTechIds]);

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a job title or problem description.",
        type: "error",
      });
      return;
    }
    if (!formCustomerId || !formSiteId) {
      toast({
        title: "Validation Error",
        description: "Customer and service site location are required.",
        type: "error",
      });
      return;
    }

    let scheduledStart: string | null = null;
    let scheduledEnd: string | null = null;
    if (formStartDate && formStartTime) {
      const start = new Date(`${formStartDate}T${formStartTime}:00+06:00`);
      const end = new Date(start.getTime() + formDurationMinutes * 60000);
      scheduledStart = start.toISOString();
      scheduledEnd = end.toISOString();
    }

    setIsSubmitting(true);
    const res = await createJob({
      customerId: formCustomerId,
      serviceSiteId: formSiteId,
      equipmentAssetId: formAssetId || null,
      title: formTitle,
      description: formDescription || null,
      jobType: formJobType,
      priority: formPriority,
      status: scheduledStart ? "scheduled" : "new",
      scheduledStart,
      scheduledEnd,
      estimatedDuration: formDurationMinutes,
      assignedNotes: formAssignedNotes || null,
      assignedTechnicianIds: formAssignedTechIds,
      leadTechnicianId: formAssignedTechIds[0] || null,
    });
    setIsSubmitting(false);

    if (res.error) {
      toast({
        title: "Failed to Create Job",
        description: res.error,
        type: "error",
      });
    } else {
      toast({
        title: "Work Order Created",
        description: `Job #${res.data?.jobNumber} created successfully.`,
        type: "success",
      });
      if (res.conflictWarnings && res.conflictWarnings.length > 0) {
        toast({
          title: "Schedule Conflict Detected",
          description: `Warning: ${res.conflictWarnings.length} overlapping appointment(s) found for assigned technician.`,
          type: "info",
        });
      }
      setIsCreateModalOpen(false);
      setFormTitle("");
      setFormDescription("");
      setFormAssignedTechIds([]);
      setFormAssignedNotes("");
      loadJobsList();
    }
  };

  const handleQuickNextAction = async (job: JobListItem) => {
    let nextStatus: JobStatus | null = null;
    let actionDesc = "";

    switch (job.status) {
      case "new":
        nextStatus = "scheduled";
        actionDesc = "Marked as scheduled";
        break;
      case "quoted":
        nextStatus = "scheduled";
        actionDesc = "Quote accepted & scheduled";
        break;
      case "scheduled":
        nextStatus = "in_progress";
        actionDesc = "Technician dispatched & started";
        break;
      case "in_progress":
        nextStatus = "completed";
        actionDesc = "Work marked as completed";
        break;
      case "on_hold":
        nextStatus = "in_progress";
        actionDesc = "Work resumed";
        break;
      default:
        return;
    }

    setIsSubmitting(true);
    const res = await transitionJobStatus({
      jobId: job.id,
      targetStatus: nextStatus,
    });
    setIsSubmitting(false);

    if (res.error) {
      toast({
        title: "Status Update Failed",
        description: res.error,
        type: "error",
      });
    } else {
      toast({
        title: "Status Updated",
        description: `${job.jobNumber} updated: ${actionDesc}.`,
        type: "success",
      });
      loadJobsList();
    }
  };

  const handleConfirmCancel = async () => {
    if (!jobToCancel) return;
    setIsSubmitting(true);
    const res = await cancelJob(jobToCancel.id, cancelReason || "Cancelled by dispatcher");
    setIsSubmitting(false);

    if (res.error) {
      toast({
        title: "Failed to Cancel Job",
        description: res.error,
        type: "error",
      });
    } else {
      toast({
        title: "Job Cancelled",
        description: `${jobToCancel.jobNumber} cancelled. History preserved.`,
        type: "info",
      });
      setJobToCancel(null);
      setCancelReason("");
      loadJobsList();
    }
  };

  const getJobTypeLabel = (type: string) => {
    switch (type) {
      case "master_service":
        return "Master Service";
      case "gas_charging":
        return "Gas Charging";
      case "installation":
        return "Installation";
      case "uninstallation":
        return "Uninstallation";
      case "inspection":
        return "Diagnostics";
      case "amc_routine":
        return "AMC Routine";
      default:
        return "AC Repair";
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Work Orders & Jobs"
        description="Dispatch AC technicians, track job stages from intake to signoff, and prevent schedule conflicts."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadJobsList}
              disabled={isLoading}
              className="text-slate-600 hover:text-slate-900"
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              New Work Order
            </Button>
          </div>
        }
      />

      {/* Filter and Search Bar */}
      <Card className="border-slate-200 shadow-xs">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by Job # (e.g. JOB-1), title, customer, or site..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>

            {/* Status Filter */}
            <div className="w-full md:w-44">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
              >
                <option value="all">All Statuses</option>
                <option value="new">New Inquiry</option>
                <option value="quoted">Quoted</option>
                <option value="scheduled">Scheduled</option>
                <option value="in_progress">In Progress</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* Priority Filter */}
            <div className="w-full md:w-36">
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
              >
                <option value="all">All Priorities</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            {/* Technician Filter */}
            <div className="w-full md:w-48">
              <select
                value={technicianFilter}
                onChange={(e) => setTechnicianFilter(e.target.value)}
                className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
              >
                <option value="all">All Technicians</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName} ({t.role})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Jobs Table or Empty/Loading State */}
      <Card className="border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-24 text-center text-slate-500 flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-xs font-medium">Loading live work orders and dispatch schedules...</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="py-16">
            <EmptyState
              icon={Briefcase}
              title="No work orders found"
              description="No service jobs match your current search or filters. Create a new work order to dispatch field technicians."
              action={
                <Button
                  size="sm"
                  onClick={() => setIsCreateModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Create First Job
                </Button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/75 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[11px]">
                <tr>
                  <th className="py-3 px-4">Job # & Title</th>
                  <th className="py-3 px-4">Customer & Site</th>
                  <th className="py-3 px-4">Equipment Unit</th>
                  <th className="py-3 px-4">Priority / Status</th>
                  <th className="py-3 px-4">Assigned Tech</th>
                  <th className="py-3 px-4">Scheduled Window</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Job Number & Title */}
                    <td className="py-3.5 px-4">
                      <Link
                        href={`/app/jobs/${job.id}`}
                        className="font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline block"
                      >
                        {job.jobNumber}
                      </Link>
                      <p className="font-medium text-slate-900 mt-0.5 line-clamp-1">{job.title}</p>
                      <span className="inline-block text-[10px] font-medium text-slate-500 bg-slate-100 rounded px-1.5 py-0.5 mt-1">
                        {getJobTypeLabel(job.jobType)}
                      </span>
                    </td>

                    {/* Customer & Site */}
                    <td className="py-3.5 px-4">
                      <Link
                        href={`/app/customers/${job.customerId}`}
                        className="font-medium text-slate-900 hover:text-blue-600 transition-colors block"
                      >
                        {job.customerName}
                      </Link>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[180px]">{job.siteName}</span>
                      </p>
                    </td>

                    {/* Equipment Unit */}
                    <td className="py-3.5 px-4">
                      {job.assetBrand ? (
                        <div>
                          <p className="font-medium text-slate-900">{job.assetBrand}</p>
                          <p className="text-[11px] text-slate-500">{job.assetCapacity || "AC Unit"}</p>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">No AC unit tagged</span>
                      )}
                    </td>

                    {/* Priority & Status */}
                    <td className="py-3.5 px-4 space-y-1">
                      <div>
                        <StatusBadge status={job.priority} />
                      </div>
                      <div>
                        <StatusBadge status={job.status} />
                      </div>
                    </td>

                    {/* Assigned Tech */}
                    <td className="py-3.5 px-4">
                      {job.assignedTechnicians.length === 0 ? (
                        <span className="inline-flex items-center text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          Unassigned
                        </span>
                      ) : (
                        <div className="space-y-1">
                          {job.assignedTechnicians.map((t) => (
                            <div key={t.technicianId} className="flex items-center gap-1 text-[11px] text-slate-800">
                              <User className="h-3 w-3 text-slate-400" />
                              <span className="font-medium">{t.name}</span>
                              {t.isLead && (
                                <span className="text-[9px] bg-blue-100 text-blue-700 px-1 rounded font-semibold">
                                  Lead
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Scheduled Window */}
                    <td className="py-3.5 px-4 text-slate-600">
                      {job.scheduledStart ? (
                        <div>
                          <p className="font-medium text-slate-900 flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            {formatDhakaDate(job.scheduledStart)}
                          </p>
                          <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3 text-slate-400" />
                            {formatDhakaTime(job.scheduledStart)}
                          </p>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Not scheduled</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Next Action Progression Button */}
                        {job.status !== "completed" && job.status !== "cancelled" && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleQuickNextAction(job)}
                            disabled={isSubmitting}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] h-7 px-2"
                          >
                            {job.status === "new" && "Schedule"}
                            {job.status === "quoted" && "Schedule"}
                            {job.status === "scheduled" && "Start"}
                            {job.status === "in_progress" && "Complete"}
                            {job.status === "on_hold" && "Resume"}
                          </Button>
                        )}

                        <Link href={`/app/jobs/${job.id}`}>
                          <Button variant="outline" size="sm" className="h-7 text-[11px] px-2 text-slate-700">
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </Button>
                        </Link>

                        {job.status !== "completed" && job.status !== "cancelled" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setJobToCancel(job)}
                            className="h-7 text-[11px] px-2 text-rose-600 hover:bg-rose-50"
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create Job Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Create New Work Order</h3>
                <p className="text-xs text-slate-500">
                  Assign technicians and schedule commercial AC servicing in Dhaka.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateJob} className="p-5 space-y-4 text-xs">
              {/* Conflict Alert Banner if any conflicts exist */}
              {conflictWarnings.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-900 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    Technician Schedule Conflict Detected!
                  </div>
                  {conflictWarnings.map((c, i) => (
                    <p key={i} className="text-[11px] text-amber-800 leading-tight">
                      • <strong>{c.technicianName}</strong> already has work order{" "}
                      <strong>{c.conflictingJobNumber}</strong> ({c.conflictingJobTitle}) during this time window.
                    </p>
                  ))}
                  <p className="text-[10px] text-amber-700 italic">
                    You can still proceed, but the dispatcher calendar will mark an overlapping alert.
                  </p>
                </div>
              )}

              {/* Customer and Location Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Customer Account *</label>
                  <select
                    required
                    value={formCustomerId}
                    onChange={(e) => setFormCustomerId(e.target.value)}
                    className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.phone})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Service Site Location *</label>
                  <select
                    required
                    value={formSiteId}
                    onChange={(e) => setFormSiteId(e.target.value)}
                    className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  >
                    {availableSites.length === 0 ? (
                      <option value="">No sites found for customer</option>
                    ) : (
                      availableSites.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.siteName} — {s.area || s.address}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* Equipment Asset Selector */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">AC Equipment Unit (Optional)</label>
                <select
                  value={formAssetId}
                  onChange={(e) => setFormAssetId(e.target.value)}
                  className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
                >
                  <option value="">No specific AC unit (General site work)</option>
                  {availableAssets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.brand} {a.capacity || ""} ({a.model || "Unit"} • {a.serialNumber || "No SN"})
                    </option>
                  ))}
                </select>
              </div>

              {/* Title & Job Type */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="font-semibold text-slate-700">Job Title / Issue *</label>
                  <Input
                    required
                    placeholder="e.g. Master Service & Gas Pressure Check"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Service Type</label>
                  <select
                    value={formJobType}
                    onChange={(e) => setFormJobType(e.target.value as JobType)}
                    className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="repair">AC Repair</option>
                    <option value="master_service">Master Service</option>
                    <option value="gas_charging">Gas Charging</option>
                    <option value="installation">Installation</option>
                    <option value="uninstallation">Uninstallation</option>
                    <option value="inspection">Inspection / Diagnostics</option>
                    <option value="amc_routine">AMC Routine Visit</option>
                  </select>
                </div>
              </div>

              {/* Priority & Scheduling Window */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Priority Level</label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as JobPriority)}
                    className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent / Emergency</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Scheduled Date</label>
                  <Input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Start Time</label>
                  <Input
                    type="time"
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Est. Duration</label>
                  <select
                    value={formDurationMinutes}
                    onChange={(e) => setFormDurationMinutes(Number(e.target.value))}
                    className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  >
                    <option value={30}>30 mins</option>
                    <option value={60}>1 hour</option>
                    <option value={90}>1.5 hours</option>
                    <option value={120}>2 hours</option>
                    <option value={180}>3 hours</option>
                    <option value={240}>4 hours</option>
                  </select>
                </div>
              </div>

              {/* Technician Assignment */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Assign Technician(s)</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2 border border-slate-200 rounded-md bg-slate-50/50 max-h-36 overflow-y-auto">
                  {technicians.map((t) => {
                    const isChecked = formAssignedTechIds.includes(t.id);
                    return (
                      <label
                        key={t.id}
                        className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition-colors ${
                          isChecked ? "bg-blue-100 text-blue-900 font-medium" : "hover:bg-slate-100 text-slate-700"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormAssignedTechIds([...formAssignedTechIds, t.id]);
                            } else {
                              setFormAssignedTechIds(formAssignedTechIds.filter((id) => id !== t.id));
                            }
                          }}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="truncate">{t.fullName}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Description & Assigned Notes */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Technician Dispatch Instructions / Access Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Call security upon arrival. AC outdoor unit located on 5th floor rooftop."
                  value={formAssignedNotes}
                  onChange={(e) => setFormAssignedNotes(e.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-white p-2.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isSubmitting ? "Creating Job..." : "Create Work Order"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancellation Confirmation Dialog */}
      {jobToCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-md p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-rose-100 text-rose-600 rounded-full shrink-0">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-slate-900 text-sm">
                  Cancel Work Order {jobToCancel.jobNumber}?
                </h3>
                <p className="text-xs text-slate-500">
                  This work order will be marked as cancelled. Historical records, visits, and customer notes are preserved.
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Reason for Cancellation</label>
              <textarea
                rows={2}
                placeholder="e.g. Client rescheduled next month, or duplicate request."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setJobToCancel(null)}>
                Keep Active
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={isSubmitting}
                onClick={handleConfirmCancel}
              >
                {isSubmitting ? "Cancelling..." : "Confirm Cancellation"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
