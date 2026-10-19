"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, type CurrentUserSession, type UserMembership } from "@/lib/auth";
import {
  createContractSchema,
  updateContractSchema,
  convertVisitToJobSchema,
  renewContractSchema,
  type CreateContractInput,
  type UpdateContractInput,
  type ConvertVisitToJobInput,
  type RenewContractInput,
} from "./schemas";
import type {
  ContractSummary,
  ContractDetail,
  ContractStatus,
  ContractType,
  BillingFrequency,
  ServiceFrequency,
  CoveredAsset,
  PlannedVisit,
  PlannedVisitStatus,
} from "./types";
import { frequencyToMonths } from "./recurrence";

type AuthContextResult =
  | {
      supabase: Awaited<ReturnType<typeof createClient>>;
      session: CurrentUserSession & { membership: UserMembership };
      error: null;
    }
  | {
      supabase: Awaited<ReturnType<typeof createClient>>;
      session: null;
      error: string;
    };

async function getContractAuthContext(requireManagePermission: boolean = false): Promise<AuthContextResult> {
  const supabase = await createClient();
  const session = await getCurrentUser();

  if (!session || !session.membership) {
    return { supabase, session: null, error: "Authentication required" };
  }

  const role = session.membership.role;
  const canManage = ["owner", "admin", "finance", "dispatcher"].includes(role);
  const canView = ["owner", "admin", "finance", "dispatcher", "technician"].includes(role);

  if (requireManagePermission && !canManage) {
    return {
      supabase,
      session: null,
      error: "Access denied: Operational management permissions required.",
    };
  }

  if (!canView) {
    return {
      supabase,
      session: null,
      error: "Access denied: You do not have permission to access service contracts.",
    };
  }

  return {
    supabase,
    session: session as CurrentUserSession & { membership: UserMembership },
    error: null,
  };
}

/**
 * Fetch all contracts for the active organization.
 */
export async function getContracts(params?: {
  search?: string;
  status?: string;
  contractType?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  success: boolean;
  data?: ContractSummary[];
  error?: string;
}> {
  try {
    const { supabase, session, error } = await getContractAuthContext(false);
    if (error || !session) return { success: false, error: error || "Unauthorized" };

    const orgId = session.membership.organizationId;
    const limit = Math.min(Math.max(params?.limit ?? 100, 1), 500);
    const offset = Math.max(params?.offset ?? 0, 0);

    let query = supabase
      .from("service_contracts")
      .select(
        `
        id,
        contract_number,
        customer_id,
        service_site_id,
        contract_name,
        title,
        description,
        contract_type,
        billing_frequency,
        service_frequency,
        service_interval_months,
        start_date,
        end_date,
        contract_amount,
        total_contract_value,
        status,
        terms,
        renewed_from_id,
        renewed_to_id,
        created_at,
        updated_at,
        customers (
          contact_name,
          company_name,
          phone
        ),
        service_sites (
          site_name,
          address
        ),
        service_contract_assets (
          id
        ),
        contract_planned_visits (
          id,
          planned_date,
          status
        )
      `
      )
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (params?.status && params.status !== "all") {
      query = query.eq("status", params.status);
    }

    if (params?.contractType && params.contractType !== "all") {
      query = query.eq("contract_type", params.contractType);
    }

    const { data: rawContracts, error: queryError } = await query;
    if (queryError) return { success: false, error: queryError.message };

    const todayStr = new Date().toISOString().split("T")[0];

    const contracts: ContractSummary[] = (rawContracts || []).map((c) => {
      const customer = Array.isArray(c.customers) ? c.customers[0] : c.customers;
      const site = Array.isArray(c.service_sites) ? c.service_sites[0] : c.service_sites;
      const assets = c.service_contract_assets || [];
      const visits = c.contract_planned_visits || [];

      // Sort visits to find next scheduled
      const sortedVisits = [...visits].sort((a, b) =>
        a.planned_date.localeCompare(b.planned_date)
      );

      const nextVisit = sortedVisits.find(
        (v) => v.planned_date >= todayStr && v.status !== "completed" && v.status !== "cancelled"
      );

      const completedCount = visits.filter(
        (v) => v.status === "completed" || v.status === "job_created"
      ).length;

      const remainingCount = Math.max(0, visits.length - completedCount);

      // Check renewal due if end date within 30 days
      let currentStatus = c.status as ContractStatus;
      if (currentStatus === "active") {
        const endDate = c.end_date;
        const thirtyDaysOut = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
        if (endDate < todayStr) {
          currentStatus = "expired";
        } else if (endDate <= thirtyDaysOut) {
          currentStatus = "renewal_due";
        }
      }

      return {
        id: c.id,
        contractNumber: c.contract_number,
        customerId: c.customer_id,
        customerName: customer?.company_name || customer?.contact_name || "Customer",
        customerPhone: customer?.phone || "",
        serviceSiteId: c.service_site_id,
        siteName: site?.site_name || null,
        siteAddress: site?.address || null,
        contractName: c.contract_name || c.title || "Maintenance Contract",
        title: c.title || c.contract_name || "Maintenance Contract",
        description: c.description,
        contractType: c.contract_type as ContractType,
        billingFrequency: c.billing_frequency as BillingFrequency,
        serviceFrequency: (c.service_frequency as ServiceFrequency) || "quarterly",
        serviceIntervalMonths: c.service_interval_months || 3,
        startDate: c.start_date,
        endDate: c.end_date,
        contractAmount: Number(c.contract_amount || c.total_contract_value || 0),
        totalContractValue: Number(c.total_contract_value || c.contract_amount || 0),
        status: currentStatus,
        terms: c.terms,
        coveredAssetsCount: assets.length,
        plannedVisitsCount: visits.length,
        completedVisitsCount: completedCount,
        nextScheduledVisit: nextVisit?.planned_date || null,
        remainingVisitsCount: remainingCount,
        renewedFromId: c.renewed_from_id,
        renewedToId: c.renewed_to_id,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      };
    });

    if (params?.search && params.search.trim()) {
      const s = params.search.toLowerCase().trim();
      const filtered = contracts.filter(
        (c) =>
          c.contractNumber.toLowerCase().includes(s) ||
          c.contractName.toLowerCase().includes(s) ||
          c.customerName.toLowerCase().includes(s)
      );
      return { success: true, data: filtered };
    }

    return { success: true, data: contracts };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load contracts",
    };
  }
}

