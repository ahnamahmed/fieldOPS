"use client";

import * as React from "react";
import Link from "next/link";
import {
  MapPin,
  Phone,
  Clock,
  ArrowRight,
  Wrench,
  Navigation,
  ClipboardCheck,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { formatBDPhoneDisplay } from "@/lib/formatters";
import { getTechnicianJobs, seedSampleTechnicianJob } from "@/features/tech/actions";
import type { TechJobsGrouped } from "@/features/tech/types";

export default function TechJobsPage() {
  const { toast } = useToast();
  const [groupedJobs, setGroupedJobs] = React.useState<TechJobsGrouped>({
    today: [],
    upcoming: [],
    completed: [],
  });
  const [loading, setLoading] = React.useState(true);
  const [seeding, setSeeding] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"today" | "upcoming" | "completed">("today");

  const loadJobs = React.useCallback(async () => {
    const res = await getTechnicianJobs();
    if (res.success && res.data) {
      setGroupedJobs(res.data);
    } else {
      toast({
        title: "Could not load jobs",
        description: res.error || "Please check your network connection.",
        type: "error",
      });
    }
    setLoading(false);
  }, [toast]);

  React.useEffect(() => {
    let ignore = false;
    async function init() {
      const res = await getTechnicianJobs();
      if (!ignore) {
        if (res.success && res.data) {
          setGroupedJobs(res.data);
        } else {
          toast({
            title: "Could not load jobs",
            description: res.error || "Please check your network connection.",
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
  }, [toast]);

  const handleSeedJob = async () => {
    setSeeding(true);
    const res = await seedSampleTechnicianJob();
    if (res.success) {
      toast({
        title: "Sample AC Job Created",
        description: "Assigned high-priority HVAC overhaul job to your workspace.",
        type: "success",
      });
      await loadJobs();
    } else {
      toast({
        title: "Could not create job",
        description: res.error || "Please try again.",
        type: "error",
      });
    }
    setSeeding(false);
  };

  const currentList = groupedJobs[activeTab];
  const totalActive = groupedJobs.today.length + groupedJobs.upcoming.length;

  return (
    <div className="space-y-4">
      {/* Top Mobile Banner Card */}
      <div className="bg-slate-900 text-white rounded-xl p-4 shadow-sm border border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider">
              Field Technician Workspace
            </span>
            <h1 className="text-lg font-bold text-white mt-0.5">
              Assigned Work Orders
            </h1>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-amber-400">
              {loading ? "..." : totalActive}
            </span>
            <span className="block text-[10px] text-slate-400 font-medium">Active Jobs</span>
          </div>
        </div>

        {/* Segmented Tab Controls */}
        <div className="grid grid-cols-3 gap-1.5 mt-3 pt-3 border-t border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab("today")}
            className={`py-2 rounded-lg text-center font-bold transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === "today"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-800/80 text-slate-400 hover:text-white"
            }`}
          >
            <span>Today</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                activeTab === "today" ? "bg-blue-800 text-blue-100" : "bg-slate-700 text-slate-300"
              }`}
            >
              {groupedJobs.today.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("upcoming")}
            className={`py-2 rounded-lg text-center font-bold transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === "upcoming"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-800/80 text-slate-400 hover:text-white"
            }`}
          >
            <span>Upcoming</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                activeTab === "upcoming" ? "bg-blue-800 text-blue-100" : "bg-slate-700 text-slate-300"
              }`}
            >
              {groupedJobs.upcoming.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("completed")}
            className={`py-2 rounded-lg text-center font-bold transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === "completed"
                ? "bg-blue-600 text-white shadow-xs"
                : "bg-slate-800/80 text-slate-400 hover:text-white"
            }`}
          >
            <span>Done</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                activeTab === "completed" ? "bg-blue-800 text-blue-100" : "bg-slate-700 text-slate-300"
              }`}
            >
              {groupedJobs.completed.length}
            </span>
          </button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading ? (
        <div className="space-y-3 pt-2">
          {[1, 2].map((i) => (
            <Card key={i} className="p-4 space-y-3 animate-pulse bg-white border-slate-200">
              <div className="flex justify-between items-center">
                <div className="h-4 w-24 bg-slate-200 rounded" />
                <div className="h-5 w-16 bg-slate-200 rounded-full" />
              </div>
              <div className="h-5 w-3/4 bg-slate-200 rounded" />
              <div className="h-4 w-1/2 bg-slate-200 rounded" />
              <div className="h-10 bg-slate-100 rounded-lg" />
            </Card>
          ))}
        </div>
      ) : currentList.length === 0 ? (
        /* Empty State */
        <Card className="p-6 text-center bg-white border-slate-200 shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 mb-3">
            <ClipboardCheck className="h-6 w-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">
            {activeTab === "today"
              ? "No Jobs Scheduled Today"
              : activeTab === "upcoming"
              ? "No Upcoming Work Orders"
              : "No Completed Jobs Yet"}
          </h2>
          <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1 mb-4 leading-relaxed">
            {activeTab === "today"
              ? "You have no pending assignments for today. New dispatch work orders will appear here automatically."
              : "Completed jobs and inspection history will be recorded in this list."}
          </p>

          <Button
            onClick={handleSeedJob}
            disabled={seeding}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-10 px-4 gap-2"
          >
            {seeding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            <span>Generate Sample AC Work Order</span>
          </Button>
        </Card>
      ) : (
        /* Job Cards List */
        <div className="space-y-3">
          {currentList.map((job) => {
            const mapQuery = [
              job.siteAddress,
              job.siteArea,
              job.siteCity,
              "Bangladesh",
            ]
              .filter(Boolean)
              .join(", ");
            const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              mapQuery
            )}`;

            return (
              <Card
                key={job.id}
                className="overflow-hidden border-slate-200 bg-white shadow-xs hover:border-blue-400 transition-all"
              >
                {/* Header Strip */}
                <div className="p-3.5 pb-2.5">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/60">
                      {job.jobNumber}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                          job.priority === "urgent"
                            ? "bg-red-100 text-red-800 border border-red-200"
                            : job.priority === "high"
                            ? "bg-amber-100 text-amber-800 border border-amber-200"
                            : "bg-slate-100 text-slate-700 border border-slate-200"
                        }`}
                      >
                        {job.priority}
                      </span>
                      <StatusBadge status={job.status} />
                    </div>
                  </div>

                  <Link href={`/tech/jobs/${job.id}`} className="block group">
                    <h2 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                      {job.title}
                    </h2>
                  </Link>

                  {/* Customer & Tap to Call */}
                  <div className="mt-2.5 flex items-center justify-between text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <div className="truncate pr-2">
                      <span className="font-semibold text-slate-900 block truncate">
                        {job.customerName}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {formatBDPhoneDisplay(job.customerPhone)}
                      </span>
                    </div>
                    {job.customerPhone && (
                      <a
                        href={`tel:${job.customerPhone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] px-2.5 py-1.5 rounded-md shadow-xs active:scale-95 transition-transform shrink-0"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        <span>Call</span>
                      </a>
                    )}
                  </div>

                  {/* Service Site & Google Maps Nav */}
                  <div className="mt-2 text-xs text-slate-600 flex items-start justify-between gap-2">
                    <div className="flex items-start gap-1.5 min-w-0">
                      <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <span className="font-medium text-slate-800 block truncate">
                          {job.siteName}
                        </span>
                        <p className="text-[11px] text-slate-500 truncate">
                          {job.siteAddress}
                        </p>
                      </div>
                    </div>
                    <a
                      href={mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-200/50 shrink-0 active:scale-95 transition-transform"
                    >
                      <Navigation className="h-3 w-3" />
                      <span>Map</span>
                    </a>
                  </div>

                  {/* Equipment Spec Pill */}
                  {job.assetBrand && (
                    <div className="mt-2 text-[11px] text-slate-700 flex items-center gap-1.5 bg-slate-100/70 px-2 py-1 rounded">
                      <Wrench className="h-3 w-3 text-slate-500 shrink-0" />
                      <span className="font-medium truncate">
                        {job.assetBrand} {job.assetModel || ""} {job.assetCapacity ? `(${job.assetCapacity})` : ""}
                      </span>
                    </div>
                  )}

                  {/* Scheduled / Actual Times & Checklist Progress */}
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-slate-400" />
                      <span>
                        {job.scheduledStart
                          ? new Date(job.scheduledStart).toLocaleTimeString("en-BD", {
                              hour: "2-digit",
                              minute: "2-digit",
                              timeZone: "Asia/Dhaka",
                            })
                          : "Unscheduled"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 font-semibold text-slate-700">
                      <ClipboardCheck className="h-3 w-3 text-blue-600" />
                      <span>
                        {job.completedChecklists}/{job.totalChecklists} Checks
                      </span>
                    </div>
                  </div>
                </div>

                {/* Primary Action Button */}
                <Link
                  href={`/tech/jobs/${job.id}`}
                  className={`block text-center font-bold text-xs py-2.5 transition-colors border-t ${
                    job.status === "in_progress"
                      ? "bg-amber-500 text-slate-900 hover:bg-amber-400 font-extrabold flex items-center justify-center gap-1.5"
                      : job.status === "completed"
                      ? "bg-slate-50 text-slate-700 hover:bg-slate-100"
                      : "bg-blue-600 text-white hover:bg-blue-700 flex items-center justify-center gap-1.5"
                  }`}
                >
                  {job.status === "in_progress" ? (
                    <>
                      <span className="h-2 w-2 rounded-full bg-slate-900 animate-pulse" />
                      <span>Resume Active Work Order</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  ) : job.status === "completed" ? (
                    <span>View Completion Report</span>
                  ) : (
                    <>
                      <span>Open Work Order & Arrive</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </Link>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
