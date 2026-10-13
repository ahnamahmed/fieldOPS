"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Camera,
  Plus,
  Upload,
  Cpu,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { DEMO_JOBS, type DemoJob } from "@/lib/demo-data";

interface DiagnosticItem {
  id: string;
  title: string;
  type: "numeric" | "toggle";
  value?: string;
  unit?: string;
  done: boolean;
}

function TechJobDetailContent() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const jobId = (params?.id as string) || "job-1";

  // Find job fixture
  const initialJob = DEMO_JOBS.find((j) => j.id === jobId) || DEMO_JOBS[0];
  const [job] = React.useState<DemoJob>(initialJob);

  // Status transition state
  const [currentStatus, setCurrentStatus] = React.useState<
    "scheduled" | "in_progress" | "completed" | "on_hold"
  >(job.status);

  // Diagnostic Checklist State
  const [checklist, setChecklist] = React.useState<DiagnosticItem[]>([
    {
      id: "chk-1",
      title: "Pre-service Test Run & Temperature Check",
      type: "numeric",
      value: "28.5",
      unit: "°C",
      done: true,
    },
    {
      id: "chk-2",
      title: "Suction Pressure Measurement (R410A)",
      type: "numeric",
      value: "115",
      unit: "PSI",
      done: true,
    },
    {
      id: "chk-3",
      title: "Compressor Running Current",
      type: "numeric",
      value: "14.2",
      unit: "Amps",
      done: true,
    },
    {
      id: "chk-4",
      title: "Evaporator & Condenser Water-Jet Foam Wash",
      type: "toggle",
      done: false,
    },
    {
      id: "chk-5",
      title: "Drain Line Flush & Nitrogen Pressure Leak Test",
      type: "toggle",
      done: false,
    },
    {
      id: "chk-6",
      title: "Electrical Terminal Tightening & Contactor Check",
      type: "toggle",
      done: false,
    },
  ]);

  // Parts Used State
  const [parts, setParts] = React.useState([
    { id: "prt-1", name: "R410A Refrigerant Charge", qty: "1.2 kg", cost: "৳3,600" },
    { id: "prt-2", name: "45uF Motor Running Capacitor", qty: "1 pc", cost: "৳1,200" },
  ]);
  const [newPartName, setNewPartName] = React.useState("");
  const [newPartQty, setNewPartQty] = React.useState("");

  // Photos State
  const [photos, setPhotos] = React.useState([
    {
      id: "p-1",
      title: "Outdoor Unit Before Service",
      timestamp: "10:45 AM",
      verified: true,
    },
    {
      id: "p-2",
      title: "Evaporator Coil Inspection",
      timestamp: "11:10 AM",
      verified: true,
    },
  ]);

  // Tech Notes State
  const [notes, setNotes] = React.useState(
    "Unit running at normal 115 PSI suction. Cleaned indoor filters. Customer requested additional drain pipe check."
  );

  const toggleChecklist = (id: string) => {
    setChecklist(
      checklist.map((item) =>
        item.id === id ? { ...item, done: !item.done } : item
      )
    );
  };

  const handleUpdateNumericChecklist = (id: string, val: string) => {
    setChecklist(
      checklist.map((item) =>
        item.id === id ? { ...item, value: val, done: !!val.trim() } : item
      )
    );
  };

  const handleAddPart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartName.trim()) return;

    const newPart = {
      id: `prt-${Date.now()}`,
      name: newPartName.trim(),
      qty: newPartQty.trim() || "1 pc",
      cost: "Pending Price",
    };

    setParts([...parts, newPart]);
    setNewPartName("");
    setNewPartQty("");

    toast({
      title: "Part Logged",
      description: `Recorded ${newPart.name} (${newPart.qty}) to work order.`,
      type: "success",
    });
  };

  const handleSimulatePhotoUpload = () => {
    const newPhoto = {
      id: `p-${Date.now()}`,
      title: `Service Evidence #${photos.length + 1}`,
      timestamp: new Date().toLocaleTimeString("en-BD", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      verified: true,
    };

    setPhotos([...photos, newPhoto]);

    toast({
      title: "Photo Attached",
      description: "Service photo encrypted & uploaded to secure Supabase storage.",
      type: "success",
    });
  };

  const handleStartWork = () => {
    setCurrentStatus("in_progress");
    toast({
      title: "Job Started",
      description: "Work status transitioned to In Progress. Timer started.",
      type: "info",
    });
  };

  const handleCompleteJob = () => {
    const uncompleted = checklist.filter((c) => !c.done);
    if (uncompleted.length > 0) {
      toast({
        title: "Checklist Incomplete",
        description: `Please complete all ${checklist.length} diagnostic items before finalizing work order.`,
        type: "error",
      });
      return;
    }

    setCurrentStatus("completed");
    toast({
      title: "Work Order Completed!",
      description: `${job.jobNumber} marked completed. Service card signed & sent to dispatch.`,
      type: "success",
    });

    setTimeout(() => {
      router.push("/tech/jobs");
    }, 1500);
  };

  const completedCount = checklist.filter((c) => c.done).length;

  return (
    <div className="space-y-4 pb-12">
      {/* Top Header Navigation */}
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/tech/jobs"
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white px-3 py-2 rounded-lg border border-slate-200 shadow-xs"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Jobs</span>
        </Link>
        <StatusBadge status={currentStatus} />
      </div>

      {/* Main Job Overview Card */}
      <Card className="p-4 border-slate-200 bg-white shadow-xs">
        <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
              {job.jobNumber}
            </span>
            <h1 className="font-bold text-slate-900 text-base mt-1.5">
              {job.title}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {job.description}
            </p>
          </div>
        </div>

        <div className="py-3 space-y-2 text-xs">
          <div className="flex items-center justify-between text-slate-700">
            <span className="font-medium text-slate-500">Customer:</span>
            <span className="font-bold text-slate-900">{job.customerName}</span>
          </div>

          <div className="flex items-start justify-between gap-4 text-slate-700">
            <span className="font-medium text-slate-500 shrink-0">Site & Landmark:</span>
            <span className="text-right text-slate-800">
              {job.siteAddress} •{" "}
              <strong className="text-amber-700">{job.siteLandmark}</strong>
            </span>
          </div>

          <div className="flex items-center justify-between text-slate-700 pt-1 border-t border-slate-100">
            <span className="font-medium text-slate-500">Equipment Target:</span>
            <span className="font-bold text-blue-700">{job.equipmentTitle}</span>
          </div>
        </div>

        {/* Start / In Progress Status Controller */}
        {currentStatus === "scheduled" && (
          <Button
            onClick={handleStartWork}
            className="w-full h-12 mt-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm shadow-xs"
          >
            <Clock className="h-4 w-4 mr-2" />
            Start Working On-Site
          </Button>
        )}
      </Card>

      {/* Diagnostic Checklist Runner */}
      <Card className="p-4 border-slate-200 bg-white shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-blue-600" />
            <div>
              <h2 className="font-bold text-slate-900 text-sm">
                Service Diagnostics Checklist
              </h2>
              <span className="text-[11px] text-slate-500">
                {completedCount} of {checklist.length} checkpoints completed
              </span>
            </div>
          </div>
          <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
            {Math.round((completedCount / checklist.length) * 100)}%
          </span>
        </div>

        {/* Checklist Items */}
        <div className="pt-3 space-y-2.5">
          {checklist.map((item) => (
            <div
              key={item.id}
              className={`p-3 rounded-lg border text-xs transition-colors ${
                item.done
                  ? "bg-emerald-50/40 border-emerald-200"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 flex-1">
                  <button
                    type="button"
                    onClick={() => toggleChecklist(item.id)}
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                      item.done
                        ? "bg-emerald-600 border-emerald-600 text-white"
                        : "border-slate-300 bg-white hover:border-slate-400"
                    }`}
                  >
                    {item.done && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                  </button>
                  <div>
                    <p className="font-medium text-slate-900 leading-snug">
                      {item.title}
                    </p>
                    {item.type === "numeric" && (
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="text"
                          value={item.value || ""}
                          placeholder="Reading value..."
                          onChange={(e) =>
                            handleUpdateNumericChecklist(item.id, e.target.value)
                          }
                          className="h-8 w-24 px-2 rounded border border-slate-300 bg-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-blue-600"
                        />
                        <span className="font-semibold text-slate-600">
                          {item.unit}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Parts & Refrigerant Used */}
      <Card className="p-4 border-slate-200 bg-white shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-amber-600" />
            <h2 className="font-bold text-slate-900 text-sm">
              Spare Parts & Gas Consumed
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {parts.length} Items
          </span>
        </div>

        {/* Existing Parts List */}
        <div className="pt-3 space-y-2 text-xs">
          {parts.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200"
            >
              <div>
                <p className="font-semibold text-slate-800">{p.name}</p>
                <span className="text-[11px] text-slate-500 font-medium">
                  Qty: {p.qty}
                </span>
              </div>
              <span className="font-semibold text-slate-900">{p.cost}</span>
            </div>
          ))}

          {/* Quick Add Part Input */}
          <form onSubmit={handleAddPart} className="pt-2 flex gap-2">
            <input
              type="text"
              placeholder="e.g. 2-pole 30A Contactor"
              value={newPartName}
              onChange={(e) => setNewPartName(e.target.value)}
              className="h-9 flex-1 px-3 rounded-md border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
            <input
              type="text"
              placeholder="Qty (1 pc)"
              value={newPartQty}
              onChange={(e) => setNewPartQty(e.target.value)}
              className="h-9 w-20 px-2 rounded-md border border-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
            <Button
              type="submit"
              size="sm"
              className="h-9 bg-slate-900 hover:bg-slate-800 text-white"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </Card>

      {/* Photo Evidence Section */}
      <Card className="p-4 border-slate-200 bg-white shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-indigo-600" />
            <h2 className="font-bold text-slate-900 text-sm">
              Service Photo Proofs
            </h2>
          </div>
          <Button
            size="sm"
            onClick={handleSimulatePhotoUpload}
            className="h-8 bg-blue-600 hover:bg-blue-700 text-white text-xs px-2.5"
          >
            <Upload className="h-3.5 w-3.5 mr-1" />
            Capture Photo
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2.5 pt-3">
          {photos.map((ph) => (
            <div
              key={ph.id}
              className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs flex flex-col justify-between"
            >
              <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                <Camera className="h-3.5 w-3.5 text-blue-600" />
                <span className="truncate">{ph.title}</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-2 block">
                Uploaded {ph.timestamp}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Field Notes Input */}
      <Card className="p-4 border-slate-200 bg-white shadow-xs">
        <h2 className="font-bold text-slate-900 text-sm mb-2">
          Technician Job Notes & Remarks
        </h2>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Enter diagnostic observations, abnormal noises, or recommendations for the client..."
          className="w-full p-2.5 rounded-md border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600"
        />
      </Card>

      {/* Complete Job Primary Action */}
      <div className="pt-2">
        <Button
          onClick={handleCompleteJob}
          className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-base shadow-md rounded-xl flex items-center justify-center gap-2"
        >
          <CheckCircle2 className="h-5 w-5" />
          <span>Mark Work Completed & Sign Off</span>
        </Button>
      </div>
    </div>
  );
}

export default function TechJobDetailPage() {
  return (
    <React.Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">Loading work order...</div>}>
      <TechJobDetailContent />
    </React.Suspense>
  );
}
