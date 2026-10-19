"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, type CurrentUserSession, type UserMembership } from "@/lib/auth";
import {
  checklistResponseSchema,
  partUsedSchema,
  completeJobSchema,
  validatePhotoUpload,
  canTechnicianTransition,
  type ChecklistResponseInput,
  type PartUsedInput,
  type CompleteJobInput,
} from "./schemas";
import type {
  TechJobSummary,
  TechJobDetail,
  TechJobsGrouped,
  TechChecklistItem,
  TechPartItem,
  TechPhotoAttachment,
  ChecklistResult,
} from "./types";

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

/**
 * Helper to authenticate and verify tenant membership.
 */
async function getAuthContext(): Promise<AuthContextResult> {
  const supabase = await createClient();
  const session = await getCurrentUser();

  if (!session || !session.membership) {
    return { supabase, session: null, error: "Authentication required" };
  }

  return {
    supabase,
    session: session as CurrentUserSession & { membership: UserMembership },
    error: null,
  };
}

/**
 * Fetch all assigned jobs for the current technician, grouped into Today, Upcoming, and Completed.
 */
export async function getTechnicianJobs(): Promise<{
  success: boolean;
  data?: TechJobsGrouped;
  error?: string;
}> {
  try {
    const { supabase, session, error } = await getAuthContext();
    if (error || !session) {
      return { success: false, error: error || "Authentication required" };
    }

    const orgId = session.membership.organizationId;
    const userId = session.user.id;
    const isStaff = ["owner", "admin", "dispatcher"].includes(
      session.membership.role
    );

    // Build query based on role:
    // Technicians only see jobs where they are assigned.
    // Managers/Dispatchers in tech mode see all org jobs or assigned jobs.
    let jobsQuery = supabase
      .from("jobs")
      .select(
        `
        id,
        job_number,
        title,
        description,
        job_type,
        priority,
        status,
        scheduled_start,
        scheduled_end,
        actual_start,
        actual_end,
        created_at,
        customer_id,
        customers (
          id,
          contact_name,
          company_name,
          phone
        ),
        service_site_id,
        service_sites (
          id,
          site_name,
          address,
          area,
          city,
          access_notes
        ),
        equipment_asset_id,
        equipment_assets (
          id,
          brand,
          model,
          capacity
        ),
        job_checklists (
          id,
          is_mandatory,
          result
        )
      `
      )
      .eq("organization_id", orgId);

    if (!isStaff) {
      // Find jobs assigned to this technician
      const { data: assignments } = await supabase
        .from("job_assignments")
        .select("job_id")
        .eq("organization_id", orgId)
        .eq("technician_id", userId);

      const assignedJobIds = (assignments || []).map((a) => a.job_id);
      if (assignedJobIds.length === 0) {
        return {
          success: true,
          data: { today: [], upcoming: [], completed: [] },
        };
      }

      jobsQuery = jobsQuery.in("id", assignedJobIds);
    }

    const { data: rawJobs, error: queryError } = await jobsQuery.order(
      "scheduled_start",
      { ascending: true, nullsFirst: false }
    );

    if (queryError) {
      return { success: false, error: queryError.message };
    }

    // Determine current date in Dhaka timezone (UTC+6)
    const nowDhaka = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" })
    );
    const todayDhakaStr = nowDhaka.toISOString().split("T")[0];

    const today: TechJobSummary[] = [];
    const upcoming: TechJobSummary[] = [];
    const completed: TechJobSummary[] = [];

    for (const j of rawJobs || []) {
      const customer = Array.isArray(j.customers) ? j.customers[0] : j.customers;
      const site = Array.isArray(j.service_sites)
        ? j.service_sites[0]
        : j.service_sites;
      const asset = Array.isArray(j.equipment_assets)
        ? j.equipment_assets[0]
        : j.equipment_assets;
      const checklists = (j.job_checklists || []) as Array<{
        id: string;
        is_mandatory: boolean;
        result: string | null;
      }>;

      const totalChecklists = checklists.length;
      const completedChecklists = checklists.filter(
        (c) => c.result && c.result !== "pending"
      ).length;

      const summary: TechJobSummary = {
        id: j.id,
        jobNumber: j.job_number,
        title: j.title,
        description: j.description,
        jobType: j.job_type,
        priority: j.priority as TechJobSummary["priority"],
        status: j.status as TechJobSummary["status"],
        scheduledStart: j.scheduled_start,
        scheduledEnd: j.scheduled_end,
        actualStart: j.actual_start,
        actualEnd: j.actual_end,
        customerId: customer?.id || j.customer_id,
        customerName:
          customer?.company_name || customer?.contact_name || "Customer",
        customerPhone: customer?.phone || "",
        siteId: site?.id || j.service_site_id || "",
        siteName: site?.site_name || "Service Site",
        siteAddress: site?.address || "Address not provided",
        siteArea: site?.area || null,
        siteCity: site?.city || null,
        siteLandmark: site?.access_notes || null,
        assetId: asset?.id || j.equipment_asset_id || null,
        assetBrand: asset?.brand || null,
        assetModel: asset?.model || null,
        assetCapacity: asset?.capacity || null,
        totalChecklists,
        completedChecklists,
        createdAt: j.created_at,
      };

      if (j.status === "completed") {
        completed.push(summary);
      } else if (j.status === "in_progress") {
        // Active work is always surfaced in Today tab
        today.push(summary);
      } else {
        const jobDateStr = j.scheduled_start
          ? new Date(j.scheduled_start).toISOString().split("T")[0]
          : null;

        if (jobDateStr && jobDateStr <= todayDhakaStr) {
          today.push(summary);
        } else {
          upcoming.push(summary);
        }
      }
    }

    return {
      success: true,
      data: { today, upcoming, completed },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load technician jobs";
    return { success: false, error: message };
  }
}

