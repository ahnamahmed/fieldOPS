"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMembership } from "@/lib/auth";
import { canManageJobs, isTechnician } from "@/lib/permissions";
import type { Database } from "@/types/database.types";
import {
  createJobSchema,
  updateJobSchema,
  assignTechniciansSchema,
  transitionStatusSchema,
  isValidJobTransition,
  ALLOWED_JOB_TRANSITIONS,
  type CreateJobInput,
  type UpdateJobInput,
  type AssignTechniciansInput,
  type TransitionStatusInput,
  type JobStatus,
  type JobPriority,
  type JobType,
} from "@/schemas/job";

type JobUpdate = Database["public"]["Tables"]["jobs"]["Update"];

export interface AssignedTechnicianInfo {
  assignmentId: string;
  technicianId: string;
  name: string;
  phone: string | null;
  isLead: boolean;
  status: string;
}

export interface JobListItem {
  id: string;
  jobNumber: string;
  title: string;
  description: string | null;
  jobType: JobType;
  priority: JobPriority;
  status: JobStatus;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  estimatedDuration: number;
  customerId: string;
  customerName: string;
  customerPhone: string;
  siteId: string;
  siteName: string;
  siteAddress: string;
  assetId: string | null;
  assetBrand: string | null;
  assetCapacity: string | null;
  assignedTechnicians: AssignedTechnicianInfo[];
  createdAt: string;
  updatedAt: string;
}

export interface JobVisitItem {
  id: string;
  visitNumber: number;
  status: string;
  scheduledStart: string;
  scheduledEnd: string;
  actualStart: string | null;
  actualEnd: string | null;
  technicianNotes: string | null;
}

export interface JobDetail extends JobListItem {
  siteContactName: string | null;
  siteContactPhone: string | null;
  accessNotes: string | null;
  assignedNotes: string | null;
  completionNotes: string | null;
  completedAt: string | null;
  equipment: {
    id: string;
    brand: string;
    model: string | null;
    serialNumber: string | null;
    capacity: string | null;
    refrigerant: string | null;
    location: string | null;
  } | null;
  visits: JobVisitItem[];
  activityLogs: Array<{
    id: string;
    action: string;
    actorName: string | null;
    details: Record<string, unknown> | null;
    createdAt: string;
  }>;
  allowedNextStatuses: JobStatus[];
}

export interface ScheduleConflict {
  technicianId: string;
  technicianName: string;
  conflictingJobId: string;
  conflictingJobNumber: string;
  conflictingJobTitle: string;
  scheduledStart: string;
  scheduledEnd: string;
}

/**
 * Check for scheduling conflicts for a technician across jobs in the same organization
 */
export async function checkTechnicianScheduleConflicts(
  technicianId: string,
  scheduledStart: string,
  scheduledEnd: string,
  excludeJobId?: string
): Promise<{ conflicts: ScheduleConflict[]; error?: string }> {
  try {
    const session = await requireMembership();
    const orgId = session.membership.organizationId;
    const supabase = await createClient();

    // Query assignments for this technician on other active jobs
    const { data: assignments, error } = await supabase
      .from("job_assignments")
      .select(`
        job_id,
        technician_id,
        profiles!job_assignments_technician_id_fkey(full_name),
        jobs!job_assignments_job_id_fkey(
          id,
          job_number,
          title,
          status,
          scheduled_start,
          scheduled_end
        )
      `)
      .eq("organization_id", orgId)
      .eq("technician_id", technicianId);

    if (error) {
      return { conflicts: [], error: error.message };
    }

    const conflicts: ScheduleConflict[] = [];
    const newStart = new Date(scheduledStart).getTime();
    const newEnd = new Date(scheduledEnd).getTime();

    for (const a of assignments || []) {
      const job = a.jobs;
      if (!job) continue;
      if (excludeJobId && job.id === excludeJobId) continue;
      if (job.status === "completed" || job.status === "cancelled") continue;
      if (!job.scheduled_start || !job.scheduled_end) continue;

      const existingStart = new Date(job.scheduled_start).getTime();
      const existingEnd = new Date(job.scheduled_end).getTime();

      // Overlap condition: start < existingEnd AND end > existingStart
      if (newStart < existingEnd && newEnd > existingStart) {
        conflicts.push({
          technicianId,
          technicianName: a.profiles?.full_name || "Assigned Technician",
          conflictingJobId: job.id,
          conflictingJobNumber: job.job_number,
          conflictingJobTitle: job.title,
          scheduledStart: job.scheduled_start,
          scheduledEnd: job.scheduled_end,
        });
      }
    }

    return { conflicts };
  } catch (err: unknown) {
    return { conflicts: [], error: err instanceof Error ? err.message : "Error checking conflicts" };
  }
}

