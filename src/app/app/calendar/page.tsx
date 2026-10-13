"use client";

import * as React from "react";
import Link from "next/link";
import {
  Clock,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  AlertTriangle,
  X,
  Loader2,
  Cpu,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import {
  getCalendarJobs,
  rescheduleJob,
  assignTechnicians,
  getAssignableTechnicians,
  checkTechnicianScheduleConflicts,
  type JobListItem,
  type ScheduleConflict,
} from "@/features/jobs/actions";
import { formatDhakaDateTime, formatDhakaDate, formatDhakaTime } from "@/lib/formatters";

type CalendarViewMode = "day" | "week" | "month";

export default function CalendarPage() {
  const { toast } = useToast();
  const [viewMode, setViewMode] = React.useState<CalendarViewMode>("day");
  const [currentDate, setCurrentDate] = React.useState<Date>(() => new Date());
  const [selectedTechId, setSelectedTechId] = React.useState("all");

  const [jobs, setJobs] = React.useState<JobListItem[]>([]);
  const [technicians, setTechnicians] = React.useState<
    Array<{ id: string; fullName: string; phone: string | null; role: string }>
  >([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Modals for Quick Reschedule and Reassign
  const [jobToReschedule, setJobToReschedule] = React.useState<JobListItem | null>(null);
  const [rescheduleDate, setRescheduleDate] = React.useState("");
  const [rescheduleTime, setRescheduleTime] = React.useState("10:00");
  const [rescheduleDuration, setRescheduleDuration] = React.useState(120);
  const [rescheduleConflicts, setRescheduleConflicts] = React.useState<ScheduleConflict[]>([]);

  const [jobToReassign, setJobToReassign] = React.useState<JobListItem | null>(null);
  const [reassignTechIds, setReassignTechIds] = React.useState<string[]>([]);
  const [reassignConflicts, setReassignConflicts] = React.useState<ScheduleConflict[]>([]);

  // Calculate start and end ISO strings based on current date and view mode
  const { startIso, endIso } = React.useMemo(() => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);

    if (viewMode === "day") {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (viewMode === "week") {
      const day = start.getDay(); // 0 is Sunday
      start.setDate(start.getDate() - day);
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else {
      // Month
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
    }

    return { startIso: start.toISOString(), endIso: end.toISOString() };
  }, [currentDate, viewMode]);

  // Load calendar jobs
  const loadCalendarData = React.useCallback(async () => {
    setIsLoading(true);
    const res = await getCalendarJobs({
      startDate: startIso,
      endDate: endIso,
      technicianId: selectedTechId !== "all" ? selectedTechId : undefined,
    });
    if (res.error) {
      toast({
        title: "Error Loading Calendar",
        description: res.error,
        type: "error",
      });
    } else if (res.data) {
      setJobs(res.data);
    }
    setIsLoading(false);
  }, [startIso, endIso, selectedTechId, toast]);

  // Initial and reactive fetch
  React.useEffect(() => {
    let active = true;
    getCalendarJobs({
      startDate: startIso,
      endDate: endIso,
      technicianId: selectedTechId !== "all" ? selectedTechId : undefined,
    }).then((res) => {
      if (active) {
        if (res.data) setJobs(res.data);
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
  }, [startIso, endIso, selectedTechId]);

  // Detect schedule overlaps across all loaded jobs
  const detectedOverlaps = React.useMemo(() => {
    const overlapsMap = new Map<string, string[]>(); // jobId -> array of overlapping job numbers
    for (let i = 0; i < jobs.length; i++) {
      for (let j = i + 1; j < jobs.length; j++) {
        const j1 = jobs[i];
        const j2 = jobs[j];
        if (!j1.scheduledStart || !j1.scheduledEnd || !j2.scheduledStart || !j2.scheduledEnd) continue;
        if (j1.status === "cancelled" || j2.status === "cancelled") continue;

        // Check if they share any technician
        const commonTech = j1.assignedTechnicians.some((t1) =>
          j2.assignedTechnicians.some((t2) => t2.technicianId === t1.technicianId)
        );

        if (commonTech) {
          const s1 = new Date(j1.scheduledStart).getTime();
          const e1 = new Date(j1.scheduledEnd).getTime();
          const s2 = new Date(j2.scheduledStart).getTime();
          const e2 = new Date(j2.scheduledEnd).getTime();

          if (s1 < e2 && e1 > s2) {
            const list1 = overlapsMap.get(j1.id) || [];
            list1.push(j2.jobNumber);
            overlapsMap.set(j1.id, list1);

            const list2 = overlapsMap.get(j2.id) || [];
            list2.push(j1.jobNumber);
            overlapsMap.set(j2.id, list2);
          }
        }
      }
    }
    return overlapsMap;
  }, [jobs]);

  // Handle date navigation
  const handlePrevDate = () => {
    const d = new Date(currentDate);
    if (viewMode === "day") d.setDate(d.getDate() - 1);
    else if (viewMode === "week") d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  };

  const handleNextDate = () => {
    const d = new Date(currentDate);
    if (viewMode === "day") d.setDate(d.getDate() + 1);
    else if (viewMode === "week") d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Reschedule handlers
  const openRescheduleModal = (job: JobListItem) => {
    setJobToReschedule(job);
    if (job.scheduledStart) {
      const d = new Date(job.scheduledStart);
      setRescheduleDate(d.toISOString().slice(0, 10));
      setRescheduleTime(d.toTimeString().slice(0, 5));
    } else {
      setRescheduleDate(new Date().toISOString().slice(0, 10));
      setRescheduleTime("10:00");
    }
    setRescheduleDuration(job.estimatedDuration || 120);
    setRescheduleConflicts([]);
  };

  React.useEffect(() => {
    let active = true;

    async function checkConflicts() {
      if (!jobToReschedule || !rescheduleDate || !rescheduleTime) {
        if (active) setRescheduleConflicts([]);
        return;
      }
      const start = new Date(`${rescheduleDate}T${rescheduleTime}:00+06:00`);
      const end = new Date(start.getTime() + rescheduleDuration * 60000);

      const results = await Promise.all(
        jobToReschedule.assignedTechnicians.map((t) =>
          checkTechnicianScheduleConflicts(t.technicianId, start.toISOString(), end.toISOString(), jobToReschedule.id)
        )
      );

      if (active) {
        setRescheduleConflicts(results.flatMap((r) => r.conflicts || []));
      }
    }

    void checkConflicts();

    return () => {
      active = false;
    };
  }, [jobToReschedule, rescheduleDate, rescheduleTime, rescheduleDuration]);

  const handleSaveReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobToReschedule || !rescheduleDate || !rescheduleTime) return;

    const start = new Date(`${rescheduleDate}T${rescheduleTime}:00+06:00`);
    const end = new Date(start.getTime() + rescheduleDuration * 60000);

    setIsSubmitting(true);
    const res = await rescheduleJob(jobToReschedule.id, start.toISOString(), end.toISOString());
    setIsSubmitting(false);

    if (res.error) {
      toast({
        title: "Reschedule Failed",
        description: res.error,
        type: "error",
      });
    } else {
      toast({
        title: "Visit Rescheduled",
        description: `${jobToReschedule.jobNumber} moved to ${formatDhakaDateTime(start.toISOString())}.`,
        type: "success",
      });
      setJobToReschedule(null);
      loadCalendarData();
    }
  };

  // Reassign handlers
  const openReassignModal = (job: JobListItem) => {
    setJobToReassign(job);
    setReassignTechIds(job.assignedTechnicians.map((a) => a.technicianId));
    setReassignConflicts([]);
  };

  React.useEffect(() => {
    let active = true;

    async function checkConflicts() {
      if (!jobToReassign || !jobToReassign.scheduledStart || !jobToReassign.scheduledEnd || reassignTechIds.length === 0) {
        if (active) setReassignConflicts([]);
        return;
      }

      const results = await Promise.all(
        reassignTechIds.map((tId) =>
          checkTechnicianScheduleConflicts(
            tId,
            jobToReassign.scheduledStart!,
            jobToReassign.scheduledEnd!,
            jobToReassign.id
          )
        )
      );

      if (active) {
        setReassignConflicts(results.flatMap((r) => r.conflicts || []));
      }
    }

    void checkConflicts();

    return () => {
      active = false;
    };
  }, [jobToReassign, reassignTechIds]);

  const handleSaveReassign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobToReassign || reassignTechIds.length === 0) return;

    setIsSubmitting(true);
    const res = await assignTechnicians({
      jobId: jobToReassign.id,
      technicianIds: reassignTechIds,
      leadTechnicianId: reassignTechIds[0],
    });
    setIsSubmitting(false);

    if (res.error) {
      toast({
        title: "Reassign Failed",
        description: res.error,
        type: "error",
      });
    } else {
      toast({
        title: "Technicians Updated",
        description: `${jobToReassign.jobNumber} assigned to ${reassignTechIds.length} technician(s).`,
        type: "success",
      });
      setJobToReassign(null);
      loadCalendarData();
    }
  };

  // Title formatting for current range
  const formatRangeHeader = () => {
    if (viewMode === "day") {
      return formatDhakaDate(currentDate.toISOString());
    } else if (viewMode === "week") {
      return `Week of ${formatDhakaDate(startIso)} – ${formatDhakaDate(endIso)}`;
    } else {
      return new Intl.DateTimeFormat("en-BD", {
        timeZone: "Asia/Dhaka",
        month: "long",
        year: "numeric",
      }).format(currentDate);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        title="Dispatch Calendar & Schedules"
        description="Visual technician swimlanes, assignment schedule windows, and conflict management across Dhaka."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadCalendarData}
              disabled={isLoading}
              className="text-slate-600 hover:text-slate-900"
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Link href="/app/jobs">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white shadow-xs">
                <Plus className="h-4 w-4 mr-1.5" />
                Schedule New Visit
              </Button>
            </Link>
          </div>
        }
      />

      {/* Dhaka Traffic Buffer Alert Banner */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 text-xs text-blue-900 flex items-start gap-3">
        <Clock className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-semibold text-blue-950">Intelligent Dhaka Travel Buffer Active</p>
          <p className="text-blue-800 leading-relaxed">
            Dispatch schedule factors in a 45-minute inter-thana travel buffer (e.g., Banani to Dhanmondi via Mohakhali Flyover) to prevent overlapping commitments.
          </p>
        </div>
      </div>

      {/* Overlap Summary Alert Banner if conflicts exist */}
      {detectedOverlaps.size > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-amber-950">
              {detectedOverlaps.size} Scheduling Conflict(s) Detected in Active Window
            </p>
            <p className="text-amber-800 leading-relaxed">
              Technicians have overlapping work orders. Use &ldquo;Reschedule&rdquo; or &ldquo;Reassign&rdquo; on conflicting cards below to resolve overlaps.
            </p>
          </div>
        </div>
      )}

      {/* Calendar Controls & Navigation Bar */}
      <Card className="border-slate-200 shadow-xs">
        <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Date Navigation */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrevDate} className="h-8 w-8 p-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleToday} className="h-8 text-xs font-semibold px-3">
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={handleNextDate} className="h-8 w-8 p-0">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <h2 className="text-sm font-bold text-slate-900 ml-2">{formatRangeHeader()}</h2>
          </div>

          {/* Technician & View Mode Toggles */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            {/* Technician Filter Dropdown */}
            <div className="w-48">
              <select
                value={selectedTechId}
                onChange={(e) => setSelectedTechId(e.target.value)}
                className="w-full h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
              >
                <option value="all">All Technicians</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName}
                  </option>
                ))}
              </select>
            </div>

            {/* View Mode Buttons */}
            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              {(["day", "week", "month"] as CalendarViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md capitalize transition-colors ${
                    viewMode === mode
                      ? "bg-white text-blue-600 shadow-xs border border-slate-200"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Calendar Views */}
      {isLoading ? (
        <div className="py-24 text-center text-slate-500 flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-xs font-medium">Loading technician dispatch swimlanes...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* DAY VIEW: Swimlanes by Technician */}
          {viewMode === "day" && (
            <div className="space-y-4">
              {technicians
                .filter((t) => selectedTechId === "all" || t.id === selectedTechId)
                .map((tech) => {
                  const techJobs = jobs.filter((j) =>
                    j.assignedTechnicians.some((a) => a.technicianId === tech.id)
                  );

                  return (
                    <Card key={tech.id} className="border-slate-200 shadow-xs overflow-hidden bg-white">
                      {/* Technician Swimlane Header */}
                      <div className="flex items-center justify-between bg-slate-50 px-4 py-2.5 border-b border-slate-200 text-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-full bg-slate-800 text-white font-bold text-xs flex items-center justify-center">
                            {tech.fullName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900">{tech.fullName}</span>
                            <span className="text-[11px] text-slate-500 ml-2">{tech.phone || "No mobile"}</span>
                          </div>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {techJobs.length} Assigned Visits
                        </span>
                      </div>

                      {/* Job Cards in Swimlane */}
                      <div className="p-4">
                        {techJobs.length === 0 ? (
                          <p className="text-xs text-slate-400 italic py-2">No visits scheduled for this day.</p>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {techJobs.map((job) => {
                              const isConflicting = detectedOverlaps.has(job.id);
                              return (
                                <div
                                  key={job.id}
                                  className={`p-3 rounded-lg border text-xs space-y-2 transition-shadow hover:shadow-xs ${
                                    isConflicting
                                      ? "border-amber-400 bg-amber-50/50"
                                      : "border-slate-200 bg-white"
                                  }`}
                                >
                                  {isConflicting && (
                                    <div className="flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded">
                                      <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
                                      Conflict with {detectedOverlaps.get(job.id)?.join(", ")}
                                    </div>
                                  )}

                                  <div className="flex items-start justify-between gap-1">
                                    <Link
                                      href={`/app/jobs/${job.id}`}
                                      className="font-mono font-bold text-blue-600 hover:underline"
                                    >
                                      {job.jobNumber}
                                    </Link>
                                    <StatusBadge status={job.status} />
                                  </div>

                                  <p className="font-semibold text-slate-900 line-clamp-1">{job.title}</p>

                                  <div className="space-y-1 text-[11px] text-slate-600">
                                    <p className="flex items-center gap-1">
                                      <Clock className="h-3 w-3 text-slate-400 shrink-0" />
                                      {formatDhakaTime(job.scheduledStart)} – {formatDhakaTime(job.scheduledEnd)}
                                    </p>
                                    <p className="flex items-center gap-1 truncate">
                                      <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                                      {job.customerName} ({job.siteName})
                                    </p>
                                    {job.assetBrand && (
                                      <p className="flex items-center gap-1 truncate text-slate-500">
                                        <Cpu className="h-3 w-3 text-slate-400 shrink-0" />
                                        {job.assetBrand} {job.assetCapacity}
                                      </p>
                                    )}
                                  </div>

                                  <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => openRescheduleModal(job)}
                                      className="h-6 text-[10px] px-2"
                                    >
                                      Reschedule
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => openReassignModal(job)}
                                      className="h-6 text-[10px] px-2"
                                    >
                                      Reassign
                                    </Button>
                                    <Link href={`/app/jobs/${job.id}`}>
                                      <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 text-blue-600">
                                        View
                                      </Button>
                                    </Link>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
            </div>
          )}

          {/* WEEK VIEW: 7 Day Columns with mobile-friendly card layout */}
          {viewMode === "week" && (
            <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
              {Array.from({ length: 7 }).map((_, idx) => {
                const dayDate = new Date(startIso);
                dayDate.setDate(dayDate.getDate() + idx);
                const dayDateString = dayDate.toISOString().slice(0, 10);

                const dayJobs = jobs.filter((j) => {
                  if (!j.scheduledStart) return false;
                  return j.scheduledStart.slice(0, 10) === dayDateString;
                });

                const isToday = new Date().toISOString().slice(0, 10) === dayDateString;

                return (
                  <Card
                    key={idx}
                    className={`border shadow-xs ${
                      isToday ? "border-blue-400 bg-blue-50/20" : "border-slate-200 bg-white"
                    }`}
                  >
                    <div
                      className={`p-2.5 border-b text-center text-xs font-bold ${
                        isToday ? "bg-blue-600 text-white" : "bg-slate-50 text-slate-700 border-slate-200"
                      }`}
                    >
                      <p className="uppercase text-[10px]">
                        {new Intl.DateTimeFormat("en-BD", { weekday: "short" }).format(dayDate)}
                      </p>
                      <p className="text-sm">{dayDate.getDate()}</p>
                    </div>

                    <CardContent className="p-2 space-y-2 min-h-[140px]">
                      {dayJobs.length === 0 ? (
                        <p className="text-[11px] text-slate-300 italic text-center py-4">No visits</p>
                      ) : (
                        dayJobs.map((j) => {
                          const isConflicting = detectedOverlaps.has(j.id);
                          return (
                            <div
                              key={j.id}
                              className={`p-2 rounded border text-[11px] space-y-1 ${
                                isConflicting
                                  ? "border-amber-400 bg-amber-50"
                                  : "border-slate-200 bg-white"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <Link
                                  href={`/app/jobs/${j.id}`}
                                  className="font-mono font-bold text-blue-600 hover:underline"
                                >
                                  {j.jobNumber}
                                </Link>
                                <span className="text-[9px] text-slate-500 font-medium">
                                  {formatDhakaTime(j.scheduledStart)}
                                </span>
                              </div>
                              <p className="font-semibold text-slate-900 truncate">{j.title}</p>
                              <p className="text-[10px] text-slate-500 truncate">{j.customerName}</p>
                              <div className="pt-1 flex items-center justify-end gap-1">
                                <button
                                  onClick={() => openRescheduleModal(j)}
                                  className="text-[9px] text-blue-600 hover:underline"
                                >
                                  Move
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* MONTH VIEW: Calendar grid overview */}
          {viewMode === "month" && (
            <Card className="border-slate-200 shadow-xs p-4">
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  {jobs.length === 0 ? (
                    <div className="col-span-4 py-12 text-center text-slate-400 text-xs italic">
                      No visits scheduled for this entire month.
                    </div>
                  ) : (
                    jobs.map((job) => (
                      <div
                        key={job.id}
                        className="p-3 rounded-md border border-slate-200 bg-white text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <Link
                            href={`/app/jobs/${job.id}`}
                            className="font-mono font-bold text-blue-600 hover:underline"
                          >
                            {job.jobNumber}
                          </Link>
                          <StatusBadge status={job.status} />
                        </div>
                        <p className="font-semibold text-slate-900 line-clamp-1">{job.title}</p>
                        <p className="text-[11px] text-slate-500">
                          {formatDhakaDate(job.scheduledStart)} at {formatDhakaTime(job.scheduledStart)}
                        </p>
                        <p className="text-[11px] text-slate-600 truncate">{job.customerName}</p>
                        <div className="pt-1 flex justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openRescheduleModal(job)}
                            className="h-6 text-[10px]"
                          >
                            Reschedule
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Quick Reschedule Modal */}
      {jobToReschedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">
                Reschedule {jobToReschedule.jobNumber}
              </h3>
              <button onClick={() => setJobToReschedule(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            {rescheduleConflicts.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-amber-900 text-xs space-y-1">
                <div className="flex items-center gap-1 font-bold">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Technician Schedule Overlap Warning
                </div>
                {rescheduleConflicts.map((c, i) => (
                  <p key={i} className="text-[11px]">
                    • {c.technicianName} already has {c.conflictingJobNumber} ({c.conflictingJobTitle}).
                  </p>
                ))}
              </div>
            )}

            <form onSubmit={handleSaveReschedule} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">New Scheduled Date</label>
                <Input
                  type="date"
                  required
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Start Time</label>
                  <Input
                    type="time"
                    required
                    value={rescheduleTime}
                    onChange={(e) => setRescheduleTime(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Duration (min)</label>
                  <Input
                    type="number"
                    value={rescheduleDuration}
                    onChange={(e) => setRescheduleDuration(parseInt(e.target.value) || 120)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button type="button" variant="outline" size="sm" onClick={() => setJobToReschedule(null)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
                  {isSubmitting ? "Rescheduling..." : "Save New Schedule"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Reassign Modal */}
      {jobToReassign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">
                Reassign Technicians for {jobToReassign.jobNumber}
              </h3>
              <button onClick={() => setJobToReassign(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            {reassignConflicts.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded text-amber-900 text-xs space-y-1">
                <div className="flex items-center gap-1 font-bold">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Technician Schedule Overlap Warning
                </div>
                {reassignConflicts.map((c, i) => (
                  <p key={i} className="text-[11px]">
                    • {c.technicianName} already has {c.conflictingJobNumber} ({c.conflictingJobTitle}).
                  </p>
                ))}
              </div>
            )}

            <form onSubmit={handleSaveReassign} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Select Technicians</label>
                <div className="space-y-1 max-h-48 overflow-y-auto border border-slate-200 rounded p-2 bg-slate-50">
                  {technicians.map((t) => {
                    const isChecked = reassignTechIds.includes(t.id);
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
                                setReassignTechIds([...reassignTechIds, t.id]);
                              } else {
                                setReassignTechIds(reassignTechIds.filter((id) => id !== t.id));
                              }
                            }}
                          />
                          <span>{t.fullName}</span>
                        </div>
                        <span className="text-[10px] text-slate-500">{t.role}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button type="button" variant="outline" size="sm" onClick={() => setJobToReassign(null)}>
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
    </div>
  );
}