/**
 * Fetch detailed job execution data including customer, equipment specs,
 * diagnostic checklist items, recorded parts used, and private photo attachments.
 */
export async function getTechnicianJobDetail(
  jobId: string
): Promise<{ success: boolean; data?: TechJobDetail; error?: string }> {
  try {
    const { supabase, session, error } = await getAuthContext();
    if (error || !session) {
      return { success: false, error: error || "Authentication required" };
    }

    const orgId = session.membership.organizationId;
    const userId = session.user.id;
    const isStaff = ["owner", "admin", "dispatcher"].includes(
      session.membership.role
    );

    // Verify permission: technician must be assigned unless staff
    if (!isStaff) {
      const { data: assignment } = await supabase
        .from("job_assignments")
        .select("id")
        .eq("organization_id", orgId)
        .eq("job_id", jobId)
        .eq("technician_id", userId)
        .maybeSingle();

      if (!assignment) {
        return {
          success: false,
          error: "Access denied: You are not assigned to this job.",
        };
      }
    }

    // Auto-seed standard AC checklist items if none exist yet
    const { count: checklistCount } = await supabase
      .from("job_checklists")
      .select("id", { count: "exact", head: true })
      .eq("job_id", jobId);

    if (!checklistCount || checklistCount === 0) {
      await supabase.rpc("seed_job_standard_checklist", { p_job_id: jobId });
    }

    // Fetch Job with related records
    const { data: j, error: jobError } = await supabase
      .from("jobs")
      .select(
        `
        id,
        job_number,
        title,
        description,
        job_type,
        priority,
        status,
        scheduled_start,
        scheduled_end,
        actual_start,
        actual_end,
        assigned_notes,
        completion_notes,
        work_performed,
        follow_up_recommendation,
        completed_at,
        created_at,
        customer_id,
        customers (
          id,
          contact_name,
          company_name,
          phone,
          alternate_phone
        ),
        service_site_id,
        service_sites (
          id,
          site_name,
          address,
          area,
          city,
          access_notes
        ),
        equipment_asset_id,
        equipment_assets (
          id,
          brand,
          model,
          capacity,
          service_notes,
          location_description
        )
      `
      )
      .eq("id", jobId)
      .eq("organization_id", orgId)
      .single();

    if (jobError || !j) {
      return { success: false, error: jobError?.message || "Job not found" };
    }

    // Fetch Checklists
    const { data: rawChecklists } = await supabase
      .from("job_checklists")
      .select("*")
      .eq("job_id", jobId)
      .order("is_mandatory", { ascending: false })
      .order("created_at", { ascending: true });

    const checklists: TechChecklistItem[] = (rawChecklists || []).map((c) => ({
      id: c.id,
      itemKey: c.item_key,
      label: c.label,
      fieldType: (c.field_type as TechChecklistItem["fieldType"]) || "boolean",
      unit: c.unit,
      category: c.category || "general",
      isMandatory: c.is_mandatory,
      result: (c.result as ChecklistResult) || (c.passed ? "pass" : "pending"),
      valueNumber: c.value_number,
      valueBoolean: c.value_boolean,
      valueText: c.value_text,
      notes: c.notes,
      recordedAt: c.recorded_at,
    }));

    // Fetch Parts Used
    const { data: rawParts } = await supabase
      .from("job_parts_used")
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true });

    const parts: TechPartItem[] = (rawParts || []).map((p) => ({
      id: p.id,
      partName: p.part_name,
      quantity: Number(p.quantity),
      unitOfMeasure: p.unit_of_measure,
      notes: p.notes,
      unitPrice: Number(p.unit_price) || 0,
      createdAt: p.created_at,
    }));

    // Fetch Attachments (Photos) and generate signed URLs from private storage
    const { data: rawAttachments } = await supabase
      .from("job_attachments")
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: false });

    const photos: TechPhotoAttachment[] = [];
    for (const a of rawAttachments || []) {
      let signedUrl = "";
      if (a.file_path) {
        const { data: signedData } = await supabase.storage
          .from("job-attachments")
          .createSignedUrl(a.file_path, 3600); // 1 hour access
        if (signedData?.signedUrl) {
          signedUrl = signedData.signedUrl;
        }
      }

      photos.push({
        id: a.id,
        fileName: a.file_name,
        filePath: a.file_path,
        fileSizeBytes: a.file_size_bytes,
        mimeType: a.mime_type,
        attachmentType: a.attachment_type,
        caption: a.caption,
        signedUrl,
        createdAt: a.created_at,
      });
    }

    const customer = Array.isArray(j.customers) ? j.customers[0] : j.customers;
    const site = Array.isArray(j.service_sites)
      ? j.service_sites[0]
      : j.service_sites;
    const asset = Array.isArray(j.equipment_assets)
      ? j.equipment_assets[0]
      : j.equipment_assets;

    const totalChecklists = checklists.length;
    const completedChecklists = checklists.filter(
      (c) => c.result && c.result !== "pending"
    ).length;

    const detail: TechJobDetail = {
      id: j.id,
      jobNumber: j.job_number,
      title: j.title,
      description: j.description,
      jobType: j.job_type,
      priority: j.priority as TechJobSummary["priority"],
      status: j.status as TechJobSummary["status"],
      scheduledStart: j.scheduled_start,
      scheduledEnd: j.scheduled_end,
      actualStart: j.actual_start,
      actualEnd: j.actual_end,
      assignedNotes: j.assigned_notes,
      workPerformed: j.work_performed,
      completionNotes: j.completion_notes,
      followUpRecommendation: j.follow_up_recommendation,
      completedAt: j.completed_at,
      customerId: customer?.id || j.customer_id,
      customerName:
        customer?.company_name || customer?.contact_name || "Customer",
      customerPhone: customer?.phone || "",
      alternatePhone: customer?.alternate_phone || null,
      siteId: site?.id || j.service_site_id || "",
      siteName: site?.site_name || "Service Site",
      siteAddress: site?.address || "Address not provided",
      siteArea: site?.area || null,
      siteCity: site?.city || null,
      siteLandmark: site?.access_notes || null,
      accessNotes: site?.access_notes || null,
      assetId: asset?.id || j.equipment_asset_id || null,
      assetBrand: asset?.brand || null,
      assetModel: asset?.model || null,
      assetCapacity: asset?.capacity || null,
      equipmentLocation: asset?.location_description || null,
      equipmentServiceNotes: asset?.service_notes || null,
      totalChecklists,
      completedChecklists,
      createdAt: j.created_at,
      checklists,
      parts,
      photos,
    };

    return { success: true, data: detail };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load job details";
    return { success: false, error: message };
  }
}