/**
 * Fetch detailed maintenance contract with covered equipment and planned visits timeline.
 */
export async function getContractDetail(
  contractId: string
): Promise<{ success: boolean; data?: ContractDetail; error?: string }> {
  try {
    const { supabase, session, error } = await getContractAuthContext(false);
    if (error || !session) return { success: false, error: error || "Unauthorized" };

    const orgId = session.membership.organizationId;

    const { data: c, error: cErr } = await supabase
      .from("service_contracts")
      .select(
        `
        id,
        contract_number,
        customer_id,
        service_site_id,
        contract_name,
        title,
        description,
        contract_type,
        billing_frequency,
        service_frequency,
        service_interval_months,
        start_date,
        end_date,
        contract_amount,
        total_contract_value,
        status,
        terms,
        renewed_from_id,
        renewed_to_id,
        created_at,
        updated_at,
        customers (
          contact_name,
          company_name,
          phone,
          email
        ),
        service_sites (
          site_name,
          address
        )
      `
      )
      .eq("id", contractId)
      .eq("organization_id", orgId)
      .single();

    if (cErr || !c) {
      return { success: false, error: cErr?.message || "Contract not found" };
    }

    // 1. Fetch covered assets
    const { data: rawAssets } = await supabase
      .from("service_contract_assets")
      .select(
        `
        id,
        asset_id,
        notes,
        equipment_assets (
          id,
          asset_tag,
          equipment_type,
          brand,
          model,
          serial_number,
          capacity,
          location_description
        )
      `
      )
      .eq("contract_id", contractId);

    const coveredAssets: CoveredAsset[] = (rawAssets || []).map((ra) => {
      const a = Array.isArray(ra.equipment_assets) ? ra.equipment_assets[0] : ra.equipment_assets;
      return {
        id: ra.id,
        assetId: ra.asset_id,
        assetTag: a?.asset_tag || null,
        equipmentType: a?.equipment_type || "HVAC Unit",
        brand: a?.brand || "Generic",
        model: a?.model || null,
        serialNumber: a?.serial_number || null,
        capacity: a?.capacity || null,
        locationDescription: a?.location_description || null,
        notes: ra.notes,
      };
    });

    // 2. Fetch planned visits
    const { data: rawVisits } = await supabase
      .from("contract_planned_visits")
      .select(
        `
        id,
        contract_id,
        visit_number,
        planned_date,
        title,
        description,
        status,
        job_id,
        notes,
        completed_at,
        created_at,
        jobs (
          job_number
        )
      `
      )
      .eq("contract_id", contractId)
      .order("visit_number", { ascending: true });

    const plannedVisits: PlannedVisit[] = (rawVisits || []).map((rv) => {
      const job = Array.isArray(rv.jobs) ? rv.jobs[0] : rv.jobs;
      return {
        id: rv.id,
        contractId: rv.contract_id,
        visitNumber: rv.visit_number,
        plannedDate: rv.planned_date,
        title: rv.title,
        description: rv.description,
        status: rv.status as PlannedVisitStatus,
        jobId: rv.job_id,
        jobNumber: job?.job_number || null,
        notes: rv.notes,
        completedAt: rv.completed_at,
        createdAt: rv.created_at,
      };
    });

    const customer = Array.isArray(c.customers) ? c.customers[0] : c.customers;
    const site = Array.isArray(c.service_sites) ? c.service_sites[0] : c.service_sites;

    const completedCount = plannedVisits.filter(
      (v) => v.status === "completed" || v.status === "job_created"
    ).length;
    const remainingCount = Math.max(0, plannedVisits.length - completedCount);

    const todayStr = new Date().toISOString().split("T")[0];
    const nextVisit = plannedVisits.find(
      (v) => v.plannedDate >= todayStr && v.status !== "completed" && v.status !== "cancelled"
    );

    const detail: ContractDetail = {
      id: c.id,
      contractNumber: c.contract_number,
      customerId: c.customer_id,
      customerName: customer?.company_name || customer?.contact_name || "Customer",
      customerPhone: customer?.phone || "",
      customerEmail: customer?.email || null,
      serviceSiteId: c.service_site_id,
      siteName: site?.site_name || null,
      siteAddress: site?.address || null,
      contractName: c.contract_name || c.title || "Maintenance Contract",
      title: c.title || c.contract_name || "Maintenance Contract",
      description: c.description,
      contractType: c.contract_type as ContractType,
      billingFrequency: c.billing_frequency as BillingFrequency,
      serviceFrequency: (c.service_frequency as ServiceFrequency) || "quarterly",
      serviceIntervalMonths: c.service_interval_months || 3,
      startDate: c.start_date,
      endDate: c.end_date,
      contractAmount: Number(c.contract_amount || c.total_contract_value || 0),
      totalContractValue: Number(c.total_contract_value || c.contract_amount || 0),
      status: c.status as ContractStatus,
      terms: c.terms,
      coveredAssetsCount: coveredAssets.length,
      plannedVisitsCount: plannedVisits.length,
      completedVisitsCount: completedCount,
      nextScheduledVisit: nextVisit?.plannedDate || null,
      remainingVisitsCount: remainingCount,
      renewedFromId: c.renewed_from_id,
      renewedToId: c.renewed_to_id,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      coveredAssets,
      plannedVisits,
    };

    return { success: true, data: detail };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load contract details",
    };
  }
}

