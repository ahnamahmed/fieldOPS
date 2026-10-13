"use client";

import * as React from "react";
import {
  Building,
  Globe,
  Hash,
  ClipboardList,
  Save,
  CheckCircle2,
  FileSpreadsheet,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { DEMO_ORGANIZATION } from "@/lib/demo-data";

export default function SettingsPage() {
  const { toast } = useToast();

  // Company Profile State
  const [orgName, setOrgName] = React.useState(DEMO_ORGANIZATION.name);
  const [orgPhone, setOrgPhone] = React.useState(DEMO_ORGANIZATION.contactPhone);
  const [orgEmail, setOrgEmail] = React.useState(DEMO_ORGANIZATION.contactEmail);
  const [orgAddress, setOrgAddress] = React.useState(DEMO_ORGANIZATION.address);
  const [taxId, setTaxId] = React.useState(DEMO_ORGANIZATION.taxId);

  // Numbering Sequences State
  const [jobPrefix, setJobPrefix] = React.useState("FO-JOB-");
  const [quotePrefix, setQuotePrefix] = React.useState("FO-QTE-");
  const [invoicePrefix, setInvoicePrefix] = React.useState("FO-INV-");
  const [contractPrefix, setContractPrefix] = React.useState("FO-AMC-");

  // Currency & Regional
  const [currency] = React.useState("BDT (৳)");
  const [timezone] = React.useState("Asia/Dhaka (GMT+6)");

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Settings Saved",
      description: "Company profile, document sequences, and localization preferences updated.",
      type: "success",
    });
  };

  const handleExportData = () => {
    toast({
      title: "Data Export Generated",
      description: "Downloading JSON/CSV operational archive for CoolTech BD...",
      type: "info",
    });
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="Settings & Business Configuration"
        description="Configure your service company profile, invoice numbering sequences, Dhaka regional defaults, and technician checklist templates."
        actions={
          <Button
            size="sm"
            onClick={handleExportData}
            variant="outline"
            className="text-xs"
          >
            <FileSpreadsheet className="h-4 w-4 mr-1.5 text-slate-500" />
            Export Business Records
          </Button>
        }
      />

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Company Profile Card */}
        <Card className="p-6 border-slate-200 shadow-xs">
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
            <Building className="h-5 w-5 text-blue-600" />
            <div>
              <h2 className="font-semibold text-slate-900 text-sm">
                Company Profile
              </h2>
              <p className="text-xs text-slate-500">
                Official company details displayed on quotations, invoices, and job completion slips.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-5 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Company Legal Name *
              </label>
              <input
                type="text"
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 text-slate-900"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Tax Identification Number / BIN *
              </label>
              <input
                type="text"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 text-slate-900 font-mono"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Official Contact Phone *
              </label>
              <input
                type="text"
                required
                value={orgPhone}
                onChange={(e) => setOrgPhone(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 text-slate-900"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Dispatch / Billing Email *
              </label>
              <input
                type="email"
                required
                value={orgEmail}
                onChange={(e) => setOrgEmail(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 text-slate-900"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block font-medium text-slate-700 mb-1">
                Workshop & Office Address (Dhaka, Bangladesh) *
              </label>
              <input
                type="text"
                required
                value={orgAddress}
                onChange={(e) => setOrgAddress(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 text-slate-900"
              />
            </div>
          </div>
        </Card>

        {/* Regional & Localization */}
        <Card className="p-6 border-slate-200 shadow-xs">
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
            <Globe className="h-5 w-5 text-emerald-600" />
            <div>
              <h2 className="font-semibold text-slate-900 text-sm">
                Regional & Currency Standards
              </h2>
              <p className="text-xs text-slate-500">
                Guarantees localized currency calculations and accurate time scheduling for Dhaka traffic.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-5 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Default Currency
              </label>
              <input
                type="text"
                disabled
                value={currency}
                className="w-full h-9 px-3 rounded-md border border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed font-medium"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Formatted with South Asian commas (e.g. ৳1,50,000.00).
              </p>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Operational Timezone
              </label>
              <input
                type="text"
                disabled
                value={timezone}
                className="w-full h-9 px-3 rounded-md border border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed font-medium"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Enforces Asia/Dhaka timestamps across technician visits.
              </p>
            </div>
          </div>
        </Card>

        {/* Document Numbering Sequences */}
        <Card className="p-6 border-slate-200 shadow-xs">
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
            <Hash className="h-5 w-5 text-indigo-600" />
            <div>
              <h2 className="font-semibold text-slate-900 text-sm">
                Document Numbering Sequences
              </h2>
              <p className="text-xs text-slate-500">
                Custom prefix templates for work orders, estimates, invoices, and AMC maintenance contracts.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-5 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Job Card Prefix
              </label>
              <input
                type="text"
                value={jobPrefix}
                onChange={(e) => setJobPrefix(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 font-mono text-slate-900"
              />
              <p className="text-[10px] text-slate-400 mt-1">Example: {jobPrefix}1001</p>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Quote Prefix
              </label>
              <input
                type="text"
                value={quotePrefix}
                onChange={(e) => setQuotePrefix(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 font-mono text-slate-900"
              />
              <p className="text-[10px] text-slate-400 mt-1">Example: {quotePrefix}1001</p>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Invoice Prefix
              </label>
              <input
                type="text"
                value={invoicePrefix}
                onChange={(e) => setInvoicePrefix(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 font-mono text-slate-900"
              />
              <p className="text-[10px] text-slate-400 mt-1">Example: {invoicePrefix}1001</p>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                AMC Contract Prefix
              </label>
              <input
                type="text"
                value={contractPrefix}
                onChange={(e) => setContractPrefix(e.target.value)}
                className="w-full h-9 px-3 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 font-mono text-slate-900"
              />
              <p className="text-[10px] text-slate-400 mt-1">Example: {contractPrefix}1001</p>
            </div>
          </div>
        </Card>

        {/* Technician Checklist Template Preview */}
        <Card className="p-6 border-slate-200 shadow-xs">
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
            <ClipboardList className="h-5 w-5 text-amber-600" />
            <div>
              <h2 className="font-semibold text-slate-900 text-sm">
                Default Master AC Service Checklist
              </h2>
              <p className="text-xs text-slate-500">
                Standard mandatory diagnostic checkpoints assigned to technicians on mobile work orders.
              </p>
            </div>
          </div>

          <div className="pt-4 space-y-2 text-xs">
            {[
              {
                step: "1. Pre-service test run & temperature differential check (T_in - T_out)",
                type: "Numeric (°C)",
              },
              {
                step: "2. Suction & discharge line pressure test (PSI)",
                type: "Numeric (PSI)",
              },
              {
                step: "3. Compressor running current measurement (Amps vs Rated)",
                type: "Numeric (Amps)",
              },
              {
                step: "4. Indoor coil water-jet wash & anti-fungal chemical foam treatment",
                type: "Checkbox (Pass/Fail)",
              },
              {
                step: "5. Outdoor condenser coil degreasing & blower motor lubrication",
                type: "Checkbox (Pass/Fail)",
              },
              {
                step: "6. Condensate drain line flush with nitrogen to prevent water overflow",
                type: "Checkbox (Pass/Fail)",
              },
              {
                step: "7. Photo evidence of outdoor unit before & after service",
                type: "Mandatory Photo Upload",
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200/80"
              >
                <div className="flex items-center gap-2 text-slate-800 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>{item.step}</span>
                </div>
                <span className="text-[10px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {item.type}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-xs px-6"
          >
            <Save className="h-4 w-4 mr-1.5" />
            Save Business Configuration
          </Button>
        </div>
      </form>
    </div>
  );
}