/**
 * Transition job work state: Start Work (scheduled -> in_progress)
 */
export async function startJobWork(jobId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { supabase, session, error } = await getAuthContext();
    if (error || !session) return { success: false, error: error || "Unauthorized" };

    const orgId = session.membership.organizationId;
    const nowIso = new Date().toISOString();

    const { data: job } = await supabase
      .from("jobs")
      .select("status, actual_start")
      .eq("id", jobId)
      .eq("organization_id", orgId)
      .single();

    if (!job) return { success: false, error: "Job not found" };

    if (!canTechnicianTransition(job.status, "in_progress")) {
      return {
        success: false,
        error: `Cannot start work from current status: ${job.status}`,
      };
    }

    const { error: updateError } = await supabase
      .from("jobs")
      .update({
        status: "in_progress",
        actual_start: job.actual_start || nowIso,
        updated_at: nowIso,
      })
      .eq("id", jobId)
      .eq("organization_id", orgId);

    if (updateError) return { success: false, error: updateError.message };

    // Update active visit
    await supabase
      .from("job_visits")
      .update({
        visit_status: "in_progress",
        actual_start: nowIso,
        updated_at: nowIso,
      })
      .eq("job_id", jobId)
      .is("actual_start", null);

    revalidatePath(`/tech/jobs/${jobId}`);
    revalidatePath("/tech/jobs");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to start job" };
  }
}

