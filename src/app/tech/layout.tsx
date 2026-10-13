"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Wrench,
  Briefcase,
  ArrowLeftRight,
  PhoneCall,
} from "lucide-react";
import { ToastProvider, useToast } from "@/components/ui/toast";
import { DEMO_TEAM } from "@/lib/demo-data";
import { cn } from "@/lib/utils";

function TechHeaderAndNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { toast } = useToast();
  const currentTech = DEMO_TEAM[0]; // Tanvir Ahmed

  const handleCallDispatch = () => {
    toast({
      title: "Calling Dispatcher",
      description: "Dialing Kazi Farhan (Operations Desk) at 01755-123456...",
      type: "info",
    });
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 text-slate-900 pb-20 sm:pb-0">
      {/* High-Contrast Mobile Top Bar */}
      <header className="sticky top-0 z-40 bg-slate-900 text-white shadow-md border-b border-slate-800">
        <div className="flex h-14 items-center justify-between px-4 max-w-xl mx-auto">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-xs shadow-xs">
              FO
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-white text-sm tracking-tight">
                  FieldOps
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded border border-amber-500/30">
                  Tech App
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                Dhaka • Asia/Dhaka GMT+6
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Online indicator */}
            <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="hidden xs:inline">Online</span>
            </div>

            {/* Switch to Manager Shell */}
            <Link
              href="/app/dashboard"
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
              title="Switch to Management Desktop Shell"
            >
              <ArrowLeftRight className="h-3.5 w-3.5 text-blue-400" />
              <span className="hidden sm:inline">Manager Mode</span>
            </Link>
          </div>
        </div>

        {/* Technician Profile Strip */}
        <div className="bg-slate-800/90 px-4 py-1.5 text-xs text-slate-300 border-t border-slate-700/60">
          <div className="max-w-xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              <span className="font-semibold text-white">
                {currentTech.fullName}
              </span>
              <span className="text-slate-400">• Lead AC Specialist</span>
            </div>
            <button
              onClick={handleCallDispatch}
              className="text-[11px] font-medium text-amber-400 hover:text-amber-300 flex items-center gap-1 active:scale-95 transition-transform"
            >
              <PhoneCall className="h-3 w-3" />
              Call Dispatch
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area - Mobile Optimized */}
      <main className="flex-1 w-full max-w-xl mx-auto p-4 sm:p-5">
        {children}
      </main>

      {/* Mobile Sticky Bottom Navigation Bar */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 shadow-lg sm:hidden">
        <div className="grid grid-cols-3 h-16 max-w-xl mx-auto">
          <Link
            href="/tech/jobs"
            className={cn(
              "flex flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors active:bg-slate-50",
              pathname === "/tech/jobs"
                ? "text-blue-600 border-t-2 border-blue-600 bg-blue-50/20"
                : "text-slate-500 hover:text-slate-900"
            )}
          >
            <Briefcase className="h-5 w-5" />
            <span>My Jobs</span>
          </Link>

          <Link
            href="/tech/jobs/job-1"
            className={cn(
              "flex flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors active:bg-slate-50",
              pathname.includes("/tech/jobs/job-")
                ? "text-blue-600 border-t-2 border-blue-600 bg-blue-50/20"
                : "text-slate-500 hover:text-slate-900"
            )}
          >
            <Wrench className="h-5 w-5" />
            <span>Active Job</span>
          </Link>

          <Link
            href="/app/dashboard"
            className="flex flex-col items-center justify-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900 active:bg-slate-50"
          >
            <ArrowLeftRight className="h-5 w-5 text-amber-600" />
            <span>Manager Mode</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}

export default function TechLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <React.Suspense fallback={<div className="min-h-screen bg-slate-900" />}>
        <TechHeaderAndNav>{children}</TechHeaderAndNav>
      </React.Suspense>
    </ToastProvider>
  );
}
