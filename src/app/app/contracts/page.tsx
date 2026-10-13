"use client";

import * as React from "react";
import {
  FileCheck2,
  Plus,
  Calendar,
  AlertCircle,
  Building2,
  Cpu,
  Sparkles,
  Eye,
  CheckCircle2,
  RefreshCw,
  X,
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
  DEMO_CONTRACTS,
  DEMO_CUSTOMERS,
  type DemoContract,
} from "@/lib/demo-data";

export default function ContractsPage() {
  const { toast } = useToast();
  const [contracts, setContracts] = React.useState<DemoContract[]>(DEMO_CONTRACTS);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("");

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [selectedContract, setSelectedContract] = React.useState<DemoContract | null>(null);

  // New Contract Form State
  const [newTitle, setNewTitle] = React.useState("");
  const [newCustomerId, setNewCustomerId] = React.useState(DEMO_CUSTOMERS[0].id);
  const [newContractType, setNewContractType] = React.useState<"Comprehensive" | "Non-Comprehensive" | "Labor Only">("Comprehensive");
  const [newUnitsCount, setNewUnitsCount] = React.useState(8);
  const [newInterval, setNewInterval] = React.useState<"Monthly" | "Quarterly" | "Bi-Monthly">("Quarterly");
  const [newAnnualValue, setNewAnnualValue] = React.useState(120000);
  const [newStartDate, setNewStartDate] = React.useState("01 Nov 2026");
  const [newEndDate, setNewEndDate] = React.useState("31 Oct 2027");

  const filteredContracts = contracts.filter((contract) => {
    const matchesSearch =
      !searchQuery ||
      contract.contractNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contract.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contract.customerName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = !statusFilter || contract.status === statusFilter;
    const matchesType = !typeFilter || contract.contractType === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  // Calculate Metrics
  const totalACV = contracts.reduce((acc, c) => acc + c.annualValue, 0);
  const totalCoveredUnits = contracts.reduce((acc, c) => acc + c.coveredUnitsCount, 0);
  const renewalDueCount = contracts.filter((c) => c.status === "renewal_due").length;

  const handleCreateContract = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      toast({
        title: "Validation Error",
        description: "Please specify a contract title or service scope.",
        type: "error",
      });
      return;
    }

    const customer = DEMO_CUSTOMERS.find((c) => c.id === newCustomerId)!;
    const newContract: DemoContract = {
      id: `amc-${Date.now()}`,
      contractNumber: `FO-AMC-${1000 + contracts.length + 1}`,
      title: newTitle.trim(),
      customerName: customer.name,
      contractType: newContractType,
      coveredUnitsCount: Number(newUnitsCount) || 1,
      interval: newInterval,
      annualValue: Number(newAnnualValue) || 50000,
      startDate: newStartDate,
      endDate: newEndDate,
      nextScheduledVisit: "15 Nov 2026",
      status: "active",
    };

    setContracts([newContract, ...contracts]);
    setIsCreateModalOpen(false);
    setNewTitle("");

    toast({
      title: "Contract Registered",
      description: `AMC Contract ${newContract.contractNumber} recorded for ${customer.name}.`,
      type: "success",
    });
  };

  const handleDispatchVisit = (contract: DemoContract) => {
    toast({
      title: "Routine Visit Scheduled",
      description: `Scheduled upcoming maintenance visit for ${contract.customerName} on ${contract.nextScheduledVisit}.`,
      type: "success",
    });
  };

  const handleRenewNotice = (contract: DemoContract) => {
    toast({
      title: "Renewal Notification Sent",
      description: `Drafted renewal agreement & quotation for ${contract.customerName}.`,
      type: "info",
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="AMC & Maintenance Contracts"
        description="Manage recurring preventive maintenance agreements for corporate offices, commercial outlets, and residential towers in Dhaka."
        actions={
          <Button
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            New AMC Agreement
          </Button>
        }
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Active AMC Agreements"
          value={contracts.filter((c) => c.status === "active").length}
          subtitle="Recurring maintenance accounts"
          icon={<FileCheck2 className="h-5 w-5 text-blue-600" />}
        />
        <MetricCard
          title="Covered Equipment Units"
          value={totalCoveredUnits}
          subtitle="Cassette, Split, VRF & Chillers"
          icon={<Cpu className="h-5 w-5 text-emerald-600" />}
        />
        <MetricCard
          title="Annual Contract Value (ACV)"
          value={formatBDT(totalACV)}
          subtitle="Contracted annual service fees"
          icon={<Sparkles className="h-5 w-5 text-indigo-600" />}
        />
        <MetricCard
          title="Renewals Due This Month"
          value={renewalDueCount}
          subtitle="Expiring agreements requiring review"
          icon={<AlertCircle className="h-5 w-5 text-amber-600" />}
        />
      </div>

      {/* Filter and Search Bar */}
      <SearchFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search AMC contract #, title, or client..."
        filterValue={statusFilter}
        onFilterChange={setStatusFilter}
        filterLabel="All Statuses"
        filterOptions={[
          { label: "Active", value: "active" },
          { label: "Renewal Due", value: "renewal_due" },
          { label: "Draft", value: "draft" },
        ]}
        resultsCount={filteredContracts.length}
        actions={
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-9 px-3 rounded-md border border-slate-200 bg-white text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-600"
          >
            <option value="">All Contract Types</option>
            <option value="Comprehensive">Comprehensive (Parts + Gas)</option>
            <option value="Non-Comprehensive">Non-Comprehensive (Service Only)</option>
            <option value="Labor Only">Labor Only</option>
          </select>
        }
      />

      {/* Contracts Grid / Cards */}
      {filteredContracts.length === 0 ? (
        <EmptyState
          icon={FileCheck2}
          title="No contracts found"
          description={
            searchQuery || statusFilter || typeFilter
              ? "No maintenance agreements match your current search filters."
              : "No recurring maintenance contracts created yet. Set up recurring agreements to lock in predictable service revenue."
          }
          action={
            <Button
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Create First AMC
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredContracts.map((contract) => (
            <Card
              key={contract.id}
              className="p-5 flex flex-col justify-between border-slate-200 hover:border-slate-300 transition-all shadow-xs hover:shadow-sm"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                      {contract.contractNumber}
                    </span>
                    <h3 className="font-semibold text-slate-900 text-base mt-2 line-clamp-1">
                      {contract.title}
                    </h3>
                  </div>
                  <StatusBadge status={contract.status} />
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="font-medium text-slate-800 truncate">
                    {contract.customerName}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                  <div className="bg-slate-50 p-2 rounded border border-slate-100">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                      Type & Interval
                    </span>
                    <span className="font-medium text-slate-700">
                      {contract.contractType} • {contract.interval}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded border border-slate-100">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                      Covered Units
                    </span>
                    <span className="font-semibold text-slate-800">
                      {contract.coveredUnitsCount} Units Under Care
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs py-1">
                  <div className="text-slate-500">
                    <span>Period: </span>
                    <span className="font-medium text-slate-700">
                      {contract.startDate} – {contract.endDate}
                    </span>
                  </div>
                </div>

                <div className="bg-blue-50/50 rounded-lg p-2.5 border border-blue-100/60 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-blue-600 shrink-0" />
                    <div>
                      <p className="text-[10px] text-blue-600 font-medium uppercase">
                        Next Routine Visit
                      </p>
                      <p className="font-semibold text-slate-800">
                        {contract.nextScheduledVisit}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 font-medium uppercase">
                      Annual Fee
                    </p>
                    <p className="font-bold text-slate-900 text-sm">
                      {formatBDT(contract.annualValue)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedContract(contract)}
                  className="flex-1 text-xs"
                >
                  <Eye className="h-3.5 w-3.5 mr-1 text-slate-500" />
                  View Terms
                </Button>
                {contract.status === "renewal_due" ? (
                  <Button
                    size="sm"
                    onClick={() => handleRenewNotice(contract)}
                    className="flex-1 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />
                    Renew AMC
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleDispatchVisit(contract)}
                    className="flex-1 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    Dispatch Visit
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Contract Details Drawer / Modal */}
      {selectedContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <div>
                <span className="font-mono text-xs font-bold text-blue-600">
                  {selectedContract.contractNumber}
                </span>
                <h3 className="font-bold text-slate-900 text-base">
                  {selectedContract.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedContract(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                    Client Name
                  </span>
                  <span className="font-semibold text-slate-800 text-sm">
                    {selectedContract.customerName}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                    Contract Status
                  </span>
                  <StatusBadge status={selectedContract.status} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                    Service Plan
                  </span>
                  <span className="font-medium text-slate-700">
                    {selectedContract.contractType}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                    Frequency
                  </span>
                  <span className="font-medium text-slate-700">
                    {selectedContract.interval} Routine Visits
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                    Units Under Agreement
                  </span>
                  <span className="font-medium text-slate-700">
                    {selectedContract.coveredUnitsCount} Units (Chillers, VRF & Splits)
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                    Annual Fee (BDT)
                  </span>
                  <span className="font-bold text-slate-900 text-sm">
                    {formatBDT(selectedContract.annualValue)}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <p className="font-semibold text-slate-700 mb-1">
                  Scope of Service Checklist:
                </p>
                <ul className="list-disc pl-4 space-y-1 text-slate-600">
                  <li>Regular scheduled chemical washing of evaporator & condenser coils.</li>
                  <li>Suction & discharge refrigerant pressure testing on each visit.</li>
                  <li>Electrical terminal retightening, contactor checking, capacitor rating audit.</li>
                  <li>Free emergency breakdown calls with 4-hour SLA response in Dhaka.</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-200 bg-slate-50">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedContract(null)}
              >
                Close
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setSelectedContract(null);
                  handleDispatchVisit(selectedContract);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Dispatch Visit
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* New AMC Agreement Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <FileCheck2 className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-slate-900 text-base">
                  New Annual Maintenance Contract (AMC)
                </h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateContract} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Contract Agreement Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Annual Preventive HVAC Maintenance — 12 Units"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 text-slate-900"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Select Customer / Client *
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
                    Contract Type
                  </label>
                  <select
                    value={newContractType}
                    onChange={(e) =>
                      setNewContractType(
                        e.target.value as "Comprehensive" | "Non-Comprehensive" | "Labor Only"
                      )
                    }
                    className="w-full h-9 px-3 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white text-slate-900"
                  >
                    <option value="Comprehensive">Comprehensive (Parts + Gas)</option>
                    <option value="Non-Comprehensive">Non-Comprehensive (Service Only)</option>
                    <option value="Labor Only">Labor Only</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Visit Frequency
                  </label>
                  <select
                    value={newInterval}
                    onChange={(e) =>
                      setNewInterval(
                        e.target.value as "Monthly" | "Quarterly" | "Bi-Monthly"
                      )
                    }
                    className="w-full h-9 px-3 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 bg-white text-slate-900"
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Bi-Monthly">Bi-Monthly</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Covered AC Units (Qty)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={newUnitsCount}
                    onChange={(e) => setNewUnitsCount(Number(e.target.value))}
                    className="w-full h-9 px-3 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Annual Value (BDT ৳)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={newAnnualValue}
                    onChange={(e) => setNewAnnualValue(Number(e.target.value))}
                    className="w-full h-9 px-3 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="text"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="w-full h-9 px-3 rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-600 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="text"
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
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
                  Save AMC Contract
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
