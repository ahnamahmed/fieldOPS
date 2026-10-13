import * as React from "react";
import { getCurrentUser } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userSession = await getCurrentUser();

  return (
    <React.Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <AppShell userSession={userSession}>{children}</AppShell>
    </React.Suspense>
  );
}
