"use client";

import * as React from "react";
import Link from "next/link";
import {
  MapPin,
  Phone,
  Clock,
  ArrowRight,
  CheckCircle2,
  Wrench,
  Navigation,
  Camera,
  ClipboardCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { DEMO_JOBS, DEMO_TEAM, type DemoJob } from "@/lib/demo-data";
import { formatBDPhoneDisplay } from "@/lib/formatters";

export default function TechJobsPage() {
  const { toast } = useToast();
  const currentTech = DEMO_TEAM[0]; // Tanvir Ahmed

  // Jobs assigned to Tanvir
  const [jobs] = React.useState(
    DEMO_JOBS.filter((j) => j.technicianId === currentTech.id || j.id === "job-1" || j.id === "job-2")
  );

  const [filterTab, setFilterTab] = React.useState<"all" | "in_progress" | "scheduled" | "completed">("all");

  const filteredJobs = jobs.filter((job) => {
    if (filterTab === "all") return true;
    return job.status === filterTab;
  });

  const handleCallClient = (e: React.MouseEvent, job: DemoJob) => {
    e.preventDefault();
    e.stopPropagation();
    toast({
      title: "Calling Client",
      description: `Dialing ${job.customerName} at ${formatBDPhoneDisplay(job.customerPhone)}...`,
      type: "info",
    });
  };

  const handleNavigate = (e: React.MouseEvent, job: DemoJob) => {
    e.preventDefault();
    e.stopPropagation();
    toast({
      title: "Site Location & Landmark",
      description: `Destination: ${job.siteAddress}. Landmark: ${job.siteLandmark}.`,
      type: "info",
    });
  };

  return (
    <div className="space-y-4">
      {/* Top Welcome Card */}
      <div className="bg-slate-900 text-white rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-medium text-blue-400 uppercase tracking-wider">
              Assigned Field Schedule
            </span>
            <h1 className="text-lg font-bold text-white mt-0.5">
              Today&apos;s Work Orders
            </h1>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-amber-400">
              {jobs.filter((j) => j.status !== "completed").length}
            </span>
            <span className="block text-[10px] text-slate-400">Remaining</span>
          </div>
        </div>

        {/* Quick Tabs */}
        <div className="grid grid-cols-4 gap-1.5 mt-3 pt-3 border-t border-slate-800 text-xs">
          {[
            { id: "all", label: "All" },
            { id: "in_progress", label: "Active" },
            { id: "scheduled", label: "Pending" },
            { id: "completed", label: "Done" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id as typeof filterTab)}
              className={`py-1.5 rounded-lg text-center font-semibold transition-colors ${
                filterTab === tab.id
                  ? "bg-blue-600 text-white"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Jobs List */}
      <div className="space-y-3">
        {filteredJobs.length === 0 ? (
          <Card className="p-8 text-center border-dashed border-slate-300">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
            <h3 className="font-bold text-slate-800 text-base">
              No Work Orders Found
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              You have no assigned jobs under this filter category.
            </p>
          </Card>
        ) : (
          filteredJobs.map((job) => (
            <Card
              key={job.id}
              className={`p-4 border-2 transition-all shadow-xs ${
                job.status === "in_progress"
                  ? "border-amber-400 bg-amber-50/20"
                  : "border-slate-200 bg-white"
              }`}
            >
              {/* Header: Job #, Priority, Status */}
              <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                      {job.jobNumber}
                    </span>
                    <StatusBadge status={job.priority} />
                  </div>
                  <h2 className="font-bold text-slate-900 text-sm mt-1.5 line-clamp-2">
                    {job.title}
                  </h2>
                </div>
                <StatusBadge status={job.status} />
              </div>

              {/* Time slot & Equipment */}
              <div className="py-2.5 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-slate-700 font-medium">
                  <Clock className="h-4 w-4 text-slate-400 shrink-0" />
                  <span>{job.scheduledTime}</span>
                  <span className="text-slate-400">• Est. {job.estimatedDuration}</span>
                </div>

                <div className="flex items-center gap-2 text-slate-700">
                  <Wrench className="h-4 w-4 text-amber-600 shrink-0" />
                  <span className="font-semibold text-slate-900 truncate">
                    {job.equipmentTitle}
                  </span>
                  {job.refrigerant && (
                    <span className="px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded text-[10px] font-mono border">
                      {job.refrigerant}
                    </span>
                  )}
                </div>

                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 space-y-1">
                  <div className="font-semibold text-slate-900">
                    {job.customerName}
                  </div>
                  <div className="flex items-start gap-1.5 text-slate-600">
                    <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span className="text-[11px] leading-snug">
                      {job.siteAddress}
                    </span>
                  </div>
                  <div className="text-[11px] text-amber-800 font-medium bg-amber-50 px-2 py-1 rounded border border-amber-200">
                    📍 Landmark: {job.siteLandmark}
                  </div>
                </div>

                {/* Checklist & Photos Progress */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <div className="flex items-center gap-1.5">
                    <ClipboardCheck className="h-3.5 w-3.5 text-blue-600" />
                    <span>
                      Checklist: {job.checklistsCompleted ?? 0}/
                      {job.checklistsTotal ?? 5} complete
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Camera className="h-3.5 w-3.5 text-slate-400" />
                    <span>{job.photosUploaded ?? 0} photos</span>
                  </div>
                </div>
              </div>

              {/* High-touch Quick Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => handleCallClient(e, job)}
                  className="h-11 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 border-slate-300"
                  title="Call Customer"
                >
                  <Phone className="h-4 w-4 text-emerald-600 mr-1.5" />
                  Call
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => handleNavigate(e, job)}
                  className="h-11 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 border-slate-300"
                  title="Map Landmark"
                >
                  <Navigation className="h-4 w-4 text-blue-600 mr-1.5" />
                  Landmark
                </Button>

                <Link href={`/tech/jobs/${job.id}`} className="flex-1">
                  <Button
                    size="sm"
                    className={`w-full h-11 text-xs font-bold text-white shadow-xs ${
                      job.status === "in_progress"
                        ? "bg-amber-600 hover:bg-amber-700"
                        : "bg-blue-600 hover:bg-blue-700"
                    }`}
                  >
                    {job.status === "in_progress" ? (
                      <>
                        <span>Resume Work</span>
                        <ArrowRight className="h-4 w-4 ml-1.5" />
                      </>
                    ) : (
                      <>
                        <span>Open & Start</span>
                        <ArrowRight className="h-4 w-4 ml-1.5" />
                      </>
                    )}
                  </Button>
                </Link>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
