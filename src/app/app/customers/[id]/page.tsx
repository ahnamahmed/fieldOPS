"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Phone,
  Mail,
  MapPin,
  Plus,
  ArrowLeft,
  Cpu,
  Wrench,
  CreditCard,
  Edit2,
  Archive,
  X,
  Loader2,
  AlertCircle,
  FileText,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useToast } from "@/components/ui/toast";
import {
  getCustomerById,
  updateCustomer,
  archiveCustomer,
  type CustomerDetail,
} from "@/features/customers/actions";
import {
  createServiceSite,
  archiveServiceSite,
} from "@/features/service-sites/actions";
import {
  createEquipmentAsset,
  archiveEquipmentAsset,
} from "@/features/equipment/actions";

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const customerId = params.id as string;

  const [customer, setCustomer] = React.useState<CustomerDetail | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<"sites" | "equipment" | "jobs" | "billing">("sites");

  // Modals state
  const [isAddSiteModalOpen, setIsAddSiteModalOpen] = React.useState(false);
  const [isAddAssetModalOpen, setIsAddAssetModalOpen] = React.useState(false);
  const [isEditCustomerModalOpen, setIsEditCustomerModalOpen] = React.useState(false);
  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = React.useState(false);
  const [siteToArchive, setSiteToArchive] = React.useState<string | null>(null);
  const [assetToArchive, setAssetToArchive] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Edit Customer Form State
  const [editCustomerForm, setEditCustomerForm] = React.useState({
    name: "",
    phone: "",
    alternatePhone: "",
    email: "",
    customerType: "commercial" as "residential" | "commercial" | "corporate",
    notes: "",
  });

  // New Site Form State
  const [siteForm, setSiteForm] = React.useState({
    siteName: "",
    address: "",
    area: "",
    city: "Dhaka",
    postcode: "",
    landmark: "",
    siteContactName: "",
    siteContactPhone: "",
    accessNotes: "",
  });

  // New Asset Form State
  const [assetForm, setAssetForm] = React.useState({
    siteId: "",
    brand: "",
    model: "",
    serialNumber: "",
    capacity: "2.0 Ton",
    equipmentType: "split_ac" as "split_ac" | "cassette_ac" | "standing_ac" | "vrf_system" | "chiller",
    refrigerantType: "R32" as "R32" | "R410A" | "R22",
    locationDescription: "",
    installationDate: "",
    warrantyExpiry: "",
    conditionStatus: "operational" as "operational" | "needs_service" | "under_repair",
    serviceNotes: "",
  });

  const loadCustomer = React.useCallback(async () => {
    const res = await getCustomerById(customerId);
    if (res.error) {
      toast({
        title: "Error Loading Customer",
        description: res.error,
        type: "error",
      });
    } else if (res.data) {
      const custData = res.data;
      setCustomer(custData);
      if (custData.serviceSites.length > 0 && !assetForm.siteId) {
        setAssetForm((prev) => ({ ...prev, siteId: custData.serviceSites[0].id }));
      }
    }
  }, [customerId, assetForm.siteId, toast]);

  React.useEffect(() => {
    let active = true;
    getCustomerById(customerId).then((res) => {
      if (active) {
        if (res.error) {
          toast({
            title: "Error Loading Customer",
            description: res.error,
            type: "error",
          });
        } else if (res.data) {
          setCustomer(res.data);
          if (res.data.serviceSites.length > 0) {
            setAssetForm((prev) => ({ ...prev, siteId: res.data!.serviceSites[0].id }));
          }
        }
        setIsLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [customerId, toast]);

  const handleAddSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteForm.siteName.trim() || !siteForm.address.trim()) {
      toast({
        title: "Validation Error",
        description: "Site location name and address are required.",
        type: "error",
      });
      return;
    }

    setIsSubmitting(true);
    const res = await createServiceSite({
      customerId,
      siteName: siteForm.siteName,
      address: siteForm.address,
      area: siteForm.area || undefined,
      city: siteForm.city,
      district: "Dhaka",
      postcode: siteForm.postcode || undefined,
      landmark: siteForm.landmark || undefined,
      siteContactName: siteForm.siteContactName || undefined,
      siteContactPhone: siteForm.siteContactPhone || undefined,
      accessNotes: siteForm.accessNotes || undefined,
    });
    setIsSubmitting(false);

    if (res.error) {
      toast({
        title: "Failed to Add Site",
        description: res.error,
        type: "error",
      });
    } else {
      toast({
        title: "Site Location Added",
        description: `${siteForm.siteName} added to ${customer?.name}.`,
        type: "success",
      });
      setIsAddSiteModalOpen(false);
      setSiteForm({
        siteName: "",
        address: "",
        area: "",
        city: "Dhaka",
        postcode: "",
        landmark: "",
        siteContactName: "",
        siteContactPhone: "",
        accessNotes: "",
      });
      loadCustomer();
    }
  };

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetForm.brand.trim() || !assetForm.siteId) {
      toast({
        title: "Validation Error",
        description: "Equipment brand and service site are required.",
        type: "error",
      });
      return;
    }

    setIsSubmitting(true);
    const res = await createEquipmentAsset({
      customerId,
      siteId: assetForm.siteId,
      equipmentType: assetForm.equipmentType,
      brand: assetForm.brand,
      model: assetForm.model || undefined,
      serialNumber: assetForm.serialNumber || undefined,
      capacity: assetForm.capacity || undefined,
      refrigerantType: assetForm.refrigerantType,
      locationDescription: assetForm.locationDescription || undefined,
      installationDate: assetForm.installationDate || undefined,
      warrantyExpiry: assetForm.warrantyExpiry || undefined,
      conditionStatus: assetForm.conditionStatus,
      serviceNotes: assetForm.serviceNotes || undefined,
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
        description: `${assetForm.brand} ${assetForm.capacity} registered successfully.`,
        type: "success",
      });
      setIsAddAssetModalOpen(false);
      setAssetForm((prev) => ({
        ...prev,
        brand: "",
        model: "",
        serialNumber: "",
        locationDescription: "",
        serviceNotes: "",
      }));
      loadCustomer();
    }
  };

  const handleArchiveSite = async () => {
    if (!siteToArchive) return;
    const res = await archiveServiceSite(siteToArchive, customerId);
    if (res.error) {
      toast({
        title: "Failed to Archive Site",
        description: res.error,
        type: "error",
      });
    } else {
      toast({
        title: "Site Archived",
        description: "Site hidden from active dispatch while preserving work orders.",
        type: "info",
      });
      setSiteToArchive(null);
      loadCustomer();
    }
  };

  const handleArchiveAsset = async () => {
    if (!assetToArchive) return;
    const res = await archiveEquipmentAsset(assetToArchive, customerId);
    if (res.error) {
      toast({
        title: "Failed to Archive Equipment",
        description: res.error,
        type: "error",
      });
    } else {
      toast({
        title: "Equipment Archived",
        description: "AC unit archived. Historical checklist and parts data preserved.",
        type: "info",
      });
      setAssetToArchive(null);
      loadCustomer();
    }
  };

  const handleArchiveCustomer = async () => {
    if (!customer) return;
    const res = await archiveCustomer(customer.id);
    if (res.error) {
      toast({
        title: "Failed to Archive Customer",
        description: res.error,
        type: "error",
      });
    } else {
      toast({
        title: "Customer Archived",
        description: "Customer archived successfully.",
        type: "info",
      });
      router.push("/app/customers");
    }
  };

  const handleEditCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    if (!editCustomerForm.name.trim() || !editCustomerForm.phone.trim()) {
      toast({
        title: "Validation Error",
        description: "Customer/Company name and phone number are required.",
        type: "error",
      });
      return;
    }

    setIsSubmitting(true);
    const res = await updateCustomer(customer.id, {
      name: editCustomerForm.name,
      companyName: editCustomerForm.name,
      phone: editCustomerForm.phone,
      alternatePhone: editCustomerForm.alternatePhone || undefined,
      email: editCustomerForm.email || undefined,
      customerType: editCustomerForm.customerType,
      notes: editCustomerForm.notes || undefined,
    });
    setIsSubmitting(false);

    if (res.error) {
      toast({
        title: "Failed to Update Customer",
        description: res.error,
        type: "error",
      });
    } else {
      toast({
        title: "Customer Updated",
        description: "Customer account details saved.",
        type: "success",
      });
      setIsEditCustomerModalOpen(false);
      loadCustomer();
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 text-center text-slate-500 flex flex-col items-center gap-2">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm font-medium">Loading customer profile and equipment records...</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-8 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900">Customer Not Found</h2>
        <p className="text-sm text-slate-500">
          The requested customer does not exist or you do not have permission to access it.
        </p>
        <Link href="/app/customers">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back to Customers Directory
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Breadcrumb */}
      <div>
        <Link
          href="/app/customers"
          className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-blue-600 transition-colors mb-2"
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1" />
          Back to Customers Directory
        </Link>
        <PageHeader
          title={customer.name}
          description={`Customer Account #${customer.id.slice(0, 8)} • ${customer.customerType.toUpperCase()}`}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditCustomerForm({
                    name: customer.name,
                    phone: customer.phone,
                    alternatePhone: customer.alternatePhone || "",
                    email: customer.email || "",
                    customerType: customer.customerType,
                    notes: customer.notes || "",
                  });
                  setIsEditCustomerModalOpen(true);
                }}
                className="text-slate-700"
              >
                <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                Edit Account
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsArchiveConfirmOpen(true)}
                className="text-rose-600 hover:bg-rose-50 border-rose-200"
              >
                <Archive className="h-3.5 w-3.5 mr-1.5" />
                Archive
              </Button>
            </div>
          }
        />
      </div>

      {/* Customer Quick Overview Card */}
      <Card className="border-slate-200 shadow-xs">
        <CardContent className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Primary Contact
            </span>
            <p className="text-sm font-semibold text-slate-900">{customer.contactName}</p>
            <p className="font-mono text-slate-600 flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-slate-400" />
              {customer.phone}
            </p>
            {customer.alternatePhone && (
              <p className="text-slate-500">Alt: {customer.alternatePhone}</p>
            )}
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Email & Invoicing
            </span>
            <p className="text-slate-700 flex items-center gap-1.5 truncate">
              <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              {customer.email || "No email registered"}
            </p>
            <p className="text-slate-500 capitalize">Type: {customer.customerType}</p>
          </div>

          <div className="space-y-1 md:col-span-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Billing Address & Notes
            </span>
            <p className="text-slate-700 flex items-start gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
              <span>{customer.billingAddress || "No billing address specified"}</span>
            </p>
            {customer.notes && (
              <p className="text-slate-500 italic mt-1">“{customer.notes}”</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sub-module Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab("sites")}
          className={`pb-3 transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === "sites"
              ? "border-blue-600 text-blue-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <MapPin className="h-4 w-4" />
          Service Sites ({customer.serviceSites.filter((s) => !s.isArchived).length})
        </button>

        <button
          onClick={() => setActiveTab("equipment")}
          className={`pb-3 transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === "equipment"
              ? "border-blue-600 text-blue-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Cpu className="h-4 w-4" />
          Equipment Registry ({customer.equipmentAssets.filter((a) => !a.isArchived).length})
        </button>

        <button
          onClick={() => setActiveTab("jobs")}
          className={`pb-3 transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === "jobs"
              ? "border-blue-600 text-blue-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <Wrench className="h-4 w-4" />
          Work Orders & History
        </button>

        <button
          onClick={() => setActiveTab("billing")}
          className={`pb-3 transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === "billing"
              ? "border-blue-600 text-blue-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-900"
          }`}
        >
          <CreditCard className="h-4 w-4" />
          Billing & Invoices
        </button>
      </div>

      {/* TAB 1: Service Sites */}
      {activeTab === "sites" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Physical Service Locations</h3>
              <p className="text-xs text-slate-500">
                Premises where technicians perform AC inspections and servicing.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setIsAddSiteModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Location
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {customer.serviceSites.filter((s) => !s.isArchived).map((site) => (
              <Card key={site.id} className="border-slate-200 shadow-xs hover:border-slate-300 transition-all">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold text-slate-900">{site.siteName}</CardTitle>
                      {site.area && (
                        <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 mt-1 inline-block">
                          {site.area}, {site.city}
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSiteToArchive(site.id)}
                      className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600"
                      title="Archive site"
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-slate-600 pt-1">
                  <div className="flex items-start gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>{site.address} {site.postcode ? `(${site.postcode})` : ""}</span>
                  </div>

                  {site.accessNotes && (
                    <div className="p-2 rounded bg-amber-50/70 border border-amber-200/60 text-amber-900 text-[11px]">
                      <strong>Access Instructions:</strong> {site.accessNotes}
                    </div>
                  )}

                  {site.siteContactName && (
                    <p className="text-[11px] text-slate-500">
                      On-site Contact: <strong>{site.siteContactName}</strong> {site.siteContactPhone ? `(${site.siteContactPhone})` : ""}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}

            {customer.serviceSites.filter((s) => !s.isArchived).length === 0 && (
              <div className="col-span-2">
                <EmptyState
                  icon={MapPin}
                  title="No Service Sites"
                  description="Register the first service location so technicians know where to find the AC equipment."
                  action={
                    <Button size="sm" onClick={() => setIsAddSiteModalOpen(true)}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Primary Site
                    </Button>
                  }
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Equipment Assets */}
      {activeTab === "equipment" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">AC & Cooling Unit Registry</h3>
              <p className="text-xs text-slate-500">
                Track unit specifications, tonnage capacity, refrigerant, and serial numbers.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setIsAddAssetModalOpen(true)}
              disabled={customer.serviceSites.filter((s) => !s.isArchived).length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Register AC Unit
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {customer.equipmentAssets.filter((a) => !a.isArchived).map((asset) => (
              <Card key={asset.id} className="border-slate-200 shadow-xs">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-mono font-semibold uppercase text-slate-400">
                        {asset.assetTag || "AC UNIT"}
                      </span>
                      <CardTitle className="text-sm font-bold text-slate-900">
                        {asset.brand} {asset.capacity || ""}
                      </CardTitle>
                      <p className="text-xs text-slate-500 capitalize">
                        {asset.equipmentType.replace(/_/g, " ")} {asset.model ? `• ${asset.model}` : ""}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAssetToArchive(asset.id)}
                      className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600"
                      title="Archive equipment"
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-slate-600 pt-1">
                  <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[11px]">
                    <span className="text-slate-500">Serial No:</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {asset.serialNumber || "N/A"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Site Location:</span>
                    <span className="font-medium text-slate-800 truncate max-w-[150px]">
                      {asset.siteName}
                    </span>
                  </div>

                  {asset.locationDescription && (
                    <div className="text-[11px] text-slate-500">
                      Location in facility: <strong>{asset.locationDescription}</strong>
                    </div>
                  )}

                  <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                    <span className="text-[11px] text-slate-500">Status:</span>
                    <StatusBadge status={asset.conditionStatus} />
                  </div>
                </CardContent>
              </Card>
            ))}

            {customer.equipmentAssets.filter((a) => !a.isArchived).length === 0 && (
              <div className="col-span-full">
                <EmptyState
                  icon={Cpu}
                  title="No Equipment Units Registered"
                  description="Register AC units or chillers for this client to enable mobile rooftop checklists and servicing history."
                  action={
                    <Button
                      size="sm"
                      onClick={() => setIsAddAssetModalOpen(true)}
                      disabled={customer.serviceSites.filter((s) => !s.isArchived).length === 0}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add First AC Unit
                    </Button>
                  }
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Jobs & History */}
      {activeTab === "jobs" && (
        <Card className="border-slate-200">
          <CardContent className="p-8">
            <EmptyState
              icon={Wrench}
              title="No Jobs Dispatched Yet"
              description="Create a work order from the Jobs module to dispatch technicians to this customer's service sites."
              action={
                <Link href="/app/jobs">
                  <Button size="sm">Go to Jobs Workspace</Button>
                </Link>
              }
            />
          </CardContent>
        </Card>
      )}

      {/* TAB 4: Billing & Invoices */}
      {activeTab === "billing" && (
        <Card className="border-slate-200">
          <CardContent className="p-8">
            <EmptyState
              icon={FileText}
              title="No Invoices Issued Yet"
              description="Issue quotations or invoices with BDT (৳) currency directly to this client account."
              action={
                <Link href="/app/invoices">
                  <Button size="sm">Go to Invoices Workspace</Button>
                </Link>
              }
            />
          </CardContent>
        </Card>
      )}

      {/* Add Service Site Modal */}
      {isAddSiteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in-0 duration-150">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900">Add Service Location</h3>
              <button
                type="button"
                onClick={() => setIsAddSiteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddSite} className="space-y-3 pt-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Location Label *</label>
                <Input
                  required
                  placeholder="e.g. Banani Branch 2nd Floor"
                  value={siteForm.siteName}
                  onChange={(e) => setSiteForm({ ...siteForm, siteName: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Full Physical Address *</label>
                <Input
                  required
                  placeholder="Plot 14, Road 11, Block E"
                  value={siteForm.address}
                  onChange={(e) => setSiteForm({ ...siteForm, address: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Area / Thana</label>
                  <Input
                    placeholder="Banani / Gulshan"
                    value={siteForm.area}
                    onChange={(e) => setSiteForm({ ...siteForm, area: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">City</label>
                  <Input
                    value={siteForm.city}
                    onChange={(e) => setSiteForm({ ...siteForm, city: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Access Instructions (for Techs)</label>
                <textarea
                  rows={2}
                  placeholder="Rooftop outdoor units key at security guard. Cargo lift available."
                  value={siteForm.accessNotes}
                  onChange={(e) => setSiteForm({ ...siteForm, accessNotes: e.target.value })}
                  className="w-full rounded-md border border-slate-200 bg-white p-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Site Contact Person</label>
                  <Input
                    placeholder="Security Officer"
                    value={siteForm.siteContactName}
                    onChange={(e) => setSiteForm({ ...siteForm, siteContactName: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Site Contact Phone</label>
                  <Input
                    placeholder="01712345678"
                    value={siteForm.siteContactPhone}
                    onChange={(e) => setSiteForm({ ...siteForm, siteContactPhone: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddSiteModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isSubmitting ? "Saving..." : "Add Location"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Equipment Modal */}
      {isAddAssetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in-0 duration-150">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900">Register AC Unit</h3>
              <button
                type="button"
                onClick={() => setIsAddAssetModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddAsset} className="space-y-3 pt-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Service Site Location *</label>
                <select
                  required
                  value={assetForm.siteId}
                  onChange={(e) => setAssetForm({ ...assetForm, siteId: e.target.value })}
                  className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
                >
                  {customer.serviceSites.filter((s) => !s.isArchived).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.siteName} ({s.area || s.city})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Brand *</label>
                  <Input
                    required
                    placeholder="Gree, Daikin, General, Media"
                    value={assetForm.brand}
                    onChange={(e) => setAssetForm({ ...assetForm, brand: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Capacity / Tonnage</label>
                  <Input
                    placeholder="1.5 Ton, 2.0 Ton, 5.0 Ton"
                    value={assetForm.capacity}
                    onChange={(e) => setAssetForm({ ...assetForm, capacity: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Equipment Type</label>
                  <select
                    value={assetForm.equipmentType}
                    onChange={(e) =>
                      setAssetForm({
                        ...assetForm,
                        equipmentType: e.target.value as "split_ac" | "cassette_ac" | "standing_ac" | "vrf_system" | "chiller",
                      })
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
                    value={assetForm.refrigerantType}
                    onChange={(e) =>
                      setAssetForm({
                        ...assetForm,
                        refrigerantType: e.target.value as "R32" | "R410A" | "R22",
                      })
                    }
                    className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="R32">R32 (Eco-Friendly)</option>
                    <option value="R410A">R410A</option>
                    <option value="R22">R22</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Model / Inverter Series</label>
                  <Input
                    placeholder="e.g. Lomo Inverter"
                    value={assetForm.model}
                    onChange={(e) => setAssetForm({ ...assetForm, model: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Serial Number</label>
                  <Input
                    placeholder="SN-9821734"
                    value={assetForm.serialNumber}
                    onChange={(e) => setAssetForm({ ...assetForm, serialNumber: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Location in Facility</label>
                <Input
                  placeholder="e.g. Server Room 3rd Floor / MD Room"
                  value={assetForm.locationDescription}
                  onChange={(e) =>
                    setAssetForm({ ...assetForm, locationDescription: e.target.value })
                  }
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddAssetModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isSubmitting ? "Registering..." : "Register Unit"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {isEditCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-sm font-semibold text-slate-900">Edit Customer Account</h3>
              <button
                type="button"
                onClick={() => setIsEditCustomerModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleEditCustomer} className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Company / Client Name *</label>
                <Input
                  required
                  value={editCustomerForm.name}
                  onChange={(e) =>
                    setEditCustomerForm({ ...editCustomerForm, name: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Phone Number *</label>
                  <Input
                    required
                    value={editCustomerForm.phone}
                    onChange={(e) =>
                      setEditCustomerForm({ ...editCustomerForm, phone: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Alternate Phone</label>
                  <Input
                    value={editCustomerForm.alternatePhone}
                    onChange={(e) =>
                      setEditCustomerForm({ ...editCustomerForm, alternatePhone: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Email Address</label>
                  <Input
                    type="email"
                    value={editCustomerForm.email}
                    onChange={(e) =>
                      setEditCustomerForm({ ...editCustomerForm, email: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Account Type</label>
                  <select
                    value={editCustomerForm.customerType}
                    onChange={(e) =>
                      setEditCustomerForm({
                        ...editCustomerForm,
                        customerType: e.target.value as "residential" | "commercial" | "corporate",
                      })
                    }
                    className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="commercial">Commercial Site</option>
                    <option value="residential">Residential</option>
                    <option value="corporate">Corporate / Industrial</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Internal Notes</label>
                <textarea
                  rows={2}
                  value={editCustomerForm.notes}
                  onChange={(e) =>
                    setEditCustomerForm({ ...editCustomerForm, notes: e.target.value })
                  }
                  className="w-full rounded-md border border-slate-200 bg-white p-2.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditCustomerModalOpen(false)}
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

      {/* Confirmation Modals */}
      <ConfirmModal
        isOpen={isArchiveConfirmOpen}
        onClose={() => setIsArchiveConfirmOpen(false)}
        onConfirm={handleArchiveCustomer}
        title={`Archive ${customer.name}?`}
        description="This customer will be archived. All historical jobs, parts records, and invoices are preserved."
        confirmText="Archive Customer"
        variant="danger"
      />

      <ConfirmModal
        isOpen={Boolean(siteToArchive)}
        onClose={() => setSiteToArchive(null)}
        onConfirm={handleArchiveSite}
        title="Archive Service Site?"
        description="This location will be archived. Linked historical service records will not be deleted."
        confirmText="Archive Location"
        variant="danger"
      />

      <ConfirmModal
        isOpen={Boolean(assetToArchive)}
        onClose={() => setAssetToArchive(null)}
        onConfirm={handleArchiveAsset}
        title="Archive Equipment Unit?"
        description="This AC unit will be removed from active maintenance without breaking past service job records."
        confirmText="Archive Unit"
        variant="danger"
      />
    </div>
  );
}
