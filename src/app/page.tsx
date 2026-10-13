import Link from "next/link";
import {
  Wrench,
  ShieldCheck,
  Calendar,
  CreditCard,
  FileText,
  Smartphone,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-slate-900">
                FieldOps <span className="text-blue-600">BD</span>
              </span>
              <span className="hidden sm:inline-block ml-2 rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
                Bangladesh
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900">
                Sign In
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                Get Started
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white to-slate-100 py-16 sm:py-24 border-b border-slate-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800 shadow-sm mb-6">
              <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
              Built for AC & Refrigeration Contractors in Bangladesh
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Professional Field Service,{" "}
              <span className="text-blue-600">from Dispatch to BDT Payment</span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-600">
              FieldOps BD empowers small-to-midsize service companies with 3–20 technicians to manage customer equipment histories, dispatch work orders, run mobile checklists on rooftops, and track cash, bKash, and bank dues without paperwork.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white shadow-md text-base px-8 h-12">
                  Start Free Company Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/login" className="w-full sm:w-auto">
                <Button variant="outline" size="lg" className="w-full sm:w-auto text-base px-8 h-12 border-slate-300">
                  Dispatcher Portal
                </Button>
              </Link>
            </div>

            {/* Quick stats / Highlights */}
            <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4 border-t border-slate-200/80 pt-8">
              <div>
                <p className="text-2xl font-bold text-slate-900">৳ BDT</p>
                <p className="text-xs text-slate-500 font-medium">Native Currency</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">Asia/Dhaka</p>
                <p className="text-xs text-slate-500 font-medium">Standard Timezone</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">100% Isolated</p>
                <p className="text-xs text-slate-500 font-medium">Multi-Tenant PostgreSQL RLS</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">Mobile-First</p>
                <p className="text-xs text-slate-500 font-medium">Technician Workspace</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Workflow Pillars */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-base font-semibold uppercase tracking-wider text-blue-600">
              End-to-End Operational Lifecycle
            </h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Engineered for Bangladesh Field Work
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1 */}
            <Card className="border-slate-200 shadow-sm hover:shadow transition-shadow">
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700 mb-3">
                  <Smartphone className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">Mobile Technician Workspace</CardTitle>
                <CardDescription>
                  Large touch targets for technicians on ladders. One-click customer phone calls, Google Maps routing, and touch diagnostic checklists.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    AC Gas pressure (PSI) & Amps testing
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    Camera photo upload with compression
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    Digital customer completion signature
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Feature 2 */}
            <Card className="border-slate-200 shadow-sm hover:shadow transition-shadow">
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700 mb-3">
                  <Calendar className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">Dispatcher Scheduling Grid</CardTitle>
                <CardDescription>
                  Visual technician swimlanes, conflict warnings, and automated travel buffer management tailored for Dhaka traffic.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    Drag-and-drop technician assignment
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    Schedule overlap collision warning
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    Site landmark tags (e.g. Opposite to Star Kabab)
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Feature 3 */}
            <Card className="border-slate-200 shadow-sm hover:shadow transition-shadow">
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 mb-3">
                  <CreditCard className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">Bangladesh Financial Ledger</CardTitle>
                <CardDescription>
                  Manual payment recording designed for the reality of field collections in BDT across mobile financial services and cash.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    bKash, Nagad, and Rocket TrxID recording
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    On-site cash collections ledger
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    Corporate bank cheque & clearing tracking
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Feature 4 */}
            <Card className="border-slate-200 shadow-sm hover:shadow transition-shadow">
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-700 mb-3">
                  <Wrench className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">AC Equipment Unit Passport</CardTitle>
                <CardDescription>
                  Full lifecycle history for every AC unit across client facilities. Track refrigerant leaks, replaced capacitors, and warranty.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    Split, Cassette, Standing, VRF, and Chillers
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    R22, R32, R410A gas leak & top-up history
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    Asset serial number & facility location
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Feature 5 */}
            <Card className="border-slate-200 shadow-sm hover:shadow transition-shadow">
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 text-teal-700 mb-3">
                  <FileText className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">Recurring AMC Contracts</CardTitle>
                <CardDescription>
                  Automate planned visits for Annual Maintenance Contracts with corporate offices, banks, and restaurant chains.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    Monthly, quarterly, & half-yearly schedules
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    Automated planned visit generator
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    Contract renewal alerts
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Feature 6 */}
            <Card className="border-slate-200 shadow-sm hover:shadow transition-shadow">
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-100 text-rose-700 mb-3">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">Multi-Tenant Isolation</CardTitle>
                <CardDescription>
                  Zero cross-company data leakage guaranteed by PostgreSQL Row Level Security policies at database level.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    Owner, Admin, Dispatcher, Tech, Finance roles
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    Technicians only see assigned visits
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    Encrypted private job photo storage
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span className="font-bold text-slate-900">FieldOps BD</span>
            <span>—</span>
            <span>Field Service Management SaaS for Bangladesh</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
              Foundation Active
            </Badge>
            <span>Timezone: Asia/Dhaka</span>
            <span>Currency: BDT (৳)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
