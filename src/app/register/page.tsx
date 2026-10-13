"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerAction } from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Wrench, Lock, Mail, Phone, User, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";

export default function RegisterPage() {
  const [state, formAction, isPending] = useActionState(registerAction, null);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <Card className="w-full max-w-md shadow-lg border-slate-200">
        <CardHeader className="space-y-1 pb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow-sm">
              <Wrench className="w-4 h-4" />
            </div>
            <span className="font-bold text-lg tracking-tight text-slate-900">
              FieldOps <span className="text-blue-600">BD</span>
            </span>
          </div>
          <CardTitle className="text-2xl font-bold text-slate-900">Create your account</CardTitle>
          <CardDescription className="text-slate-600">
            Sign up to manage your AC & refrigeration servicing company with modern field dispatch.
          </CardDescription>
        </CardHeader>

        {state?.success ? (
          <CardContent className="space-y-4 pt-2">
            <div
              role="status"
              className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2"
            >
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Verification link sent</span>
              </div>
              <p className="text-sm text-emerald-800 leading-relaxed">
                {state.message ||
                  "Please check your email inbox to verify your account. Once verified, you can complete your business onboarding."}
              </p>
            </div>
            <div className="pt-2 text-center">
              <Link href="/login">
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                  Return to Sign In
                </Button>
              </Link>
            </div>
          </CardContent>
        ) : (
          <form action={formAction}>
            <CardContent className="space-y-4 pt-2">
              {state?.error && (
                <div
                  role="alert"
                  className="p-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-2.5"
                >
                  <AlertCircle className="w-4 h-4 mt-0.5 text-red-600 shrink-0" />
                  <div className="flex-1">{state.error}</div>
                </div>
              )}

              <div className="space-y-1.5">
                <label
                  htmlFor="fullName"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                >
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    id="fullName"
                    name="fullName"
                    type="text"
                    required
                    placeholder="Engr. Rezaul Karim"
                    className="pl-9"
                  />
                </div>
                {state?.fieldErrors?.fullName && (
                  <p className="text-xs text-red-600">{state.fieldErrors.fullName}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="phone"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                >
                  Bangladesh Mobile Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    required
                    placeholder="01712345678"
                    className="pl-9"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Standard BD format: 013, 014, 015, 016, 017, 018, or 019
                </p>
                {state?.fieldErrors?.phone && (
                  <p className="text-xs text-red-600">{state.fieldErrors.phone}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                >
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="rezaul@acservicebd.com"
                    className="pl-9"
                  />
                </div>
                {state?.fieldErrors?.email && (
                  <p className="text-xs text-red-600">{state.fieldErrors.email}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    placeholder="Minimum 6 characters"
                    className="pl-9"
                  />
                </div>
                {state?.fieldErrors?.password && (
                  <p className="text-xs text-red-600">{state.fieldErrors.password}</p>
                )}
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-4 pt-2">
              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2"
                disabled={isPending}
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Creating account...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>

              <p className="text-center text-sm text-slate-600">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="text-blue-600 hover:text-blue-800 font-semibold hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </CardFooter>
          </form>
        )}
      </Card>

      <div className="mt-8 text-center text-xs text-slate-400 space-y-1">
        <p>FieldOps BD — Designed for Bangladeshi AC & Cooling Contractors</p>
        <p>Multi-tenant Tenant Isolation • PostgreSQL RLS</p>
      </div>
    </div>
  );
}
