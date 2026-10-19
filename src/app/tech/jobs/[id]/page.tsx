"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Camera,
  Plus,
  Cpu,
  Check,
  X,
  Minus,
  MapPin,
  Phone,
  Navigation,
  Wrench,
  AlertTriangle,
  Play,
  Pause,
  CheckSquare,
  Trash2,
  Loader2,
  FileText,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { formatBDPhoneDisplay } from "@/lib/formatters";
import {
  getTechnicianJobDetail,
  startJobWork,
  pauseJobWork,
  resumeJobWork,
  saveChecklistResponse,
  addPartUsed,
  removePartUsed,
  uploadJobPhoto,
  completeJobWork,
} from "@/features/tech/actions";
import type {
  TechJobDetail,
  TechChecklistItem,
  ChecklistResult,
} from "@/features/tech/types";

export default function TechJobDetailPage() {
  const params = useParams();
  const { toast } = useToast();
  const jobId = params?.id as string;

  const [job, setJob] = React.useState<TechJobDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [actionLoading, setActionLoading] = React.useState(false);

  // Parts form state
  const [newPartName, setNewPartName] = React.useState("");
  const [newPartQty, setNewPartQty] = React.useState("1");
  const [newPartUnit, setNewPartUnit] = React.useState("pc");
  const [newPartNotes, setNewPartNotes] = React.useState("");
  const [addingPart, setAddingPart] = React.useState(false);

  // Photo upload state
  const [uploadingPhoto, setUploadingPhoto] = React.useState(false);
  const [photoCaption, setPhotoCaption] = React.useState("");
  const [photoType, setPhotoType] = React.useState<"before" | "after" | "evidence">("evidence");
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Completion modal state
  const [showCompleteModal, setShowCompleteModal] = React.useState(false);
  const [workPerformed, setWorkPerformed] = React.useState("");
  const [completionNotes, setCompletionNotes] = React.useState("");
  const [followUpRecommendation, setFollowUpRecommendation] = React.useState("");
  const [completing, setCompleting] = React.useState(false);

  // Pause modal state
  const [showPauseModal, setShowPauseModal] = React.useState(false);
  const [pauseReason, setPauseReason] = React.useState("");

  const loadJob = React.useCallback(async () => {
    if (!jobId) return;
    const res = await getTechnicianJobDetail(jobId);
    if (res.success && res.data) {
      setJob(res.data);
      if (res.data.workPerformed) setWorkPerformed(res.data.workPerformed);
      if (res.data.completionNotes) setCompletionNotes(res.data.completionNotes);
      if (res.data.followUpRecommendation)
        setFollowUpRecommendation(res.data.followUpRecommendation);
    } else {
      toast({
        title: "Could not load job",
        description: res.error || "Please verify your assignment or connection.",
        type: "error",
      });
    }
    setLoading(false);
  }, [jobId, toast]);

  React.useEffect(() => {
    let ignore = false;
    async function init() {
      if (!jobId) return;
      const res = await getTechnicianJobDetail(jobId);
      if (!ignore) {
        if (res.success && res.data) {
          setJob(res.data);
          if (res.data.workPerformed) setWorkPerformed(res.data.workPerformed);
          if (res.data.completionNotes) setCompletionNotes(res.data.completionNotes);
          if (res.data.followUpRecommendation)
            setFollowUpRecommendation(res.data.followUpRecommendation);
        } else {
          toast({
            title: "Could not load job",
            description: res.error || "Please verify your assignment or connection.",
            type: "error",
          });
        }
        setLoading(false);
      }
    }
    init();
    return () => {
      ignore = true;
    };
  }, [jobId, toast]);

  // Status transitions
  const handleStartWork = async () => {
    setActionLoading(true);
    const res = await startJobWork(jobId);
    if (res.success) {
      toast({
        title: "Work Started",
        description: "Arrival recorded. Timer is active.",
        type: "success",
      });
      await loadJob();
    } else {
      toast({
        title: "Action Failed",
        description: res.error || "Could not start work.",
        type: "error",
      });
    }
    setActionLoading(false);
  };

  const handlePauseWork = async () => {
    setActionLoading(true);
    const res = await pauseJobWork(jobId, pauseReason);
    if (res.success) {
      toast({
        title: "Work Paused",
        description: "Job status transitioned to On-Hold.",
        type: "info",
      });
      setShowPauseModal(false);
      setPauseReason("");
      await loadJob();
    } else {
      toast({
        title: "Action Failed",
        description: res.error || "Could not pause work.",
        type: "error",
      });
    }
    setActionLoading(false);
  };

  const handleResumeWork = async () => {
    setActionLoading(true);
    const res = await resumeJobWork(jobId);
    if (res.success) {
      toast({
        title: "Work Resumed",
        description: "Job is back In Progress.",
        type: "success",
      });
      await loadJob();
    } else {
      toast({
        title: "Action Failed",
        description: res.error || "Could not resume work.",
        type: "error",
      });
    }
    setActionLoading(false);
  };

  // Checklist updates
  const handleChecklistResultChange = async (
    item: TechChecklistItem,
    newResult: ChecklistResult
  ) => {
    if (!job) return;

    // Optimistically update
    const updated = job.checklists.map((c) =>
      c.id === item.id ? { ...c, result: newResult } : c
    );
    setJob({ ...job, checklists: updated });

    const res = await saveChecklistResponse(jobId, {
      itemKey: item.itemKey,
      result: newResult,
      valueNumber: item.valueNumber,
      valueBoolean: newResult === "pass",
      valueText: item.valueText,
      notes: item.notes,
    });

    if (!res.success) {
      toast({
        title: "Checklist Error",
        description: res.error || "Could not save response.",
        type: "error",
      });
      await loadJob();
    }
  };

  const handleChecklistNumberChange = async (
    item: TechChecklistItem,
    valStr: string
  ) => {
    if (!job) return;
    const num = valStr.trim() === "" ? null : Number(valStr);

    const updated = job.checklists.map((c) =>
      c.id === item.id ? { ...c, valueNumber: num } : c
    );
    setJob({ ...job, checklists: updated });

    await saveChecklistResponse(jobId, {
      itemKey: item.itemKey,
      result: item.result,
      valueNumber: num,
      notes: item.notes,
    });
  };

  const handleChecklistNotesChange = async (
    item: TechChecklistItem,
    noteText: string
  ) => {
    if (!job) return;
    const updated = job.checklists.map((c) =>
      c.id === item.id ? { ...c, notes: noteText } : c
    );
    setJob({ ...job, checklists: updated });

    await saveChecklistResponse(jobId, {
      itemKey: item.itemKey,
      result: item.result,
      valueNumber: item.valueNumber,
      notes: noteText,
    });
  };

  // Parts handlers
  const handleAddPart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartName.trim()) return;

    setAddingPart(true);
    const qty = parseFloat(newPartQty) || 1;
    const res = await addPartUsed(jobId, {
      partName: newPartName.trim(),
      quantity: qty,
      unitOfMeasure: newPartUnit.trim() || "pc",
      notes: newPartNotes.trim() || undefined,
    });

    if (res.success && res.part) {
      toast({
        title: "Part Logged",
        description: `Recorded ${res.part.partName} (${res.part.quantity} ${res.part.unitOfMeasure}).`,
        type: "success",
      });
      setNewPartName("");
      setNewPartQty("1");
      setNewPartNotes("");
      await loadJob();
    } else {
      toast({
        title: "Could not log part",
        description: res.error || "Failed to record part.",
        type: "error",
      });
    }
    setAddingPart(false);
  };

  const handleDeletePart = async (partId: string) => {
    const res = await removePartUsed(jobId, partId);
    if (res.success) {
      toast({ title: "Part Removed", type: "info" });
      await loadJob();
    } else {
      toast({ title: "Failed to remove part", description: res.error, type: "error" });
    }
  };

  // Photo uploads
  const handlePhotoFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    const formData = new FormData();
    formData.append("jobId", jobId);
    formData.append("file", file);
    formData.append("caption", photoCaption.trim());
    formData.append("attachmentType", photoType);

    const res = await uploadJobPhoto(formData);
    if (res.success) {
      toast({
        title: "Photo Attached",
        description: "Encrypted & uploaded to secure Supabase storage.",
        type: "success",
      });
      setPhotoCaption("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadJob();
    } else {
      toast({
        title: "Upload Failed",
        description: res.error || "Please verify file format and size (< 10MB).",
        type: "error",
      });
    }
    setUploadingPhoto(false);
  };

  // Job Completion
  const handleOpenCompleteModal = () => {
    if (!job) return;

    // Check mandatory items
    const pendingMandatory = job.checklists.filter(
      (c) => c.isMandatory && (!c.result || c.result === "pending")
    );

    if (pendingMandatory.length > 0) {
      toast({
        title: "Mandatory Checks Incomplete",
        description: `Please complete: "${pendingMandatory[0].label}" (${pendingMandatory.length} mandatory item(s) pending).`,
        type: "error",
      });
      return;
    }

    setShowCompleteModal(true);
  };

  const handleSubmitComplete = async () => {
    if (!workPerformed.trim() || workPerformed.trim().length < 5) {
      toast({
        title: "Details Required",
        description: "Please describe the work performed (min 5 characters).",
        type: "error",
      });
      return;
    }

    setCompleting(true);
    const res = await completeJobWork(jobId, {
      workPerformed: workPerformed.trim(),
      completionNotes: completionNotes.trim(),
      followUpRecommendation: followUpRecommendation.trim(),
    });

    if (res.success) {
      toast({
        title: "Job Completed!",
        description: "Work order successfully closed and submitted to dispatch.",
        type: "success",
      });
      setShowCompleteModal(false);
      await loadJob();
    } else {
      toast({
        title: "Completion Failed",
        description: res.error || "Could not complete job.",
        type: "error",
      });
    }
    setCompleting(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-xs text-slate-500 font-medium">Loading work order details...</p>
      </div>
    );
  }

  if (!job) {
    return (
      <Card className="p-6 text-center space-y-3 bg-white border-slate-200">
        <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
        <h2 className="text-base font-bold text-slate-900">Work Order Not Found</h2>
        <p className="text-xs text-slate-500">
          This job might have been reassigned or does not belong to your organization.
        </p>
        <Link href="/tech/jobs">
          <Button className="text-xs h-9 bg-blue-600 hover:bg-blue-700 text-white">
            Back to Assigned Jobs
          </Button>
        </Link>
      </Card>
    );
  }

  const mapQuery = [job.siteAddress, job.siteArea, job.siteCity, "Bangladesh"]
    .filter(Boolean)
    .join(", ");
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    mapQuery
  )}`;

  const totalMandatory = job.checklists.filter((c) => c.isMandatory).length;
  const completedMandatory = job.checklists.filter(
    (c) => c.isMandatory && c.result && c.result !== "pending"
  ).length;

  return (
    <div className="space-y-4 pb-12">
      {/* Top Navigation & Status Strip */}
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/tech/jobs"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>All Jobs</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-extrabold text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-200">
            {job.jobNumber}
          </span>
          <StatusBadge status={job.status} />
        </div>
      </div>

      {/* Main Execution Header Card */}
      <Card className="p-4 bg-white border-slate-200 shadow-xs space-y-3">
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {job.jobType} Service Order
          </span>
          <h1 className="text-base font-extrabold text-slate-900 mt-0.5 leading-snug">
            {job.title}
          </h1>
          {job.description && (
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              {job.description}
            </p>
          )}
        </div>

        {/* Timestamps */}
        <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-100">
          <div>
            <span className="text-slate-400 block font-medium">Scheduled</span>
            <span className="font-bold text-slate-700">
              {job.scheduledStart
                ? new Date(job.scheduledStart).toLocaleTimeString("en-BD", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Asia/Dhaka",
                  })
                : "Not set"}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block font-medium">Actual Start</span>
            <span className="font-bold text-slate-900">
              {job.actualStart
                ? new Date(job.actualStart).toLocaleTimeString("en-BD", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Asia/Dhaka",
                  })
                : "Not started"}
            </span>
          </div>
        </div>

        {/* Mobile Primary Execution Action Controls */}
        <div className="pt-1">
          {job.status === "scheduled" && (
            <Button
              onClick={handleStartWork}
              disabled={actionLoading}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm gap-2 shadow-xs active:scale-[0.98] transition-transform"
            >
              {actionLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Play className="h-5 w-5 fill-current" />
              )}
              <span>Arrive & Start Work</span>
            </Button>
          )}

          {job.status === "in_progress" && (
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => setShowPauseModal(true)}
                disabled={actionLoading}
                variant="outline"
                className="h-12 border-slate-300 font-bold text-xs gap-1.5 text-slate-700 hover:bg-slate-50"
              >
                <Pause className="h-4 w-4" />
                <span>Pause / On-Hold</span>
              </Button>

              <Button
                onClick={handleOpenCompleteModal}
                disabled={actionLoading}
                className="h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs gap-1.5 shadow-xs"
              >
                <CheckSquare className="h-4 w-4" />
                <span>Complete Job</span>
              </Button>
            </div>
          )}

          {job.status === "on_hold" && (
            <Button
              onClick={handleResumeWork}
              disabled={actionLoading}
              className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-slate-900 font-extrabold text-sm gap-2 shadow-xs"
            >
              {actionLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Play className="h-5 w-5 fill-current" />
              )}
              <span>Resume Work Order</span>
            </Button>
          )}

          {job.status === "completed" && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-3 rounded-lg text-xs flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold block">Job Completed & Submitted</span>
                <span className="text-[11px] text-emerald-700">
                  Closed on{" "}
                  {job.completedAt
                    ? new Date(job.completedAt).toLocaleString("en-BD", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Dhaka",
                      })
                    : "Completed"}
                </span>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Customer & Location Details */}
      <Card className="p-4 bg-white border-slate-200 shadow-xs space-y-3">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Client & Site Contact
        </h2>

        {/* Customer Tap-to-call */}
        <div className="flex items-center justify-between text-xs bg-slate-50 p-3 rounded-lg border border-slate-100">
          <div>
            <span className="font-bold text-slate-900 block text-sm">
              {job.customerName}
            </span>
            <span className="text-slate-500 text-[11px]">
              {formatBDPhoneDisplay(job.customerPhone)}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {job.customerPhone && (
              <a
                href={`tel:${job.customerPhone}`}
                className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-2 rounded-lg shadow-xs active:scale-95 transition-transform"
              >
                <Phone className="h-3.5 w-3.5" />
                <span>Call Client</span>
              </a>
            )}
            {job.alternatePhone && (
              <a
                href={`tel:${job.alternatePhone}`}
                className="inline-flex items-center gap-1 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs px-2.5 py-2 rounded-lg"
                title="Alternate phone"
              >
                <Phone className="h-3.5 w-3.5" />
                <span>Alt</span>
              </a>
            )}
          </div>
        </div>

        {/* Site Location with Google Maps link */}
        <div className="text-xs space-y-1.5 pt-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-1.5">
              <MapPin className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-900 block">
                  {job.siteName}
                </span>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  {job.siteAddress}
                  {job.siteArea ? `, ${job.siteArea}` : ""}
                  {job.siteCity ? `, ${job.siteCity}` : ""}
                </p>
              </div>
            </div>

            <a
              href={mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-xs px-2.5 py-1.5 rounded-lg shrink-0 active:scale-95 transition-transform"
            >
              <Navigation className="h-3.5 w-3.5" />
              <span>Map</span>
            </a>
          </div>

          {job.accessNotes && (
            <div className="bg-amber-50/70 border border-amber-200/60 p-2 rounded text-[11px] text-amber-900 flex items-start gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Access Instructions:</strong> {job.accessNotes}
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* Equipment Information */}
      <Card className="p-4 bg-white border-slate-200 shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5 text-slate-600" />
            <span>Equipment Specifications</span>
          </h2>
          {job.assetCapacity && (
            <span className="text-[10px] font-extrabold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
              {job.assetCapacity}
            </span>
          )}
        </div>

        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500">Unit Brand & Model</span>
            <span className="font-bold text-slate-900">
              {job.assetBrand || "Not specified"} {job.assetModel || ""}
            </span>
          </div>

          {job.equipmentLocation && (
            <div className="flex justify-between">
              <span className="text-slate-500">Unit Location</span>
              <span className="font-semibold text-slate-800">
                {job.equipmentLocation}
              </span>
            </div>
          )}

          {job.equipmentServiceNotes && (
            <div className="pt-2 border-t border-slate-200/60 text-[11px]">
              <span className="text-slate-500 block font-medium">
                Previous Service History & Notes:
              </span>
              <p className="text-slate-700 mt-0.5 italic">
                &ldquo;{job.equipmentServiceNotes}&rdquo;
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Diagnostic Checklist Section */}
      <Card className="p-4 bg-white border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <CheckSquare className="h-4 w-4 text-blue-600" />
              <span>AC & Refrigeration Checklist</span>
            </h2>
            <p className="text-[11px] text-slate-500">
              Record real diagnostic readings. All mandatory (*) items required.
            </p>
          </div>
          <span className="text-xs font-extrabold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
            {completedMandatory}/{totalMandatory} Mandatory
          </span>
        </div>

        {/* Checklist Items List */}
        <div className="space-y-3 pt-1">
          {job.checklists.map((item) => (
            <div
              key={item.id}
              className={`p-3 rounded-xl border transition-all ${
                item.result === "pass"
                  ? "bg-emerald-50/40 border-emerald-200"
                  : item.result === "fail"
                  ? "bg-red-50/40 border-red-200"
                  : item.result === "na"
                  ? "bg-slate-50 border-slate-200"
                  : "bg-white border-slate-200 shadow-2xs"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1">
                    {item.label}
                    {item.isMandatory && (
                      <span className="text-red-500 font-extrabold" title="Mandatory item">
                        *
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] text-slate-400 capitalize">
                    Category: {item.category}
                  </span>
                </div>

                {/* Status Indicator */}
                <span
                  className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                    item.result === "pass"
                      ? "bg-emerald-600 text-white"
                      : item.result === "fail"
                      ? "bg-red-600 text-white"
                      : item.result === "na"
                      ? "bg-slate-500 text-white"
                      : "bg-amber-100 text-amber-800 border border-amber-300"
                  }`}
                >
                  {item.result || "Pending"}
                </span>
              </div>

              {/* Pass / Fail / NA Action Toggle Buttons */}
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                <button
                  type="button"
                  disabled={job.status === "completed"}
                  onClick={() => handleChecklistResultChange(item, "pass")}
                  className={`py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all active:scale-95 ${
                    item.result === "pass"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-slate-100 hover:bg-emerald-50 text-slate-700 border border-slate-200"
                  }`}
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Pass</span>
                </button>

                <button
                  type="button"
                  disabled={job.status === "completed"}
                  onClick={() => handleChecklistResultChange(item, "fail")}
                  className={`py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all active:scale-95 ${
                    item.result === "fail"
                      ? "bg-red-600 text-white shadow-xs"
                      : "bg-slate-100 hover:bg-red-50 text-slate-700 border border-slate-200"
                  }`}
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Fail</span>
                </button>

                <button
                  type="button"
                  disabled={job.status === "completed"}
                  onClick={() => handleChecklistResultChange(item, "na")}
                  className={`py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all active:scale-95 ${
                    item.result === "na"
                      ? "bg-slate-600 text-white shadow-xs"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                  }`}
                >
                  <Minus className="h-3.5 w-3.5" />
                  <span>N/A</span>
                </button>
              </div>

              {/* Numeric Measurement Field (if applicable) */}
              {item.fieldType === "number" && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] font-medium text-slate-600 shrink-0">
                    Measurement:
                  </span>
                  <div className="relative flex-1">
                    <input
                      type="number"
                      step="any"
                      disabled={job.status === "completed"}
                      defaultValue={item.valueNumber ?? ""}
                      onBlur={(e) =>
                        handleChecklistNumberChange(item, e.target.value)
                      }
                      placeholder={`e.g. 115`}
                      className="w-full text-xs h-8 px-2.5 pr-10 border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 bg-white"
                    />
                    {item.unit && (
                      <span className="absolute right-2.5 top-1.5 text-[10px] font-bold text-slate-400">
                        {item.unit}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Optional Findings & Notes */}
              <div>
                <input
                  type="text"
                  disabled={job.status === "completed"}
                  defaultValue={item.notes ?? ""}
                  onBlur={(e) => handleChecklistNotesChange(item, e.target.value)}
                  placeholder="Observation notes (e.g. Flare nut tight, capacitor 45uF OK)..."
                  className="w-full text-[11px] h-7 px-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 bg-white/80"
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Parts Used Section */}
      <Card className="p-4 bg-white border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <Wrench className="h-4 w-4 text-amber-600" />
            <span>Parts & Materials Used</span>
          </h2>
          <span className="text-xs font-semibold text-slate-500">
            {job.parts.length} logged
          </span>
        </div>

        {/* Existing Parts List */}
        {job.parts.length > 0 ? (
          <div className="space-y-2">
            {job.parts.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs"
              >
                <div>
                  <span className="font-bold text-slate-900 block">
                    {p.partName}
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Quantity: {p.quantity} {p.unitOfMeasure}
                    {p.notes ? ` • ${p.notes}` : ""}
                  </span>
                </div>
                {job.status !== "completed" && (
                  <button
                    onClick={() => handleDeletePart(p.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                    title="Remove part"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">No spare parts recorded for this job.</p>
        )}

        {/* Quick Add Part Form */}
        {job.status !== "completed" && (
          <form
            onSubmit={handleAddPart}
            className="pt-2 border-t border-slate-100 space-y-2"
          >
            <div className="grid grid-cols-12 gap-1.5">
              <input
                type="text"
                placeholder="Part Name (e.g. R410A Refrigerant, 45uF Capacitor)"
                value={newPartName}
                onChange={(e) => setNewPartName(e.target.value)}
                className="col-span-7 text-xs h-9 px-2.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
              />
              <input
                type="number"
                step="any"
                placeholder="Qty"
                value={newPartQty}
                onChange={(e) => setNewPartQty(e.target.value)}
                className="col-span-2 text-xs h-9 px-2 text-center border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
              />
              <select
                value={newPartUnit}
                onChange={(e) => setNewPartUnit(e.target.value)}
                className="col-span-3 text-xs h-9 px-1 border border-slate-300 rounded-lg bg-white"
              >
                <option value="pc">pc</option>
                <option value="kg">kg</option>
                <option value="meter">meter</option>
                <option value="can">can</option>
              </select>
            </div>

            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder="Optional part notes (e.g. Topped up 300g)..."
                value={newPartNotes}
                onChange={(e) => setNewPartNotes(e.target.value)}
                className="flex-1 text-xs h-8 px-2.5 border border-slate-200 rounded-lg"
              />
              <Button
                type="submit"
                disabled={addingPart || !newPartName.trim()}
                className="h-8 px-3 text-xs bg-slate-900 hover:bg-slate-800 text-white font-semibold"
              >
                {addingPart ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                <span>Add</span>
              </Button>
            </div>
          </form>
        )}
      </Card>

      {/* Service Photo Evidence Section */}
      <Card className="p-4 bg-white border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Camera className="h-4 w-4 text-blue-600" />
              <span>Service Photos & Evidence</span>
            </h2>
            <p className="text-[11px] text-slate-500">
              Private organization storage. Max 10MB JPG, PNG, WEBP.
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {job.photos.length} uploaded
          </span>
        </div>

        {/* Photo Gallery Grid */}
        {job.photos.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {job.photos.map((p) => (
              <div
                key={p.id}
                className="group relative rounded-lg overflow-hidden border border-slate-200 bg-slate-50 shadow-2xs"
              >
                {p.signedUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.signedUrl}
                    alt={p.caption || p.fileName}
                    className="w-full h-28 object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="w-full h-28 flex items-center justify-center bg-slate-100 text-slate-400 text-xs">
                    File Encrypted
                  </div>
                )}
                <div className="p-1.5 bg-white text-[10px]">
                  <span className="font-bold text-slate-800 block truncate">
                    {p.caption || p.attachmentType.toUpperCase()}
                  </span>
                  <span className="text-slate-400 block truncate">
                    {new Date(p.createdAt).toLocaleTimeString("en-BD", {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "Asia/Dhaka",
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 bg-slate-50 rounded-lg border border-dashed border-slate-300 text-xs text-slate-400">
            No service photos uploaded yet.
          </div>
        )}

        {/* Upload Controls */}
        {job.status !== "completed" && (
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <div className="grid grid-cols-3 gap-1.5 text-xs">
              {(["before", "after", "evidence"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setPhotoType(t)}
                  className={`py-1 rounded font-bold capitalize transition-colors ${
                    photoType === t
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="Photo caption (e.g. Suction manifold reading at 115 PSI)..."
              value={photoCaption}
              onChange={(e) => setPhotoCaption(e.target.value)}
              className="w-full text-xs h-8 px-2.5 border border-slate-300 rounded-lg"
            />

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoFileSelected}
              className="hidden"
            />

            <Button
              type="button"
              disabled={uploadingPhoto}
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs gap-2"
            >
              {uploadingPhoto ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Encrypting & Uploading to Private Storage...</span>
                </>
              ) : (
                <>
                  <Camera className="h-4 w-4" />
                  <span>Take / Upload Service Photo</span>
                </>
              )}
            </Button>
          </div>
        )}
      </Card>

      {/* Completion Summary (If Completed) */}
      {job.status === "completed" && (
        <Card className="p-4 bg-emerald-50/50 border-emerald-200 shadow-xs space-y-2 text-xs">
          <h2 className="font-extrabold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="h-4 w-4 text-emerald-700" />
            <span>Job Completion Report</span>
          </h2>

          <div className="bg-white p-3 rounded-lg border border-emerald-200/80 space-y-2">
            <div>
              <span className="font-bold text-slate-800 block">Work Performed:</span>
              <p className="text-slate-700 mt-0.5 leading-relaxed">
                {job.workPerformed || "Not recorded"}
              </p>
            </div>

            {job.followUpRecommendation && (
              <div className="pt-2 border-t border-slate-100">
                <span className="font-bold text-slate-800 block">
                  Follow-up Recommendation:
                </span>
                <p className="text-slate-700 mt-0.5">
                  {job.followUpRecommendation}
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Completion Modal / Dialog */}
      {showCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Complete Work Order #{job.jobNumber}
                </h3>
              </div>
              <button
                onClick={() => setShowCompleteModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Actual Work Performed <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={workPerformed}
                  onChange={(e) => setWorkPerformed(e.target.value)}
                  placeholder="e.g. Jet washed indoor evaporator and outdoor condenser. Checked R410A suction pressure (115 PSI). Flushed drain pipe."
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Follow-up Recommendation (Optional)
                </label>
                <textarea
                  rows={2}
                  value={followUpRecommendation}
                  onChange={(e) => setFollowUpRecommendation(e.target.value)}
                  placeholder="e.g. Recommend replacing blower bearing during next scheduled servicing."
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Internal Completion Notes (Optional)
                </label>
                <input
                  type="text"
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  placeholder="Client signed off verbally with Mr. Rafiqul."
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 text-xs"
                />
              </div>

              <div className="bg-slate-50 p-2.5 rounded border text-[11px] text-slate-600">
                <span>
                  ✓ All {completedMandatory} mandatory checklist checks are recorded.
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCompleteModal(false)}
                className="flex-1 text-xs h-10"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={completing}
                onClick={handleSubmitComplete}
                className="flex-1 text-xs h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                {completing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span>Submit Completion</span>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Pause Modal */}
      {showPauseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 space-y-3">
            <h3 className="font-bold text-slate-900 text-sm">
              Pause Work Order
            </h3>
            <p className="text-xs text-slate-500">
              State the reason for pausing (e.g. Waiting for client access, spare parts procurement, heavy rain).
            </p>
            <textarea
              rows={2}
              value={pauseReason}
              onChange={(e) => setPauseReason(e.target.value)}
              placeholder="Reason for pause..."
              className="w-full p-2 border border-slate-300 rounded-lg text-xs"
            />
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowPauseModal(false)}
                className="flex-1 text-xs h-9"
              >
                Cancel
              </Button>
              <Button
                onClick={handlePauseWork}
                className="flex-1 text-xs h-9 bg-amber-600 hover:bg-amber-700 text-white font-bold"
              >
                Confirm Pause
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