/**
 * Transition job work state: Pause / On-Hold (in_progress -> on_hold)
 */
export async function pauseJobWork(
  jobId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, session, error } = await getAuthContext();
    if (error || !session) return { success: false, error: error || "Unauthorized" };

    const orgId = session.membership.organizationId;
    const nowIso = new Date().toISOString();

    const { data: job } = await supabase
      .from("jobs")
      .select("status, assigned_notes")
      .eq("id", jobId)
      .eq("organization_id", orgId)
      .single();

    if (!job) return { success: false, error: "Job not found" };

    if (!canTechnicianTransition(job.status, "on_hold")) {
      return {
        success: false,
        error: `Cannot put on hold from current status: ${job.status}`,
      };
    }

    const updatedNotes = reason
      ? `${job.assigned_notes || ""}\n[Paused: ${reason}]`.trim()
      : job.assigned_notes;

    const { error: updateError } = await supabase
      .from("jobs")
      .update({
        status: "on_hold",
        assigned_notes: updatedNotes,
        updated_at: nowIso,
      })
      .eq("id", jobId)
      .eq("organization_id", orgId);

    if (updateError) return { success: false, error: updateError.message };

    revalidatePath(`/tech/jobs/${jobId}`);
    revalidatePath("/tech/jobs");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to pause job" };
  }
}

/**
 * Transition job work state: Resume Work (on_hold -> in_progress)
 */
export async function resumeJobWork(jobId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { supabase, session, error } = await getAuthContext();
    if (error || !session) return { success: false, error: error || "Unauthorized" };

    const orgId = session.membership.organizationId;
    const nowIso = new Date().toISOString();

    const { data: job } = await supabase
      .from("jobs")
      .select("status")
      .eq("id", jobId)
      .eq("organization_id", orgId)
      .single();

    if (!job) return { success: false, error: "Job not found" };

    if (!canTechnicianTransition(job.status, "in_progress")) {
      return {
        success: false,
        error: `Cannot resume from status: ${job.status}`,
      };
    }

    const { error: updateError } = await supabase
      .from("jobs")
      .update({
        status: "in_progress",
        updated_at: nowIso,
      })
      .eq("id", jobId)
      .eq("organization_id", orgId);

    if (updateError) return { success: false, error: updateError.message };

    revalidatePath(`/tech/jobs/${jobId}`);
    revalidatePath("/tech/jobs");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to resume job" };
  }
}

/**
 * Save a single diagnostic checklist item response.
 * Enforces that tests are not claimed if no real response was recorded.
 */
export async function saveChecklistResponse(
  jobId: string,
  input: ChecklistResponseInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const parsed = checklistResponseSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const { supabase, session, error } = await getAuthContext();
    if (error || !session) return { success: false, error: error || "Unauthorized" };

    const orgId = session.membership.organizationId;
    const userId = session.user.id;
    const nowIso = new Date().toISOString();
    const data = parsed.data;

    const { error: updateError } = await supabase
      .from("job_checklists")
      .update({
        result: data.result,
        passed: data.result === "pass",
        value_number: data.valueNumber !== undefined ? data.valueNumber : null,
        value_boolean: data.valueBoolean !== undefined ? data.valueBoolean : null,
        value_text: data.valueText || null,
        notes: data.notes || null,
        recorded_at: nowIso,
        recorded_by: userId,
      })
      .eq("job_id", jobId)
      .eq("item_key", data.itemKey)
      .eq("organization_id", orgId);

    if (updateError) return { success: false, error: updateError.message };

    revalidatePath(`/tech/jobs/${jobId}`);
    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to record checklist response",
    };
  }
}

/**
 * Record a part used during the service job.
 */