/**
 * Fetch jobs list with search and filters
 */
export async function getJobs(params?: {
  search?: string;
  status?: string;
  priority?: string;
  technicianId?: string;
  customerId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<{ data?: JobListItem[]; error?: string }> {
  try {
    const session = await requireMembership();
    const orgId = session.membership.organizationId;
    const userRole = session.membership.role;
    const userId = session.user.id;
    const supabase = await createClient();

    let query = supabase
      .from("jobs")
      .select(`
        id,
        job_number,
        title,
        description,
        job_type,
        priority,
        status,
        scheduled_start,
        scheduled_end,
        estimated_duration,
        estimated_duration_minutes,
        created_at,
        updated_at,
        customers!jobs_customer_id_fkey(id, name, company_name, contact_name, phone),
        service_sites!jobs_site_id_fkey(id, site_name, address, address_line1, area),
        equipment_assets!jobs_asset_id_fkey(id, brand, capacity),
        job_assignments!job_assignments_job_id_fkey(
          id,
          technician_id,
          is_lead,
          assignment_status,
          profiles!job_assignments_technician_id_fkey(full_name, phone)
        )
      `)
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    // Status filter
    if (params?.status && params.status !== "all") {
      query = query.eq("status", params.status);
    }

    // Priority filter
    if (params?.priority && params.priority !== "all") {
      query = query.eq("priority", params.priority);
    }

    // Customer filter
    if (params?.customerId) {
      query = query.eq("customer_id", params.customerId);
    }

    // Date range filter
    if (params?.startDate) {
      query = query.gte("scheduled_start", params.startDate);
    }
    if (params?.endDate) {
      query = query.lte("scheduled_end", params.endDate);
    }

    // Search filter
    if (params?.search && params.search.trim()) {
      const q = `%${params.search.trim()}%`;
      query = query.or(`job_number.ilike.${q},title.ilike.${q},description.ilike.${q}`);
    }

    const { data: rawJobs, error } = await query;

    if (error) {
      return { error: error.message };
    }

    let jobsList = (rawJobs || []).map((j) => {
      const customer = j.customers;
      const site = j.service_sites;
      const asset = j.equipment_assets;
      const assignments = (j.job_assignments || []).map((a) => ({
        assignmentId: a.id,
        technicianId: a.technician_id,
        name: a.profiles?.full_name || "Technician",
        phone: a.profiles?.phone || null,
        isLead: a.is_lead,
        status: a.assignment_status,
      }));

      return {
        id: j.id,
        jobNumber: j.job_number,
        title: j.title,
        description: j.description,
        jobType: j.job_type as JobType,
        priority: j.priority as JobPriority,
        status: j.status as JobStatus,
        scheduledStart: j.scheduled_start,
        scheduledEnd: j.scheduled_end,
        estimatedDuration: j.estimated_duration || j.estimated_duration_minutes || 120,
        customerId: customer?.id || "",
        customerName: customer?.name || customer?.company_name || customer?.contact_name || "Customer",
        customerPhone: customer?.phone || "",
        siteId: site?.id || "",
        siteName: site?.site_name || "Site",
        siteAddress: site?.address || site?.address_line1 || "",
        assetId: asset?.id || null,
        assetBrand: asset?.brand || null,
        assetCapacity: asset?.capacity || null,
        assignedTechnicians: assignments,
        createdAt: j.created_at,
        updatedAt: j.updated_at,
      };
    });

    // If role is technician, only show jobs where this technician is assigned
    if (isTechnician(userRole)) {
      jobsList = jobsList.filter((j) =>
        j.assignedTechnicians.some((a) => a.technicianId === userId)
      );
    } else if (params?.technicianId && params.technicianId !== "all") {
      jobsList = jobsList.filter((j) =>
        j.assignedTechnicians.some((a) => a.technicianId === params.technicianId)
      );
    }

    return { data: jobsList };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to load jobs" };
  }
}

/**
 * Fetch a single job by ID with full details, assignments, visits, and activity history
 */
export async function getJobById(jobId: string): Promise<{ data?: JobDetail; error?: string }> {
  try {
    const session = await requireMembership();
    const orgId = session.membership.organizationId;
    const userRole = session.membership.role;
    const userId = session.user.id;
    const supabase = await createClient();

    const { data: job, error } = await supabase
      .from("jobs")
      .select(`
        id,
        job_number,
        title,
        description,
        job_type,
        priority,
        status,
        scheduled_start,
        scheduled_end,
        estimated_duration,
        estimated_duration_minutes,
        assigned_notes,
        completion_notes,
        completed_at,
        created_at,
        updated_at,
        customers!jobs_customer_id_fkey(id, name, company_name, contact_name, phone),
        service_sites!jobs_site_id_fkey(id, site_name, address, address_line1, area, access_notes, access_instructions, site_contact_name, site_contact_phone),
        equipment_assets!jobs_asset_id_fkey(id, brand, model, serial_number, capacity, refrigerant_type, location_description),
        job_assignments!job_assignments_job_id_fkey(
          id,
          technician_id,
          is_lead,
          assignment_status,
          profiles!job_assignments_technician_id_fkey(full_name, phone)
        ),
        job_visits!job_visits_job_id_fkey(
          id,
          visit_number,
          status,
          scheduled_start,
          scheduled_end,
          actual_start,
          actual_end,
          technician_notes
        )
      `)
      .eq("id", jobId)
      .eq("organization_id", orgId)
      .single();

    if (error || !job) {
      return { error: error?.message || "Job not found" };
    }

    // Role security check: technician must be assigned to view this job
    const assignedTechs = (job.job_assignments || []).map((a) => ({
      assignmentId: a.id,
      technicianId: a.technician_id,
      name: a.profiles?.full_name || "Technician",
      phone: a.profiles?.phone || null,
      isLead: a.is_lead,
      status: a.assignment_status,
    }));

    if (isTechnician(userRole) && !assignedTechs.some((a) => a.technicianId === userId)) {
      return { error: "Access denied: You are not assigned to this job." };
    }

    // Fetch activity logs for this job
    const { data: activityLogs } = await supabase
      .from("activity_logs")
      .select(`
        id,
        action,
        actor_id,
        details,
        created_at,
        profiles!activity_logs_actor_id_fkey(full_name)
      `)
      .eq("organization_id", orgId)
      .eq("entity_type", "job")
      .eq("entity_id", jobId)
      .order("created_at", { ascending: false })
      .limit(20);

    const logs = (activityLogs || []).map((l) => ({
      id: l.id,
      action: l.action,
      actorName: l.profiles?.full_name || "System",
      details: l.details as Record<string, unknown> | null,
      createdAt: l.created_at,
    }));

    const visits = (job.job_visits || []).map((v) => ({
      id: v.id,
      visitNumber: v.visit_number,
      status: v.status,
      scheduledStart: v.scheduled_start,
      scheduledEnd: v.scheduled_end,
      actualStart: v.actual_start,
      actualEnd: v.actual_end,
      technicianNotes: v.technician_notes,
    }));

    const allowedNextStatuses = ALLOWED_JOB_TRANSITIONS[job.status as JobStatus] || [];

    return {
      data: {
        id: job.id,
        jobNumber: job.job_number,
        title: job.title,
        description: job.description,
        jobType: job.job_type as JobType,
        priority: job.priority as JobPriority,
        status: job.status as JobStatus,
        scheduledStart: job.scheduled_start,
        scheduledEnd: job.scheduled_end,
        estimatedDuration: job.estimated_duration || job.estimated_duration_minutes || 120,
        customerId: job.customers?.id || "",
        customerName: job.customers?.name || job.customers?.company_name || job.customers?.contact_name || "Customer",
        customerPhone: job.customers?.phone || "",
        siteId: job.service_sites?.id || "",
        siteName: job.service_sites?.site_name || "Site",
        siteAddress: job.service_sites?.address || job.service_sites?.address_line1 || "",
        siteContactName: job.service_sites?.site_contact_name || null,
        siteContactPhone: job.service_sites?.site_contact_phone || null,
        accessNotes: job.service_sites?.access_notes || job.service_sites?.access_instructions || null,
        assignedNotes: job.assigned_notes,
        completionNotes: job.completion_notes,
        completedAt: job.completed_at,
        assetId: job.equipment_assets?.id || null,
        assetBrand: job.equipment_assets?.brand || null,
        assetCapacity: job.equipment_assets?.capacity || null,
        equipment: job.equipment_assets
          ? {
              id: job.equipment_assets.id,
              brand: job.equipment_assets.brand,
              model: job.equipment_assets.model || null,
              serialNumber: job.equipment_assets.serial_number || null,
              capacity: job.equipment_assets.capacity || null,
              refrigerant: job.equipment_assets.refrigerant_type || null,
              location: job.equipment_assets.location_description || null,
            }
          : null,
        assignedTechnicians: assignedTechs,
        visits,
        activityLogs: logs,
        allowedNextStatuses,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
      },
    };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Failed to load job details" };
  }
}

/**
 * Create a new service job with atomic sequence number and optional technician assignments
 */
export async function createJob(
  rawInput: CreateJobInput
): Promise<{ data?: JobListItem; conflictWarnings?: ScheduleConflict[]; error?: string }> {
  try {
    const session = await requireMembership();
    if (!canManageJobs(session.membership.role)) {
      return { error: "Permission denied: Only dispatchers, admins, and owners can create jobs." };
    }

    const parseResult = createJobSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return { error: parseResult.error.issues[0]?.message || "Invalid job input" };
    }

    const input = parseResult.data;
    const orgId = session.membership.organizationId;
    const supabase = await createClient();

    // Generate atomic human-readable job number using database sequence
    const { data: numData, error: numError } = await supabase.rpc("get_next_document_number", {
      target_org_id: orgId,
      doc_type: "job",
      prefix: "JOB",
    });

    if (numError || !numData) {
      return { error: "Failed to generate job sequence number: " + (numError?.message || "") };
    }

    const jobNumber = numData as string;

    // Check for technician scheduling conflicts if technicians are assigned
    const conflictWarnings: ScheduleConflict[] = [];
    if (input.scheduledStart && input.scheduledEnd && input.assignedTechnicianIds?.length) {
      for (const techId of input.assignedTechnicianIds) {
        const { conflicts } = await checkTechnicianScheduleConflicts(
          techId,
          input.scheduledStart,
          input.scheduledEnd
        );
        if (conflicts.length > 0) {
          conflictWarnings.push(...conflicts);
        }
      }
    }

    // Insert job record
    const { data: newJob, error: insertError } = await supabase
      .from("jobs")
      .insert({
        organization_id: orgId,
        job_number: jobNumber,
        customer_id: input.customerId,
        site_id: input.serviceSiteId,
        service_site_id: input.serviceSiteId,
        asset_id: input.equipmentAssetId || null,
        equipment_asset_id: input.equipmentAssetId || null,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        job_type: input.jobType,
        priority: input.priority,
        status: input.status,
        scheduled_start: input.scheduledStart || null,
        scheduled_end: input.scheduledEnd || null,
        estimated_duration: input.estimatedDuration,
        estimated_duration_minutes: input.estimatedDuration,
        assigned_notes: input.assignedNotes?.trim() || null,
        created_by: session.user.id,
      })
      .select()
      .single();

    if (insertError || !newJob) {
      return { error: insertError?.message || "Failed to create job" };
    }

    // Insert technician assignments if provided
    if (input.assignedTechnicianIds && input.assignedTechnicianIds.length > 0) {
      const assignmentRows = input.assignedTechnicianIds.map((techId) => ({
        organization_id: orgId,
        job_id: newJob.id,
        technician_id: techId,
        technician_user_id: techId,
        is_lead: input.leadTechnicianId === techId,
        assigned_by: session.user.id,
        assignment_status: "assigned",
      }));

      await supabase.from("job_assignments").insert(assignmentRows);
    }

    // Insert initial visit if scheduled
    if (input.scheduledStart && input.scheduledEnd) {
      await supabase.from("job_visits").insert({
        organization_id: orgId,
        job_id: newJob.id,
        visit_number: 1,
        status: "scheduled",
        visit_status: "scheduled",
        scheduled_start: input.scheduledStart,
        scheduled_end: input.scheduledEnd,
      });
    }

    // Record in activity_logs
    await supabase.from("activity_logs").insert({
      organization_id: orgId,
      actor_id: session.user.id,
      entity_type: "job",
      entity_id: newJob.id,
      action: "created",
      details: {
        job_number: jobNumber,
        title: newJob.title,
        priority: newJob.priority,
        status: newJob.status,
        conflicts_detected: conflictWarnings.length,
      },
    });

    revalidatePath("/app/jobs");
    revalidatePath("/app/calendar");
    revalidatePath(`/app/customers/${input.customerId}`);

    // Fetch the created job in list format
    const res = await getJobById(newJob.id);
    return { data: res.data, conflictWarnings };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error creating job" };
  }
}

/**
 * Update an existing job's details and scheduling
 */
export async function updateJob(
  jobId: string,
  rawInput: UpdateJobInput
): Promise<{ success?: boolean; conflictWarnings?: ScheduleConflict[]; error?: string }> {
  try {
    const session = await requireMembership();
    if (!canManageJobs(session.membership.role)) {
      return { error: "Permission denied: Only dispatchers, admins, and owners can update jobs." };
    }

    const parseResult = updateJobSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return { error: parseResult.error.issues[0]?.message || "Invalid update input" };
    }

    const input = parseResult.data;
    const orgId = session.membership.organizationId;
    const supabase = await createClient();

    // If scheduled times changed, check conflicts for assigned technicians
    const conflictWarnings: ScheduleConflict[] = [];
    if (input.scheduledStart && input.scheduledEnd) {
      const { data: assignments } = await supabase
        .from("job_assignments")
        .select("technician_id")
        .eq("job_id", jobId);

      for (const a of assignments || []) {
        const { conflicts } = await checkTechnicianScheduleConflicts(
          a.technician_id,
          input.scheduledStart,
          input.scheduledEnd,
          jobId
        );
        if (conflicts.length > 0) {
          conflictWarnings.push(...conflicts);
        }
      }
    }

    const updatePayload: JobUpdate = {
      updated_at: new Date().toISOString(),
    };

    if (input.title !== undefined) updatePayload.title = input.title.trim();
    if (input.description !== undefined) updatePayload.description = input.description ? input.description.trim() : null;
    if (input.jobType !== undefined) updatePayload.job_type = input.jobType;
    if (input.priority !== undefined) updatePayload.priority = input.priority;
    if (input.serviceSiteId !== undefined) {
      updatePayload.site_id = input.serviceSiteId;
      updatePayload.service_site_id = input.serviceSiteId;
    }
    if (input.equipmentAssetId !== undefined) {
      updatePayload.asset_id = input.equipmentAssetId;
      updatePayload.equipment_asset_id = input.equipmentAssetId;
    }
    if (input.scheduledStart !== undefined) updatePayload.scheduled_start = input.scheduledStart;
    if (input.scheduledEnd !== undefined) updatePayload.scheduled_end = input.scheduledEnd;
    if (input.estimatedDuration !== undefined) {
      updatePayload.estimated_duration = input.estimatedDuration;
      updatePayload.estimated_duration_minutes = input.estimatedDuration;
    }
    if (input.assignedNotes !== undefined) updatePayload.assigned_notes = input.assignedNotes ? input.assignedNotes.trim() : null;
    if (input.completionNotes !== undefined) updatePayload.completion_notes = input.completionNotes ? input.completionNotes.trim() : null;

    const { error: updateError } = await supabase
      .from("jobs")
      .update(updatePayload)
      .eq("id", jobId)
      .eq("organization_id", orgId);

    if (updateError) {
      return { error: updateError.message };
    }

    // Sync visit schedule if times changed
    if (input.scheduledStart && input.scheduledEnd) {
      await supabase
        .from("job_visits")
        .update({
          scheduled_start: input.scheduledStart,
          scheduled_end: input.scheduledEnd,
          updated_at: new Date().toISOString(),
        })
        .eq("job_id", jobId)
        .eq("visit_number", 1);
    }

    await supabase.from("activity_logs").insert({
      organization_id: orgId,
      actor_id: session.user.id,
      entity_type: "job",
      entity_id: jobId,
      action: "updated",
      details: {
        fields_updated: Object.keys(updatePayload),
        conflicts: conflictWarnings.length,
      },
    });

    revalidatePath("/app/jobs");
    revalidatePath(`/app/jobs/${jobId}`);
    revalidatePath("/app/calendar");

    return { success: true, conflictWarnings };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error updating job" };
  }
}

