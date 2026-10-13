"use client";

import { useActionState } from "react";
import Link from "next/link";
import { resetPasswordAction } from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Wrench, Lock, AlertCircle, Loader2 } from "lucide-react";

export default function ResetPasswordPage() {
  const [state, formAction, isPending] = useActionState(resetPasswordAction, null);

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
          <CardTitle className="text-2xl font-bold text-slate-900">Choose a new password</CardTitle>
          <CardDescription className="text-slate-600">
            Please enter a strong new password for your FieldOps BD account.
          </CardDescription>
        </CardHeader>

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
                htmlFor="password"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
              >
                New Password
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

            <div className="space-y-1.5">
              <label
                htmlFor="confirmPassword"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
              >
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  placeholder="Re-enter new password"
                  className="pl-9"
                />
              </div>
              {state?.fieldErrors?.confirmPassword && (
                <p className="text-xs text-red-600">{state.fieldErrors.confirmPassword}</p>
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
                  Updating password...
                </>
              ) : (
                "Update Password"
              )}
            </Button>

            <p className="text-center text-sm text-slate-600">
              <Link
                href="/login"
                className="text-blue-600 hover:text-blue-800 font-semibold hover:underline"
              >
                Cancel and return to sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
