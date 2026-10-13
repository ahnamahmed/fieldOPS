"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  MapPin,
  Phone,
  Users,
  Cpu,
  Edit2,
  AlertTriangle,
  Play,
  XCircle,
  Loader2,
  ShieldAlert,
  X,
  History,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import {
  getJobById,
  updateJob,
  transitionJobStatus,
  assignTechnicians,
  cancelJob,
  getAssignableTechnicians,
  checkTechnicianScheduleConflicts,
  type JobDetail,
  type ScheduleConflict,
} from "@/features/jobs/actions";
import { getServiceSites, type ServiceSiteItem } from "@/features/service-sites/actions";
import { getEquipmentAssets, type EquipmentAssetItem } from "@/features/equipment/actions";
import { formatDhakaDateTime, formatDhakaDate, formatDhakaTime } from "@/lib/formatters";
import type { JobPriority, JobStatus, JobType } from "@/schemas/job";

export default function JobDetailPage() {
  const params = useParams();
  const { toast } = useToast();
  const jobId = params.id as string;

  const [job, setJob] = React.useState<JobDetail | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Auxiliary data
  const [technicians, setTechnicians] = React.useState<
    Array<{ id: string; fullName: string; phone: string | null; role: string }>
  >([]);
  const [customerSites, setCustomerSites] = React.useState<ServiceSiteItem[]>([]);
  const [customerAssets, setCustomerAssets] = React.useState<EquipmentAssetItem[]>([]);

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = React.useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = React.useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = React.useState(false);
  const [selectedNextStatus, setSelectedNextStatus] = React.useState<JobStatus>("in_progress");
  const [statusNotes, setStatusNotes] = React.useState("");
  const [cancelReason, setCancelReason] = React.useState("");

  // Edit Form State
  const [editTitle, setEditTitle] = React.useState("");
  const [editDescription, setEditDescription] = React.useState("");
  const [editJobType, setEditJobType] = React.useState<JobType>("repair");
  const [editPriority, setEditPriority] = React.useState<JobPriority>("medium");
  const [editSiteId, setEditSiteId] = React.useState("");
  const [editAssetId, setEditAssetId] = React.useState("");
  const [editStartDate, setEditStartDate] = React.useState("");
  const [editStartTime, setEditStartTime] = React.useState("");
  const [editDuration, setEditDuration] = React.useState(120);
  const [editAssignedNotes, setEditAssignedNotes] = React.useState("");

  // Assignment Modal State
  const [selectedTechIds, setSelectedTechIds] = React.useState<string[]>([]);
  const [leadTechId, setLeadTechId] = React.useState("");
  const [assignConflicts, setAssignConflicts] = React.useState<ScheduleConflict[]>([]);

  const loadJobData = React.useCallback(async () => {
    const res = await getJobById(jobId);
    if (res.error) {
      toast({
        title: "Error Loading Job",
        description: res.error,
        type: "error",
      });
    } else if (res.data) {
      setJob(res.data);
    }
  }, [jobId, toast]);

  // Initial fetch
  React.useEffect(() => {
    let active = true;
    getJobById(jobId).then((res) => {
      if (active) {
        if (res.error) {
          toast({
            title: "Error Loading Job",
            description: res.error,
            type: "error",
          });
        } else if (res.data) {
          setJob(res.data);
        }
        setIsLoading(false);
      }
    });

    getAssignableTechnicians().then((res) => {
      if (active && res.data) {
        setTechnicians(res.data);
      }
    });

    return () => {
      active = false;
    };
  }, [jobId, toast]);

  // Load customer sites and assets when job is loaded
  React.useEffect(() => {
    if (!job?.customerId) return;
    let active = true;
    getServiceSites({ customerId: job.customerId }).then((res) => {
      if (active && res.data) setCustomerSites(res.data);
    });
    getEquipmentAssets({ customerId: job.customerId }).then((res) => {
      if (active && res.data) setCustomerAssets(res.data);
    });
    return () => {
      active = false;
    };
  }, [job?.customerId]);

  // Conflict detection in assign modal
  React.useEffect(() => {
    let active = true;

    async function checkConflicts() {
      if (!job?.scheduledStart || !job?.scheduledEnd || selectedTechIds.length === 0) {
        if (active) setAssignConflicts([]);
        return;
      }

      const results = await Promise.all(
        selectedTechIds.map((tId) =>
          checkTechnicianScheduleConflicts(
            tId,
            job.scheduledStart!,
            job.scheduledEnd!,
            job.id
          )
        )
      );

      if (active) {
        const allConflicts = results.flatMap((r) => r.conflicts || []);
        setAssignConflicts(allConflicts);
      }
    }

    void checkConflicts();

    return () => {
      active = false;
    };
  }, [job?.scheduledStart, job?.scheduledEnd, job?.id, selectedTechIds]);

  const openEditModal = () => {
    if (!job) return;
    setEditTitle(job.title);
    setEditDescription(job.description || "");
    setEditJobType(job.jobType);
    setEditPriority(job.priority);
    setEditSiteId(job.siteId);
    setEditAssetId(job.assetId || "");
    if (job.scheduledStart) {
      const d = new Date(job.scheduledStart);
      setEditStartDate(d.toISOString().slice(0, 10));
      setEditStartTime(d.toTimeString().slice(0, 5));
    } else {
      setEditStartDate("");
      setEditStartTime("10:00");
    }
    setEditDuration(job.estimatedDuration || 120);
    setEditAssignedNotes(job.assignedNotes || "");
    setIsEditModalOpen(true);
  };

  const openAssignModal = () => {
    if (!job) return;
    const currentTechIds = job.assignedTechnicians.map((a) => a.technicianId);
    setSelectedTechIds(currentTechIds);
    const currentLead = job.assignedTechnicians.find((a) => a.isLead);
    setLeadTechId(currentLead?.technicianId || currentTechIds[0] || "");
    setIsAssignModalOpen(true);
  };

  const handleUpdateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job) return;

    let scheduledStart: string | null = null;
    let scheduledEnd: string | null = null;
    if (editStartDate && editStartTime) {
      const start = new Date(`${editStartDate}T${editStartTime}:00+06:00`);
      const end = new Date(start.getTime() + editDuration * 60000);
      scheduledStart = start.toISOString();
      scheduledEnd = end.toISOString();
    }

    setIsSubmitting(true);
    const res = await updateJob(job.id, {
      title: editTitle,
      description: editDescription || null,
      jobType: editJobType,
      priority: editPriority,
      serviceSiteId: editSiteId,
      equipmentAssetId: editAssetId || null,
      scheduledStart,
      scheduledEnd,
      estimatedDuration: editDuration,
      assignedNotes: editAssignedNotes || null,
    });
    setIsSubmitting(false);

    if (res.error) {
      toast({
        title: "Update Failed",
        description: res.error,
        type: "error",
      });
    } else {
      toast({
        title: "Work Order Updated",
        description: "Job details successfully saved.",
        type: "success",
      });
      setIsEditModalOpen(false);
      loadJobData();
    }
  };

  const handleSaveAssignments = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job) return;
    if (selectedTechIds.length === 0) {
      toast({
        title: "Validation Error",
        description: "Select at least one technician for this work order.",
        type: "error",
      });
      return;
    }

    setIsSubmitting(true);
    const res = await assignTechnicians({
      jobId: job.id,
      technicianIds: selectedTechIds,
      leadTechnicianId: leadTechId || selectedTechIds[0],
    });
    setIsSubmitting(false);

    if (res.error) {
      toast({
        title: "Assignment Failed",
        description: res.error,
        type: "error",
      });
    } else {
      toast({
        title: "Technicians Assigned",
        description: `${selectedTechIds.length} technician(s) assigned to ${job.jobNumber}.`,
        type: "success",
      });
      if (res.conflictWarnings && res.conflictWarnings.length > 0) {
        toast({
          title: "Schedule Warning",
          description: "One or more assigned technicians have overlapping appointments.",
          type: "info",
        });
      }
      setIsAssignModalOpen(false);
      loadJobData();
    }
  };

  const handleTransitionStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job) return;

    setIsSubmitting(true);
    const res = await transitionJobStatus({
      jobId: job.id,
      targetStatus: selectedNextStatus,
      notes: statusNotes || undefined,
    });
    setIsSubmitting(false);

    if (res.error) {
      toast({
        title: "Status Transition Failed",
        description: res.error,
        type: "error",
      });
    } else {
      toast({
        title: "Status Updated",
        description: `Job transitioned to "${selectedNextStatus}".`,
        type: "success",
      });
      setIsStatusModalOpen(false);
      setStatusNotes("");
      loadJobData();
    }
  };

  const handleCancelJob = async () => {
    if (!job) return;
    setIsSubmitting(true);
    const res = await cancelJob(job.id, cancelReason || "Cancelled by office dispatcher.");
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
        description: `${job.jobNumber} has been cancelled.`,
        type: "info",
      });
      setIsCancelModalOpen(false);
      setCancelReason("");
      loadJobData();
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 text-center text-slate-500 flex flex-col items-center gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-xs font-medium">Loading work order and technician activity details...</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-8 text-center space-y-4">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900">Work Order Not Found</h2>
        <p className="text-xs text-slate-500">
          The requested job does not exist or you do not have permission to access it.
        </p>
        <Link href="/app/jobs">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back to Jobs
          </Button>
        </Link>
      </div>
    );
  }

  const pipelineStages: JobStatus[] = ["new", "quoted", "scheduled", "in_progress", "completed"];
  const currentStageIndex = pipelineStages.indexOf(job.status);

  return (
    <div className="space-y-6">
      {/* Top Header & Breadcrumb */}
      <div>
        <Link
          href="/app/jobs"
          className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-blue-600 transition-colors mb-2"
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1" />
          Back to Work Orders
        </Link>

        <PageHeader
          title={`${job.jobNumber}: ${job.title}`}
          description={`Customer: ${job.customerName} • Site: ${job.siteName}`}
          actions={
            <div className="flex items-center gap-2">
              {/* Primary Next Action Progression Button */}
              {job.allowedNextStatuses.length > 0 && (
                <Button
                  size="sm"
                  onClick={() => {
                    setSelectedNextStatus(job.allowedNextStatuses[0]);
                    setIsStatusModalOpen(true);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                >
                  <Play className="h-3.5 w-3.5 mr-1.5" />
                  {job.status === "new" && "Schedule Job"}
                  {job.status === "quoted" && "Accept & Schedule"}
                  {job.status === "scheduled" && "Start Servicing"}
                  {job.status === "in_progress" && "Complete Job"}
                  {job.status === "on_hold" && "Resume Work"}
                </Button>
              )}

              <Button variant="outline" size="sm" onClick={openAssignModal} className="text-slate-700">
                <Users className="h-3.5 w-3.5 mr-1.5" />
                Assign Techs
              </Button>

              <Button variant="outline" size="sm" onClick={openEditModal} className="text-slate-700">
                <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                Edit
              </Button>

              {job.status !== "cancelled" && job.status !== "completed" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCancelModalOpen(true)}
                  className="text-rose-600 hover:bg-rose-50 border-rose-200"
                >
                  <XCircle className="h-3.5 w-3.5 mr-1.5" />
                  Cancel
                </Button>
              )}
            </div>
          }
        />
      </div>

      {/* Visual Status Pipeline Banner */}
      <Card className="border-slate-200 shadow-xs bg-white p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status:</span>
            <StatusBadge status={job.status} />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-3">Priority:</span>
            <StatusBadge status={job.priority} />
          </div>

          {/* Stepper Pipeline */}
          {job.status !== "cancelled" && job.status !== "on_hold" ? (
            <div className="flex items-center gap-1.5 text-xs">
              {pipelineStages.map((stage, idx) => {
                const isPassed = currentStageIndex >= idx;
                const isCurrent = job.status === stage;
                return (
                  <React.Fragment key={stage}>
                    <div
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full font-semibold transition-colors ${
                        isCurrent
                          ? "bg-blue-600 text-white shadow-xs"
                          : isPassed
                          ? "bg-blue-50 text-blue-700"
                          : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      <span>{idx + 1}.</span>
                      <span className="capitalize">{stage.replace("_", " ")}</span>
                    </div>
                    {idx < pipelineStages.length - 1 && (
                      <div className={`w-3 h-0.5 ${isPassed ? "bg-blue-300" : "bg-slate-200"}`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          ) : (
            <div className="text-xs font-semibold px-3 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200">
              Work Order currently {job.status.toUpperCase()}
            </div>
          )}
        </div>
      </Card>

      {/* Main Grid: Left Job Details & History, Right Customer & Site Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Job Overview Card */}
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="p-4 pb-2 border-b border-slate-100">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Scope of Work & Instructions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4 text-xs">
              <div>
                <span className="font-semibold text-slate-700">Problem Description:</span>
                <p className="text-slate-900 mt-1 leading-relaxed bg-slate-50 p-3 rounded-md border border-slate-200">
                  {job.description || "No specific problem notes entered."}
                </p>
              </div>

              {job.assignedNotes && (
                <div>
                  <span className="font-semibold text-slate-700">Dispatcher Instructions / Access Notes:</span>
                  <p className="text-slate-800 mt-1 bg-amber-50/60 p-3 rounded-md border border-amber-200">
                    {job.assignedNotes}
                  </p>
                </div>
              )}

              {job.completionNotes && (
                <div>
                  <span className="font-semibold text-slate-700">Completion Summary:</span>
                  <p className="text-emerald-900 mt-1 bg-emerald-50 p-3 rounded-md border border-emerald-200">
                    {job.completionNotes}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-slate-600 border-t border-slate-100">
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block uppercase">Scheduled Start</span>
                  <span className="font-medium text-slate-900">
                    {job.scheduledStart ? formatDhakaDateTime(job.scheduledStart) : "Not scheduled"}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block uppercase">Duration</span>
                  <span className="font-medium text-slate-900">{job.estimatedDuration} minutes</span>
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-slate-400 block uppercase">Created At</span>
                  <span className="font-medium text-slate-900">{formatDhakaDate(job.createdAt)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tagged Equipment Unit Card */}
          {job.equipment && (
            <Card className="border-slate-200 shadow-xs">
              <CardHeader className="p-4 pb-2 border-b border-slate-100 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Cpu className="h-4 w-4 text-blue-600" />
                  Target AC Equipment Unit
                </CardTitle>
                <Link href="/app/equipment" className="text-xs text-blue-600 hover:underline">
                  View in Registry
                </Link>
              </CardHeader>
              <CardContent className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Brand & Capacity</span>
                  <span className="font-bold text-slate-900">
                    {job.equipment.brand} {job.equipment.capacity}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Model / Series</span>
                  <span className="font-medium text-slate-900">{job.equipment.model || "Standard"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Serial Number</span>
                  <span className="font-mono text-slate-900">{job.equipment.serialNumber || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Refrigerant Gas</span>
                  <span className="font-medium text-slate-900">{job.equipment.refrigerant || "R32"}</span>
                </div>
                {job.equipment.location && (
                  <div className="col-span-2 sm:col-span-4 bg-slate-50 p-2 rounded border border-slate-200 mt-1 text-[11px]">
                    <span className="font-semibold text-slate-700">Location in Facility: </span>
                    <span className="text-slate-900">{job.equipment.location}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Visits & Schedule Windows */}
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="p-4 pb-2 border-b border-slate-100">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-blue-600" />
                Service Visits & Execution Windows ({job.visits.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 text-xs divide-y divide-slate-100">
              {job.visits.length === 0 ? (
                <p className="text-slate-400 italic py-2">No visits generated yet.</p>
              ) : (
                job.visits.map((v) => (
                  <div key={v.id} className="py-3 first:pt-0 last:pb-0 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">Visit #{v.visitNumber}</span>
                      <StatusBadge status={v.status} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600">
                      <p>
                        <strong className="text-slate-700">Scheduled:</strong>{" "}
                        {formatDhakaDateTime(v.scheduledStart)} – {formatDhakaTime(v.scheduledEnd)}
                      </p>
                      {v.actualStart && (
                        <p>
                          <strong className="text-slate-700">Actual:</strong>{" "}
                          {formatDhakaDateTime(v.actualStart)}{" "}
                          {v.actualEnd ? `– ${formatDhakaTime(v.actualEnd)}` : "(In Progress)"}
                        </p>
                      )}
                    </div>
                    {v.technicianNotes && (
                      <p className="text-[11px] text-slate-700 bg-slate-50 p-2 rounded border border-slate-100">
                        <strong>Technician Note:</strong> {v.technicianNotes}
                      </p>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Audit History Timeline */}
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="p-4 pb-2 border-b border-slate-100">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <History className="h-4 w-4 text-slate-600" />
                Audit Trail & Status History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 text-xs">
              {job.activityLogs.length === 0 ? (
                <p className="text-slate-400 italic py-2">No audit logs recorded.</p>
              ) : (
                <div className="space-y-3">
                  {job.activityLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-2.5 pb-2.5 border-b border-slate-100 last:border-0 last:pb-0">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900 capitalize">
                            {log.action.replace(/_/g, " ")}
                          </span>
                          <span className="text-[10px] text-slate-400">{formatDhakaDateTime(log.createdAt)}</span>
                        </div>
                        <p className="text-[11px] text-slate-500">By {log.actorName || "System"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column (1 Col) - Customer, Site, Assignments */}
        <div className="space-y-6">
          {/* Customer Profile Card */}
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="p-4 pb-2 border-b border-slate-100 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Customer Details
              </CardTitle>
              <Link href={`/app/customers/${job.customerId}`} className="text-xs text-blue-600 hover:underline">
                View Account
              </Link>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-xs">
              <div>
                <p className="font-bold text-slate-900 text-sm">{job.customerName}</p>
                <p className="text-slate-600 flex items-center gap-1.5 mt-1">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  <a href={`tel:${job.customerPhone}`} className="hover:underline font-mono">
                    {job.customerPhone}
                  </a>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Service Site Card */}
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="p-4 pb-2 border-b border-slate-100">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-blue-600" />
                Service Site Location
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3 text-xs">
              <div>
                <p className="font-bold text-slate-900">{job.siteName}</p>
                <p className="text-slate-600 leading-relaxed mt-0.5">{job.siteAddress}</p>
              </div>

              {job.siteContactName && (
                <div className="pt-2 border-t border-slate-100 text-[11px]">
                  <span className="font-semibold text-slate-700">Site Contact Person:</span>
                  <p className="text-slate-900">{job.siteContactName} {job.siteContactPhone ? `(${job.siteContactPhone})` : ""}</p>
                </div>
              )}

              {job.accessNotes && (
                <div className="p-2.5 rounded bg-blue-50/70 border border-blue-200 text-blue-900 text-[11px] leading-relaxed">
                  <span className="font-bold block">Technician Access Directions:</span>
                  {job.accessNotes}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Assigned Technicians Card */}
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="p-4 pb-2 border-b border-slate-100 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Users className="h-4 w-4 text-blue-600" />
                Assigned Team ({job.assignedTechnicians.length})
              </CardTitle>
              <button
                type="button"
                onClick={openAssignModal}
                className="text-xs text-blue-600 hover:underline font-medium"
              >
                Reassign
              </button>
            </CardHeader>
            <CardContent className="p-4 text-xs divide-y divide-slate-100">
              {job.assignedTechnicians.length === 0 ? (
                <div className="text-center py-4 text-amber-700 bg-amber-50 rounded-md border border-amber-200">
                  <AlertTriangle className="h-4 w-4 mx-auto mb-1 text-amber-500" />
                  <p className="font-semibold">Unassigned Work Order</p>
                  <p className="text-[11px] mt-0.5">Click &ldquo;Reassign&rdquo; to assign field technicians.</p>
                </div>
              ) : (
                job.assignedTechnicians.map((t) => (
                  <div key={t.technicianId} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900">{t.name}</span>
                        {t.isLead && (
                          <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded font-semibold">
                            Lead
                          </span>
                        )}
                      </div>
                      {t.phone && (
                        <p className="text-[11px] text-slate-500 font-mono mt-0.5">{t.phone}</p>
                      )}
                    </div>
                    <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded capitalize">
                      {t.status}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Job Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-xl p-5 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Edit Work Order {job.jobNumber}</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateJob} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Job Title *</label>
                <Input required value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Service Type</label>
                  <select
                    value={editJobType}
                    onChange={(e) => setEditJobType(e.target.value as JobType)}
                    className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs"
                  >
                    <option value="repair">AC Repair</option>
                    <option value="master_service">Master Service</option>
                    <option value="gas_charging">Gas Charging</option>
                    <option value="installation">Installation</option>
                    <option value="uninstallation">Uninstallation</option>
                    <option value="inspection">Inspection</option>
                    <option value="amc_routine">AMC Routine</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Priority Level</label>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value as JobPriority)}
                    className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Service Site</label>
                  <select
                    value={editSiteId}
                    onChange={(e) => setEditSiteId(e.target.value)}
                    className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs"
                  >
                    {customerSites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.siteName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">AC Unit</label>
                  <select
                    value={editAssetId}
                    onChange={(e) => setEditAssetId(e.target.value)}
                    className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs"
                  >
                    <option value="">No specific unit</option>
                    {customerAssets.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.brand} {a.capacity || ""} ({a.model || "Unit"})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Scheduled Date</label>
                  <Input type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Start Time</label>
                  <Input type="time" value={editStartTime} onChange={(e) => setEditStartTime(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Duration (min)</label>
                  <Input
                    type="number"
                    value={editDuration}
                    onChange={(e) => setEditDuration(parseInt(e.target.value) || 120)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Description</label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full rounded-md border border-slate-200 p-2.5 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsEditModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Technicians Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Assign Technicians</h3>
              <button onClick={() => setIsAssignModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            {assignConflicts.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-amber-900 text-xs space-y-1">
                <div className="flex items-center gap-1 font-bold">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Schedule Conflict Detected!
                </div>
                {assignConflicts.map((c, i) => (
                  <p key={i} className="text-[11px] leading-tight">
                    • {c.technicianName} is booked for {c.conflictingJobNumber} ({c.conflictingJobTitle}).
                  </p>
                ))}
              </div>
            )}

            <form onSubmit={handleSaveAssignments} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Select Field Technicians</label>
                <div className="space-y-1 max-h-48 overflow-y-auto border border-slate-200 rounded p-2 bg-slate-50">
                  {technicians.map((t) => {
                    const isChecked = selectedTechIds.includes(t.id);
                    return (
                      <label
                        key={t.id}
                        className={`flex items-center justify-between p-1.5 rounded cursor-pointer ${
                          isChecked ? "bg-blue-100 text-blue-900 font-semibold" : "hover:bg-slate-100"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedTechIds([...selectedTechIds, t.id]);
                                if (!leadTechId) setLeadTechId(t.id);
                              } else {
                                setSelectedTechIds(selectedTechIds.filter((id) => id !== t.id));
                                if (leadTechId === t.id) setLeadTechId("");
                              }
                            }}
                          />
                          <span>{t.fullName}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-normal">{t.role}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {selectedTechIds.length > 1 && (
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Designate Lead Technician</label>
                  <select
                    value={leadTechId}
                    onChange={(e) => setLeadTechId(e.target.value)}
                    className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs"
                  >
                    {selectedTechIds.map((id) => {
                      const t = technicians.find((tech) => tech.id === id);
                      return (
                        <option key={id} value={id}>
                          {t?.fullName || "Technician"}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsAssignModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {isSubmitting ? "Assigning..." : "Save Assignments"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transition Status Modal */}
      {isStatusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Update Work Order Status</h3>
              <button onClick={() => setIsStatusModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleTransitionStatus} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Next Stage / Status</label>
                <select
                  value={selectedNextStatus}
                  onChange={(e) => setSelectedNextStatus(e.target.value as JobStatus)}
                  className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs capitalize"
                >
                  {job.allowedNextStatuses.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Status Change Notes / Findings</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Compressor replaced, gas pressure refilled to 65 PSI."
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  className="w-full rounded-md border border-slate-200 p-2.5 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsStatusModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {isSubmitting ? "Updating..." : "Confirm Status Change"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Dialog */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-md p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-rose-100 text-rose-600 rounded-full shrink-0">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-slate-900 text-sm">Cancel Work Order {job.jobNumber}?</h3>
                <p className="text-xs text-slate-500">
                  This work order will be marked as cancelled. History, visits, and customer records remain intact.
                </p>
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <label className="font-semibold text-slate-700">Reason for Cancellation</label>
              <textarea
                rows={2}
                placeholder="e.g. Customer cancelled appointment."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full rounded-md border border-slate-200 p-2 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setIsCancelModalOpen(false)}>
                Keep Active
              </Button>
              <Button size="sm" variant="destructive" disabled={isSubmitting} onClick={handleCancelJob}>
                {isSubmitting ? "Cancelling..." : "Confirm Cancellation"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