export async function addPartUsed(
  jobId: string,
  input: PartUsedInput
): Promise<{ success: boolean; part?: TechPartItem; error?: string }> {
  try {
    const parsed = partUsedSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const { supabase, session, error } = await getAuthContext();
    if (error || !session) return { success: false, error: error || "Unauthorized" };

    const orgId = session.membership.organizationId;
    const data = parsed.data;

    const { data: inserted, error: insertError } = await supabase
      .from("job_parts_used")
      .insert({
        organization_id: orgId,
        job_id: jobId,
        part_name: data.partName,
        quantity: data.quantity,
        unit_of_measure: data.unitOfMeasure,
        notes: data.notes || null,
        unit_cost: 0,
        unit_price: 0,
        is_billable: true,
      })
      .select()
      .single();

    if (insertError || !inserted) {
      return { success: false, error: insertError?.message || "Failed to add part" };
    }

    revalidatePath(`/tech/jobs/${jobId}`);
    return {
      success: true,
      part: {
        id: inserted.id,
        partName: inserted.part_name,
        quantity: Number(inserted.quantity),
        unitOfMeasure: inserted.unit_of_measure,
        notes: inserted.notes,
        createdAt: inserted.created_at,
      },
    };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to record part" };
  }
}

/**
 * Remove a recorded part from the job.
 */
export async function removePartUsed(
  jobId: string,
  partId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, session, error } = await getAuthContext();
    if (error || !session) return { success: false, error: error || "Unauthorized" };

    const orgId = session.membership.organizationId;

    const { error: deleteError } = await supabase
      .from("job_parts_used")
      .delete()
      .eq("id", partId)
      .eq("job_id", jobId)
      .eq("organization_id", orgId);

    if (deleteError) return { success: false, error: deleteError.message };

    revalidatePath(`/tech/jobs/${jobId}`);
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to delete part" };
  }
}

/**
 * Upload a service photo to private Supabase Storage and register the attachment.
 * Validates MIME type, file size (< 10MB), and ensures tenant-scoped paths.
 */
export async function uploadJobPhoto(
  formData: FormData
): Promise<{ success: boolean; photo?: TechPhotoAttachment; error?: string }> {
  try {
    const { supabase, session, error } = await getAuthContext();
    if (error || !session) return { success: false, error: error || "Unauthorized" };

    const orgId = session.membership.organizationId;
    const userId = session.user.id;

    const jobId = formData.get("jobId") as string;
    const file = formData.get("file") as File | null;
    const caption = (formData.get("caption") as string) || null;
    const attachmentType =
      (formData.get("attachmentType") as string) || "evidence";

    if (!jobId) return { success: false, error: "Job ID is required" };
    if (!file) return { success: false, error: "No photo file provided" };

    // Validate MIME type and file size
    const validation = validatePhotoUpload({ type: file.type, size: file.size });
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Convert file to Buffer for server upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Build private tenant storage path: {orgId}/{jobId}/{randomUUID}-{sanitizedName}
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const uniqueId = crypto.randomUUID();
    const storagePath = `${orgId}/${jobId}/${uniqueId}-${cleanFileName}`;

    // Upload to private bucket
    const { error: uploadError } = await supabase.storage
      .from("job-attachments")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return {
        success: false,
        error: `Storage upload failed: ${uploadError.message}`,
      };
    }

    // Insert database record
    const { data: record, error: dbError } = await supabase
      .from("job_attachments")
      .insert({
        organization_id: orgId,
        job_id: jobId,
        file_name: file.name,
        file_path: storagePath,
        file_size_bytes: file.size,
        mime_type: file.type,
        attachment_type: attachmentType,
        caption: caption,
        uploaded_by: userId,
      })
      .select()
      .single();

    if (dbError || !record) {
      // Cleanup uploaded file on DB insert failure
      await supabase.storage.from("job-attachments").remove([storagePath]);
      return {
        success: false,
        error: `Failed to record photo attachment: ${dbError?.message}`,
      };
    }

    // Generate signed URL for immediate view
    const { data: signedData } = await supabase.storage
      .from("job-attachments")
      .createSignedUrl(storagePath, 3600);

    revalidatePath(`/tech/jobs/${jobId}`);

    return {
      success: true,
      photo: {
        id: record.id,
        fileName: record.file_name,
        filePath: record.file_path,
        fileSizeBytes: record.file_size_bytes,
        mimeType: record.mime_type,
        attachmentType: record.attachment_type,
        caption: record.caption,
        signedUrl: signedData?.signedUrl || "",
        createdAt: record.created_at,
      },
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to upload photo",
    };
  }
}

