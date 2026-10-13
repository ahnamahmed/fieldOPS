"use server";

import { createClient } from "@/lib/supabase/server";
import { requireMembership } from "@/lib/auth";
import { canManageCustomers } from "@/lib/permissions";
import { customerSchema, type CustomerInput } from "@/schemas/customer";
import { revalidatePath } from "next/cache";
import type { Database } from "@/types/database.types";

type CustomerUpdate = Database["public"]["Tables"]["customers"]["Update"];

export interface CustomerListItem {
  id: string;
  name: string;
  companyName: string | null;
  contactName: string;
  phone: string;
  alternatePhone: string | null;
  email: string | null;
  customerType: "residential" | "commercial" | "corporate";
  billingAddress: string | null;
  notes: string | null;
  isArchived: boolean;
  sitesCount: number;
  assetsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerDetail extends CustomerListItem {
  serviceSites: {
    id: string;
    siteName: string;
    address: string;
    area: string | null;
    city: string;
    district: string;
    postcode: string | null;
    accessNotes: string | null;
    siteContactName: string | null;
    siteContactPhone: string | null;
    isArchived: boolean;
    createdAt: string;
  }[];
  equipmentAssets: {
    id: string;
    assetTag: string | null;
    equipmentType: string;
    brand: string;
    model: string | null;
    serialNumber: string | null;
    capacity: string | null;
    conditionStatus: string;
    locationDescription: string | null;
    serviceSiteId: string;
    siteName: string;
    isArchived: boolean;
  }[];
}

/**
 * Fetch list of organization customers with optional search and type filter.
 */
export async function getCustomers(params?: {
  search?: string;
  customerType?: string;
  includeArchived?: boolean;
}): Promise<{ data?: CustomerListItem[]; error?: string }> {
  try {
    const session = await requireMembership();
    const orgId = session.membership.organizationId;
    const supabase = await createClient();

    let query = supabase
      .from("customers")
      .select(`
        id,
        name,
        company_name,
        contact_name,
        phone,
        alternate_phone,
        email,
        customer_type,
        billing_address,
        notes,
        is_archived,
        created_at,
        updated_at,
        service_sites!service_sites_customer_id_fkey(id, is_archived),
        equipment_assets!equipment_assets_customer_id_fkey(id, is_archived)
      `)
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    if (!params?.includeArchived) {
      query = query.eq("is_archived", false);
    }

    if (params?.customerType && params.customerType !== "all") {
      query = query.eq("customer_type", params.customerType);
    }

    if (params?.search && params.search.trim()) {
      const s = params.search.trim();
      query = query.or(
        `name.ilike.%${s}%,company_name.ilike.%${s}%,contact_name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      return { error: error.message };
    }

    const list: CustomerListItem[] = (data || []).map((row) => {
      const sites = (row.service_sites as Array<{ id: string; is_archived: boolean }>) || [];
      const assets = (row.equipment_assets as Array<{ id: string; is_archived: boolean }>) || [];

      const activeSites = sites.filter((s) => !s.is_archived);
      const activeAssets = assets.filter((a) => !a.is_archived);

      return {
        id: row.id,
        name: row.name || row.company_name || row.contact_name,
        companyName: row.company_name,
        contactName: row.contact_name,
        phone: row.phone,
        alternatePhone: row.alternate_phone,
        email: row.email,
        customerType: row.customer_type as "residential" | "commercial" | "corporate",
        billingAddress: row.billing_address,
        notes: row.notes,
        isArchived: row.is_archived,
        sitesCount: activeSites.length,
        assetsCount: activeAssets.length,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });

    return { data: list };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to load customers" };
  }
}

/**
 * Fetch single customer details with linked service sites and equipment.
 */
export async function getCustomerById(
  id: string
): Promise<{ data?: CustomerDetail; error?: string }> {
  try {
    const session = await requireMembership();
    const orgId = session.membership.organizationId;
    const supabase = await createClient();

    const { data: customer, error: custError } = await supabase
      .from("customers")
      .select("*")
      .eq("id", id)
      .eq("organization_id", orgId)
      .single();

    if (custError || !customer) {
      return { error: "Customer not found" };
    }

    // Fetch service sites for this customer
    const { data: sitesData } = await supabase
      .from("service_sites")
      .select("*")
      .eq("customer_id", id)
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true });

    const sitesMap = new Map<string, string>();
    const serviceSites = (sitesData || []).map((s) => {
      sitesMap.set(s.id, s.site_name);
      return {
        id: s.id,
        siteName: s.site_name,
        address: s.address || s.address_line1,
        area: s.area,
        city: s.city,
        district: s.district,
        postcode: s.postcode || s.postal_code,
        accessNotes: s.access_notes || s.access_instructions,
        siteContactName: s.site_contact_name,
        siteContactPhone: s.site_contact_phone,
        isArchived: s.is_archived,
        createdAt: s.created_at,
      };
    });

    // Fetch equipment assets for this customer
    const { data: assetsData } = await supabase
      .from("equipment_assets")
      .select("*")
      .eq("customer_id", id)
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    const equipmentAssets = (assetsData || []).map((a) => {
      const siteId = a.service_site_id || a.site_id;
      return {
        id: a.id,
        assetTag: a.asset_tag,
        equipmentType: a.equipment_type,
        brand: a.brand,
        model: a.model || a.model_number,
        serialNumber: a.serial_number,
        capacity: a.capacity,
        conditionStatus: a.condition_status,
        locationDescription: a.location_description || a.location_in_facility,
        serviceSiteId: siteId,
        siteName: sitesMap.get(siteId) || "Unknown Site",
        isArchived: a.is_archived,
      };
    });

    return {
      data: {
        id: customer.id,
        name: customer.name || customer.company_name || customer.contact_name,
        companyName: customer.company_name,
        contactName: customer.contact_name,
        phone: customer.phone,
        alternatePhone: customer.alternate_phone,
        email: customer.email,
        customerType: customer.customer_type as "residential" | "commercial" | "corporate",
        billingAddress: customer.billing_address,
        notes: customer.notes,
        isArchived: customer.is_archived,
        sitesCount: serviceSites.filter((s) => !s.isArchived).length,
        assetsCount: equipmentAssets.filter((a) => !a.isArchived).length,
        createdAt: customer.created_at,
        updatedAt: customer.updated_at,
        serviceSites,
        equipmentAssets,
      },
    };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to load customer details" };
  }
}

/**
 * Create a new customer and optionally an initial primary service site.
 */
export async function createCustomer(
  input: CustomerInput,
  initialSite?: {
    siteName?: string;
    address?: string;
    area?: string;
    accessNotes?: string;
  }
): Promise<{ data?: CustomerListItem; error?: string }> {
  try {
    const session = await requireMembership();
    if (!canManageCustomers(session.membership.role)) {
      return { error: "You do not have permission to create customers." };
    }

    const parsed = customerSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message || "Validation failed" };
    }

    const { name, companyName, contactName, phone, alternatePhone, email, customerType, billingAddress, notes } =
      parsed.data;
    const orgId = session.membership.organizationId;
    const supabase = await createClient();

    const { data: newCust, error: insertError } = await supabase
      .from("customers")
      .insert({
        organization_id: orgId,
        name,
        company_name: companyName,
        contact_name: contactName,
        phone,
        alternate_phone: alternatePhone || null,
        email: email || null,
        customer_type: customerType,
        billing_address: billingAddress || null,
        notes: notes || null,
      })
      .select()
      .single();

    if (insertError || !newCust) {
      return { error: insertError?.message || "Failed to create customer" };
    }

    // Automatically create initial primary service location
    const siteName = initialSite?.siteName?.trim() || "Main Facility / Office";
    const siteAddress = initialSite?.address?.trim() || billingAddress || "Dhaka, Bangladesh";
    const siteArea = initialSite?.area?.trim() || null;
    const accessNotes = initialSite?.accessNotes?.trim() || null;

    await supabase.from("service_sites").insert({
      organization_id: orgId,
      customer_id: newCust.id,
      site_name: siteName,
      address: siteAddress,
      address_line1: siteAddress,
      area: siteArea,
      city: "Dhaka",
      district: "Dhaka",
      access_notes: accessNotes,
      access_instructions: accessNotes,
    });

    // Log audit activity
    await supabase.from("activity_logs").insert({
      organization_id: orgId,
      actor_id: session.user.id,
      entity_type: "customer",
      entity_id: newCust.id,
      action: "created",
      details: {
        name,
        phone,
        customer_type: customerType,
      },
    });

    revalidatePath("/app/customers");
    return {
      data: {
        id: newCust.id,
        name: newCust.name || newCust.company_name || newCust.contact_name,
        companyName: newCust.company_name,
        contactName: newCust.contact_name,
        phone: newCust.phone,
        alternatePhone: newCust.alternate_phone,
        email: newCust.email,
        customerType: newCust.customer_type as "residential" | "commercial" | "corporate",
        billingAddress: newCust.billing_address,
        notes: newCust.notes,
        isArchived: newCust.is_archived,
        sitesCount: 1,
        assetsCount: 0,
        createdAt: newCust.created_at,
        updatedAt: newCust.updated_at,
      },
    };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error creating customer" };
  }
}

/**
 * Update an existing customer's contact and billing information.
 */
export async function updateCustomer(
  id: string,
  input: Partial<CustomerInput>
): Promise<{ success?: boolean; error?: string }> {
  try {
    const session = await requireMembership();
    if (!canManageCustomers(session.membership.role)) {
      return { error: "You do not have permission to update customers." };
    }

    const orgId = session.membership.organizationId;
    const supabase = await createClient();

    const updatePayload: CustomerUpdate = {};
    if (input.name !== undefined) updatePayload.name = input.name.trim();
    if (input.companyName !== undefined) updatePayload.company_name = input.companyName.trim();
    if (input.contactName !== undefined) updatePayload.contact_name = input.contactName.trim();
    if (input.phone !== undefined) updatePayload.phone = input.phone.trim();
    if (input.alternatePhone !== undefined) updatePayload.alternate_phone = input.alternatePhone ? input.alternatePhone.trim() : null;
    if (input.email !== undefined) updatePayload.email = input.email ? input.email.trim() : null;
    if (input.customerType !== undefined) updatePayload.customer_type = input.customerType;
    if (input.billingAddress !== undefined) updatePayload.billing_address = input.billingAddress ? input.billingAddress.trim() : null;
    if (input.notes !== undefined) updatePayload.notes = input.notes ? input.notes.trim() : null;

    const { error } = await supabase
      .from("customers")
      .update(updatePayload)
      .eq("id", id)
      .eq("organization_id", orgId);

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/app/customers");
    revalidatePath(`/app/customers/${id}`);
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error updating customer" };
  }
}

/**
 * Soft-delete / archive a customer to preserve historical service records and invoices.
 */
export async function archiveCustomer(
  id: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const session = await requireMembership();
    if (!canManageCustomers(session.membership.role)) {
      return { error: "You do not have permission to archive customers." };
    }

    const orgId = session.membership.organizationId;
    const supabase = await createClient();

    const { error } = await supabase
      .from("customers")
      .update({ is_archived: true })
      .eq("id", id)
      .eq("organization_id", orgId);

    if (error) {
      return { error: error.message };
    }

    // Log audit event
    await supabase.from("activity_logs").insert({
      organization_id: orgId,
      actor_id: session.user.id,
      entity_type: "customer",
      entity_id: id,
      action: "archived",
      details: { is_archived: true },
    });

    revalidatePath("/app/customers");
    revalidatePath(`/app/customers/${id}`);
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error archiving customer" };
  }
}

/**
 * Restore an archived customer.
 */
export async function restoreCustomer(
  id: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const session = await requireMembership();
    if (!canManageCustomers(session.membership.role)) {
      return { error: "You do not have permission to restore customers." };
    }

    const orgId = session.membership.organizationId;
    const supabase = await createClient();

    const { error } = await supabase
      .from("customers")
      .update({ is_archived: false })
      .eq("id", id)
      .eq("organization_id", orgId);

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/app/customers");
    revalidatePath(`/app/customers/${id}`);
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error restoring customer" };
  }
}