/**
 * Transition job status along the validated state machine
 */
export async function transitionJobStatus(
  rawInput: TransitionStatusInput
): Promise<{ success?: boolean; error?: string }> {
  try {
    const session = await requireMembership();
    const parseResult = transitionStatusSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return { error: parseResult.error.issues[0]?.message || "Invalid transition input" };
    }

    const { jobId, targetStatus, notes } = parseResult.data;
    const orgId = session.membership.organizationId;
    const userRole = session.membership.role;
    const userId = session.user.id;
    const supabase = await createClient();

    // Fetch current job
    const { data: job, error: fetchError } = await supabase
      .from("jobs")
      .select("id, status, job_number")
      .eq("id", jobId)
      .eq("organization_id", orgId)
      .single();

    if (fetchError || !job) {
      return { error: "Job not found" };
    }

    const currentStatus = job.status as JobStatus;

    // Validate transition
    if (!isValidJobTransition(currentStatus, targetStatus)) {
      return {
        error: `Illegal state transition: Cannot change status from "${currentStatus}" to "${targetStatus}".`,
      };
    }

    // Role-based permission enforcement:
    // Technicians can only transition assigned jobs to 'in_progress', 'completed', or 'on_hold'
    if (isTechnician(userRole)) {
      const { data: assignment } = await supabase
        .from("job_assignments")
        .select("id")
        .eq("job_id", jobId)
        .eq("technician_id", userId)
        .single();

      if (!assignment) {
        return { error: "Access denied: You are not assigned to this job." };
      }

      if (targetStatus === "cancelled" || targetStatus === "quoted") {
        return { error: "Technicians cannot mark jobs as cancelled or quoted." };
      }
    } else if (!canManageJobs(userRole)) {
      return { error: "You do not have permission to change job status." };
    }

    const updatePayload: JobUpdate = {
      status: targetStatus,
      updated_at: new Date().toISOString(),
    };

    if (targetStatus === "completed") {
      updatePayload.completed_at = new Date().toISOString();
      if (notes) updatePayload.completion_notes = notes;
    } else if (notes) {
      updatePayload.assigned_notes = notes;
    }

    const { error: updateError } = await supabase
      .from("jobs")
      .update(updatePayload)
      .eq("id", jobId)
      .eq("organization_id", orgId);

    if (updateError) {
      return { error: updateError.message };
    }

    // If starting or completing job, update visit status
    if (targetStatus === "in_progress") {
      await supabase
        .from("job_visits")
        .update({
          status: "started",
          visit_status: "started",
          actual_start: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("job_id", jobId)
        .eq("visit_number", 1);
    } else if (targetStatus === "completed") {
      await supabase
        .from("job_visits")
        .update({
          status: "completed",
          visit_status: "completed",
          actual_end: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("job_id", jobId)
        .eq("visit_number", 1);
    }

    // Record status change in activity_logs
    await supabase.from("activity_logs").insert({
      organization_id: orgId,
      actor_id: session.user.id,
      entity_type: "job",
      entity_id: jobId,
      action: `status_changed_to_${targetStatus}`,
      details: {
        from: currentStatus,
        to: targetStatus,
        notes: notes || null,
        job_number: job.job_number,
      },
    });

    revalidatePath("/app/jobs");
    revalidatePath(`/app/jobs/${jobId}`);
    revalidatePath("/app/calendar");

    return { success: true };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error updating job status" };
  }
}

/**
 * Assign or reassign technicians to a job
 */
export async function assignTechnicians(
  rawInput: AssignTechniciansInput
): Promise<{ success?: boolean; conflictWarnings?: ScheduleConflict[]; error?: string }> {
  try {
    const session = await requireMembership();
    if (!canManageJobs(session.membership.role)) {
      return { error: "Permission denied: Only dispatchers, admins, and owners can assign technicians." };
    }

    const parseResult = assignTechniciansSchema.safeParse(rawInput);
    if (!parseResult.success) {
      return { error: parseResult.error.issues[0]?.message || "Invalid assignment input" };
    }

    const { jobId, technicianIds, leadTechnicianId } = parseResult.data;
    const orgId = session.membership.organizationId;
    const supabase = await createClient();

    // Fetch job scheduled times to check for conflicts
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, job_number, scheduled_start, scheduled_end, status")
      .eq("id", jobId)
      .eq("organization_id", orgId)
      .single();

    if (jobError || !job) {
      return { error: "Job not found" };
    }

    // Check for scheduling conflicts
    const conflictWarnings: ScheduleConflict[] = [];
    if (job.scheduled_start && job.scheduled_end) {
      for (const techId of technicianIds) {
        const { conflicts } = await checkTechnicianScheduleConflicts(
          techId,
          job.scheduled_start,
          job.scheduled_end,
          jobId
        );
        if (conflicts.length > 0) {
          conflictWarnings.push(...conflicts);
        }
      }
    }

    // Remove old assignments for this job
    await supabase.from("job_assignments").delete().eq("job_id", jobId).eq("organization_id", orgId);

    // Insert new assignments
    const rows = technicianIds.map((techId) => ({
      organization_id: orgId,
      job_id: jobId,
      technician_id: techId,
      technician_user_id: techId,
      is_lead: leadTechnicianId === techId,
      assigned_by: session.user.id,
      assignment_status: "assigned",
    }));

    const { error: insertError } = await supabase.from("job_assignments").insert(rows);
    if (insertError) {
      return { error: insertError.message };
    }

    // If job was 'new' or 'quoted' and has scheduled times, auto-progress to 'scheduled'
    if ((job.status === "new" || job.status === "quoted") && job.scheduled_start) {
      await supabase.from("jobs").update({ status: "scheduled" }).eq("id", jobId);
    }

    await supabase.from("activity_logs").insert({
      organization_id: orgId,
      actor_id: session.user.id,
      entity_type: "job",
      entity_id: jobId,
      action: "technicians_assigned",
      details: {
        assigned_technician_ids: technicianIds,
        lead_technician_id: leadTechnicianId,
        conflicts: conflictWarnings.length,
      },
    });

    revalidatePath("/app/jobs");
    revalidatePath(`/app/jobs/${jobId}`);
    revalidatePath("/app/calendar");

    return { success: true, conflictWarnings };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error assigning technicians" };
  }
}

/**
 * Reschedule a job to new times with conflict detection
 */
export async function rescheduleJob(
  jobId: string,
  newScheduledStart: string,
  newScheduledEnd: string
): Promise<{ success?: boolean; conflictWarnings?: ScheduleConflict[]; error?: string }> {
  try {
    const session = await requireMembership();
    if (!canManageJobs(session.membership.role)) {
      return { error: "Permission denied: Only dispatchers, admins, and owners can reschedule jobs." };
    }

    return await updateJob(jobId, {
      scheduledStart: newScheduledStart,
      scheduledEnd: newScheduledEnd,
    });
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error rescheduling job" };
  }
}

/**
 * Cancel a job with a mandatory confirmation reason
 */
export async function cancelJob(
  jobId: string,
  cancellationReason?: string
): Promise<{ success?: boolean; error?: string }> {
  return transitionJobStatus({
    jobId,
    targetStatus: "cancelled",
    notes: cancellationReason || "Job cancelled by dispatcher.",
  });
}

/**
 * Fetch calendar events for day, week, and month views
 */
export async function getCalendarJobs(params: {
  startDate: string;
  endDate: string;
  technicianId?: string;
}): Promise<{ data?: JobListItem[]; error?: string }> {
  return getJobs({
    startDate: params.startDate,
    endDate: params.endDate,
    technicianId: params.technicianId,
  });
}

/**
 * Get available technicians in the organization for assignment dropdowns
 */
export async function getAssignableTechnicians(): Promise<{
  data?: Array<{ id: string; fullName: string; phone: string | null; role: string }>;
  error?: string;
}> {
  try {
    const session = await requireMembership();
    const orgId = session.membership.organizationId;
    const supabase = await createClient();

    const { data: members, error } = await supabase
      .from("organization_members")
      .select(`
        user_id,
        role,
        profiles!organization_members_user_id_fkey(id, full_name, phone)
      `)
      .eq("organization_id", orgId)
      .eq("status", "active")
      .in("role", ["technician", "dispatcher", "admin", "owner"]);

    if (error) {
      return { error: error.message };
    }

    const result = (members || []).map((m) => ({
      id: m.user_id,
      fullName: m.profiles?.full_name || "Team Member",
      phone: m.profiles?.phone || null,
      role: m.role,
    }));

    return { data: result };
  } catch (err: unknown) {
    return { error: err instanceof Error ? err.message : "Error loading technicians" };
  }
}