/**
 * Complete the job work order.
 * Strictly verifies that all mandatory checklist items have been answered,
 * records the actual work performed, and updates timestamps.
 */
export async function completeJobWork(
  jobId: string,
  input: CompleteJobInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const parsed = completeJobSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const { supabase, session, error } = await getAuthContext();
    if (error || !session) return { success: false, error: error || "Unauthorized" };

    const orgId = session.membership.organizationId;
    const nowIso = new Date().toISOString();
    const data = parsed.data;

    // 1. Fetch Job and verify status
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("status, actual_start")
      .eq("id", jobId)
      .eq("organization_id", orgId)
      .single();

    if (jobError || !job) {
      return { success: false, error: "Job not found" };
    }

    if (job.status === "completed") {
      return { success: false, error: "Job is already completed" };
    }

    // 2. Verify all mandatory checklist items are answered
    const { data: mandatoryItems, error: chkError } = await supabase
      .from("job_checklists")
      .select("label, result")
      .eq("job_id", jobId)
      .eq("is_mandatory", true);

    if (chkError) {
      return { success: false, error: chkError.message };
    }

    const unanswered = (mandatoryItems || []).filter(
      (item) => !item.result || item.result === "pending"
    );

    if (unanswered.length > 0) {
      return {
        success: false,
        error: `Cannot complete job: ${unanswered.length} mandatory checklist item(s) are still pending (e.g. "${unanswered[0].label}"). Please complete all checks before submitting.`,
      };
    }

    // 3. Update job to completed
    const { error: updateError } = await supabase
      .from("jobs")
      .update({
        status: "completed",
        completed_at: nowIso,
        actual_end: nowIso,
        actual_start: job.actual_start || nowIso,
        work_performed: data.workPerformed,
        completion_notes: data.completionNotes || null,
        follow_up_recommendation: data.followUpRecommendation || null,
        updated_at: nowIso,
      })
      .eq("id", jobId)
      .eq("organization_id", orgId);

    if (updateError) return { success: false, error: updateError.message };

    // 4. Update any active visit
    await supabase
      .from("job_visits")
      .update({
        visit_status: "completed",
        status: "completed",
        actual_end: nowIso,
        technician_notes: data.completionNotes || data.workPerformed,
        updated_at: nowIso,
      })
      .eq("job_id", jobId);

    // 5. Record activity log
    await supabase.from("activity_logs").insert({
      organization_id: orgId,
      actor_id: session.user.id,
      entity_type: "job",
      entity_id: jobId,
      action: "job.completed_by_technician",
      details: {
        workPerformed: data.workPerformed,
        completedAt: nowIso,
      },
    });

    revalidatePath(`/tech/jobs/${jobId}`);
    revalidatePath("/tech/jobs");
    revalidatePath("/app/jobs");

    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to complete job",
    };
  }
}

/**
 * Seed a realistic AC maintenance job for the active user if no jobs exist yet,
 * enabling immediate end-to-end verification of the technician workspace with real DB tables.
 */