/**
 * Create a new service contract with covered assets and generated planned visits.
 */
export async function createContract(
  input: CreateContractInput
): Promise<{ success: boolean; contractId?: string; error?: string }> {
  try {
    const parsed = createContractSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const { supabase, session, error } = await getContractAuthContext(true);
    if (error || !session) return { success: false, error: error || "Unauthorized" };

    const orgId = session.membership.organizationId;
    const userId = session.user.id;
    const data = parsed.data;

    // 1. Generate sequential contract number (AMC-XXXX)
    const { data: docNumber, error: seqErr } = await supabase.rpc("get_next_document_number", {
      doc_type: "contract",
      prefix: "AMC",
      target_org_id: orgId,
    });

    if (seqErr || !docNumber) {
      return { success: false, error: seqErr?.message || "Failed to generate contract number" };
    }

    const intervalMonths = frequencyToMonths(data.serviceFrequency);

    // 2. Insert contract
    const { data: newContract, error: insErr } = await supabase
      .from("service_contracts")
      .insert({
        organization_id: orgId,
        contract_number: docNumber,
        customer_id: data.customerId,
        service_site_id: data.serviceSiteId || null,
        contract_name: data.contractName,
        title: data.contractName,
        description: data.description || null,
        contract_type: data.contractType,
        billing_frequency: data.billingFrequency,
        service_frequency: data.serviceFrequency,
        service_interval_months: intervalMonths,
        start_date: data.startDate,
        end_date: data.endDate,
        contract_amount: data.contractAmount,
        total_contract_value: data.contractAmount,
        status: "active",
        terms: data.terms || "Standard comprehensive annual maintenance contract terms apply.",
        created_by: userId,
      })
      .select("id")
      .single();

    if (insErr || !newContract) {
      return { success: false, error: insErr?.message || "Failed to create contract" };
    }

    // 3. Attach covered assets
    if (data.assetIds && data.assetIds.length > 0) {
      const assetsToInsert = data.assetIds.map((assetId) => ({
        organization_id: orgId,
        contract_id: newContract.id,
        asset_id: assetId,
        notes: "Covered under AMC " + docNumber,
      }));
      await supabase.from("service_contract_assets").insert(assetsToInsert);
    }

    // 4. Generate planned visits via database RPC
    await supabase.rpc("generate_contract_planned_visits", {
      p_org_id: orgId,
      p_contract_id: newContract.id,
    });

    // 5. Sync immediate reminders if any
    await supabase.rpc("sync_service_reminders", {
      p_org_id: orgId,
    });

    // 6. Audit log
    await supabase.from("activity_logs").insert({
      organization_id: orgId,
      actor_id: userId,
      entity_type: "contract",
      entity_id: newContract.id,
      action: "contract.created",
      details: {
        contract_number: docNumber,
        contract_amount: data.contractAmount,
        assets_count: data.assetIds?.length || 0,
      },
    });

    revalidatePath("/app/contracts");
    revalidatePath("/app/dashboard");
    return { success: true, contractId: newContract.id };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create contract",
    };
  }
}

