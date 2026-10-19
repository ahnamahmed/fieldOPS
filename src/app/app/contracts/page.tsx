"use client";

import * as React from "react";
import Link from "next/link";
import {
  FileCheck2,
  Plus,
  Calendar,
  AlertCircle,
  Building2,
  Cpu,
  Sparkles,
  Eye,
  RefreshCw,
  X,
  Clock,
  ArrowRight,
  Archive,
  Wrench,
  Search,
  Filter,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import { useToast } from "@/components/ui/toast";
import { formatBDT } from "@/lib/formatters";
import {
  getContracts,
  getContractDetail,
  createContract,
  renewContract,
  archiveContract,
  convertVisitToJob,
  seedSampleContractData,
} from "@/features/contracts/actions";
import { getCustomers, type CustomerListItem } from "@/features/customers/actions";
import type {
  ContractSummary,
  ContractDetail,
  ContractType,
  BillingFrequency,
  ServiceFrequency,
} from "@/features/contracts/types";

export default function ContractsPage() {
  const { toast } = useToast();

  const [isLoading, setIsLoading] = React.useState(true);
  const [contracts, setContracts] = React.useState<ContractSummary[]>([]);

  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");

  // Detail Modal
  const [selectedContractId, setSelectedContractId] = React.useState<string | null>(null);
  const [contractDetail, setContractDetail] = React.useState<ContractDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = React.useState(false);

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);
  const [customers, setCustomers] = React.useState<CustomerListItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = React.useState<string>("");
  const [title, setTitle] = React.useState("");
  const [contractType, setContractType] = React.useState<ContractType>("comprehensive");
  const [serviceFrequency, setServiceFrequency] = React.useState<ServiceFrequency>("quarterly");
  const [billingFrequency, setBillingFrequency] = React.useState<BillingFrequency>("annually");
  const [contractAmount, setContractAmount] = React.useState<number>(120000);
  const [startDate, setStartDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = React.useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split("T")[0];
  });
  const [description, setDescription] = React.useState("");
  const [terms, setTerms] = React.useState(
    "Includes quarterly full servicing, gas pressure check, electrical coil inspection, and priority 4-hour breakdown response."
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Renewal Modal
  const [renewModalOpen, setRenewModalOpen] = React.useState(false);
  const [renewContractTarget, setRenewContractTarget] = React.useState<ContractSummary | null>(null);
  const [renewStartDate, setRenewStartDate] = React.useState("");
  const [renewEndDate, setRenewEndDate] = React.useState("");
  const [renewAmount, setRenewAmount] = React.useState<number>(0);
  const [renewNotes, setRenewNotes] = React.useState("");
  const [isRenewing, setIsRenewing] = React.useState(false);

  // Conversion Action State
  const [convertingVisitId, setConvertingVisitId] = React.useState<string | null>(null);

  // Calculate live stats from active contracts
  const stats = React.useMemo(() => {
    let totalActive = 0;
    let totalCoveredUnits = 0;
    let annualContractValue = 0;
    let renewalDueCount = 0;

    for (const c of contracts) {
      if (c.status === "active") totalActive++;
      if (c.status === "renewal_due") renewalDueCount++;
      totalCoveredUnits += c.coveredAssetsCount;
      annualContractValue += c.totalContractValue;
    }

    return {
      totalActive,
      totalCoveredUnits,
      annualContractValue,
      renewalDueCount,
    };
  }, [contracts]);

  // Reload contracts
  const reloadContractsData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getContracts({
        status: statusFilter === "all" ? undefined : statusFilter,
        search: searchQuery || undefined,
        contractType: typeFilter === "all" ? undefined : typeFilter,
      });

      if (res.success && res.data) {
        setContracts(res.data);
      } else {
        toast({
          title: "Contracts",
          description: res.error || "Failed to load contracts",
          type: "error",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Network or server error while loading contracts",
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, statusFilter, typeFilter, toast]);

  React.useEffect(() => {
    let active = true;
    getContracts({
      status: statusFilter === "all" ? undefined : statusFilter,
      search: searchQuery || undefined,
      contractType: typeFilter === "all" ? undefined : typeFilter,
    }).then((res) => {
      if (active) {
        if (res.success && res.data) {
          setContracts(res.data);
        }
        setIsLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [searchQuery, statusFilter, typeFilter]);

  // Load customers for create modal
  React.useEffect(() => {
    if (isCreateOpen && customers.length === 0) {
      getCustomers().then((res) => {
        if (res.data) {
          setCustomers(res.data);
          if (res.data.length > 0 && !selectedCustomerId) {
            setSelectedCustomerId(res.data[0].id);
          }
        }
      });
    }
  }, [isCreateOpen, customers.length, selectedCustomerId]);

  // Load detail
  const handleViewDetail = async (contractId: string) => {
    setSelectedContractId(contractId);
    setIsLoadingDetail(true);
    try {
      const res = await getContractDetail(contractId);
      if (res.success && res.data) {
        setContractDetail(res.data);
      } else {
        toast({
          title: "Error",
          description: res.error || "Failed to load contract details",
          type: "error",
        });
      }
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Convert planned visit to job
  const handleConvertVisit = async (visitId: string) => {
    setConvertingVisitId(visitId);
    try {
      const res = await convertVisitToJob({ visitId });
      if (res.success) {
        toast({
          title: "Job Dispatched!",
          description: "Created Work Order with standard AC maintenance checklist.",
          type: "success",
        });
        // Reload detail
        if (selectedContractId) {
          handleViewDetail(selectedContractId);
        }
        reloadContractsData();
      } else {
        toast({
          title: "Conversion Failed",
          description: res.error || "Could not convert visit into job",
          type: "error",
        });
      }
    } finally {
      setConvertingVisitId(null);
    }
  };

  // Open renew modal
  const handleOpenRenew = (contract: ContractSummary) => {
    setRenewContractTarget(contract);
    const prevEnd = new Date(contract.endDate);
    const newStart = new Date(prevEnd);
    newStart.setDate(newStart.getDate() + 1);
    const newEnd = new Date(newStart);
    newEnd.setFullYear(newEnd.getFullYear() + 1);

    setRenewStartDate(newStart.toISOString().split("T")[0]);
    setRenewEndDate(newEnd.toISOString().split("T")[0]);
    setRenewAmount(contract.totalContractValue || 120000);
    setRenewNotes(`Renewed annual contract for year ${newStart.getFullYear()}-${newEnd.getFullYear()}`);
    setRenewModalOpen(true);
  };

  // Submit renewal
  const handleSubmitRenew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewContractTarget) return;

    setIsRenewing(true);
    try {
      const res = await renewContract({
        contractId: renewContractTarget.id,
        newStartDate: renewStartDate,
        newEndDate: renewEndDate,
        newAmount: Number(renewAmount),
        renewalNotes: renewNotes,
      });

      if (res.success) {
        toast({
          title: "Contract Renewed!",
          description: "Generated planned maintenance visits for the new contract period.",
          type: "success",
        });
        setRenewModalOpen(false);
        reloadContractsData();
      } else {
        toast({
          title: "Renewal Failed",
          description: res.error || "Could not renew contract",
          type: "error",
        });
      }
    } finally {
      setIsRenewing(false);
    }
  };

  // Archive
  const handleArchive = async (contractId: string) => {
    if (!confirm("Are you sure you want to archive this maintenance contract? Past service history will be preserved.")) {
      return;
    }
    const res = await archiveContract(contractId);
    if (res.success) {
      toast({
        title: "Contract Archived",
        description: "The contract has been moved to archive.",
        type: "success",
      });
      reloadContractsData();
      if (selectedContractId === contractId) setSelectedContractId(null);
    } else {
      toast({
        title: "Action Failed",
        description: res.error || "Could not archive contract",
        type: "error",
      });
    }
  };

  // Seed sample
  const handleSeedSample = async () => {
    setIsLoading(true);
    try {
      const res = await seedSampleContractData();
      if (res.success) {
        toast({
          title: "Sample AMC Contract Created",
          description: "Created sample commercial contract with planned visits and AC assets.",
          type: "success",
        });
        reloadContractsData();
      } else {
        toast({
          title: "Seed Failed",
          description: res.error || "Could not seed contract data",
          type: "error",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Submit create
  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !selectedCustomerId) {
      toast({
        title: "Validation Error",
        description: "Please specify contract title and select a customer.",
        type: "error",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createContract({
        customerId: selectedCustomerId,
        contractName: title.trim(),
        contractType,
        serviceFrequency,
        billingFrequency,
        contractAmount: Number(contractAmount) || 0,
        startDate,
        endDate,
        description,
        terms,
        assetIds: [],
      });

      if (res.success) {
        toast({
          title: "AMC Contract Created!",
          description: "Contract created with scheduled maintenance visits.",
          type: "success",
        });
        setIsCreateOpen(false);
        setTitle("");
        reloadContractsData();
      } else {
        toast({
          title: "Failed to Create",
          description: res.error || "Could not create contract",
          type: "error",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maintenance Contracts (AMC)"
        description="Manage recurring service agreements, multi-unit coverage, automated visit schedules, and renewals."
        badge={
          <span className="rounded bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-800">
            Preventative Maintenance
          </span>
        }
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSeedSample}
              disabled={isLoading}
              className="text-xs border-slate-200 hover:bg-slate-50 text-slate-700"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
              Load Sample AMC
            </Button>
            <Button
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-xs text-xs"
            >
              <Plus className="h-4 w-4 mr-1" />
              New AMC Contract
            </Button>
          </div>
        }
      />

      {/* Metrics Grid */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Active Contracts"
          value={stats.totalActive}
          subtitle="Corporate & Commercial AMCs"
          icon={<FileCheck2 className="h-5 w-5" />}
          iconBgColor="bg-teal-50 text-teal-700"
        />
        <MetricCard
          title="Covered AC & Chillers"
          value={stats.totalCoveredUnits}
          subtitle="Maintained equipment units"
          icon={<Cpu className="h-5 w-5" />}
          iconBgColor="bg-blue-50 text-blue-700"
        />
        <MetricCard
          title="Annual Contract Value"
          value={formatBDT(stats.annualContractValue)}
          subtitle="Contracted recurring revenue"
          icon={<Building2 className="h-5 w-5" />}
          iconBgColor="bg-emerald-50 text-emerald-700"
        />
        <MetricCard
          title="Renewals Due (30 Days)"
          value={stats.renewalDueCount}
          subtitle="Expiring agreements"
          icon={<AlertCircle className="h-5 w-5" />}
          iconBgColor="bg-amber-50 text-amber-700"
          badge={stats.renewalDueCount > 0 ? "Action Needed" : undefined}
        />
      </div>

      {/* Search & Filter Controls */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by contract number, title, or client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="renewal_due">Renewal Due</option>
            <option value="renewed">Renewed</option>
            <option value="expired">Expired</option>
            <option value="archived">Archived</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs py-1.5 px-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="all">All Types</option>
            <option value="comprehensive">Comprehensive</option>
            <option value="non_comprehensive">Non-Comprehensive</option>
            <option value="labor_only">Labor Only</option>
          </select>

          <Button
            variant="ghost"
            size="sm"
            onClick={reloadContractsData}
            disabled={isLoading}
            className="h-8 px-2 text-slate-500 hover:text-slate-800"
            title="Refresh contracts"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Main Contracts List */}
      {isLoading && contracts.length === 0 ? (
        <div className="py-20 text-center text-slate-500 text-sm">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-600" />
          Loading maintenance contracts from database...
        </div>
      ) : contracts.length === 0 ? (
        <EmptyState
          title="No Maintenance Contracts Found"
          description="Create your first AC maintenance contract to automate recurring service visits, track covered equipment, and manage renewals."
          action={
            <Button
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="h-4 w-4 mr-1" />
              Create Contract
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {contracts.map((contract) => (
            <Card
              key={contract.id}
              className="border-slate-200/90 shadow-2xs hover:border-slate-300 transition-colors"
            >
              <div className="p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                      {contract.contractNumber}
                    </span>
                    <StatusBadge status={contract.status} />
                    <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded capitalize">
                      {contract.contractType.replace("_", " ")}
                    </span>
                    <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded capitalize">
                      {contract.serviceFrequency} Servicing
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>
                      {contract.startDate} – {contract.endDate}
                    </span>
                  </div>
                </div>

                <div className="mt-3">
                  <h3 className="font-bold text-slate-900 text-base">
                    {contract.contractName || contract.title}
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5 font-medium">
                    Client: <span className="text-slate-900 font-semibold">{contract.customerName}</span>
                    {contract.siteName && (
                      <span className="text-slate-500 ml-1.5">• Site: {contract.siteName}</span>
                    )}
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-3 border-t border-slate-100">
                  <div>
                    <span className="text-slate-400 text-[11px] block">Covered Equipment</span>
                    <span className="font-semibold text-slate-800 flex items-center gap-1 mt-0.5">
                      <Cpu className="h-3.5 w-3.5 text-slate-500" />
                      {contract.coveredAssetsCount} Units
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 text-[11px] block">Annual Value</span>
                    <span className="font-bold text-slate-900 mt-0.5 block">
                      {formatBDT(contract.totalContractValue || contract.contractAmount)}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 text-[11px] block">Next Scheduled Service</span>
                    <span className="font-semibold text-teal-700 mt-0.5 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-teal-500" />
                      {contract.nextScheduledVisit || "All visits completed"}
                    </span>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewDetail(contract.id)}
                      className="text-xs h-8 px-2.5 border-slate-200 text-slate-700 hover:bg-slate-50"
                    >
                      <Eye className="h-3.5 w-3.5 mr-1 text-slate-500" />
                      Visits ({contract.plannedVisitsCount || 0})
                    </Button>

                    {contract.status === "renewal_due" || contract.status === "active" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenRenew(contract)}
                        className="text-xs h-8 px-2.5 border-amber-300 text-amber-800 hover:bg-amber-50"
                      >
                        <RefreshCw className="h-3.5 w-3.5 mr-1" />
                        Renew
                      </Button>
                    ) : null}

                    {contract.status !== "archived" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleArchive(contract.id)}
                        className="text-xs h-8 px-2 text-slate-400 hover:text-rose-600"
                        title="Archive Contract"
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* DETAIL SLIDE-OVER / MODAL */}
      {selectedContractId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto shadow-xl relative space-y-5">
            <button
              onClick={() => {
                setSelectedContractId(null);
                setContractDetail(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="h-5 w-5" />
            </button>

            {isLoadingDetail || !contractDetail ? (
              <div className="py-20 text-center text-slate-500">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-600" />
                Loading contract visit timeline and covered units...
              </div>
            ) : (
              <>
                <div className="border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                      {contractDetail.contractNumber}
                    </span>
                    <StatusBadge status={contractDetail.status} />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">
                    {contractDetail.contractName || contractDetail.title}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Client: <strong className="text-slate-800">{contractDetail.customerName}</strong>
                    {contractDetail.siteName && ` • Facility: ${contractDetail.siteName}`}
                  </p>
                </div>

                {/* Key specs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-lg text-xs">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Contract Period</span>
                    <span className="font-semibold text-slate-800">
                      {contractDetail.startDate} to {contractDetail.endDate}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Service Interval</span>
                    <span className="font-semibold text-slate-800 capitalize">
                      {contractDetail.serviceFrequency}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Contract Value</span>
                    <span className="font-bold text-slate-900">
                      {formatBDT(contractDetail.contractAmount || contractDetail.totalContractValue)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Total Visits</span>
                    <span className="font-semibold text-teal-700">
                      {contractDetail.plannedVisits.length} Scheduled
                    </span>
                  </div>
                </div>

                {/* Covered Equipment */}
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Cpu className="h-4 w-4 text-blue-600" />
                    Covered Equipment Units ({contractDetail.coveredAssets.length})
                  </h4>
                  {contractDetail.coveredAssets.length === 0 ? (
                    <p className="text-xs text-slate-500 italic bg-slate-50 p-2.5 rounded">
                      No individual assets linked. Contract covers facility-wide AC equipment.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {contractDetail.coveredAssets.map((asset) => (
                        <div
                          key={asset.id}
                          className="p-2.5 rounded-lg border border-slate-200/80 bg-white"
                        >
                          <p className="font-bold text-slate-800">
                            {asset.brand} {asset.model || asset.equipmentType}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {asset.capacity || "Standard Capacity"} • Tag: {asset.assetTag || "N/A"}
                          </p>
                          {asset.locationDescription && (
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Loc: {asset.locationDescription}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Planned Visits Schedule */}
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-teal-600" />
                    Service Visit Schedule & Job Dispatch
                  </h4>
                  <div className="space-y-2">
                    {contractDetail.plannedVisits.map((visit) => {
                      const isOverdue =
                        visit.status !== "completed" &&
                        visit.plannedDate < new Date().toISOString().split("T")[0];

                      return (
                        <div
                          key={visit.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50/50 gap-2 text-xs"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-800">
                                Visit #{visit.visitNumber}: {visit.title}
                              </span>
                              <span
                                className={`px-2 py-0.5 text-[10px] font-semibold rounded ${
                                  visit.status === "completed"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : visit.status === "job_created"
                                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                                    : isOverdue
                                    ? "bg-rose-50 text-rose-700 border border-rose-200"
                                    : "bg-slate-100 text-slate-700"
                                }`}
                              >
                                {isOverdue && visit.status !== "job_created"
                                  ? "Overdue"
                                  : visit.status.replace("_", " ")}
                              </span>
                            </div>
                            <p className="text-slate-500 text-[11px]">
                              Scheduled Target:{" "}
                              <strong className="text-slate-700">{visit.plannedDate}</strong>
                              {visit.jobNumber && (
                                <span className="ml-2 text-blue-600 font-mono font-bold">
                                  Linked Job: {visit.jobNumber}
                                </span>
                              )}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            {visit.jobId ? (
                              <Link href={`/tech/jobs/${visit.jobId}`}>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                                >
                                  View Job Card
                                  <ArrowRight className="h-3 w-3 ml-1" />
                                </Button>
                              </Link>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => handleConvertVisit(visit.id)}
                                disabled={convertingVisitId === visit.id}
                                className="h-7 text-xs bg-teal-600 hover:bg-teal-700 text-white"
                              >
                                <Wrench className="h-3 w-3 mr-1" />
                                {convertingVisitId === visit.id
                                  ? "Dispatching..."
                                  : "Convert to Job"}
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Contract Terms */}
                {contractDetail.terms && (
                  <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600 border border-slate-200/80">
                    <p className="font-semibold text-slate-800 mb-1">Contract Scope & Terms:</p>
                    <p className="whitespace-pre-line text-[11px] leading-relaxed">
                      {contractDetail.terms}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* CREATE CONTRACT MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-xl w-full p-6 max-h-[90vh] overflow-y-auto shadow-xl relative">
            <button
              onClick={() => setIsCreateOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-lg font-bold text-slate-900 mb-1">
              Create New Maintenance Contract (AMC)
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Defines scheduled preventative visits, covered units, and billing terms.
            </p>

            <form onSubmit={handleSubmitCreate} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Contract Title / Description *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Annual HVAC Maintenance Agreement 2026-2027"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full p-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Optional Scope Summary
                </label>
                <input
                  type="text"
                  placeholder="e.g. Preventative chiller and VRF maintenance for main building"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Customer / Corporate Client *
                </label>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full p-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName ? `${c.companyName} (${c.contactName})` : c.contactName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Contract Type
                  </label>
                  <select
                    value={contractType}
                    onChange={(e) => setContractType(e.target.value as ContractType)}
                    className="w-full p-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                  >
                    <option value="comprehensive">Comprehensive (Parts + Labor)</option>
                    <option value="non_comprehensive">Non-Comprehensive (Labor Only)</option>
                    <option value="labor_only">Inspection & Labor Only</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Service Frequency *
                  </label>
                  <select
                    value={serviceFrequency}
                    onChange={(e) => setServiceFrequency(e.target.value as ServiceFrequency)}
                    className="w-full p-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white font-medium text-teal-700"
                  >
                    <option value="monthly">Monthly (12 visits/yr)</option>
                    <option value="bi_monthly">Bi-Monthly (6 visits/yr)</option>
                    <option value="quarterly">Quarterly (4 visits/yr)</option>
                    <option value="half_yearly">Half-Yearly (2 visits/yr)</option>
                    <option value="annually">Annual (1 visit/yr)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full p-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    End Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full p-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Contract Amount (BDT) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={contractAmount}
                    onChange={(e) => setContractAmount(Number(e.target.value))}
                    className="w-full p-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Billing Cycle
                  </label>
                  <select
                    value={billingFrequency}
                    onChange={(e) => setBillingFrequency(e.target.value as BillingFrequency)}
                    className="w-full p-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                  >
                    <option value="annually">Annual Advance</option>
                    <option value="half_yearly">Half-Yearly</option>
                    <option value="quarterly">Quarterly Installments</option>
                    <option value="monthly">Monthly Billing</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Scope & Service Terms
                </label>
                <textarea
                  rows={2}
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  className="w-full p-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isSubmitting ? "Generating Schedule..." : "Create & Generate Visits"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RENEW MODAL */}
      {renewModalOpen && renewContractTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl relative space-y-4">
            <button
              onClick={() => setRenewModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="h-5 w-5" />
            </button>

            <div>
              <h2 className="text-lg font-bold text-slate-900">Renew Contract</h2>
              <p className="text-xs text-slate-500">
                Renewing {renewContractTarget.contractNumber} for client{" "}
                <strong className="text-slate-700">{renewContractTarget.customerName}</strong>
              </p>
            </div>

            <form onSubmit={handleSubmitRenew} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  New Start Date *
                </label>
                <input
                  type="date"
                  required
                  value={renewStartDate}
                  onChange={(e) => setRenewStartDate(e.target.value)}
                  className="w-full p-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  New End Date *
                </label>
                <input
                  type="date"
                  required
                  value={renewEndDate}
                  onChange={(e) => setRenewEndDate(e.target.value)}
                  className="w-full p-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  New Annual Amount (BDT) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  required
                  value={renewAmount}
                  onChange={(e) => setRenewAmount(Number(e.target.value))}
                  className="w-full p-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Renewal Notes
                </label>
                <textarea
                  rows={2}
                  value={renewNotes}
                  onChange={(e) => setRenewNotes(e.target.value)}
                  className="w-full p-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRenewModalOpen(false)}
                  disabled={isRenewing}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isRenewing}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {isRenewing ? "Renewing..." : "Confirm & Generate Visits"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
