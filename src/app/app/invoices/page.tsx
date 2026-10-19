"use client";

import * as React from "react";
import {
  Receipt,
  Plus,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  X,
  Wallet,
  Download,
  Building,
  Phone,
  Sparkles,
  Loader2,
  Trash2,
  RotateCcw,
  ShieldAlert,
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
  getInvoices,
  getInvoiceDetail,
  createInvoice,
  recordPayment,
  voidPayment,
  seedSampleBillingData,
} from "@/features/billing/actions";
import { getCustomers, type CustomerListItem } from "@/features/customers/actions";
import type { InvoiceSummary, InvoiceDetail, PaymentRecord } from "@/features/billing/types";
import { calculateDocumentTotals, roundMoney } from "@/lib/money";

interface FormLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  itemType: "service" | "labour" | "part";
}

export default function InvoicesPage() {
  const { toast } = useToast();
  const [invoices, setInvoices] = React.useState<InvoiceSummary[]>([]);
  const [customers, setCustomers] = React.useState<CustomerListItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSeeding, setIsSeeding] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = React.useState<string | null>(null);
  const [invoiceDetail, setInvoiceDetail] = React.useState<InvoiceDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = React.useState(false);
  const [paymentInvoice, setPaymentInvoice] = React.useState<InvoiceSummary | InvoiceDetail | null>(null);

  // Form Submitting
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isRecordingPayment, setIsRecordingPayment] = React.useState(false);
  const [voidingPaymentId, setVoidingPaymentId] = React.useState<string | null>(null);

  // New Invoice Form State
  const [formCustomerId, setFormCustomerId] = React.useState("");
  const [formIssueDate, setFormIssueDate] = React.useState("");
  const [formDueDate, setFormDueDate] = React.useState("");
  const [formNotes, setFormNotes] = React.useState(
    "Service completed and tested. Customer accepted cooling temperature performance."
  );
  const [formPaymentTerms, setFormPaymentTerms] = React.useState(
    "Due within 7 days. Pay via bKash Merchant, Nagad, or Bank Wire (BEFTN/NPSB)."
  );
  const [formDiscount, setFormDiscount] = React.useState<number>(0);
  const [formVatRate, setFormVatRate] = React.useState<number>(0);
  const [formItems, setFormItems] = React.useState<FormLineItem[]>([
    {
      id: "item-1",
      description: "AC Master Service & Chemical Jet Foam Clean",
      quantity: 2,
      unitPrice: 2200,
      itemType: "service",
    },
    {
      id: "item-2",
      description: "Compressor Run Capacitor Replacement (50uF)",
      quantity: 1,
      unitPrice: 1600,
      itemType: "part",
    },
  ]);

  // Record Payment Form State
  const [payAmount, setPayAmount] = React.useState<number>(0);
  const [payMethod, setPayMethod] = React.useState<
    "cash" | "bkash" | "nagad" | "bank_transfer" | "rocket" | "cheque" | "other"
  >("bkash");
  const [payDate, setPayDate] = React.useState("");
  const [payTrxId, setPayTrxId] = React.useState("");
  const [payNotes, setPayNotes] = React.useState("");

  const openCreateModal = () => {
    const now = new Date();
    setFormIssueDate(now.toISOString().split("T")[0]);
    setFormDueDate(new Date(now.getTime() + 7 * 86400000).toISOString().split("T")[0]);
    setIsCreateModalOpen(true);
  };

  // Load invoices and customers
  const loadData = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const [invRes, custRes] = await Promise.all([
        getInvoices(),
        getCustomers(),
      ]);

      if (invRes.success && invRes.data) {
        setInvoices(invRes.data);
      } else if (invRes.error) {
        toast({
          title: "Failed to load invoices",
          description: invRes.error,
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
        title: "Database Connection Error",
        description: "Failed to communicate with Supabase backend.",
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    let active = true;
    Promise.all([getInvoices(), getCustomers()]).then(([invRes, custRes]) => {
      if (!active) return;
      if (invRes.success && invRes.data) {
        setInvoices(invRes.data);
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

  // Open invoice detail modal and fetch breakdown + payment history
  const openDetailModal = async (id: string) => {
    setSelectedInvoiceId(id);
    setIsLoadingDetail(true);
    setInvoiceDetail(null);
    try {
      const res = await getInvoiceDetail(id);
      if (res.success && res.data) {
        setInvoiceDetail(res.data);
      } else {
        toast({
          title: "Error loading invoice",
          description: res.error || "Invoice details could not be retrieved.",
          type: "error",
        });
        setSelectedInvoiceId(null);
      }
    } catch {
      toast({
        title: "Error",
        description: "Network failure while fetching invoice.",
        type: "error",
      });
      setSelectedInvoiceId(null);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Seed sample billing data
  const handleSeedData = async () => {
    try {
      setIsSeeding(true);
      const res = await seedSampleBillingData();
      if (res.success) {
        toast({
          title: "Sample Data Ready",
          description: "Created sample invoice, quotation, and recorded partial payment.",
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

  // Live calculation for create invoice modal
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

  // Dynamic items in form
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

  const handleRemoveItem = (id: string) => {
    if (formItems.length <= 1) {
      toast({
        title: "Item Required",
        description: "An invoice must contain at least one line item.",
        type: "error",
      });
      return;
    }
    setFormItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdateItem = (
    id: string,
    field: keyof FormLineItem,
    value: string | number
  ) => {
    setFormItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // Create Invoice Submit
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCustomerId) {
      toast({
        title: "Customer Required",
        description: "Please select an account for this invoice.",
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
        description: "Please provide a valid description, quantity, and unit price.",
        type: "error",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await createInvoice({
        customerId: formCustomerId,
        issueDate: formIssueDate,
        dueDate: formDueDate,
        notes: formNotes,
        paymentTerms: formPaymentTerms,
        discountAmount: Number(formDiscount) || 0,
        vatRate: Number(formVatRate) || 0,
        items: formItems.map((item) => ({
          description: item.description.trim(),
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          itemType: item.itemType,
        })),
      });

      if (res.success && res.invoiceId) {
        toast({
          title: "Invoice Issued",
          description: "New invoice issued successfully with sequential number.",
          type: "success",
        });
        setIsCreateModalOpen(false);
        await loadData();
      } else {
        toast({
          title: "Issue Failed",
          description: res.error || "Failed to issue invoice.",
          type: "error",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "An unexpected error occurred while issuing invoice.",
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Payment Recording Modal
  const openPaymentModal = (invoice: InvoiceSummary | InvoiceDetail) => {
    setPaymentInvoice(invoice);
    setPayAmount(roundMoney(invoice.balanceDue));
    setPayDate(new Date().toISOString().split("T")[0]);
    setPayTrxId("");
    setPayNotes("");
    setPayMethod("bkash");
  };

  // Submit Payment Record
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentInvoice) return;

    const amount = Number(payAmount) || 0;
    if (amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Payment amount must be greater than ৳0.",
        type: "error",
      });
      return;
    }

    if (amount > paymentInvoice.balanceDue) {
      toast({
        title: "Overpayment Rejected",
        description: `Payment cannot exceed current balance due of ৳${paymentInvoice.balanceDue.toFixed(2)}.`,
        type: "error",
      });
      return;
    }

    try {
      setIsRecordingPayment(true);
      const res = await recordPayment({
        invoiceId: paymentInvoice.id,
        amount,
        paymentMethod: payMethod,
        paymentDate: payDate,
        transactionReference: payTrxId.trim() || undefined,
        notes: payNotes.trim() || undefined,
      });

      if (res.success) {
        toast({
          title: "Payment Recorded",
          description: `Collected ${formatBDT(amount)} via ${payMethod.toUpperCase()} for ${paymentInvoice.invoiceNumber}.`,
          type: "success",
        });
        setPaymentInvoice(null);
        await loadData();
        if (selectedInvoiceId === paymentInvoice.id) {
          await openDetailModal(paymentInvoice.id);
        }
      } else {
        toast({
          title: "Payment Recording Failed",
          description: res.error || "Unable to record payment.",
          type: "error",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Network error while posting payment.",
        type: "error",
      });
    } finally {
      setIsRecordingPayment(false);
    }
  };

  // Void Payment
  const handleVoidPayment = async (payment: PaymentRecord) => {
    if (!confirm(`Are you sure you want to void this payment of ৳${payment.amount.toFixed(2)}? This will restore the invoice balance.`)) {
      return;
    }

    try {
      setVoidingPaymentId(payment.id);
      const res = await voidPayment(payment.id, "Voided by finance user request");
      if (res.success) {
        toast({
          title: "Payment Voided",
          description: `Payment of ${formatBDT(payment.amount)} has been voided and balance restored.`,
          type: "info",
        });
        await loadData();
        if (selectedInvoiceId) {
          await openDetailModal(selectedInvoiceId);
        }
      } else {
        toast({
          title: "Void Failed",
          description: res.error || "Failed to void payment.",
          type: "error",
        });
      }
    } finally {
      setVoidingPaymentId(null);
    }
  };

  // Filtering
  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      !searchQuery ||
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.quoteNumber && inv.quoteNumber.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = !statusFilter || inv.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Calculate Metrics
  const totalInvoiced = invoices.reduce((acc, inv) => acc + inv.totalAmount, 0);
  const totalCollected = invoices.reduce((acc, inv) => acc + inv.paidAmount, 0);
  const totalOutstanding = invoices.reduce((acc, inv) => acc + inv.balanceDue, 0);
  const totalOverdue = invoices
    .filter((inv) => inv.status === "overdue")
    .reduce((acc, inv) => acc + inv.balanceDue, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices & Collections"
        description="Track customer billings, bKash/Nagad transactions, bank wire transfers, and overdue accounts in Bangladeshi Taka (BDT)."
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
              Issue New Invoice
            </Button>
          </div>
        }
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Invoiced"
          value={formatBDT(totalInvoiced)}
          subtitle="Cumulative billing volume"
          icon={<DollarSign className="h-5 w-5 text-blue-600" />}
        />
        <MetricCard
          title="Collected Revenue"
          value={formatBDT(totalCollected)}
          subtitle="Realized cash and MFS payments"
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
        />
        <MetricCard
          title="Outstanding Balance"
          value={formatBDT(totalOutstanding)}
          subtitle="Receivables currently due"
          icon={<Clock className="h-5 w-5 text-amber-600" />}
        />
        <MetricCard
          title="Overdue Accounts"
          value={formatBDT(totalOverdue)}
          subtitle="Past agreed due date"
          icon={<AlertCircle className="h-5 w-5 text-rose-600" />}
        />
      </div>

      {/* Filter and Search Bar */}
      <SearchFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Filter by Invoice #, client name, or quote ref..."
        filterValue={statusFilter}
        onFilterChange={setStatusFilter}
        filterLabel="All Invoices"
        filterOptions={[
          { label: "Paid in Full", value: "paid" },
          { label: "Partially Paid", value: "partially_paid" },
          { label: "Issued / Pending", value: "issued" },
          { label: "Overdue", value: "overdue" },
          { label: "Void", value: "void" },
        ]}
        resultsCount={filteredInvoices.length}
      />

      {/* Invoices Table */}
      {isLoading ? (
        <Card className="p-12 text-center border-slate-200">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">Loading invoice ledger from database...</p>
        </Card>
      ) : filteredInvoices.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No invoices found"
          description={
            searchQuery || statusFilter
              ? "No billing records match your selected filters."
              : "No invoices created yet. Generate billings for completed job orders or accepted customer quotations."
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
                Create First Invoice
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
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Dates</th>
                  <th className="py-3 px-4 text-right">Total (BDT)</th>
                  <th className="py-3 px-4 text-right">Paid (BDT)</th>
                  <th className="py-3 px-4 text-right">Balance Due</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="hover:bg-slate-50/60 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-600">
                      {inv.invoiceNumber}
                      {inv.quoteNumber && (
                        <span className="block text-[10px] text-slate-400 font-mono font-normal">
                          Quote: {inv.quoteNumber}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-800 block">
                        {inv.customerName}
                      </span>
                      {inv.customerPhone && (
                        <span className="text-[10px] text-slate-400">
                          {inv.customerPhone}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      <span>Issued: {inv.issueDate}</span>
                      <span className="text-[10px] block text-slate-400">
                        Due: {inv.dueDate}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-slate-900 font-mono">
                      {formatBDT(inv.totalAmount)}
                    </td>
                    <td className="py-3.5 px-4 text-right text-emerald-600 font-medium font-mono">
                      {formatBDT(inv.paidAmount)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900 font-mono">
                      {inv.balanceDue > 0 ? (
                        <span className={inv.status === "overdue" ? "text-rose-600 font-bold" : "text-amber-700"}>
                          {formatBDT(inv.balanceDue)}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-normal">৳0.00</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openDetailModal(inv.id)}
                          className="h-7 text-xs px-2 text-slate-600 hover:text-slate-900"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          View
                        </Button>

                        <a
                          href={`/api/billing/invoices/${inv.id}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={`${inv.invoiceNumber}.pdf`}
                          className="inline-flex items-center h-7 px-2 text-xs font-medium rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors"
                          title="Download branded PDF"
                        >
                          <Download className="h-3.5 w-3.5 mr-1 text-slate-500" />
                          PDF
                        </a>

                        {inv.balanceDue > 0 ? (
                          <Button
                            size="sm"
                            onClick={() => openPaymentModal(inv)}
                            className="h-7 text-xs px-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            <Receipt className="h-3 w-3 mr-1" />
                            Record Pay
                          </Button>
                        ) : (
                          <span className="text-[11px] font-medium text-emerald-700 px-2 py-0.5 bg-emerald-50 rounded border border-emerald-200">
                            Settled
                          </span>
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

      {/* Invoice Details & Payment Ledger Modal */}
      {selectedInvoiceId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full overflow-hidden border border-slate-200 my-8 animate-in fade-in zoom-in-95 duration-100">
            {isLoadingDetail ? (
              <div className="p-12 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
                <p className="text-sm text-slate-600">Retrieving tax invoice details & payment history...</p>
              </div>
            ) : invoiceDetail ? (
              <>
                <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg">
                      <Receipt className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="font-mono text-xs font-bold text-blue-600">
                        {invoiceDetail.invoiceNumber}
                      </span>
                      <h3 className="font-bold text-slate-900 text-base">
                        Commercial Tax Invoice
                      </h3>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedInvoiceId(null)}
                    className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="p-5 space-y-5 text-xs max-h-[70vh] overflow-y-auto">
                  {/* Client & Date Info */}
                  <div className="flex justify-between items-start pb-4 border-b border-slate-100">
                    <div className="space-y-1">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                        Billed To
                      </span>
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        <Building className="h-4 w-4 text-slate-400" />
                        {invoiceDetail.customerName}
                      </div>
                      {invoiceDetail.customerPhone && (
                        <div className="text-slate-600 flex items-center gap-1">
                          <Phone className="h-3 w-3 text-slate-400" />
                          {invoiceDetail.customerPhone}
                        </div>
                      )}
                      {invoiceDetail.customerAddress && (
                        <div className="text-slate-500 text-[11px]">
                          {invoiceDetail.customerAddress}
                        </div>
                      )}
                    </div>

                    <div className="text-right space-y-1">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">
                        Payment Status
                      </span>
                      <StatusBadge status={invoiceDetail.status} />
                      <div className="text-slate-500 text-[11px] pt-1">
                        Issued: <span className="font-medium text-slate-700">{invoiceDetail.issueDate}</span>
                      </div>
                      <div className="text-slate-500 text-[11px]">
                        Payment Due:{" "}
                        <span className="font-semibold text-rose-700">{invoiceDetail.dueDate}</span>
                      </div>
                    </div>
                  </div>

                  {/* Line Items Breakdown */}
                  <div>
                    <span className="text-slate-700 block font-semibold mb-2">
                      Invoiced Items & Services
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
                          {invoiceDetail.items.map((item, idx) => (
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
                      <div className="bg-slate-50 p-4 border-t border-slate-200 space-y-1.5 text-right font-mono">
                        <div className="flex justify-between text-slate-600 font-sans">
                          <span>Gross Subtotal:</span>
                          <span className="font-mono font-medium">{formatBDT(invoiceDetail.subtotal)}</span>
                        </div>
                        {invoiceDetail.discountAmount > 0 && (
                          <div className="flex justify-between text-emerald-600 font-sans font-medium">
                            <span>Discount Applied:</span>
                            <span className="font-mono">- {formatBDT(invoiceDetail.discountAmount)}</span>
                          </div>
                        )}
                        {invoiceDetail.vatRate > 0 && (
                          <div className="flex justify-between text-slate-600 font-sans">
                            <span>VAT ({invoiceDetail.vatRate}%):</span>
                            <span className="font-mono">{formatBDT(invoiceDetail.vatAmount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-slate-900 font-sans font-bold text-sm pt-2 border-t border-slate-200">
                          <span>Total Invoiced:</span>
                          <span className="font-mono text-base">{formatBDT(invoiceDetail.totalAmount)}</span>
                        </div>
                        <div className="flex justify-between text-emerald-700 font-sans font-medium">
                          <span>Total Paid to Date:</span>
                          <span className="font-mono">- {formatBDT(invoiceDetail.paidAmount)}</span>
                        </div>
                        <div className="flex justify-between text-rose-700 font-sans font-bold text-base pt-1.5 border-t border-slate-200">
                          <span>Outstanding Balance Due:</span>
                          <span className="font-mono text-lg">{formatBDT(invoiceDetail.balanceDue)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Payment History Ledger */}
                  <div>
                    <span className="text-slate-800 block font-semibold mb-2 flex items-center gap-1.5">
                      <Wallet className="h-4 w-4 text-emerald-600" />
                      Recorded Payment Transactions ({invoiceDetail.payments.length})
                    </span>

                    {invoiceDetail.payments.length === 0 ? (
                      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center text-slate-500">
                        No payments recorded yet against this invoice.
                      </div>
                    ) : (
                      <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-600 font-semibold text-[11px]">
                              <th className="py-2.5 px-3">Date</th>
                              <th className="py-2.5 px-3">Method</th>
                              <th className="py-2.5 px-3">Reference / TrxID</th>
                              <th className="py-2.5 px-3 text-right">Amount (BDT)</th>
                              <th className="py-2.5 px-3">Recorded By</th>
                              <th className="py-2.5 px-3 text-center">Status</th>
                              <th className="py-2.5 px-3 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {invoiceDetail.payments.map((p) => (
                              <tr key={p.id}>
                                <td className="py-2.5 px-3 text-slate-700">{p.paymentDate}</td>
                                <td className="py-2.5 px-3 font-medium text-slate-900 uppercase">
                                  {p.paymentMethod}
                                </td>
                                <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                                  {p.transactionReference || "—"}
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-emerald-700 font-mono">
                                  ৳{p.amount.toLocaleString("en-BD", { minimumFractionDigits: 2 })}
                                </td>
                                <td className="py-2.5 px-3 text-slate-600">
                                  {p.recorderName || "Staff"}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                      p.status === "verified_manual"
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                        : "bg-rose-50 text-rose-700 border border-rose-200"
                                    }`}
                                  >
                                    {p.status === "verified_manual" ? "Recorded" : p.status}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  {p.status === "verified_manual" && (
                                    <button
                                      type="button"
                                      disabled={voidingPaymentId === p.id}
                                      onClick={() => handleVoidPayment(p)}
                                      className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                                      title="Void payment"
                                    >
                                      <RotateCcw className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-t border-slate-200 bg-slate-50">
                  <div className="flex items-center gap-2">
                    <a
                      href={`/api/billing/invoices/${invoiceDetail.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={`${invoiceDetail.invoiceNumber}.pdf`}
                      className="inline-flex items-center h-8 px-3 text-xs font-semibold rounded-md border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 shadow-2xs transition-colors"
                    >
                      <Download className="h-3.5 w-3.5 mr-1.5 text-blue-600" />
                      Download Tax Invoice PDF
                    </a>
                  </div>

                  <div className="flex items-center gap-2">
                    {invoiceDetail.balanceDue > 0 && (
                      <Button
                        size="sm"
                        onClick={() => openPaymentModal(invoiceDetail)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <Receipt className="h-3.5 w-3.5 mr-1.5" />
                        Record Payment
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedInvoiceId(null)}
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

      {/* Record Payment Modal */}
      {paymentInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200 my-8 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-emerald-600" />
                <h3 className="font-semibold text-slate-900 text-base">
                  Record Manual Payment
                </h3>
              </div>
              <button
                onClick={() => setPaymentInvoice(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="p-5 space-y-4 text-xs">
              {/* Invoice Summary Banner */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">
                    Invoice
                  </span>
                  <span className="font-mono font-bold text-blue-600">
                    {paymentInvoice.invoiceNumber}
                  </span>
                </div>
                <div className="font-bold text-slate-800 text-sm">
                  {paymentInvoice.customerName}
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200 text-slate-600 font-mono">
                  <span>Balance Due:</span>
                  <span className="font-bold text-rose-600 text-sm">
                    {formatBDT(paymentInvoice.balanceDue)}
                  </span>
                </div>
              </div>

              {/* Payment Amount */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Payment Amount to Record (BDT ৳) *
                </label>
                <input
                  type="number"
                  min={1}
                  max={paymentInvoice.balanceDue}
                  step={10}
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  className="w-full h-9 px-3 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 text-slate-900 font-bold font-mono text-base"
                />
                <span className="text-[10px] text-slate-500 block mt-1">
                  Maximum recordable: ৳{paymentInvoice.balanceDue.toFixed(2)} (Overpayment strictly rejected)
                </span>
              </div>

              {/* Payment Channel */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Payment Channel / Method *
                </label>
                <select
                  value={payMethod}
                  onChange={(e) =>
                    setPayMethod(
                      e.target.value as "cash" | "bkash" | "nagad" | "bank_transfer" | "rocket" | "cheque" | "other"
                    )
                  }
                  className="w-full h-9 px-3 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white text-slate-900 font-medium"
                >
                  <option value="bkash">bKash Merchant Wallet</option>
                  <option value="nagad">Nagad Wallet</option>
                  <option value="cash">Cash on Site (Collected by Tech)</option>
                  <option value="bank_transfer">Bank Wire Transfer (BEFTN / NPSB / RTGS)</option>
                  <option value="rocket">Dutch-Bangla Rocket</option>
                  <option value="cheque">Bank Cheque</option>
                  <option value="other">Other Channel</option>
                </select>
              </div>

              {/* Payment Date */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Payment Received Date *
                </label>
                <input
                  type="date"
                  required
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 text-slate-900"
                />
              </div>

              {/* TrxID / Slip Ref */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Transaction ID / Cheque # / Slip Ref
                </label>
                <input
                  type="text"
                  placeholder="e.g. 9J72KLA98P or CHQ-48291"
                  value={payTrxId}
                  onChange={(e) => setPayTrxId(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 text-slate-900 font-mono"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Internal Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Verified with bank statement or cash deposit slip"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full h-8 px-2.5 rounded-md border border-slate-200 text-slate-900"
                />
              </div>

              {/* MVP Disclosure Alert */}
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg flex items-start gap-2 text-amber-800 text-[11px]">
                <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <span>
                  <strong>Manual Entry Disclosure:</strong> This transaction records offline verification entered by authorized staff. bKash and Nagad payments are not verified via live API gateway in MVP.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPaymentInvoice(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isRecordingPayment}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isRecordingPayment ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Recording Payment...
                    </>
                  ) : (
                    "Confirm & Apply Payment"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Invoice Form Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full overflow-hidden border border-slate-200 my-8 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-slate-900 text-base">
                  Issue Commercial Invoice
                </h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="p-5 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
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
                    Invoice Issue Date *
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
                    Payment Due Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full h-9 px-3 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 text-slate-900"
                  />
                </div>
              </div>

              {/* Line Items Dynamic Builder */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block font-semibold text-slate-800">
                    Billed Services & Spare Parts *
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
                              placeholder="Description (e.g. Chiller Condenser Descaling)"
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
                  <span>Calculated Invoice Total:</span>
                  <span className="font-bold text-base text-blue-700 font-mono">
                    {formatBDT(formCalculations.totalAmount)}
                  </span>
                </div>
              </div>

              {/* Payment Terms & Notes */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Payment Instructions & Terms
                </label>
                <input
                  type="text"
                  value={formPaymentTerms}
                  onChange={(e) => setFormPaymentTerms(e.target.value)}
                  placeholder="e.g. Due within 7 days via bKash or Bank"
                  className="w-full h-8 px-2.5 rounded-md border border-slate-200 text-slate-900"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Service Execution Notes
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="e.g. Work inspected and tested satisfactory"
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
                      Issuing Invoice...
                    </>
                  ) : (
                    "Issue Invoice"
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
