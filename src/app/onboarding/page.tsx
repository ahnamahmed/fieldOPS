"use client";

import { useActionState, useState } from "react";
import { onboardingAction } from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Wrench, Building2, Phone, MapPin, Globe, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";

export default function OnboardingPage() {
  const [state, formAction, isPending] = useActionState(onboardingAction, null);
  const [slug, setSlug] = useState("");

  const handleCompanyNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const generated = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    setSlug(generated);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 py-8">
      <Card className="w-full max-w-lg shadow-xl border-slate-200">
        <CardHeader className="space-y-1 pb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow-sm">
              <Wrench className="w-4 h-4" />
            </div>
            <span className="font-bold text-lg tracking-tight text-slate-900">
              FieldOps <span className="text-blue-600">BD</span>
            </span>
          </div>
          <CardTitle className="text-2xl font-bold text-slate-900">
            Set up your service company
          </CardTitle>
          <CardDescription className="text-slate-600">
            Create your primary business workspace. You will be registered as the company owner.
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
                htmlFor="companyName"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
              >
                Company / Trade Name *
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  id="companyName"
                  name="companyName"
                  type="text"
                  required
                  placeholder="CoolTech Engineering & HVAC Services"
                  className="pl-9"
                  onChange={handleCompanyNameChange}
                />
              </div>
              {state?.fieldErrors?.companyName && (
                <p className="text-xs text-red-600">{state.fieldErrors.companyName}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="slug"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
              >
                Workspace URL Identifier (Slug) *
              </label>
              <div className="flex items-center">
                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-slate-300 bg-slate-100 text-slate-500 text-xs font-mono h-9">
                  app.fieldopsbd.com/
                </span>
                <Input
                  id="slug"
                  name="slug"
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder="cooltech-hvac"
                  className="rounded-l-none font-mono text-xs"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Lowercase letters, numbers, and hyphens only.
              </p>
              {state?.fieldErrors?.slug && (
                <p className="text-xs text-red-600">{state.fieldErrors.slug}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="contactPhone"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                >
                  Business Hotline / Mobile *
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    id="contactPhone"
                    name="contactPhone"
                    type="tel"
                    required
                    placeholder="01712345678"
                    className="pl-9"
                  />
                </div>
                {state?.fieldErrors?.contactPhone && (
                  <p className="text-xs text-red-600">{state.fieldErrors.contactPhone}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="city"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                >
                  City / Region
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    id="city"
                    name="city"
                    type="text"
                    defaultValue="Dhaka"
                    required
                    className="pl-9"
                  />
                </div>
                {state?.fieldErrors?.city && (
                  <p className="text-xs text-red-600">{state.fieldErrors.city}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="address"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
              >
                Head Office / Workshop Address (Optional)
              </label>
              <Input
                id="address"
                name="address"
                type="text"
                placeholder="House 24, Road 11, Banani, Dhaka-1213"
              />
              {state?.fieldErrors?.address && (
                <p className="text-xs text-red-600">{state.fieldErrors.address}</p>
              )}
            </div>

            {/* Bangladesh Business Defaults */}
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-2">
              <div className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-blue-600" />
                Configured Bangladesh Defaults
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-slate-600">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Currency: <strong>BDT (৳)</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-600">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Timezone: <strong>Asia/Dhaka (+06:00)</strong></span>
                </div>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 pt-2">
            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 text-sm"
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Creating organization & document sequences...
                </>
              ) : (
                "Launch Company Workspace"
              )}
            </Button>

            <p className="text-center text-[11px] text-slate-400">
              Initializing your database isolation, document numbering (INV-1000, JOB-1000), and RLS permissions.
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
