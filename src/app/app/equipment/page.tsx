"use client";

import * as React from "react";
import Link from "next/link";
import {
  Cpu,
  Plus,
  MapPin,
  Building,
  Edit2,
  Archive,
  X,
  Loader2,
  RefreshCw,
  Search,
  Filter,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useToast } from "@/components/ui/toast";
import {
  getEquipmentAssets,
  createEquipmentAsset,
  updateEquipmentAsset,
  archiveEquipmentAsset,
  type EquipmentAssetItem,
} from "@/features/equipment/actions";
import { getCustomers, type CustomerListItem } from "@/features/customers/actions";
import { getServiceSites, type ServiceSiteItem } from "@/features/service-sites/actions";

export default function EquipmentPage() {
  const { toast } = useToast();
  const [assets, setAssets] = React.useState<EquipmentAssetItem[]>([]);
  const [customers, setCustomers] = React.useState<CustomerListItem[]>([]);
  const [availableSites, setAvailableSites] = React.useState<ServiceSiteItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [conditionFilter, setConditionFilter] = React.useState("all");

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [assetToEdit, setAssetToEdit] = React.useState<EquipmentAssetItem | null>(null);
  const [assetToArchive, setAssetToArchive] = React.useState<EquipmentAssetItem | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Form State
  const [formCustomerId, setFormCustomerId] = React.useState("");
  const [formSiteId, setFormSiteId] = React.useState("");
  const [formBrand, setFormBrand] = React.useState("");
  const [formModel, setFormModel] = React.useState("");
  const [formSerialNumber, setFormSerialNumber] = React.useState("");
  const [formCapacity, setFormCapacity] = React.useState("2.0 Ton");
  const [formEquipmentType, setFormEquipmentType] = React.useState<
    "split_ac" | "cassette_ac" | "standing_ac" | "vrf_system" | "chiller"
  >("split_ac");
  const [formRefrigerant, setFormRefrigerant] = React.useState<"R32" | "R410A" | "R22">("R32");
  const [formLocation, setFormLocation] = React.useState("");
  const [formCondition, setFormCondition] = React.useState<
    "operational" | "needs_service" | "under_repair"
  >("operational");
  const [formNotes, setFormNotes] = React.useState("");

  const loadAssets = React.useCallback(async () => {
    setIsLoading(true);
    const res = await getEquipmentAssets({
      search: searchQuery,
      equipmentType: typeFilter,
      conditionStatus: conditionFilter,
    });

    if (res.error) {
      toast({
        title: "Error Loading Equipment",
        description: res.error,
        type: "error",
      });
    } else if (res.data) {
      setAssets(res.data);
    }
    setIsLoading(false);
  }, [searchQuery, typeFilter, conditionFilter, toast]);

  React.useEffect(() => {
    let active = true;
    getEquipmentAssets({
      search: searchQuery,
      equipmentType: typeFilter,
      conditionStatus: conditionFilter,
    }).then((res) => {
      if (active) {
        if (res.data) setAssets(res.data);
        setIsLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [searchQuery, typeFilter, conditionFilter]);

  // Load customers for the register modal
  React.useEffect(() => {
    async function fetchCustomersList() {
      const res = await getCustomers();
      if (res.data && res.data.length > 0) {
        setCustomers(res.data);
        setFormCustomerId(res.data[0].id);
      }
    }
    fetchCustomersList();
  }, []);

  // When customer changes in modal, load their sites
  React.useEffect(() => {
    if (!formCustomerId) return;
    async function fetchSites() {
      const res = await getServiceSites({ customerId: formCustomerId });
      if (res.data) {
        setAvailableSites(res.data);
        if (res.data.length > 0) {
          setFormSiteId(res.data[0].id);
        } else {
          setFormSiteId("");
        }
      }
    }
    fetchSites();
  }, [formCustomerId]);

  const handleRegisterAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formBrand.trim() || !formCustomerId || !formSiteId) {
      toast({
        title: "Validation Error",
        description: "Customer, service site location, and brand name are required.",
        type: "error",
      });
      return;
    }

    setIsSubmitting(true);
    const res = await createEquipmentAsset({
      customerId: formCustomerId,
      siteId: formSiteId,
      equipmentType: formEquipmentType,
      brand: formBrand.trim(),
      model: formModel.trim() || undefined,
      serialNumber: formSerialNumber.trim() || undefined,
      capacity: formCapacity.trim() || undefined,
      refrigerantType: formRefrigerant,
      locationDescription: formLocation.trim() || undefined,
      conditionStatus: formCondition,
      serviceNotes: formNotes.trim() || undefined,
    });
    setIsSubmitting(false);

    if (res.error) {
      toast({
        title: "Failed to Register Equipment",
        description: res.error,
        type: "error",
      });
    } else {
      toast({
        title: "Equipment Unit Registered",
        description: `${formBrand} ${formCapacity} unit added to asset registry.`,
        type: "success",
      });
      setIsAddModalOpen(false);
      setFormBrand("");
      setFormModel("");
      setFormSerialNumber("");
      setFormLocation("");
      setFormNotes("");
      loadAssets();
    }
  };

  const handleUpdateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetToEdit) return;

    setIsSubmitting(true);
    const res = await updateEquipmentAsset(assetToEdit.id, {
      brand: assetToEdit.brand,
      model: assetToEdit.model || undefined,
      serialNumber: assetToEdit.serialNumber || undefined,
      capacity: assetToEdit.capacity || undefined,
      locationDescription: assetToEdit.locationDescription || undefined,
      conditionStatus: assetToEdit.conditionStatus,
      serviceNotes: assetToEdit.serviceNotes || undefined,
    });
    setIsSubmitting(false);

    if (res.error) {
      toast({
        title: "Failed to Update Equipment",
        description: res.error,
        type: "error",
      });
    } else {
      toast({
        title: "Equipment Updated",
        description: `${assetToEdit.brand} unit details saved.`,
        type: "success",
      });
      setIsEditModalOpen(false);
      loadAssets();
    }
  };

  const handleArchiveConfirm = async () => {
    if (!assetToArchive) return;
    const res = await archiveEquipmentAsset(assetToArchive.id);
    if (res.error) {
      toast({
        title: "Failed to Archive Equipment",
        description: res.error,
        type: "error",
      });
    } else {
      toast({
        title: "Equipment Archived",
        description: `${assetToArchive.brand} ${assetToArchive.capacity || ""} archived. Historical service jobs preserved.`,
        type: "info",
      });
      setAssetToArchive(null);
      loadAssets();
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipment & Asset Registry"
        description="Comprehensive inventory of installed AC units, refrigeration systems, chillers, and Rooftop VRF units across customer sites."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadAssets()}
              className="text-slate-600 hover:text-slate-900"
              title="Refresh equipment registry"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={() => setIsAddModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Register Unit
            </Button>
          </div>
        }
      />

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search brand, model, serial, or room..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Filter className="h-3.5 w-3.5" />
            <span>Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
            >
              <option value="all">All Types</option>
              <option value="split_ac">Split Inverter AC</option>
              <option value="cassette_ac">Ceiling Cassette</option>
              <option value="standing_ac">Floor Standing</option>
              <option value="vrf_system">VRF / VRV System</option>
              <option value="chiller">Central Chiller</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>Condition:</span>
            <select
              value={conditionFilter}
              onChange={(e) => setConditionFilter(e.target.value)}
              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
            >
              <option value="all">All Conditions</option>
              <option value="operational">Operational</option>
              <option value="needs_service">Needs Service</option>
              <option value="under_repair">Under Repair</option>
            </select>
          </div>
        </div>
      </div>

      {/* Asset Cards Grid */}
      {isLoading ? (
        <div className="py-16 text-center text-slate-500 flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <p className="text-sm">Loading equipment inventory from Supabase...</p>
        </div>
      ) : assets.length === 0 ? (
        <Card className="border-slate-200">
          <CardContent className="p-8">
            <EmptyState
              icon={Cpu}
              title={searchQuery ? "No matching equipment found" : "No AC units registered yet"}
              description={
                searchQuery
                  ? "Try searching with a different serial number or clearing filters."
                  : "Register installed AC units and cooling systems to start tracking service histories and maintenance contracts."
              }
              action={
                searchQuery ? (
                  <Button variant="outline" size="sm" onClick={() => setSearchQuery("")}>
                    Clear Search
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => setIsAddModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Register First Unit
                  </Button>
                )
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {assets.map((asset) => (
            <Card
              key={asset.id}
              className="border-slate-200 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                      <Cpu className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono font-semibold uppercase text-slate-400">
                        {asset.assetTag || "UNIT"}
                      </span>
                      <h4 className="font-semibold text-slate-900 text-sm leading-snug">
                        {asset.brand} {asset.capacity || ""}
                      </h4>
                      <p className="text-xs text-slate-500 capitalize">
                        {asset.equipmentType.replace(/_/g, " ")} {asset.model ? `• ${asset.model}` : ""}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={asset.conditionStatus} />
                </div>

                <div className="space-y-1 text-xs text-slate-600 border-t border-slate-100 pt-2.5">
                  <div className="flex items-center gap-1.5">
                    <Building className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <Link
                      href={`/app/customers/${asset.customerId}`}
                      className="font-medium text-slate-800 hover:text-blue-600 transition-colors truncate"
                    >
                      {asset.customerName}
                    </Link>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">
                      {asset.siteName} {asset.siteArea ? `(${asset.siteArea})` : ""}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-slate-50/80 p-2.5 rounded-lg border border-slate-100 text-[11px]">
                  <div>
                    <span className="text-slate-400 block">Serial No</span>
                    <span className="font-mono font-medium text-slate-800">
                      {asset.serialNumber || "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Gas / Refrigerant</span>
                    <span className="font-medium text-slate-800">
                      {asset.refrigerantType || "R32 / Standard"}
                    </span>
                  </div>
                  {asset.locationDescription && (
                    <div className="col-span-2 text-slate-600">
                      <span className="text-slate-400">Location: </span>
                      <span className="font-medium">{asset.locationDescription}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-400">
                  Added {new Date(asset.createdAt).toLocaleDateString("en-GB")}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAssetToEdit(asset);
                      setIsEditModalOpen(true);
                    }}
                    className="h-7 w-7 p-0 text-slate-500 hover:text-slate-900"
                    title="Edit unit"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAssetToArchive(asset)}
                    className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600"
                    title="Archive unit"
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Register Equipment Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in-0 duration-150">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Cpu className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Register AC / Cooling Unit</h3>
                  <p className="text-xs text-slate-500">Record equipment specifications in the registry</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterAsset} className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Client / Customer *</label>
                  <select
                    required
                    value={formCustomerId}
                    onChange={(e) => setFormCustomerId(e.target.value)}
                    className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Service Location *</label>
                  <select
                    required
                    value={formSiteId}
                    onChange={(e) => setFormSiteId(e.target.value)}
                    className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  >
                    {availableSites.length === 0 ? (
                      <option value="">No sites found (Add site first)</option>
                    ) : (
                      availableSites.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.siteName} ({s.area || s.city})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Brand *</label>
                  <Input
                    required
                    placeholder="Gree, Daikin, General, Carrier"
                    value={formBrand}
                    onChange={(e) => setFormBrand(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Capacity / Tonnage</label>
                  <Input
                    placeholder="1.5 Ton, 2.0 Ton, 5.0 Ton"
                    value={formCapacity}
                    onChange={(e) => setFormCapacity(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Equipment Type</label>
                  <select
                    value={formEquipmentType}
                    onChange={(e) =>
                      setFormEquipmentType(
                        e.target.value as "split_ac" | "cassette_ac" | "standing_ac" | "vrf_system" | "chiller"
                      )
                    }
                    className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="split_ac">Split Inverter AC</option>
                    <option value="cassette_ac">Ceiling Cassette AC</option>
                    <option value="standing_ac">Floor Standing AC</option>
                    <option value="vrf_system">VRF / VRV System</option>
                    <option value="chiller">Central Chiller</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Refrigerant Gas</label>
                  <select
                    value={formRefrigerant}
                    onChange={(e) => setFormRefrigerant(e.target.value as "R32" | "R410A" | "R22")}
                    className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="R32">R32 (Eco-Friendly)</option>
                    <option value="R410A">R410A</option>
                    <option value="R22">R22</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Model / Inverter Series</label>
                  <Input
                    placeholder="e.g. Lomo Inverter Series"
                    value={formModel}
                    onChange={(e) => setFormModel(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Serial Number</label>
                  <Input
                    placeholder="SN-892178"
                    value={formSerialNumber}
                    onChange={(e) => setFormSerialNumber(e.target.value)}
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700">Location in Facility</label>
                  <Input
                    placeholder="e.g. Server Room 3rd Floor / Accounts Dept"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700">Condition Status</label>
                  <select
                    value={formCondition}
                    onChange={(e) =>
                      setFormCondition(e.target.value as "operational" | "needs_service" | "under_repair")
                    }
                    className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="operational">Operational (Good Working Condition)</option>
                    <option value="needs_service">Needs Service (Due for Master Wash / Gas Top-up)</option>
                    <option value="under_repair">Under Repair (Breakdown / Compressor Issue)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Service Notes</label>
                <textarea
                  rows={2}
                  placeholder="Installed in 2024. Outdoor unit on eastern parapet."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting || !formSiteId}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                      Registering...
                    </>
                  ) : (
                    "Register Equipment"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Equipment Modal */}
      {isEditModalOpen && assetToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in-0 duration-150">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900">Edit Equipment Specs</h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateAsset} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Brand *</label>
                  <Input
                    required
                    value={assetToEdit.brand}
                    onChange={(e) => setAssetToEdit({ ...assetToEdit, brand: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Capacity</label>
                  <Input
                    value={assetToEdit.capacity || ""}
                    onChange={(e) => setAssetToEdit({ ...assetToEdit, capacity: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Model</label>
                  <Input
                    value={assetToEdit.model || ""}
                    onChange={(e) => setAssetToEdit({ ...assetToEdit, model: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Serial Number</label>
                  <Input
                    value={assetToEdit.serialNumber || ""}
                    onChange={(e) =>
                      setAssetToEdit({ ...assetToEdit, serialNumber: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Location in Facility</label>
                <Input
                  value={assetToEdit.locationDescription || ""}
                  onChange={(e) =>
                    setAssetToEdit({ ...assetToEdit, locationDescription: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Condition Status</label>
                <select
                  value={assetToEdit.conditionStatus}
                  onChange={(e) =>
                    setAssetToEdit({
                      ...assetToEdit,
                      conditionStatus: e.target.value as EquipmentAssetItem["conditionStatus"],
                    })
                  }
                  className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
                >
                  <option value="operational">Operational</option>
                  <option value="needs_service">Needs Service</option>
                  <option value="under_repair">Under Repair</option>
                  <option value="decommissioned">Decommissioned</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Service Notes</label>
                <textarea
                  rows={2}
                  value={assetToEdit.serviceNotes || ""}
                  onChange={(e) =>
                    setAssetToEdit({ ...assetToEdit, serviceNotes: e.target.value })
                  }
                  className="w-full rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Archive Equipment Confirmation */}
      <ConfirmModal
        isOpen={Boolean(assetToArchive)}
        onClose={() => setAssetToArchive(null)}
        onConfirm={handleArchiveConfirm}
        title={`Archive ${assetToArchive?.brand} ${assetToArchive?.capacity || "Unit"}?`}
        description="Archiving this unit preserves all checklist logs, technician maintenance notes, and previous service history without deleting database records."
        confirmText="Archive Unit"
        variant="danger"
      />
    </div>
  );
}