export async function seedSampleTechnicianJob(): Promise<{
  success: boolean;
  jobId?: string;
  error?: string;
}> {
  try {
    const { supabase, session, error } = await getAuthContext();
    if (error || !session) return { success: false, error: error || "Unauthorized" };

    const orgId = session.membership.organizationId;
    const userId = session.user.id;

    // 1. Ensure a customer exists
    let customerId: string;
    const { data: existingCust } = await supabase
      .from("customers")
      .select("id")
      .eq("organization_id", orgId)
      .limit(1)
      .maybeSingle();

    if (existingCust) {
      customerId = existingCust.id;
    } else {
      const { data: newCust, error: custErr } = await supabase
        .from("customers")
        .insert({
          organization_id: orgId,
          contact_name: "Engr. Rafiqul Islam",
          company_name: "Apex Tower Corporate HQ",
          phone: "01711234567",
          alternate_phone: "01819876543",
          email: "facilities@apexbd.com",
          customer_type: "commercial",
          notes: "Primary commercial HVAC maintenance contract client.",
        })
        .select("id")
        .single();
      if (custErr || !newCust) {
        return { success: false, error: custErr?.message || "Failed to create sample customer" };
      }
      customerId = newCust.id;
    }

    // 2. Ensure a service site exists
    let siteId: string;
    const { data: existingSite } = await supabase
      .from("service_sites")
      .select("id")
      .eq("organization_id", orgId)
      .eq("customer_id", customerId)
      .limit(1)
      .maybeSingle();

    if (existingSite) {
      siteId = existingSite.id;
    } else {
      const { data: newSite, error: siteErr } = await supabase
        .from("service_sites")
        .insert({
          organization_id: orgId,
          customer_id: customerId,
          site_name: "Apex Tower - Server Room & Executive Floor",
          address: "Road 11, Plot 45, Gulshan-1, Dhaka 1212",
          address_line1: "Road 11, Plot 45, Gulshan-1, Dhaka 1212",
          area: "Gulshan-1",
          city: "Dhaka",
          district: "Dhaka",
          access_notes: "Entry via Service Elevator B. Contact Building Security on 2nd Floor.",
        })
        .select("id")
        .single();
      if (siteErr || !newSite) {
        return { success: false, error: siteErr?.message || "Failed to create sample site" };
      }
      siteId = newSite.id;
    }

    // 3. Ensure equipment asset exists
    let assetId: string;
    const { data: existingAsset } = await supabase
      .from("equipment_assets")
      .select("id")
      .eq("organization_id", orgId)
      .limit(1)
      .maybeSingle();

    if (existingAsset) {
      assetId = existingAsset.id;
    } else {
      const { data: newAsset, error: assetErr } = await supabase
        .from("equipment_assets")
        .insert({
          organization_id: orgId,
          customer_id: customerId,
          service_site_id: siteId,
          site_id: siteId,
          equipment_type: "Inverter Split AC",
          brand: "General Fujitsu",
          model: "ASGA24FUTC-2 Ton",
          serial_number: "GF-2024-DH-8492",
          capacity: "2.0 Ton (24,000 BTU)",
          location_description: "Floor 7 - Main Server Room Rack Area",
          service_notes: "Last serviced 3 months ago. Gas pressure tested at 115 PSI.",
        })
        .select("id")
        .single();
      if (assetErr || !newAsset) {
        return { success: false, error: assetErr?.message || "Failed to create sample equipment" };
      }
      assetId = newAsset.id;
    }

    // 4. Create Job
    const now = new Date();
    const scheduledStart = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
    const scheduledEnd = new Date(now.getTime() + 150 * 60 * 1000).toISOString();

    const { data: docNumber } = await supabase.rpc("get_next_document_number", {
      doc_type: "job",
      prefix: "JOB",
      target_org_id: orgId,
    });
    const jobNumber = docNumber || `JOB-${Math.floor(1000 + Math.random() * 9000)}`;

    const { data: newJob, error: jobErr } = await supabase
      .from("jobs")
      .insert({
        organization_id: orgId,
        job_number: jobNumber,
        title: "Quarterly Preventive AC Overhaul & Jet Foam Wash",
        description:
          "Thorough jet wash of evaporator & condenser coils, R410A operating pressure check, compressor current check, and drain line flushing.",
        priority: "high",
        status: "scheduled",
        job_type: "maintenance",
        customer_id: customerId,
        service_site_id: siteId,
        site_id: siteId,
        equipment_asset_id: assetId,
        asset_id: assetId,
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
        estimated_duration_minutes: 120,
        assigned_notes:
          "Please verify indoor supply temperature before and after jet washing.",
        created_by: userId,
      })
      .select("id")
      .single();

    if (jobErr || !newJob) {
      return { success: false, error: jobErr?.message || "Failed to create sample job" };
    }

    // 5. Assign current user
    await supabase.from("job_assignments").insert({
      organization_id: orgId,
      job_id: newJob.id,
      technician_id: userId,
      is_lead: true,
      assignment_status: "assigned",
      assigned_by: userId,
    });

    // 6. Create initial visit
    await supabase.from("job_visits").insert({
      organization_id: orgId,
      job_id: newJob.id,
      visit_number: 1,
      scheduled_start: scheduledStart,
      scheduled_end: scheduledEnd,
      status: "scheduled",
      visit_status: "scheduled",
    });

    // 7. Seed standard checklist items
    await supabase.rpc("seed_job_standard_checklist", { p_job_id: newJob.id });

    revalidatePath("/tech/jobs");
    return { success: true, jobId: newJob.id };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to seed sample job",
    };
  }
}
