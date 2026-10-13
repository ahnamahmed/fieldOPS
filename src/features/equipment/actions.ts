"use server";

import { createClient } from "@/lib/supabase/server";
import { requireMembership } from "@/lib/auth";
import { canManageJobs } from "@/lib/permissions";
import { equipmentAssetSchema, type EquipmentAssetInput } from "@/schemas/customer";
import { revalidatePath } from "next/cache";
import type { Database } from "@/types/database.types";

type EquipmentAssetUpdate = Database["public"]["Tables"]["equipment_assets"]["Update"];

export interface EquipmentAssetItem {
  id: string;
  customerId: string;
  customerName: string;
  serviceSiteId: string;
  siteName: string;
  siteArea: string | null;
  assetTag: string | null;
  equipmentType: string;
  brand: string;
  model: string | null;
  serialNumber: string | null;
  capacity: string | null;
  refrigerantType: string | null;
  locationDescription: string | null;
  installationDate: string | null;
  warrantyExpiry: string | null;
  conditionStatus: "operational" | "needs_service" | "under_repair" | "decommissioned";
  serviceNotes: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Fetch equipment registry for the organization with comprehensive filtering.
 */
export async function getEquipmentAssets(params?: {
  customerId?: string;
  siteId?: string;
  equipmentType?: string;
  conditionStatus?: string;
  search?: string;
  includeArchived?: boolean;
}): Promise<{ data?: EquipmentAssetItem[]; error?: string }> {
  try {
    const session = await requireMembership();
    const orgId = session.membership.organizationId;
    const supabase = await createClient();

    let query = supabase
      .from("equipment_assets")
      .select(`
        id,
        customer_id,
        service_site_id,
        site_id,
        asset_tag,
        equipment_type,
        brand,
        model,
        model_number,
        serial_number,
        capacity,
        refrigerant_type,
        location_description,
        location_in_facility,
        installation_date,
        warranty_expiry,
        condition_status,
        service_notes,
        notes,
        is_archived,
        created_at,
        updated_at,
        customers!equipment_assets_customer_id_fkey(id, name, company_name),
        service_sites!equipment_assets_site_id_fkey(id, site_name, area)
      `)
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    if (!params?.includeArchived) {
      query = query.eq("is_archived", false);
    }

    if (params?.customerId) {
      query = query.eq("customer_id", params.customerId);
    }

    if (params?.siteId) {
      query = query.or(`site_id.eq.${params.siteId},service_site_id.eq.${params.siteId}`);
    }

    if (params?.equipmentType && params.equipmentType !== "all") {
      query = query.eq("equipment_type", params.equipmentType);
    }

    if (params?.conditionStatus && params.conditionStatus !== "all") {
      query = query.eq("condition_status", params.conditionStatus);
    }

    if (params?.search && params.search.trim()) {
      const s = params.search.trim();
      query = query.or(
        `brand.ilike.%${s}%,model.ilike.%${s}%,model_number.ilike.%${s}%,serial_number.ilike.%${s}%,asset_tag.ilike.%${s}%,location_description.ilike.%${s}%`
      );
    }

    const { data, error } = await query;
    if (error) {
      return { error: error.message };
    }

    const list: EquipmentAssetItem[] = (data || []).map((row) => {
      const cust = Array.isArray(row.customers) ? row.customers[0] : row.customers;
      const site = Array.isArray(row.service_sites) ? row.service_sites[0] : row.service_sites;
      const resolvedSiteId = row.service_site_id || row.site_id;

      return {
        id: row.id,
        customerId: row.customer_id,
        customerName: cust?.name || cust?.company_name || "Unknown Customer",
        serviceSiteId: resolvedSiteId,
        siteName: site?.site_name || "Primary Location",
        siteArea: site?.area || null,
        assetTag: row.asset_tag,
        equipmentType: row.equipment_type,
        brand: row.brand,
        model: row.model || row.model_number,
        serialNumber: row.serial_number,
        capacity: row.capacity,
        refrigerantType: row.refrigerant_type,
        locationDescription: row.location_description || row.location_in_facility,
        installationDate: row.installation_date,
        warrantyExpiry: row.warranty_expiry,
        conditionStatus: row.condition_status as EquipmentAssetItem["conditionStatus"],
        serviceNotes: row.service_notes || row.notes,
        isArchived: row.is_archived,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });

    return { data: list };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to load equipment assets" };
  }
}

/**
 * Fetch a single equipment asset with its linked service visits and notes.
 */
export async function getEquipmentAssetById(
  id: string
): Promise<{ data?: EquipmentAssetItem; error?: string }> {
  try {
    const session = await requireMembership();
    const orgId = session.membership.organizationId;
    const supabase = await createClient();

    const { data: row, error } = await supabase
      .from("equipment_assets")
      .select(`
        id,
        customer_id,
        service_site_id,
        site_id,
        asset_tag,
        equipment_type,
        brand,
        model,
        model_number,
        serial_number,
        capacity,
        refrigerant_type,
        location_description,
        location_in_facility,
        installation_date,
        warranty_expiry,
        condition_status,
        service_notes,
        notes,
        is_archived,
        created_at,
        updated_at,
        customers!equipment_assets_customer_id_fkey(id, name, company_name),
        service_sites!equipment_assets_site_id_fkey(id, site_name, area)
      `)
      .eq("id", id)
      .eq("organization_id", orgId)
      .single();

    if (error || !row) {
      return { error: "Equipment asset not found" };
    }

    const cust = Array.isArray(row.customers) ? row.customers[0] : row.customers;
    const site = Array.isArray(row.service_sites) ? row.service_sites[0] : row.service_sites;
    const resolvedSiteId = row.service_site_id || row.site_id;

    return {
      data: {
        id: row.id,
        customerId: row.customer_id,
        customerName: cust?.name || cust?.company_name || "Unknown Customer",
        serviceSiteId: resolvedSiteId,
        siteName: site?.site_name || "Primary Location",
        siteArea: site?.area || null,
        assetTag: row.asset_tag,
        equipmentType: row.equipment_type,
        brand: row.brand,
        model: row.model || row.model_number,
        serialNumber: row.serial_number,
        capacity: row.capacity,
        refrigerantType: row.refrigerant_type,
        locationDescription: row.location_description || row.location_in_facility,
        installationDate: row.installation_date,
        warrantyExpiry: row.warranty_expiry,
        conditionStatus: row.condition_status as EquipmentAssetItem["conditionStatus"],
        serviceNotes: row.service_notes || row.notes,
        isArchived: row.is_archived,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to load equipment asset" };
  }
}

/**
 * Register a new AC/refrigeration unit into the asset registry with strict tenant and customer-site checks.
 */
export async function createEquipmentAsset(
  input: EquipmentAssetInput
): Promise<{ data?: EquipmentAssetItem; error?: string }> {
  try {
    const session = await requireMembership();
    if (!canManageJobs(session.membership.role)) {
      return { error: "You do not have permission to register equipment." };
    }

    const parsed = equipmentAssetSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message || "Validation failed" };
    }

    const {
      customerId,
      siteId,
      assetTag,
      equipmentType,
      brand,
      model,
      serialNumber,
      capacity,
      refrigerantType,
      locationDescription,
      installationDate,
      warrantyExpiry,
      conditionStatus,
      serviceNotes,
    } = parsed.data;

    const orgId = session.membership.organizationId;
    const supabase = await createClient();

    // 1. Verify customer belongs to caller's organization
    const { data: customer, error: custErr } = await supabase
      .from("customers")
      .select("id, name")
      .eq("id", customerId)
      .eq("organization_id", orgId)
      .single();

    if (custErr || !customer) {
      return { error: "Customer not found or belongs to another organization." };
    }

    // 2. Verify site belongs to caller's organization AND to this customer
    const { data: site, error: siteErr } = await supabase
      .from("service_sites")
      .select("id, site_name, customer_id, area")
      .eq("id", siteId)
      .eq("organization_id", orgId)
      .single();

    if (siteErr || !site) {
      return { error: "Service site not found or belongs to another organization." };
    }

    if (site.customer_id !== customerId) {
      return { error: "The selected service site does not belong to this customer." };
    }

    // 3. Generate asset tag if not supplied
    const resolvedTag =
      assetTag?.trim() ||
      `AC-${brand.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`;

    const { data: newAsset, error: insertError } = await supabase
      .from("equipment_assets")
      .insert({
        organization_id: orgId,
        customer_id: customerId,
        site_id: siteId,
        service_site_id: siteId,
        asset_tag: resolvedTag,
        equipment_type: equipmentType,
        brand,
        model: model || null,
        model_number: model || null,
        serial_number: serialNumber || null,
        capacity: capacity || null,
        refrigerant_type: refrigerantType || null,
        location_description: locationDescription || null,
        location_in_facility: locationDescription || null,
        installation_date: installationDate || null,
        warranty_expiry: warrantyExpiry || null,
        condition_status: conditionStatus,
        service_notes: serviceNotes || null,
        notes: serviceNotes || null,
      })
      .select()
      .single();

    if (insertError || !newAsset) {
      return { error: insertError?.message || "Failed to register equipment" };
    }

    // Log audit event
    await supabase.from("activity_logs").insert({
      organization_id: orgId,
      actor_id: session.user.id,
      entity_type: "equipment_asset",
      entity_id: newAsset.id,
      action: "registered",
      details: { brand, model, equipment_type: equipmentType, customer_id: customerId },
    });

    revalidatePath("/app/equipment");
    revalidatePath(`/app/customers/${customerId}`);
    revalidatePath("/app/jobs");

    return {
      data: {
        id: newAsset.id,
        customerId: newAsset.customer_id,
        customerName: customer.name ?? "Customer",
        serviceSiteId: (newAsset.service_site_id || newAsset.site_id || siteId)!,
        siteName: site.site_name,
        siteArea: site.area,
        assetTag: newAsset.asset_tag,
        equipmentType: newAsset.equipment_type,
        brand: newAsset.brand,
        model: newAsset.model || newAsset.model_number,
        serialNumber: newAsset.serial_number,
        capacity: newAsset.capacity,
        refrigerantType: newAsset.refrigerant_type,
        locationDescription: newAsset.location_description || newAsset.location_in_facility,
        installationDate: newAsset.installation_date,
        warrantyExpiry: newAsset.warranty_expiry,
        conditionStatus: newAsset.condition_status as EquipmentAssetItem["conditionStatus"],
        serviceNotes: newAsset.service_notes || newAsset.notes,
        isArchived: newAsset.is_archived,
        createdAt: newAsset.created_at,
        updatedAt: newAsset.updated_at,
      },
    };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error registering equipment" };
  }
}

/**
 * Update equipment asset details.
 */
export async function updateEquipmentAsset(
  id: string,
  input: Partial<EquipmentAssetInput>
): Promise<{ success?: boolean; error?: string }> {
  try {
    const session = await requireMembership();
    if (!canManageJobs(session.membership.role)) {
      return { error: "You do not have permission to update equipment." };
    }

    const orgId = session.membership.organizationId;
    const supabase = await createClient();

    const updatePayload: EquipmentAssetUpdate = {};
    if (input.brand !== undefined) updatePayload.brand = input.brand.trim();
    if (input.model !== undefined) {
      updatePayload.model = input.model ? input.model.trim() : null;
      updatePayload.model_number = input.model ? input.model.trim() : null;
    }
    if (input.serialNumber !== undefined) updatePayload.serial_number = input.serialNumber ? input.serialNumber.trim() : null;
    if (input.capacity !== undefined) updatePayload.capacity = input.capacity ? input.capacity.trim() : null;
    if (input.equipmentType !== undefined) updatePayload.equipment_type = input.equipmentType;
    if (input.refrigerantType !== undefined) updatePayload.refrigerant_type = input.refrigerantType || null;
    if (input.locationDescription !== undefined) {
      updatePayload.location_description = input.locationDescription ? input.locationDescription.trim() : null;
      updatePayload.location_in_facility = input.locationDescription ? input.locationDescription.trim() : null;
    }
    if (input.installationDate !== undefined) updatePayload.installation_date = input.installationDate || null;
    if (input.warrantyExpiry !== undefined) updatePayload.warranty_expiry = input.warrantyExpiry || null;
    if (input.conditionStatus !== undefined) updatePayload.condition_status = input.conditionStatus;
    if (input.serviceNotes !== undefined) {
      updatePayload.service_notes = input.serviceNotes ? input.serviceNotes.trim() : null;
      updatePayload.notes = input.serviceNotes ? input.serviceNotes.trim() : null;
    }

    const { error } = await supabase
      .from("equipment_assets")
      .update(updatePayload)
      .eq("id", id)
      .eq("organization_id", orgId);

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/app/equipment");
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error updating equipment" };
  }
}

/**
 * Soft-delete / archive an equipment asset, preserving historical job records.
 */
export async function archiveEquipmentAsset(
  id: string,
  customerId?: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const session = await requireMembership();
    if (!canManageJobs(session.membership.role)) {
      return { error: "You do not have permission to archive equipment." };
    }

    const orgId = session.membership.organizationId;
    const supabase = await createClient();

    const { error } = await supabase
      .from("equipment_assets")
      .update({ is_archived: true })
      .eq("id", id)
      .eq("organization_id", orgId);

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/app/equipment");
    if (customerId) revalidatePath(`/app/customers/${customerId}`);
    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error archiving equipment" };
  }
}
