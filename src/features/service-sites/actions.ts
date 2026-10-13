"use server";

import { createClient } from "@/lib/supabase/server";
import { requireMembership } from "@/lib/auth";
import { canManageCustomers } from "@/lib/permissions";
import { serviceSiteSchema, type ServiceSiteInput } from "@/schemas/customer";
import { revalidatePath } from "next/cache";
import type { Database } from "@/types/database.types";

type ServiceSiteUpdate = Database["public"]["Tables"]["service_sites"]["Update"];

export interface ServiceSiteItem {
  id: string;
  customerId: string;
  customerName?: string;
  siteName: string;
  address: string;
  area: string | null;
  city: string;
  district: string;
  postcode: string | null;
  landmark: string | null;
  siteContactName: string | null;
  siteContactPhone: string | null;
  accessNotes: string | null;
  isArchived: boolean;
  assetsCount: number;
  createdAt: string;
}

/**
 * Fetch service sites for an organization, optionally filtered by customer or search term.
 */
export async function getServiceSites(params?: {
  customerId?: string;
  search?: string;
  includeArchived?: boolean;
}): Promise<{ data?: ServiceSiteItem[]; error?: string }> {
  try {
    const session = await requireMembership();
    const orgId = session.membership.organizationId;
    const supabase = await createClient();

    let query = supabase
      .from("service_sites")
      .select(`
        id,
        customer_id,
        site_name,
        address,
        address_line1,
        area,
        city,
        district,
        postcode,
        postal_code,
        landmark,
        site_contact_name,
        site_contact_phone,
        access_notes,
        access_instructions,
        is_archived,
        created_at,
        customers!service_sites_customer_id_fkey(name, company_name),
        equipment_assets!equipment_assets_site_id_fkey(id, is_archived)
      `)
      .eq("organization_id", orgId)
      .order("site_name", { ascending: true });

    if (!params?.includeArchived) {
      query = query.eq("is_archived", false);
    }

    if (params?.customerId) {
      query = query.eq("customer_id", params.customerId);
    }

    if (params?.search && params.search.trim()) {
      const s = params.search.trim();
      query = query.or(
        `site_name.ilike.%${s}%,area.ilike.%${s}%,address.ilike.%${s}%,site_contact_phone.ilike.%${s}%`
      );
    }

    const { data, error } = await query;
    if (error) {
      return { error: error.message };
    }

    const list: ServiceSiteItem[] = (data || []).map((row) => {
      const assets = (row.equipment_assets as Array<{ id: string; is_archived: boolean }>) || [];
      const activeAssets = assets.filter((a) => !a.is_archived);
      const cust = Array.isArray(row.customers) ? row.customers[0] : row.customers;

      return {
        id: row.id,
        customerId: row.customer_id,
        customerName: cust?.name || cust?.company_name || "Unknown Customer",
        siteName: row.site_name,
        address: row.address || row.address_line1,
        area: row.area,
        city: row.city,
        district: row.district,
        postcode: row.postcode || row.postal_code,
        landmark: row.landmark,
        siteContactName: row.site_contact_name,
        siteContactPhone: row.site_contact_phone,
        accessNotes: row.access_notes || row.access_instructions,
        isArchived: row.is_archived,
        assetsCount: activeAssets.length,
        createdAt: row.created_at,
      };
    });

    return { data: list };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to load service sites" };
  }
}

/**
 * Create a new service location for an existing customer.
 */
