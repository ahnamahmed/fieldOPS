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
  Download,
  Briefcase,
  Receipt,
  Trash2,
  XCircle,
  Building,
  Phone,
  Sparkles,
  Loader2,
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
  getQuotes,
  getQuoteDetail,
  createQuote,
  updateQuoteStatus,
  convertQuoteToInvoice,
  convertQuoteToJob,
  seedSampleBillingData,
} from "@/features/billing/actions";
import { getCustomers, type CustomerListItem } from "@/features/customers/actions";
import type { QuoteSummary, QuoteDetail, QuoteStatus } from "@/features/billing/types";
import { calculateDocumentTotals, roundMoney } from "@/lib/money";

interface FormLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  itemType: "service" | "labour" | "part";
}

export default function QuotesPage() {
  const { toast } = useToast();
  const [quotes, setQuotes] = React.useState<QuoteSummary[]>([]);
  const [customers, setCustomers] = React.useState<CustomerListItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSeeding, setIsSeeding] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [selectedQuoteId, setSelectedQuoteId] = React.useState<string | null>(null);
  const [quoteDetail, setQuoteDetail] = React.useState<QuoteDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [actionInProgress, setActionInProgress] = React.useState<string | null>(null);

  // New Quote Form State
  const [formCustomerId, setFormCustomerId] = React.useState("");
  const [formIssueDate, setFormIssueDate] = React.useState("");
  const [formValidUntil, setFormValidUntil] = React.useState("");
  const [formNotes, setFormNotes] = React.useState(
    "Includes 90-day service warranty on refrigerant pressure and workmanship."
  );
  const [formTerms, setFormTerms] = React.useState(
    "Quotation valid for 14 days. 50% advance for spare parts sourcing, 50% on job completion."
  );
  const [formDiscount, setFormDiscount] = React.useState<number>(0);
  const [formVatRate, setFormVatRate] = React.useState<number>(0);
  const [formItems, setFormItems] = React.useState<FormLineItem[]>([
    {
      id: "item-1",
      description: "Chemical Jet Wash & Coil De-greasing Service",
      quantity: 1,
      unitPrice: 2500,
      itemType: "service",
    },
    {
      id: "item-2",
      description: "R410A / R32 Refrigerant Gas Pressure Top-Up",
      quantity: 1,
      unitPrice: 3500,
      itemType: "part",
    },
  ]);

  const openCreateModal = () => {
    const now = new Date();
    setFormIssueDate(now.toISOString().split("T")[0]);
    setFormValidUntil(new Date(now.getTime() + 14 * 86400000).toISOString().split("T")[0]);
    setIsCreateModalOpen(true);
  };

  // Load quotes and customers from real Supabase backend
  const loadData = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const [quotesRes, custRes] = await Promise.all([
        getQuotes(),
        getCustomers(),
      ]);

      if (quotesRes.success && quotesRes.data) {
        setQuotes(quotesRes.data);
      } else if (quotesRes.error) {
        toast({
          title: "Failed to load quotations",
          description: quotesRes.error,
          type: "error",
        });
      }

      if (custRes.data) {
        setCustomers(custRes.data);
        if (custRes.data.length > 0) {
          setFormCustomerId((prev) => prev || custRes.data![0].id);
        }
      }
    } catch {
      toast({
        title: "Connection Error",
        description: "Failed to communicate with database server.",
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    let active = true;
    Promise.all([getQuotes(), getCustomers()]).then(([quotesRes, custRes]) => {
      if (!active) return;
      if (quotesRes.success && quotesRes.data) {
        setQuotes(quotesRes.data);
      }
      if (custRes.data) {
        setCustomers(custRes.data);
        if (custRes.data.length > 0) {
          setFormCustomerId((prev) => prev || custRes.data![0].id);
        }
      }
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  // Load quote details when detail modal opens
  const openDetailModal = async (id: string) => {
    setSelectedQuoteId(id);
    setIsLoadingDetail(true);
    setQuoteDetail(null);
    try {
      const res = await getQuoteDetail(id);
      if (res.success && res.data) {
        setQuoteDetail(res.data);
      } else {
        toast({
          title: "Error loading quote",
          description: res.error || "Quotation could not be retrieved.",
          type: "error",
        });
        setSelectedQuoteId(null);
      }
    } catch {
      toast({
        title: "Error",
        description: "Network failure while fetching quotation details.",
        type: "error",
      });
      setSelectedQuoteId(null);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Seed sample data for fast testing & evaluation
  const handleSeedData = async () => {
    try {
      setIsSeeding(true);
      const res = await seedSampleBillingData();
      if (res.success) {
        toast({
          title: "Sample Data Created",
          description: "Created sample commercial customer, quotation, invoice, and bKash payment.",
          type: "success",
        });
        await loadData();
      } else {
        toast({
          title: "Seeding Failed",
          description: res.error || "Failed to create sample billing records.",
          type: "error",
        });
      }
    } finally {
      setIsSeeding(false);
    }
  };

  // Live calculation for create quote modal
  const formCalculations = React.useMemo(() => {
    const rawItems = formItems.map((item) => ({
      quantity: Number(item.quantity) || 0,
      unitPrice: Number(item.unitPrice) || 0,
    }));
    return calculateDocumentTotals(
      rawItems,
      Number(formDiscount) || 0,
      Number(formVatRate) || 0
    );
  }, [formItems, formDiscount, formVatRate]);

  // Add line item in form
  const handleAddItem = () => {
    setFormItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}`,
        description: "",
        quantity: 1,
        unitPrice: 1000,
        itemType: "service",
      },
    ]);
  };

  // Remove line item in form
  const handleRemoveItem = (id: string) => {
    if (formItems.length <= 1) {
      toast({
        title: "At least one item required",
        description: "A quotation must have at least one line item.",
        type: "error",
      });
      return;
    }
    setFormItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Update line item in form
  const handleUpdateItem = (
    id: string,
    field: keyof FormLineItem,
    value: string | number
  ) => {
    setFormItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // Submit new quote
  const handleCreateQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomerId) {
      toast({
        title: "Customer Required",
        description: "Please select a client account for this quotation.",
        type: "error",
      });
      return;
    }

    const invalidItem = formItems.find(
      (item) => !item.description.trim() || item.quantity <= 0 || item.unitPrice < 0
    );
    if (invalidItem) {
      toast({
        title: "Invalid Item",
        description: "Please provide a valid description, positive quantity, and unit price for all items.",
        type: "error",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await createQuote({
        customerId: formCustomerId,
        issueDate: formIssueDate,
        validUntil: formValidUntil,
        notes: formNotes,
        terms: formTerms,
        discountAmount: Number(formDiscount) || 0,
        vatRate: Number(formVatRate) || 0,
        items: formItems.map((item) => ({
          description: item.description.trim(),
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          itemType: item.itemType,
        })),
      });

      if (res.success && res.quoteId) {
        toast({
          title: "Quotation Created",
          description: "New cost estimate generated and ready for client review.",
          type: "success",
        });
        setIsCreateModalOpen(false);
        await loadData();
      } else {
        toast({
          title: "Creation Failed",
          description: res.error || "Failed to create quotation.",
          type: "error",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "An unexpected error occurred while saving quotation.",
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status transitions
  const handleStatusChange = async (quoteId: string, newStatus: QuoteStatus) => {
    try {
      setActionInProgress(`status-${quoteId}`);
      const res = await updateQuoteStatus(quoteId, newStatus);
      if (res.success) {
        toast({
          title: "Status Updated",
          description: `Quotation status changed to ${newStatus}.`,
          type: "success",
        });
        await loadData();
        if (selectedQuoteId === quoteId) {
          await openDetailModal(quoteId);
        }
      } else {
        toast({
          title: "Status Update Failed",
          description: res.error || "Unable to update status.",
          type: "error",
        });
      }
    } finally {
      setActionInProgress(null);
    }
  };

  // Conversion: Quote to Invoice
  const handleConvertToInvoice = async (quoteId: string) => {
    try {
      setActionInProgress(`convert-inv-${quoteId}`);
      const res = await convertQuoteToInvoice(quoteId);
      if (res.success) {
        toast({
          title: "Invoice Generated",
          description: "Accepted quotation successfully converted to billing invoice.",
          type: "success",
        });
        setSelectedQuoteId(null);
        await loadData();
      } else {
        toast({
          title: "Conversion Failed",
          description: res.error || "Could not convert quote to invoice.",
          type: "error",
        });
      }
    } finally {
      setActionInProgress(null);
    }
  };

  // Conversion: Quote to Job
  const handleConvertToJob = async (quoteId: string) => {
    try {
      setActionInProgress(`convert-job-${quoteId}`);
      const res = await convertQuoteToJob(quoteId);
      if (res.success) {
        toast({
          title: "Service Job Created",
          description: "Accepted quotation converted into active HVAC dispatch job with seeded checklist.",
          type: "success",
        });
        setSelectedQuoteId(null);
        await loadData();
      } else {
        toast({
          title: "Conversion Failed",
          description: res.error || "Could not convert quote to service job.",
          type: "error",
        });
      }
    } finally {
      setActionInProgress(null);
    }
  };

  // Filtering
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
  const totalPipeline = quotes.reduce((acc, q) => acc + q.totalAmount, 0);
  const acceptedTotal = quotes
    .filter((q) => q.status === "accepted")
    .reduce((acc, q) => acc + q.totalAmount, 0);
  const pendingCount = quotes.filter((q) => q.status === "sent").length;
  const acceptedCount = quotes.filter((q) => q.status === "accepted").length;
  const conversionRate = quotes.length > 0 ? Math.round((acceptedCount / quotes.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotations & Estimates"
        description="Prepare professional cost estimates for HVAC spare parts, compressor replacements, and gas top-ups before executing work orders."
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleSeedData}
              disabled={isSeeding}
              className="text-xs text-slate-700 bg-white hover:bg-slate-50"
            >
              {isSeeding ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin text-blue-600" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 mr-1 text-amber-500" />
              )}
              Load Sample Data
            </Button>
            <Button
              size="sm"
              onClick={openCreateModal}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Create Quotation
            </Button>
          </div>
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
          { label: "Rejected", value: "rejected" },
          { label: "Expired", value: "expired" },
        ]}
        resultsCount={filteredQuotes.length}
      />

      {/* Quotes Table */}
      {isLoading ? (
        <Card className="p-12 text-center border-slate-200">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">Loading quotations from database...</p>
        </Card>
      ) : filteredQuotes.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No quotations found"
          description={
            searchQuery || statusFilter
              ? "No quotations match your current search criteria."
              : "No cost estimates created yet. Create professional quotations with transparent BDT breakdowns for your clients."
          }
          action={
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleSeedData}
                disabled={isSeeding}
                className="text-xs"
              >
                <Sparkles className="h-3.5 w-3.5 mr-1 text-amber-500" />
                Generate Sample Data
              </Button>
              <Button
                size="sm"
                onClick={openCreateModal}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Draft First Quote
              </Button>
            </div>
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
                  <th className="py-3 px-4">Service Scope / Job</th>
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
                      <div>{quote.customerName}</div>
                      {quote.customerPhone && (
                        <div className="text-[10px] text-slate-400 font-normal">
                          {quote.customerPhone}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                      {quote.jobTitle || "AC Repair & Servicing Estimate"}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      <span>{quote.issueDate}</span>
                      {quote.validUntil && (
                        <span className="text-[10px] block text-slate-400">
                          Valid till {quote.validUntil}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                      {formatBDT(quote.totalAmount)}
                      {quote.discountAmount > 0 && (
                        <span className="block text-[10px] font-normal text-emerald-600">
                          -৳{roundMoney(quote.discountAmount).toFixed(2)} disc
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
                          onClick={() => openDetailModal(quote.id)}
                          className="h-7 text-xs px-2 text-slate-600 hover:text-slate-900"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          View
                        </Button>

                        <a
                          href={`/api/billing/quotes/${quote.id}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={`${quote.quoteNumber}.pdf`}
                          className="inline-flex items-center h-7 px-2 text-xs font-medium rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors"
                          title="Download branded PDF"
                        >
                          <Download className="h-3.5 w-3.5 mr-1 text-slate-500" />
                          PDF
                        </a>

                        {quote.status === "draft" && (
                          <Button
                            size="sm"
                            disabled={actionInProgress === `status-${quote.id}`}
                            onClick={() => handleStatusChange(quote.id, "sent")}
                            className="h-7 text-xs px-2 bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            <Send className="h-3 w-3 mr-1" />
                            Send
                          </Button>
                        )}

                        {quote.status === "sent" && (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              disabled={actionInProgress === `status-${quote.id}`}
                              onClick={() => handleStatusChange(quote.id, "accepted")}
                              className="h-7 text-xs px-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={actionInProgress === `status-${quote.id}`}
                              onClick={() => handleStatusChange(quote.id, "rejected")}
                              className="h-7 text-xs px-2 text-rose-600 border-rose-200 hover:bg-rose-50"
                            >
                              <XCircle className="h-3 w-3 mr-1" />
                              Reject
                            </Button>
                          </div>
                        )}

                        {quote.status === "accepted" && (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              disabled={actionInProgress === `convert-inv-${quote.id}`}
                              onClick={() => handleConvertToInvoice(quote.id)}
                              className="h-7 text-xs px-2 bg-emerald-700 hover:bg-emerald-800 text-white"
                            >
                              <Receipt className="h-3 w-3 mr-1" />
                              Invoice
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={actionInProgress === `convert-job-${quote.id}`}
                              onClick={() => handleConvertToJob(quote.id)}
                              className="h-7 text-xs px-2 text-blue-700 border-blue-200 hover:bg-blue-50"
                            >
                              <Briefcase className="h-3 w-3 mr-1" />
                              Job
                            </Button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Quote Details & Preview Modal */}
      {selectedQuoteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full overflow-hidden border border-slate-200 my-8 animate-in fade-in zoom-in-95 duration-100">
            {isLoadingDetail ? (
              <div className="p-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
                <p className="text-sm text-slate-600">Retrieving quotation breakdown...</p>
              </div>
            ) : quoteDetail ? (
              <>
                <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="font-mono text-xs font-bold text-blue-600">
                        {quoteDetail.quoteNumber}
                      </span>
                      <h3 className="font-bold text-slate-900 text-base">
                        Quotation Breakdown & Cost Estimate
                      </h3>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedQuoteId(null)}
                    className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="p-5 space-y-5 text-xs max-h-[70vh] overflow-y-auto">
                  {/* Customer and Status Box */}
                  <div className="flex justify-between items-start pb-4 border-b border-slate-100">
                    <div className="space-y-1">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                        Client Information
                      </span>
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        <Building className="h-4 w-4 text-slate-400" />
                        {quoteDetail.customerName}
                      </div>
                      {quoteDetail.customerPhone && (
                        <div className="text-slate-600 flex items-center gap-1">
                          <Phone className="h-3 w-3 text-slate-400" />
                          {quoteDetail.customerPhone}
                        </div>
                      )}
                      {quoteDetail.customerAddress && (
                        <div className="text-slate-500 text-[11px]">
                          {quoteDetail.customerAddress}
                        </div>
                      )}
                    </div>
                    <div className="text-right space-y-1">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                        Current Status
                      </span>
                      <StatusBadge status={quoteDetail.status} />
                      <div className="text-slate-500 text-[11px] pt-1">
                        Issued: <span className="font-medium text-slate-700">{quoteDetail.issueDate}</span>
                      </div>
                      {quoteDetail.validUntil && (
                        <div className="text-slate-500 text-[11px]">
                          Valid Until:{" "}
                          <span className="font-medium text-slate-700">{quoteDetail.validUntil}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Line Items Table */}
                  <div>
                    <span className="text-slate-700 block font-semibold mb-2">
                      Itemized Services, Labour & Spare Parts
                    </span>
                    <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50/50">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-600 font-semibold text-[11px]">
                            <th className="py-2.5 px-3">Description</th>
                            <th className="py-2.5 px-2 text-center">Type</th>
                            <th className="py-2.5 px-3 text-right">Qty</th>
                            <th className="py-2.5 px-3 text-right">Unit Price</th>
                            <th className="py-2.5 px-3 text-right">Total (BDT)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {quoteDetail.items.map((item, idx) => (
                            <tr key={item.id || idx}>
                              <td className="py-2.5 px-3 font-medium text-slate-800">
                                {item.description}
                              </td>
                              <td className="py-2.5 px-2 text-center">
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium uppercase bg-slate-100 text-slate-600">
                                  {item.itemType}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right text-slate-600 font-mono">
                                {item.quantity}
                              </td>
                              <td className="py-2.5 px-3 text-right text-slate-600 font-mono">
                                ৳{item.unitPrice.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-mono">
                                ৳{item.lineTotal.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Calculations Summary */}
                      <div className="bg-slate-50 p-4 border-t border-slate-200 space-y-1.5 text-right">
                        <div className="flex justify-between text-slate-600">
                          <span>Subtotal Gross:</span>
                          <span className="font-mono font-medium">{formatBDT(quoteDetail.subtotal)}</span>
                        </div>
                        {quoteDetail.discountAmount > 0 && (
                          <div className="flex justify-between text-emerald-600 font-medium">
                            <span>Special Client Discount:</span>
                            <span className="font-mono">- {formatBDT(quoteDetail.discountAmount)}</span>
                          </div>
                        )}
                        {quoteDetail.vatRate > 0 && (
                          <div className="flex justify-between text-slate-600">
                            <span>Government VAT ({quoteDetail.vatRate}%):</span>
                            <span className="font-mono">{formatBDT(quoteDetail.vatAmount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-slate-900 font-bold text-sm pt-2 border-t border-slate-200">
                          <span>Total Net Estimate:</span>
                          <span className="text-blue-600 font-mono text-base">
                            {formatBDT(quoteDetail.totalAmount)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Notes & Terms */}
                  {(quoteDetail.notes || quoteDetail.terms) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 text-[11px]">
                      {quoteDetail.notes && (
                        <div>
                          <span className="font-bold text-slate-700 block mb-0.5">Scope Notes:</span>
                          <p className="text-slate-600">{quoteDetail.notes}</p>
                        </div>
                      )}
                      {quoteDetail.terms && (
                        <div>
                          <span className="font-bold text-slate-700 block mb-0.5">Payment Terms:</span>
                          <p className="text-slate-600">{quoteDetail.terms}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Modal Footer Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-t border-slate-200 bg-slate-50">
                  <div className="flex items-center gap-2">
                    <a
                      href={`/api/billing/quotes/${quoteDetail.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={`${quoteDetail.quoteNumber}.pdf`}
                      className="inline-flex items-center h-8 px-3 text-xs font-semibold rounded-md border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 shadow-2xs transition-colors"
                    >
                      <Download className="h-3.5 w-3.5 mr-1.5 text-blue-600" />
                      Download PDF
                    </a>

                    {quoteDetail.status === "draft" && (
                      <Button
                        size="sm"
                        disabled={actionInProgress === `status-${quoteDetail.id}`}
                        onClick={() => handleStatusChange(quoteDetail.id, "sent")}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <Send className="h-3.5 w-3.5 mr-1.5" />
                        Send to Client
                      </Button>
                    )}

                    {quoteDetail.status === "sent" && (
                      <>
                        <Button
                          size="sm"
                          disabled={actionInProgress === `status-${quoteDetail.id}`}
                          onClick={() => handleStatusChange(quoteDetail.id, "accepted")}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                          Accept Quote
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={actionInProgress === `status-${quoteDetail.id}`}
                          onClick={() => handleStatusChange(quoteDetail.id, "rejected")}
                          className="text-rose-600 border-rose-200 hover:bg-rose-50"
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1.5" />
                          Reject
                        </Button>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {quoteDetail.status === "accepted" && (
                      <>
                        <Button
                          size="sm"
                          disabled={actionInProgress === `convert-inv-${quoteDetail.id}`}
                          onClick={() => handleConvertToInvoice(quoteDetail.id)}
                          className="bg-emerald-700 hover:bg-emerald-800 text-white shadow-2xs"
                        >
                          <Receipt className="h-3.5 w-3.5 mr-1.5" />
                          Convert to Invoice
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={actionInProgress === `convert-job-${quoteDetail.id}`}
                          onClick={() => handleConvertToJob(quoteDetail.id)}
                          className="text-blue-700 border-blue-200 hover:bg-blue-50"
                        >
                          <Briefcase className="h-3.5 w-3.5 mr-1.5" />
                          Convert to Job
                        </Button>
                      </>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedQuoteId(null)}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* New Quote Form Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full overflow-hidden border border-slate-200 my-8 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-slate-900 text-base">
                  Draft New Service Quotation
                </h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateQuote} className="p-5 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
              {/* Customer Selector */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Customer / Commercial Account *
                </label>
                {customers.length === 0 ? (
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 flex items-center justify-between">
                    <span>No customer records found. Generate sample data first or create customer.</span>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSeedData}
                      disabled={isSeeding}
                      className="bg-amber-600 text-white text-xs h-7"
                    >
                      Seed Demo Client
                    </Button>
                  </div>
                ) : (
                  <select
                    value={formCustomerId}
                    onChange={(e) => setFormCustomerId(e.target.value)}
                    required
                    className="w-full h-9 px-3 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white text-slate-900 font-medium"
                  >
                    {customers.map((cust) => (
                      <option key={cust.id} value={cust.id}>
                        {cust.name} {cust.companyName ? `(${cust.companyName})` : ""} — {cust.phone}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Quotation Issue Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formIssueDate}
                    onChange={(e) => setFormIssueDate(e.target.value)}
                    className="w-full h-9 px-3 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Valid Until Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formValidUntil}
                    onChange={(e) => setFormValidUntil(e.target.value)}
                    className="w-full h-9 px-3 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 text-slate-900"
                  />
                </div>
              </div>

              {/* Line Items Dynamic Builder */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block font-semibold text-slate-800">
                    Services, Labour & Parts Breakdown *
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddItem}
                    className="h-7 text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Item
                  </Button>
                </div>

                <div className="space-y-2">
                  {formItems.map((item, idx) => {
                    const lineTotal = roundMoney(
                      (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)
                    );
                    return (
                      <div
                        key={item.id}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-600 text-[11px]">
                            Item #{idx + 1}
                          </span>
                          {formItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                          <div className="sm:col-span-6">
                            <input
                              type="text"
                              required
                              placeholder="Description (e.g. Inverter PCB Board Repair)"
                              value={item.description}
                              onChange={(e) =>
                                handleUpdateItem(item.id, "description", e.target.value)
                              }
                              className="w-full h-8 px-2.5 rounded-md border border-slate-200 text-slate-900 text-xs"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <select
                              value={item.itemType}
                              onChange={(e) =>
                                handleUpdateItem(
                                  item.id,
                                  "itemType",
                                  e.target.value as FormLineItem["itemType"]
                                )
                              }
                              className="w-full h-8 px-2 rounded-md border border-slate-200 text-slate-900 text-xs bg-white"
                            >
                              <option value="service">Service</option>
                              <option value="part">Part</option>
                              <option value="labour">Labour</option>
                            </select>
                          </div>

                          <div className="sm:col-span-2">
                            <input
                              type="number"
                              min={0.01}
                              step={0.5}
                              required
                              placeholder="Qty"
                              value={item.quantity}
                              onChange={(e) =>
                                handleUpdateItem(item.id, "quantity", Number(e.target.value))
                              }
                              className="w-full h-8 px-2 text-right rounded-md border border-slate-200 text-slate-900 text-xs font-mono"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <input
                              type="number"
                              min={0}
                              step={100}
                              required
                              placeholder="Unit ৳"
                              value={item.unitPrice}
                              onChange={(e) =>
                                handleUpdateItem(item.id, "unitPrice", Number(e.target.value))
                              }
                              className="w-full h-8 px-2 text-right rounded-md border border-slate-200 text-slate-900 text-xs font-mono"
                            />
                          </div>
                        </div>

                        <div className="text-right text-[11px] text-slate-500 font-mono">
                          Line Total:{" "}
                          <span className="font-bold text-slate-800">
                            ৳{lineTotal.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Discounts & VAT */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Special Discount (BDT ৳)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={100}
                    value={formDiscount}
                    onChange={(e) => setFormDiscount(Number(e.target.value))}
                    className="w-full h-9 px-3 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    VAT Rate (%)
                  </label>
                  <select
                    value={formVatRate}
                    onChange={(e) => setFormVatRate(Number(e.target.value))}
                    className="w-full h-9 px-3 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white text-slate-900"
                  >
                    <option value={0}>0% (Standard AC repair)</option>
                    <option value={5}>5% (Commercial Service Tax)</option>
                    <option value={7.5}>7.5% (Contract Maintenance)</option>
                    <option value={15}>15% (Full Corporate VAT)</option>
                  </select>
                </div>
              </div>

              {/* Total Calculation Display */}
              <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-200 space-y-1 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span className="font-mono font-medium">{formatBDT(formCalculations.subtotal)}</span>
                </div>
                {formCalculations.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Discount:</span>
                    <span className="font-mono">- {formatBDT(formCalculations.discountAmount)}</span>
                  </div>
                )}
                {formCalculations.vatRate > 0 && (
                  <div className="flex justify-between text-slate-600">
                    <span>VAT ({formCalculations.vatRate}%):</span>
                    <span className="font-mono">{formatBDT(formCalculations.vatAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-900 font-bold text-sm pt-1.5 border-t border-blue-200">
                  <span>Calculated Net Total:</span>
                  <span className="font-bold text-base text-blue-700 font-mono">
                    {formatBDT(formCalculations.totalAmount)}
                  </span>
                </div>
              </div>

              {/* Notes & Terms Inputs */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Warranty & Scope Notes
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. 90-day warranty on compressor and gas charge"
                  className="w-full h-8 px-2.5 rounded-md border border-slate-200 text-slate-900"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Terms of Payment
                </label>
                <input
                  type="text"
                  value={formTerms}
                  onChange={(e) => setFormTerms(e.target.value)}
                  placeholder="e.g. 50% advance upon confirmation"
                  className="w-full h-8 px-2.5 rounded-md border border-slate-200 text-slate-900"
                />
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
                  disabled={isSubmitting || customers.length === 0}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Saving Quote...
                    </>
                  ) : (
                    "Save & Issue Quotation"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
