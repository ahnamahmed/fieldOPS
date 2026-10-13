"use client";

import * as React from "react";
import {
  CreditCard,
  Plus,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  Receipt,
  X,
  Wallet,
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
  DEMO_INVOICES,
  DEMO_CUSTOMERS,
  type DemoInvoice,
} from "@/lib/demo-data";

export default function InvoicesPage() {
  const { toast } = useToast();
  const [invoices, setInvoices] = React.useState<DemoInvoice[]>(DEMO_INVOICES);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [selectedInvoice, setSelectedInvoice] = React.useState<DemoInvoice | null>(null);
  const [paymentInvoice, setPaymentInvoice] = React.useState<DemoInvoice | null>(null);

  // New Invoice State
  const [newCustomerId, setNewCustomerId] = React.useState(DEMO_CUSTOMERS[0].id);
  const [newTotalAmount, setNewTotalAmount] = React.useState<number>(25000);
  const [newDueDate, setNewDueDate] = React.useState("26 Oct 2026");

  // Record Payment State
  const [payAmount, setPayAmount] = React.useState<number>(0);
  const [payMethod, setPayMethod] = React.useState("bKash Merchant");
  const [payTrxId, setPayTrxId] = React.useState("");

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch =
      !searchQuery ||
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.transactionRef &&
        inv.transactionRef.toLowerCase().includes(searchQuery.toLowerCase()));

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

  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    const customer = DEMO_CUSTOMERS.find((c) => c.id === newCustomerId)!;
    const amount = Number(newTotalAmount) || 0;

    const newInvoice: DemoInvoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: `FO-INV-${1000 + invoices.length + 1}`,
      customerName: customer.name,
      date: "12 Oct 2026",
      dueDate: newDueDate,
      totalAmount: amount,
      paidAmount: 0,
      balanceDue: amount,
      status: "issued",
    };

    setInvoices([newInvoice, ...invoices]);
    setIsCreateModalOpen(false);

    toast({
      title: "Invoice Issued",
      description: `Invoice ${newInvoice.invoiceNumber} for ${formatBDT(amount)} recorded.`,
      type: "success",
    });
  };

  const openPaymentModal = (invoice: DemoInvoice) => {
    setPaymentInvoice(invoice);
    setPayAmount(invoice.balanceDue);
    setPayTrxId("");
    setPayMethod("bKash Merchant");
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentInvoice) return;

    const paymentVal = Number(payAmount) || 0;
    if (paymentVal <= 0) {
      toast({
        title: "Validation Error",
        description: "Payment amount must be greater than ৳0.",
        type: "error",
      });
      return;
    }

    const newPaidTotal = paymentInvoice.paidAmount + paymentVal;
    const newBalance = Math.max(0, paymentInvoice.totalAmount - newPaidTotal);
    const newStatus: "paid" | "partially_paid" =
      newBalance === 0 ? "paid" : "partially_paid";

    const updated = invoices.map((inv) =>
      inv.id === paymentInvoice.id
        ? {
            ...inv,
            paidAmount: newPaidTotal,
            balanceDue: newBalance,
            status: newStatus,
            paymentMethod: payMethod,
            transactionRef: payTrxId.trim() || `MAN-${Date.now().toString().slice(-6)}`,
          }
        : inv
    );

    setInvoices(updated);
    setPaymentInvoice(null);

    toast({
      title: "Payment Recorded",
      description: `Collected ${formatBDT(paymentVal)} via ${payMethod} for ${paymentInvoice.invoiceNumber}.`,
      type: "success",
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices & Collections"
        description="Track customer billings, bKash/Nagad transactions, bank wire transfers, and overdue accounts in Bangladeshi Taka (BDT)."
        actions={
          <Button
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Issue New Invoice
          </Button>
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
        searchPlaceholder="Filter by Invoice #, client, or TrxID..."
        filterValue={statusFilter}
        onFilterChange={setStatusFilter}
        filterLabel="All Invoices"
        filterOptions={[
          { label: "Paid", value: "paid" },
          { label: "Partially Paid", value: "partially_paid" },
          { label: "Issued / Pending", value: "issued" },
          { label: "Overdue", value: "overdue" },
        ]}
        resultsCount={filteredInvoices.length}
      />

      {/* Invoices Table */}
      {filteredInvoices.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No invoices found"
          description={
            searchQuery || statusFilter
              ? "No billing records match your selected filters."
              : "No invoices created yet. Generate billings for completed job orders or recurring maintenance contracts."
          }
          action={
            <Button
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Create Invoice
            </Button>
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
                      {inv.transactionRef && (
                        <span className="block text-[10px] text-slate-400 font-mono font-normal">
                          Ref: {inv.transactionRef}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-800 block">
                        {inv.customerName}
                      </span>
                      {inv.paymentMethod && (
                        <span className="text-[10px] text-emerald-600 font-medium">
                          via {inv.paymentMethod}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      <span>Issued: {inv.date}</span>
                      <span className="text-[10px] block text-slate-400">
                        Due: {inv.dueDate}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-slate-900">
                      {formatBDT(inv.totalAmount)}
                    </td>
                    <td className="py-3.5 px-4 text-right text-emerald-600 font-medium">
                      {formatBDT(inv.paidAmount)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                      {inv.balanceDue > 0 ? (
                        <span className={inv.status === "overdue" ? "text-rose-600" : "text-amber-700"}>
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
                          onClick={() => setSelectedInvoice(inv)}
                          className="h-7 text-xs px-2 text-slate-600"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          View
                        </Button>
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

      {/* Invoice Details Drawer */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <div>
                <span className="font-mono text-xs font-bold text-blue-600">
                  {selectedInvoice.invoiceNumber}
                </span>
                <h3 className="font-bold text-slate-900 text-base">
                  Tax Invoice Details
                </h3>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="flex justify-between items-start pb-3 border-b border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                    Client Name
                  </span>
                  <span className="font-bold text-slate-900 text-sm">
                    {selectedInvoice.customerName}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                    Payment Status
                  </span>
                  <StatusBadge status={selectedInvoice.status} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                    Issued Date
                  </span>
                  <span className="font-medium text-slate-700">
                    {selectedInvoice.date}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                    Due Date
                  </span>
                  <span className="font-medium text-slate-700">
                    {selectedInvoice.dueDate}
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                <div className="flex justify-between text-slate-600">
                  <span>Gross Invoiced Amount:</span>
                  <span className="font-semibold text-slate-800">
                    {formatBDT(selectedInvoice.totalAmount)}
                  </span>
                </div>
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Total Payments Cleared:</span>
                  <span>- {formatBDT(selectedInvoice.paidAmount)}</span>
                </div>
                <div className="flex justify-between text-slate-900 font-bold text-sm pt-2 border-t border-slate-200">
                  <span>Outstanding Balance Due:</span>
                  <span className="text-rose-600">
                    {formatBDT(selectedInvoice.balanceDue)}
                  </span>
                </div>
              </div>

              {selectedInvoice.transactionRef && (
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <p className="font-semibold text-emerald-900">
                    Recorded Payment Method:
                  </p>
                  <p className="text-emerald-800 mt-0.5">
                    {selectedInvoice.paymentMethod} • TrxID:{" "}
                    <span className="font-mono font-bold">
                      {selectedInvoice.transactionRef}
                    </span>
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-200 bg-slate-50">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedInvoice(null)}
              >
                Close
              </Button>
              {selectedInvoice.balanceDue > 0 && (
                <Button
                  size="sm"
                  onClick={() => {
                    const inv = selectedInvoice;
                    setSelectedInvoice(null);
                    openPaymentModal(inv);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Receipt className="h-3.5 w-3.5 mr-1" />
                  Record Payment
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {paymentInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-100">
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
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                  Invoice
                </span>
                <span className="font-bold text-slate-900 text-sm">
                  {paymentInvoice.invoiceNumber} — {paymentInvoice.customerName}
                </span>
                <div className="flex justify-between mt-1 text-slate-600">
                  <span>Balance Due:</span>
                  <span className="font-bold text-rose-600">
                    {formatBDT(paymentInvoice.balanceDue)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Payment Amount to Record (BDT ৳) *
                </label>
                <input
                  type="number"
                  min={1}
                  max={paymentInvoice.balanceDue}
                  step={100}
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  className="w-full h-9 px-3 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 text-slate-900 font-semibold"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Payment Channel / Method *
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white text-slate-900"
                >
                  <option value="bKash Merchant">bKash Merchant Wallet</option>
                  <option value="Nagad">Nagad Wallet</option>
                  <option value="Bank Transfer (BEFTN/NPSB)">Bank Transfer (BEFTN/NPSB)</option>
                  <option value="Cash on Site">Cash on Site (Collected by Tech)</option>
                  <option value="Bank Cheque">Bank Cheque</option>
                </select>
              </div>

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
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Confirm & Apply Payment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Invoice Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-slate-900 text-base">
                  Issue Service Invoice
                </h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Customer / Account *
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Invoice Total (BDT ৳) *
                  </label>
                  <input
                    type="number"
                    min={100}
                    step={500}
                    required
                    value={newTotalAmount}
                    onChange={(e) => setNewTotalAmount(Number(e.target.value))}
                    className="w-full h-9 px-3 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 text-slate-900 font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Payment Due Date
                  </label>
                  <input
                    type="text"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full h-9 px-3 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 text-slate-900"
                  />
                </div>
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
                  Issue Invoice
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
