"use client";

import * as React from "react";
import Link from "next/link";
import {
  Users,
  Plus,
  Building,
  Phone,
  Mail,
  MapPin,
  ChevronRight,
  Edit2,
  Archive,
  X,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { useToast } from "@/components/ui/toast";
import {
  getCustomers,
  createCustomer,
  updateCustomer,
  archiveCustomer,
  type CustomerListItem,
} from "@/features/customers/actions";

export default function CustomersPage() {
  const { toast } = useToast();
  const [customers, setCustomers] = React.useState<CustomerListItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("all");

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [customerToEdit, setCustomerToEdit] = React.useState<CustomerListItem | null>(null);
  const [customerToArchive, setCustomerToArchive] = React.useState<CustomerListItem | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // New Customer Form State
  const [formData, setFormData] = React.useState({
    name: "",
    contactName: "",
    phone: "",
    alternatePhone: "",
    email: "",
    customerType: "commercial" as "commercial" | "residential" | "corporate",
    billingAddress: "",
    notes: "",
    initialSiteName: "Main Branch / Office",
    initialSiteArea: "",
  });

  const reloadCustomers = React.useCallback(async () => {
    setIsLoading(true);
    const res = await getCustomers({
      search: searchQuery,
      customerType: typeFilter,
    });
    if (res.error) {
      toast({
        title: "Error Loading Customers",
        description: res.error,
        type: "error",
      });
    } else if (res.data) {
      setCustomers(res.data);
    }
    setIsLoading(false);
  }, [searchQuery, typeFilter, toast]);

  React.useEffect(() => {
    let active = true;
    getCustomers({ search: searchQuery, customerType: typeFilter }).then((res) => {
      if (active) {
        if (res.data) setCustomers(res.data);
        setIsLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [searchQuery, typeFilter]);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim()) {
      toast({
        title: "Validation Error",
        description: "Customer/Company name and phone number are required.",
        type: "error",
      });
      return;
    }

    setIsSubmitting(true);
    const res = await createCustomer(
      {
        name: formData.name,
        companyName: formData.name,
        contactName: formData.contactName || formData.name,
        phone: formData.phone,
        alternatePhone: formData.alternatePhone || undefined,
        email: formData.email || undefined,
        customerType: formData.customerType,
        billingAddress: formData.billingAddress || undefined,
        notes: formData.notes || undefined,
      },
      {
        siteName: formData.initialSiteName || "Main Facility",
        address: formData.billingAddress,
        area: formData.initialSiteArea || undefined,
      }
    );

    setIsSubmitting(false);

    if (res.error) {
      toast({
        title: "Failed to Add Customer",
        description: res.error,
        type: "error",
      });
    } else {
      toast({
        title: "Customer Added",
        description: `${formData.name} has been added to your client registry.`,
        type: "success",
      });
      setIsAddModalOpen(false);
      setFormData({
        name: "",
        contactName: "",
        phone: "",
        alternatePhone: "",
        email: "",
        customerType: "commercial",
        billingAddress: "",
        notes: "",
        initialSiteName: "Main Branch / Office",
        initialSiteArea: "",
      });
      reloadCustomers();
    }
  };

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerToEdit) return;

    setIsSubmitting(true);
    const res = await updateCustomer(customerToEdit.id, {
      name: customerToEdit.name,
      contactName: customerToEdit.contactName,
      phone: customerToEdit.phone,
      alternatePhone: customerToEdit.alternatePhone || undefined,
      email: customerToEdit.email || undefined,
      customerType: customerToEdit.customerType,
      billingAddress: customerToEdit.billingAddress || undefined,
      notes: customerToEdit.notes || undefined,
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
        description: `Details for ${customerToEdit.name} have been updated.`,
        type: "success",
      });
      setIsEditModalOpen(false);
      reloadCustomers();
    }
  };

  const handleArchiveConfirm = async () => {
    if (!customerToArchive) return;
    const res = await archiveCustomer(customerToArchive.id);
    if (res.error) {
      toast({
        title: "Failed to Archive",
        description: res.error,
        type: "error",
      });
    } else {
      toast({
        title: "Customer Archived",
        description: `${customerToArchive.name} archived. Historical invoices and jobs remain intact.`,
        type: "info",
      });
      reloadCustomers();
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers & Client Accounts"
        description="Directory of commercial facilities, corporate office towers, and residential clients maintaining AC assets."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => reloadCustomers()}
              className="text-slate-600 hover:text-slate-900"
              title="Refresh customer list"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              onClick={() => setIsAddModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add Customer
            </Button>
          </div>
        }
      />

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by company, contact person, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-500 font-medium">Type:</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
          >
            <option value="all">All Customer Types</option>
            <option value="commercial">Commercial</option>
            <option value="corporate">Corporate</option>
            <option value="residential">Residential</option>
          </select>
        </div>
      </div>

      {/* Customer Data Table */}
      <Card className="border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-slate-500 flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <p className="text-sm">Loading customer directory from Supabase...</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={Users}
              title={searchQuery ? "No matching customers found" : "No customers registered yet"}
              description={
                searchQuery
                  ? "Try searching with a different name, phone number, or clear your filters."
                  : "Add your first commercial client or building manager to start tracking AC units and scheduling maintenance."
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
                    Register First Customer
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow>
                <TableHead className="w-[30%]">Client / Organization</TableHead>
                <TableHead>Contact Person</TableHead>
                <TableHead>Phone & Mobile</TableHead>
                <TableHead>Sites & Assets</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={c.id} className="hover:bg-slate-50/70 transition-colors group">
                  <TableCell>
                    <Link
                      href={`/app/customers/${c.id}`}
                      className="flex items-center gap-2.5 font-medium text-slate-900 group-hover:text-blue-600 transition-colors"
                    >
                      <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0 border border-blue-100">
                        {c.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-sm leading-snug">{c.name}</p>
                        {c.billingAddress && (
                          <p className="text-[11px] text-slate-500 flex items-center gap-1 truncate max-w-xs">
                            <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                            {c.billingAddress}
                          </p>
                        )}
                      </div>
                    </Link>
                  </TableCell>

                  <TableCell className="text-sm text-slate-700">
                    <p className="font-medium text-slate-900">{c.contactName}</p>
                    {c.email && (
                      <p className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                        {c.email}
                      </p>
                    )}
                  </TableCell>

                  <TableCell className="text-sm font-mono text-slate-700">
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      <span>{c.phone}</span>
                    </div>
                    {c.alternatePhone && (
                      <p className="text-[11px] text-slate-500 pl-5">Alt: {c.alternatePhone}</p>
                    )}
                  </TableCell>

                  <TableCell>
                    <div className="text-xs space-y-0.5">
                      <span className="font-semibold text-slate-800">{c.sitesCount}</span>
                      <span className="text-slate-500"> {c.sitesCount === 1 ? "Site" : "Sites"}</span>
                      <span className="text-slate-400"> • </span>
                      <span className="font-semibold text-blue-600">{c.assetsCount}</span>
                      <span className="text-slate-500"> {c.assetsCount === 1 ? "Unit" : "Units"}</span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium capitalize border ${
                        c.customerType === "corporate"
                          ? "bg-purple-50 text-purple-700 border-purple-200"
                          : c.customerType === "commercial"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      }`}
                    >
                      {c.customerType}
                    </span>
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setCustomerToEdit(c);
                          setIsEditModalOpen(true);
                        }}
                        className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900"
                        title="Edit customer"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCustomerToArchive(c)}
                        className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600"
                        title="Archive customer"
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </Button>

                      <Link href={`/app/customers/${c.id}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs font-semibold text-blue-600 hover:text-blue-800"
                        >
                          View
                          <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                        </Button>
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Add Customer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in-0 duration-150">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Building className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Add New Customer</h3>
                  <p className="text-xs text-slate-500">Register client account and primary service site</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-4 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700">Company / Client Name *</label>
                  <Input
                    required
                    placeholder="e.g. Prime Bank Banani Branch"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Account Type</label>
                  <select
                    value={formData.customerType}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        customerType: e.target.value as "commercial" | "residential" | "corporate",
                      })
                    }
                    className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="commercial">Commercial (Office / Restaurant / Store)</option>
                    <option value="corporate">Corporate (Factory / Headquarters)</option>
                    <option value="residential">Residential (Apartment / Residence)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Contact Person Name</label>
                  <Input
                    placeholder="e.g. Kazi Farhan (Facility Mgr)"
                    value={formData.contactName}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Primary Mobile Phone *</label>
                  <Input
                    required
                    type="tel"
                    placeholder="01712345678"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                  <p className="text-[10px] text-slate-500">BD Mobile: 013, 014, 015, 016, 017, 018, 019</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Alternate Phone (Optional)</label>
                  <Input
                    type="tel"
                    placeholder="01812345678"
                    value={formData.alternatePhone}
                    onChange={(e) => setFormData({ ...formData, alternatePhone: e.target.value })}
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700">Email Address (Optional)</label>
                  <Input
                    type="email"
                    placeholder="billing@primebank.com.bd"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700">Billing / Head Office Address</label>
                  <Input
                    placeholder="House 12, Road 11, Block D, Banani, Dhaka"
                    value={formData.billingAddress}
                    onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })}
                  />
                </div>
              </div>

              {/* Initial Site Section */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                <p className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-blue-600" />
                  Primary Service Site Location
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600">Location Label</label>
                    <Input
                      placeholder="Main Branch 3rd Floor"
                      value={formData.initialSiteName}
                      onChange={(e) => setFormData({ ...formData, initialSiteName: e.target.value })}
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600">Area / Thana</label>
                    <Input
                      placeholder="Banani, Gulshan, Agrabad"
                      value={formData.initialSiteArea}
                      onChange={(e) => setFormData({ ...formData, initialSiteArea: e.target.value })}
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Notes & Special Terms</label>
                <textarea
                  rows={2}
                  placeholder="Gate passes required, Rooftop key at security guard, etc."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
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
                  disabled={isSubmitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                      Saving...
                    </>
                  ) : (
                    "Save & Create Customer"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {isEditModalOpen && customerToEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in-0 duration-150">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900">Edit Customer Details</h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateCustomer} className="space-y-4 pt-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Company / Client Name *</label>
                <Input
                  required
                  value={customerToEdit.name}
                  onChange={(e) => setCustomerToEdit({ ...customerToEdit, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Account Type</label>
                  <select
                    value={customerToEdit.customerType}
                    onChange={(e) =>
                      setCustomerToEdit({
                        ...customerToEdit,
                        customerType: e.target.value as "commercial" | "residential" | "corporate",
                      })
                    }
                    className="w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  >
                    <option value="commercial">Commercial</option>
                    <option value="corporate">Corporate</option>
                    <option value="residential">Residential</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Contact Person Name</label>
                  <Input
                    value={customerToEdit.contactName}
                    onChange={(e) =>
                      setCustomerToEdit({ ...customerToEdit, contactName: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Phone *</label>
                  <Input
                    required
                    value={customerToEdit.phone}
                    onChange={(e) => setCustomerToEdit({ ...customerToEdit, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Alternate Phone</label>
                  <Input
                    value={customerToEdit.alternatePhone || ""}
                    onChange={(e) =>
                      setCustomerToEdit({ ...customerToEdit, alternatePhone: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Email Address</label>
                <Input
                  value={customerToEdit.email || ""}
                  onChange={(e) => setCustomerToEdit({ ...customerToEdit, email: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Billing Address</label>
                <Input
                  value={customerToEdit.billingAddress || ""}
                  onChange={(e) =>
                    setCustomerToEdit({ ...customerToEdit, billingAddress: e.target.value })
                  }
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Internal Notes</label>
                <textarea
                  rows={2}
                  value={customerToEdit.notes || ""}
                  onChange={(e) => setCustomerToEdit({ ...customerToEdit, notes: e.target.value })}
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

      {/* Archive Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(customerToArchive)}
        onClose={() => setCustomerToArchive(null)}
        onConfirm={handleArchiveConfirm}
        title={`Archive ${customerToArchive?.name}?`}
        description="Archiving will hide this customer from active dispatch while preserving all historical work orders, AC asset history, and past invoices for audit integrity."
        confirmText="Archive Customer"
        variant="danger"
      />
    </div>
  );
}
