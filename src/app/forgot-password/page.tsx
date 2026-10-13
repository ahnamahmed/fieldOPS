"use client";

import { useActionState } from "react";
import Link from "next/link";
import { forgotPasswordAction } from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Wrench, Mail, AlertCircle, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const [state, formAction, isPending] = useActionState(forgotPasswordAction, null);

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
          <CardTitle className="text-2xl font-bold text-slate-900">Reset your password</CardTitle>
          <CardDescription className="text-slate-600">
            Enter your account email address and we will send you a password reset link.
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
                <span>Check your email</span>
              </div>
              <p className="text-sm text-emerald-800 leading-relaxed">
                {state.message ||
                  "If an account exists with that email, a password reset link has been dispatched."}
              </p>
            </div>
            <div className="pt-2 text-center">
              <Link href="/login">
                <Button variant="outline" className="w-full">
                  <ArrowLeft className="w-4 h-4 mr-2" />
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
                  htmlFor="email"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                >
                  Account Email
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
                    Sending reset link...
                  </>
                ) : (
                  "Send Reset Link"
                )}
              </Button>

              <p className="text-center text-sm text-slate-600">
                Remember your password?{" "}
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
    </div>
  );
}
