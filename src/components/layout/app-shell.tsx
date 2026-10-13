"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  CalendarDays,
  Users,
  Cpu,
  FileCheck2,
  FileText,
  CreditCard,
  UserCheck,
  Settings,
  Menu,
  X,
  Smartphone,
  Bell,
  Search,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { ToastProvider } from "@/components/ui/toast";
import { DEMO_ORGANIZATION } from "@/lib/demo-data";
import { signOutAction } from "@/lib/auth-actions";
import { cn } from "@/lib/utils";
import type { CurrentUserSession } from "@/lib/auth";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/app/dashboard", icon: LayoutDashboard },
  { label: "Jobs", href: "/app/jobs", icon: Briefcase },
  { label: "Calendar", href: "/app/calendar", icon: CalendarDays },
  { label: "Customers", href: "/app/customers", icon: Users },
  { label: "Equipment", href: "/app/equipment", icon: Cpu },
  { label: "AMC Contracts", href: "/app/contracts", icon: FileCheck2 },
  { label: "Quotes", href: "/app/quotes", icon: FileText },
  { label: "Invoices", href: "/app/invoices", icon: CreditCard },
  { label: "Team", href: "/app/team", icon: UserCheck },
  { label: "Settings", href: "/app/settings", icon: Settings },
];

function getInitials(name: string): string {
  if (!name) return "FO";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AppShell({
  children,
  userSession,
}: {
  children: React.ReactNode;
  userSession?: CurrentUserSession | null;
}) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false);
  const [prevPathname, setPrevPathname] = React.useState(pathname);

  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setIsMobileOpen(false);
    setIsUserMenuOpen(false);
  }

  const orgName =
    userSession?.membership?.organizationName || DEMO_ORGANIZATION.name;
  const userName = userSession?.profile?.fullName || "Rezaul Karim";
  const userRole = userSession?.membership?.role || "owner";
  const initials = getInitials(userName);

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-slate-50 text-slate-900">
        {/* Mobile Backdrop */}
        {isMobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-slate-900/60 lg:hidden"
            onClick={() => setIsMobileOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex flex-col bg-slate-900 text-slate-300 transition-all duration-200 lg:static",
            isCollapsed ? "w-18" : "w-64",
            isMobileOpen
              ? "translate-x-0"
              : "-translate-x-full lg:translate-x-0"
          )}
        >
          {/* Brand Header */}
          <div className="flex h-16 items-center justify-between px-4 border-b border-slate-800">
            <Link
              href="/app/dashboard"
              className={cn(
                "flex items-center gap-3 overflow-hidden",
                isCollapsed && "justify-center w-full"
              )}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white font-bold shadow-sm">
                FO
              </div>
              {!isCollapsed && (
                <div className="leading-tight">
                  <span className="font-bold text-white text-base tracking-tight">
                    FieldOps <span className="text-blue-400">BD</span>
                  </span>
                  <p className="text-[10px] text-slate-400 truncate max-w-[150px]">
                    {orgName}
                  </p>
                </div>
              )}
            </Link>

            {/* Mobile close button */}
            <button
              onClick={() => setIsMobileOpen(false)}
              className="lg:hidden p-1 text-slate-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== "/app/dashboard" && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group select-none",
                    isActive
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white",
                    isCollapsed && "justify-center px-2"
                  )}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5 shrink-0",
                      isActive
                        ? "text-white"
                        : "text-slate-400 group-hover:text-white"
                    )}
                  />
                  {!isCollapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          {/* Technician Mode Switcher Shortcut */}
          <div className="p-3 border-t border-slate-800">
            <Link
              href="/tech/jobs"
              className={cn(
                "flex items-center gap-2.5 p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-amber-400 border border-amber-400/20 text-xs font-semibold transition-colors",
                isCollapsed && "justify-center"
              )}
              title={isCollapsed ? "Switch to Tech Workspace" : undefined}
            >
              <Smartphone className="h-4 w-4 shrink-0 text-amber-400" />
              {!isCollapsed && (
                <div className="flex-1 truncate">
                  <span>Technician Mode</span>
                  <p className="text-[10px] text-slate-400 font-normal">
                    Mobile Rooftop View
                  </p>
                </div>
              )}
            </Link>
          </div>

          {/* Collapse Toggle Footer */}
          <div className="hidden lg:flex items-center justify-between p-3 border-t border-slate-800/80">
            {!isCollapsed && (
              <span className="text-[11px] text-slate-500 font-medium">
                v1.0 • Bangladesh
              </span>
            )}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={cn(
                "p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 ml-auto",
                isCollapsed && "mx-auto"
              )}
              title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex flex-1 flex-col min-w-0">
          {/* Top Bar */}
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsMobileOpen(true)}
                className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-md"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-500">
                <span className="font-semibold text-slate-800">
                  {orgName}
                </span>
                <span>•</span>
                <span className="text-slate-600">Asia/Dhaka</span>
              </div>
            </div>

            {/* Quick Search & User Profile */}
            <div className="flex items-center gap-3">
              <div className="relative hidden md:block w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Quick search jobs, clients..."
                  className="h-9 w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              {/* Notification placeholder */}
              <button
                type="button"
                className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
                title="Notifications"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-blue-600 ring-2 ring-white" />
              </button>

              {/* User Profile Pill with Interactive Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2.5 pl-2 border-l border-slate-200 hover:opacity-85 text-left focus:outline-none"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-white text-xs font-bold">
                    {initials}
                  </div>
                  <div className="hidden sm:block text-left text-xs">
                    <p className="font-semibold text-slate-800 leading-tight">
                      {userName}
                    </p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">
                      {userRole}
                    </p>
                  </div>
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-md bg-white shadow-lg border border-slate-200 py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        {userName}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {userSession?.user?.email || "Signed in"}
                      </p>
                    </div>

                    <Link
                      href="/app/settings"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      <Settings className="w-3.5 h-3.5 text-slate-400" />
                      Settings & Profile
                    </Link>

                    <form action={signOutAction} className="border-t border-slate-100">
                      <button
                        type="submit"
                        className="w-full text-left flex items-center gap-2 px-4 py-2 text-xs text-red-600 hover:bg-red-50 font-medium"
                      >
                        <LogOut className="w-3.5 h-3.5 text-red-500" />
                        Sign Out
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Page Work Surface */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
