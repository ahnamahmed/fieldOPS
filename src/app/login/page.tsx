"use client";

import { useActionState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { loginAction } from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Wrench, Lock, Mail, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";

function LoginForm() {
  const searchParams = useSearchParams();
  const [state, formAction, isPending] = useActionState(loginAction, null);

  const errorParam = searchParams.get("error");
  const messageParam = searchParams.get("message");
  const nextParam = searchParams.get("next") || "";

  let displayError = state?.error;
  if (!displayError && errorParam) {
    if (errorParam === "auth_exchange_failed") {
      displayError = "Authentication link was invalid or has expired. Please try signing in.";
    } else if (errorParam === "unauthorized") {
      displayError = "You do not have permission to access that resource.";
    }
  }

  return (
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
        <CardTitle className="text-2xl font-bold text-slate-900">Sign in to your account</CardTitle>
        <CardDescription className="text-slate-600">
          Enter your business email and password to access your field-service workspace.
        </CardDescription>
      </CardHeader>

      <form action={formAction}>
        <CardContent className="space-y-4 pt-2">
          {displayError && (
            <div
              role="alert"
              className="p-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 mt-0.5 text-red-600 shrink-0" />
              <div className="flex-1">{displayError}</div>
            </div>
          )}

          {messageParam && (
            <div
              role="status"
              className="p-3 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-2.5"
            >
              <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-600 shrink-0" />
              <div className="flex-1">
                {messageParam === "password_updated"
                  ? "Your password has been successfully updated. Please sign in."
                  : messageParam}
              </div>
            </div>
          )}

          <input type="hidden" name="next" value={nextParam} />

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
            <div className="flex items-center justify-between">
              <label
                htmlFor="password"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
              >
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
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
                Signing in...
              </>
            ) : (
              "Sign In to FieldOps"
            )}
          </Button>

          <p className="text-center text-sm text-slate-600">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="text-blue-600 hover:text-blue-800 font-semibold hover:underline"
            >
              Create business account
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <Suspense fallback={<div className="text-slate-500">Loading sign-in...</div>}>
        <LoginForm />
      </Suspense>

      <div className="mt-8 text-center text-xs text-slate-400 space-y-1">
        <p>FieldOps BD — Field-Service Operations for Bangladesh</p>
        <p>Secured with Supabase PostgreSQL RLS • Timezone Asia/Dhaka • BDT (৳)</p>
      </div>
    </div>
  );
}