/**
 * Update an existing contract.
 */
export async function updateContract(
  input: UpdateContractInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const parsed = updateContractSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const { supabase, session, error } = await getContractAuthContext(true);
    if (error || !session) return { success: false, error: error || "Unauthorized" };

    const orgId = session.membership.organizationId;
    const data = parsed.data;

    const intervalMonths = frequencyToMonths(data.serviceFrequency);

    const { error: updErr } = await supabase
      .from("service_contracts")
      .update({
        contract_name: data.contractName,
        title: data.contractName,
        description: data.description || null,
        contract_type: data.contractType,
        billing_frequency: data.billingFrequency,
        service_frequency: data.serviceFrequency,
        service_interval_months: intervalMonths,
        start_date: data.startDate,
        end_date: data.endDate,
        contract_amount: data.contractAmount,
        total_contract_value: data.contractAmount,
        status: data.status,
        terms: data.terms || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.contractId)
      .eq("organization_id", orgId);

    if (updErr) return { success: false, error: updErr.message };

    // Update assets if specified
    if (data.assetIds !== undefined) {
      await supabase
        .from("service_contract_assets")
        .delete()
        .eq("contract_id", data.contractId);

      if (data.assetIds.length > 0) {
        const assetsToInsert = data.assetIds.map((assetId) => ({
          organization_id: orgId,
          contract_id: data.contractId,
          asset_id: assetId,
        }));
        await supabase.from("service_contract_assets").insert(assetsToInsert);
      }
    }

    revalidatePath("/app/contracts");
    revalidatePath("/app/dashboard");
    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update contract",
    };
  }
}

/**
 * Archive / Terminate a contract.
 */
export async function archiveContract(
  contractId: string,
  newStatus: "archived" | "terminated" = "archived"
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, session, error } = await getContractAuthContext(true);
    if (error || !session) return { success: false, error: error || "Unauthorized" };

    const orgId = session.membership.organizationId;

    const { error: updErr } = await supabase
      .from("service_contracts")
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", contractId)
      .eq("organization_id", orgId);

    if (updErr) return { success: false, error: updErr.message };

    revalidatePath("/app/contracts");
    revalidatePath("/app/dashboard");
    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to archive contract",
    };
  }
}

/**
 * Convert a planned visit into a service dispatch job with duplicate protection.
 */
export async function convertVisitToJob(
  input: ConvertVisitToJobInput
): Promise<{ success: boolean; jobId?: string; error?: string }> {
  try {
    const parsed = convertVisitToJobSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const { supabase, session, error } = await getContractAuthContext(true);
    if (error || !session) return { success: false, error: error || "Unauthorized" };

    const orgId = session.membership.organizationId;
    const userId = session.user.id;
    const data = parsed.data;

    const { data: jobId, error: rpcErr } = await supabase.rpc("convert_planned_visit_to_job", {
      p_org_id: orgId,
      p_visit_id: data.visitId,
      p_user_id: userId,
      p_technician_id: data.technicianId || undefined,
    });

    if (rpcErr || !jobId) {
      return {
        success: false,
        error: rpcErr?.message || "Failed to convert planned visit to job",
      };
    }

    revalidatePath("/app/contracts");
    revalidatePath("/app/jobs");
    revalidatePath("/app/dashboard");
    return { success: true, jobId };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to convert visit to job",
    };
  }
}

/**
 * Renew an existing contract for a new period.
 */
