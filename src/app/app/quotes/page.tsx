"use client";

import * as React from "react";
import {
  FileText,
  Plus,
  Send,
  CheckCircle2,
  Clock,
  Eye,
  DollarSign,
  X,
  FileCheck,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { SearchFilterBar } from "@/components/ui/search-filter-bar";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import { useToast } from "@/components/ui/toast";
import { formatBDT } from "@/lib/formatters";
import {
  DEMO_QUOTES,
  DEMO_CUSTOMERS,
  type DemoQuote,
} from "@/lib/demo-data";

export default function QuotesPage() {
  const { toast } = useToast();
  const [quotes, setQuotes] = React.useState<DemoQuote[]>(DEMO_QUOTES);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [selectedQuote, setSelectedQuote] = React.useState<DemoQuote | null>(null);

  // New Quote Form State
  const [newCustomerId, setNewCustomerId] = React.useState(DEMO_CUSTOMERS[0].id);
  const [newJobTitle, setNewJobTitle] = React.useState("");
  const [newSubtotal, setNewSubtotal] = React.useState<number>(15000);
  const [newDiscount, setNewDiscount] = React.useState<number>(500);

  const filteredQuotes = quotes.filter((quote) => {
    const matchesSearch =
      !searchQuery ||
      quote.quoteNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      quote.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (quote.jobTitle && quote.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = !statusFilter || quote.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Calculate Metrics
  const totalPipeline = quotes.reduce((acc, q) => acc + q.total, 0);
  const acceptedTotal = quotes
    .filter((q) => q.status === "accepted")
    .reduce((acc, q) => acc + q.total, 0);
  const pendingCount = quotes.filter((q) => q.status === "sent").length;
  const acceptedCount = quotes.filter((q) => q.status === "accepted").length;
  const conversionRate = quotes.length > 0 ? Math.round((acceptedCount / quotes.length) * 100) : 0;

  const handleCreateQuote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJobTitle.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a scope or service title.",
        type: "error",
      });
      return;
    }

    const customer = DEMO_CUSTOMERS.find((c) => c.id === newCustomerId)!;
    const sub = Number(newSubtotal) || 0;
    const disc = Number(newDiscount) || 0;
    const total = Math.max(0, sub - disc);

    const newQuote: DemoQuote = {
      id: `qte-${Date.now()}`,
      quoteNumber: `FO-QTE-${1000 + quotes.length + 1}`,
      customerName: customer.name,
      jobTitle: newJobTitle.trim(),
      date: "12 Oct 2026",
      validUntil: "26 Oct 2026",
      subtotal: sub,
      discount: disc,
      vat: 0,
      total: total,
      status: "draft",
    };

    setQuotes([newQuote, ...quotes]);
    setIsCreateModalOpen(false);
    setNewJobTitle("");

    toast({
      title: "Quotation Generated",
      description: `${newQuote.quoteNumber} created for ${customer.name}.`,
      type: "success",
    });
  };

  const handleConvertToInvoice = (quote: DemoQuote) => {
    setQuotes(
      quotes.map((q) =>
        q.id === quote.id ? { ...q, status: "accepted" } : q
      )
    );
    setSelectedQuote(null);
    toast({
      title: "Invoice Draft Created",
      description: `Converted quotation ${quote.quoteNumber} into pending invoice for ${quote.customerName}.`,
      type: "success",
    });
  };

  const handleSendQuote = (quote: DemoQuote) => {
    setQuotes(
      quotes.map((q) => (q.id === quote.id ? { ...q, status: "sent" } : q))
    );
    toast({
      title: "Quotation Dispatched",
      description: `Dispatched ${quote.quoteNumber} (${formatBDT(quote.total)}) via official WhatsApp & Email notice.`,
      type: "info",
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotations & Estimates"
        description="Prepare professional cost estimates for HVAC spare parts, compressor replacements, and gas top-ups before executing work orders."
        actions={
          <Button
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Create Quotation
          </Button>
        }
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Pipeline Value"
          value={formatBDT(totalPipeline)}
          subtitle="All active quotes issued"
          icon={<DollarSign className="h-5 w-5 text-blue-600" />}
        />
        <MetricCard
          title="Accepted Value"
          value={formatBDT(acceptedTotal)}
          subtitle="Approved and ready for invoice"
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
        />
        <MetricCard
          title="Awaiting Approval"
          value={pendingCount}
          subtitle="Sent to commercial clients"
          icon={<Clock className="h-5 w-5 text-amber-600" />}
        />
        <MetricCard
          title="Conversion Rate"
          value={`${conversionRate}%`}
          subtitle="Quotes accepted by clients"
          icon={<FileCheck className="h-5 w-5 text-indigo-600" />}
        />
      </div>

      {/* Filter and Search Bar */}
      <SearchFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Filter by Quote #, client name, or item description..."
        filterValue={statusFilter}
        onFilterChange={setStatusFilter}
        filterLabel="All Statuses"
        filterOptions={[
          { label: "Draft", value: "draft" },
          { label: "Sent to Client", value: "sent" },
          { label: "Accepted", value: "accepted" },
          { label: "Expired", value: "expired" },
        ]}
        resultsCount={filteredQuotes.length}
      />

      {/* Quotes Table */}
      {filteredQuotes.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No quotations found"
          description={
            searchQuery || statusFilter
              ? "No quotations match your current search criteria."
              : "No cost estimates created yet. Create professional quotations with transparent BDT breakdowns for your clients."
          }
          action={
            <Button
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Draft First Quote
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden border-slate-200 shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Quote #</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Service Scope</th>
                  <th className="py-3 px-4">Validity</th>
                  <th className="py-3 px-4 text-right">Amount (BDT)</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredQuotes.map((quote) => (
                  <tr
                    key={quote.id}
                    className="hover:bg-slate-50/60 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-600">
                      {quote.quoteNumber}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">
                      {quote.customerName}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                      {quote.jobTitle || "AC Repair & Servicing"}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      <span>{quote.date}</span>
                      <span className="text-[10px] block text-slate-400">
                        Valid till {quote.validUntil}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                      {formatBDT(quote.total)}
                      {quote.discount > 0 && (
                        <span className="block text-[10px] font-normal text-emerald-600">
                          -৳{quote.discount} discount
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <StatusBadge status={quote.status} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedQuote(quote)}
                          className="h-7 text-xs px-2 text-slate-600"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          View
                        </Button>
                        {quote.status === "draft" && (
                          <Button
                            size="sm"
                            onClick={() => handleSendQuote(quote)}
                            className="h-7 text-xs px-2 bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            <Send className="h-3 w-3 mr-1" />
                            Send
                          </Button>
                        )}
                        {quote.status === "accepted" ? (
                          <span className="text-[11px] font-medium text-emerald-600 px-2 py-0.5 bg-emerald-50 rounded border border-emerald-200">
                            Ready for Invoice
                          </span>
                        ) : quote.status === "sent" ? (
                          <Button
                            size="sm"
                            onClick={() => handleConvertToInvoice(quote)}
                            className="h-7 text-xs px-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Accept & Invoice
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Quote Details Modal */}
      {selectedQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <div>
                <span className="font-mono text-xs font-bold text-blue-600">
                  {selectedQuote.quoteNumber}
                </span>
                <h3 className="font-bold text-slate-900 text-base">
                  Quotation Breakdown
                </h3>
              </div>
              <button
                onClick={() => setSelectedQuote(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="flex justify-between items-start pb-3 border-b border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                    Customer
                  </span>
                  <span className="font-bold text-slate-900 text-sm">
                    {selectedQuote.customerName}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                    Status
                  </span>
                  <StatusBadge status={selectedQuote.status} />
                </div>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                  Scope of Work
                </span>
                <p className="font-medium text-slate-800 mt-0.5">
                  {selectedQuote.jobTitle}
                </p>
              </div>

              {/* Line Items Mock Table */}
              <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                <p className="font-semibold text-slate-700 mb-2">Itemized Estimate:</p>
                <div className="space-y-1.5 divide-y divide-slate-100">
                  <div className="flex justify-between pt-1 text-slate-600">
                    <span>Labor & Diagnostics Fee</span>
                    <span className="font-medium">৳3,500.00</span>
                  </div>
                  <div className="flex justify-between pt-1 text-slate-600">
                    <span>Refrigerant Gas Top-Up (R410A / R32)</span>
                    <span className="font-medium">৳6,500.00</span>
                  </div>
                  <div className="flex justify-between pt-1 text-slate-600">
                    <span>OEM Replacement Capacitors / Contactors</span>
                    <span className="font-medium">৳8,500.00</span>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-200 space-y-1 text-right">
                  <div className="flex justify-between text-slate-500">
                    <span>Subtotal:</span>
                    <span>{formatBDT(selectedQuote.subtotal)}</span>
                  </div>
                  {selectedQuote.discount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-medium">
                      <span>Discount:</span>
                      <span>- {formatBDT(selectedQuote.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-900 font-bold text-sm pt-1 border-t border-slate-200">
                    <span>Total Net Estimate:</span>
                    <span className="text-blue-600">
                      {formatBDT(selectedQuote.total)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-slate-400">
                Validity: 14 Days from issuance. Payment term: 50% advance for spare parts, balance on completion.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-200 bg-slate-50">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedQuote(null)}
              >
                Close
              </Button>
              {selectedQuote.status !== "accepted" && (
                <Button
                  size="sm"
                  onClick={() => handleConvertToInvoice(selectedQuote)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  Accept & Convert to Invoice
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Quote Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-slate-900 text-base">
                  Create Service Quotation
                </h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateQuote} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Customer / Commercial Account *
                </label>
                <select
                  value={newCustomerId}
                  onChange={(e) => setNewCustomerId(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white text-slate-900"
                >
                  {DEMO_CUSTOMERS.map((cust) => (
                    <option key={cust.id} value={cust.id}>
                      {cust.name} ({cust.customerType})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Service Scope / Job Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 4x Cassette AC Chemical Jet Wash & Capacitor Replacement"
                  value={newJobTitle}
                  onChange={(e) => setNewJobTitle(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Subtotal Estimate (BDT ৳)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={newSubtotal}
                    onChange={(e) => setNewSubtotal(Number(e.target.value))}
                    className="w-full h-9 px-3 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Special Discount (BDT ৳)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={newDiscount}
                    onChange={(e) => setNewDiscount(Number(e.target.value))}
                    className="w-full h-9 px-3 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 text-slate-900"
                  />
                </div>
              </div>

              <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100 flex items-center justify-between">
                <span className="font-semibold text-slate-700">Calculated Net Total:</span>
                <span className="font-bold text-base text-blue-600">
                  {formatBDT(Math.max(0, newSubtotal - newDiscount))}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Save Quotation
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