export async function createServiceSite(
  input: ServiceSiteInput
): Promise<{ data?: ServiceSiteItem; error?: string }> {
  try {
    const session = await requireMembership();
    if (!canManageCustomers(session.membership.role)) {
      return { error: "You do not have permission to add service sites." };
    }

    const parsed = serviceSiteSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message || "Validation failed" };
    }

    const {
      customerId,
      siteName,
      address,
      area,
      city,
      district,
      postcode,
      landmark,
      siteContactName,
      siteContactPhone,
      accessNotes,
    } = parsed.data;

    const orgId = session.membership.organizationId;
    const supabase = await createClient();

    // Verify that target customer belongs to caller's organization
    const { data: customer, error: custCheckError } = await supabase
      .from("customers")
      .select("id, name")
      .eq("id", customerId)
      .eq("organization_id", orgId)
      .single();

    if (custCheckError || !customer) {
      return { error: "Customer not found or belongs to another organization." };
    }

    const { data: newSite, error: insertError } = await supabase
      .from("service_sites")
      .insert({
        organization_id: orgId,
        customer_id: customerId,
        site_name: siteName,
        address,
        address_line1: address,
        area: area || null,
        city: city || "Dhaka",
        district: district || "Dhaka",
        postcode: postcode || null,
        postal_code: postcode || null,
        landmark: landmark || null,
        site_contact_name: siteContactName || null,
        site_contact_phone: siteContactPhone || null,
        access_notes: accessNotes || null,
        access_instructions: accessNotes || null,
      })
      .select()
      .single();

    if (insertError || !newSite) {
      return { error: insertError?.message || "Failed to create service site" };
    }

    // Log audit
    await supabase.from("activity_logs").insert({
      organization_id: orgId,
      actor_id: session.user.id,
      entity_type: "service_site",
      entity_id: newSite.id,
      action: "created",
      details: { site_name: siteName, customer_id: customerId },
    });

    revalidatePath("/app/customers");
    revalidatePath(`/app/customers/${customerId}`);
    revalidatePath("/app/equipment");

    return {
      data: {
        id: newSite.id,
        customerId: newSite.customer_id,
        customerName: customer.name ?? undefined,
        siteName: newSite.site_name,
        address: newSite.address || newSite.address_line1,
        area: newSite.area,
        city: newSite.city,
        district: newSite.district,
        postcode: newSite.postcode || newSite.postal_code,
        landmark: newSite.landmark,
        siteContactName: newSite.site_contact_name,
        siteContactPhone: newSite.site_contact_phone,
        accessNotes: newSite.access_notes || newSite.access_instructions,
        isArchived: newSite.is_archived,
        assetsCount: 0,
        createdAt: newSite.created_at,
      },
    };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error creating service site" };
  }
}

/**
 * Update an existing service site.
 */
export async function updateServiceSite(
  id: string,
  input: Partial<ServiceSiteInput>
): Promise<{ success?: boolean; error?: string }> {
  try {
    const session = await requireMembership();
    if (!canManageCustomers(session.membership.role)) {
      return { error: "You do not have permission to update service sites." };
    }

    const orgId = session.membership.organizationId;
    const supabase = await createClient();

    const updatePayload: ServiceSiteUpdate = {};
    if (input.siteName !== undefined) updatePayload.site_name = input.siteName.trim();
    if (input.address !== undefined) {
      updatePayload.address = input.address.trim();
      updatePayload.address_line1 = input.address.trim();
    }
    if (input.area !== undefined) updatePayload.area = input.area ? input.area.trim() : null;
    if (input.city !== undefined) updatePayload.city = input.city.trim();
    if (input.district !== undefined) updatePayload.district = input.district.trim();
    if (input.postcode !== undefined) {
      updatePayload.postcode = input.postcode ? input.postcode.trim() : null;
      updatePayload.postal_code = input.postcode ? input.postcode.trim() : null;
    }
    if (input.landmark !== undefined) updatePayload.landmark = input.landmark ? input.landmark.trim() : null;
    if (input.siteContactName !== undefined) updatePayload.site_contact_name = input.siteContactName ? input.siteContactName.trim() : null;
    if (input.siteContactPhone !== undefined) updatePayload.site_contact_phone = input.siteContactPhone ? input.siteContactPhone.trim() : null;
    if (input.accessNotes !== undefined) {
      updatePayload.access_notes = input.accessNotes ? input.accessNotes.trim() : null;
      updatePayload.access_instructions = input.accessNotes ? input.accessNotes.trim() : null;
    }

    const { error } = await supabase
      .from("service_sites")
      .update(updatePayload)
      .eq("id", id)
      .eq("organization_id", orgId);

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/app/customers");
    revalidatePath("/app/equipment");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error updating service site" };
  }
}

/**
 * Soft-delete / archive a service site.
 */
export async function archiveServiceSite(
  id: string,
  customerId?: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const session = await requireMembership();
    if (!canManageCustomers(session.membership.role)) {
      return { error: "You do not have permission to archive service sites." };
    }

    const orgId = session.membership.organizationId;
    const supabase = await createClient();

    const { error } = await supabase
      .from("service_sites")
      .update({ is_archived: true })
      .eq("id", id)
      .eq("organization_id", orgId);

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/app/customers");
    if (customerId) revalidatePath(`/app/customers/${customerId}`);
    revalidatePath("/app/equipment");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error archiving service site" };
  }
}