export async function renewContract(
  input: RenewContractInput
): Promise<{ success: boolean; newContractId?: string; error?: string }> {
  try {
    const parsed = renewContractSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const { supabase, session, error } = await getContractAuthContext(true);
    if (error || !session) return { success: false, error: error || "Unauthorized" };

    const orgId = session.membership.organizationId;
    const userId = session.user.id;
    const data = parsed.data;

    const { data: newContractId, error: rpcErr } = await supabase.rpc("renew_service_contract", {
      p_org_id: orgId,
      p_contract_id: data.contractId,
      p_user_id: userId,
      p_new_start_date: data.newStartDate,
      p_new_end_date: data.newEndDate,
      p_new_amount: data.newAmount,
    });

    if (rpcErr || !newContractId) {
      return {
        success: false,
        error: rpcErr?.message || "Failed to renew contract",
      };
    }

    revalidatePath("/app/contracts");
    revalidatePath("/app/dashboard");
    return { success: true, newContractId };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to renew contract",
    };
  }
}

/**
 * Seed realistic AMC contract with covered equipment and planned visits.
 */
export async function seedSampleContractData(): Promise<{
  success: boolean;
  contractId?: string;
  error?: string;
}> {
  try {
    const { supabase, session, error } = await getContractAuthContext(true);
    if (error || !session) return { success: false, error: error || "Unauthorized" };

    const orgId = session.membership.organizationId;

    // 1. Find or create customer
    let customerId: string;
    let siteId: string | null = null;
    const { data: cust } = await supabase
      .from("customers")
      .select("id")
      .eq("organization_id", orgId)
      .limit(1)
      .maybeSingle();

    if (cust) {
      customerId = cust.id;
      const { data: site } = await supabase
        .from("service_sites")
        .select("id")
        .eq("customer_id", customerId)
        .limit(1)
        .maybeSingle();
      siteId = site?.id || null;
    } else {
      const { data: newCust, error: custErr } = await supabase
        .from("customers")
        .insert({
          organization_id: orgId,
          contact_name: "Tariqul Islam",
          company_name: "Apex Corporate Tower",
          phone: "01712345678",
          email: "facilities@apex-bd.com",
          billing_address: "Plot 7, Gulshan Avenue, Dhaka 1212",
          customer_type: "commercial",
          notes: "Primary headquarters HVAC contract.",
        })
        .select("id")
        .single();

      if (custErr || !newCust) return { success: false, error: custErr?.message };
      customerId = newCust.id;

      const { data: newSite } = await supabase
        .from("service_sites")
        .insert({
          organization_id: orgId,
          customer_id: customerId,
          site_name: "Corporate Headquarters",
          address_line1: "Plot 7, Gulshan Avenue, Dhaka 1212",
          address: "Plot 7, Gulshan Avenue, Dhaka 1212",
          area: "Gulshan-1",
          city: "Dhaka",
          district: "Dhaka",
          postcode: "1212",
        })
        .select("id")
        .single();
      siteId = newSite?.id || null;
    }

    // 2. Ensure covered equipment
    const { data: existingAssets } = await supabase
      .from("equipment_assets")
      .select("id")
      .eq("customer_id", customerId)
      .limit(3);

    let assetIds: string[] = (existingAssets || []).map((a) => a.id);

    if (assetIds.length === 0) {
      const { data: newAssets } = await supabase
        .from("equipment_assets")
        .insert([
          {
            organization_id: orgId,
            customer_id: customerId,
            service_site_id: siteId,
            site_id: siteId || "",
            equipment_type: "Cassette AC",
            brand: "General",
            model: "AUG-30AB",
            capacity: "2.5 Ton",
            condition_status: "operational",
            location_description: "Level 4 Boardroom",
          },
          {
            organization_id: orgId,
            customer_id: customerId,
            service_site_id: siteId,
            site_id: siteId || "",
            equipment_type: "Split AC",
            brand: "Daikin",
            model: "FTKF-50",
            capacity: "1.5 Ton",
            condition_status: "operational",
            location_description: "Level 4 Server Room",
          },
        ])
        .select("id");

      assetIds = (newAssets || []).map((a) => a.id);
    }

    // 3. Create Contract
    const startDate = new Date().toISOString().split("T")[0];
    const endDate = new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0];

    const res = await createContract({
      customerId,
      serviceSiteId: siteId,
      contractName: "Annual Comprehensive HVAC Maintenance Agreement",
      description: "Quarterly chemical cleaning, electrical diagnostics, and refrigerant pressure balancing for corporate building.",
      contractType: "comprehensive",
      billingFrequency: "quarterly",
      serviceFrequency: "quarterly",
      startDate,
      endDate,
      contractAmount: 180000,
      terms: "Quarterly billing of ৳45,000. Includes emergency 4-hour breakdown response.",
      assetIds,
    });

    return res;
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to seed sample contract",
    };
  }
}
