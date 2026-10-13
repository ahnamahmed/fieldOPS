import { z } from "zod";

export const JOB_STATUSES = [
  "new",
  "quoted",
  "scheduled",
  "in_progress",
  "on_hold",
  "completed",
  "cancelled",
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type JobPriority = (typeof JOB_PRIORITIES)[number];

export const JOB_TYPES = [
  "repair",
  "master_service",
  "gas_charging",
  "installation",
  "uninstallation",
  "inspection",
  "amc_routine",
] as const;
export type JobType = (typeof JOB_TYPES)[number];

export const ASSIGNMENT_STATUSES = [
  "assigned",
  "accepted",
  "in_progress",
  "completed",
  "declined",
] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const VISIT_STATUSES = [
  "scheduled",
  "en_route",
  "started",
  "completed",
  "cancelled",
  "rescheduled",
] as const;
export type VisitStatus = (typeof VISIT_STATUSES)[number];

// Legal Job Status Transition Graph
export const ALLOWED_JOB_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  new: ["quoted", "scheduled", "cancelled"],
  quoted: ["scheduled", "cancelled", "on_hold"],
  scheduled: ["in_progress", "on_hold", "cancelled"],
  in_progress: ["completed", "on_hold", "cancelled"],
  on_hold: ["scheduled", "in_progress", "cancelled"],
  completed: [], // Terminal
  cancelled: [], // Terminal
};

export function isValidJobTransition(currentStatus: JobStatus, targetStatus: JobStatus): boolean {
  if (currentStatus === targetStatus) return true;
  const allowed = ALLOWED_JOB_TRANSITIONS[currentStatus] || [];
  return allowed.includes(targetStatus);
}

// Validation schemas
export const createJobSchema = z.object({
  customerId: z.string().uuid("Customer is required"),
  serviceSiteId: z.string().uuid("Service site location is required"),
  equipmentAssetId: z.string().uuid().optional().nullable(),
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  description: z.string().max(2000).optional().nullable(),
  jobType: z.enum(JOB_TYPES, {
    message: "Invalid job type",
  }).default("repair"),
  priority: z.enum(JOB_PRIORITIES, {
    message: "Invalid priority level",
  }).default("medium"),
  status: z.enum(JOB_STATUSES).default("new"),
  scheduledStart: z.string().datetime().optional().nullable(),
  scheduledEnd: z.string().datetime().optional().nullable(),
  estimatedDuration: z.number().int().positive().default(120),
  assignedNotes: z.string().max(1000).optional().nullable(),
  assignedTechnicianIds: z.array(z.string().uuid()).optional(),
  leadTechnicianId: z.string().uuid().optional().nullable(),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;

export const updateJobSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  jobType: z.enum(JOB_TYPES).optional(),
  priority: z.enum(JOB_PRIORITIES).optional(),
  serviceSiteId: z.string().uuid().optional(),
  equipmentAssetId: z.string().uuid().optional().nullable(),
  scheduledStart: z.string().datetime().optional().nullable(),
  scheduledEnd: z.string().datetime().optional().nullable(),
  estimatedDuration: z.number().int().positive().optional(),
  assignedNotes: z.string().max(1000).optional().nullable(),
  completionNotes: z.string().max(2000).optional().nullable(),
});

export type UpdateJobInput = z.infer<typeof updateJobSchema>;

export const assignTechniciansSchema = z.object({
  jobId: z.string().uuid("Job ID is required"),
  technicianIds: z.array(z.string().uuid()).min(1, "At least one technician must be selected"),
  leadTechnicianId: z.string().uuid().optional().nullable(),
});

export type AssignTechniciansInput = z.infer<typeof assignTechniciansSchema>;

export const transitionStatusSchema = z.object({
  jobId: z.string().uuid("Job ID is required"),
  targetStatus: z.enum(JOB_STATUSES, {
    message: "Invalid status",
  }),
  notes: z.string().max(1000).optional(),
});

export type TransitionStatusInput = z.infer<typeof transitionStatusSchema>;

export const scheduleConflictCheckSchema = z.object({
  technicianId: z.string().uuid(),
  scheduledStart: z.string().datetime(),
  scheduledEnd: z.string().datetime(),
  excludeJobId: z.string().uuid().optional(),
});
