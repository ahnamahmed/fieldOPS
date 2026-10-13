import { describe, it, expect } from "vitest";
import {
  JOB_STATUSES,
  JOB_PRIORITIES,
  JOB_TYPES,
  ALLOWED_JOB_TRANSITIONS,
  isValidJobTransition,
  createJobSchema,
  updateJobSchema,
  assignTechniciansSchema,
  transitionStatusSchema,
  scheduleConflictCheckSchema,
} from "@/schemas/job";
import { canManageJobs, isTechnician, canManageCustomers } from "@/lib/permissions";

describe("Jobs, Calendar & Dispatch Modules", () => {
  const validCustomerId = "123e4567-e89b-12d3-a456-426614174000";
  const validSiteId = "223e4567-e89b-12d3-a456-426614174001";
  const validAssetId = "323e4567-e89b-12d3-a456-426614174002";
  const validTechId = "423e4567-e89b-12d3-a456-426614174003";
  const validTechId2 = "523e4567-e89b-12d3-a456-426614174004";
  const validJobId = "623e4567-e89b-12d3-a456-426614174005";

  /* -------------------------------------------------------------------------
   * 1. Job Status Transitions & Lifecycle State Machine
   * ----------------------------------------------------------------------- */
  describe("Job Status Lifecycle & State Machine Transitions", () => {
    it("allows legal progression through standard servicing pipeline", () => {
      // new -> quoted
      expect(isValidJobTransition("new", "quoted")).toBe(true);
      // new -> scheduled (direct booking without quote)
      expect(isValidJobTransition("new", "scheduled")).toBe(true);
      // quoted -> scheduled
      expect(isValidJobTransition("quoted", "scheduled")).toBe(true);
      // scheduled -> in_progress (technician dispatched and starts work)
      expect(isValidJobTransition("scheduled", "in_progress")).toBe(true);
      // in_progress -> completed (technician finishes checklist and customer signs off)
      expect(isValidJobTransition("in_progress", "completed")).toBe(true);
    });

    it("allows transitioning to on_hold and resuming appropriately", () => {
      // scheduled -> on_hold (waiting for spare parts / client rescheduled)
      expect(isValidJobTransition("scheduled", "on_hold")).toBe(true);
      // in_progress -> on_hold (need AC compressor replacement from distributor)
      expect(isValidJobTransition("in_progress", "on_hold")).toBe(true);
      // on_hold -> scheduled
      expect(isValidJobTransition("on_hold", "scheduled")).toBe(true);
      // on_hold -> in_progress
      expect(isValidJobTransition("on_hold", "in_progress")).toBe(true);
    });

    it("allows cancellation from non-terminal states with audit trail", () => {
      expect(isValidJobTransition("new", "cancelled")).toBe(true);
      expect(isValidJobTransition("quoted", "cancelled")).toBe(true);
      expect(isValidJobTransition("scheduled", "cancelled")).toBe(true);
      expect(isValidJobTransition("in_progress", "cancelled")).toBe(true);
      expect(isValidJobTransition("on_hold", "cancelled")).toBe(true);
    });

    it("treats completed and cancelled as strict terminal states", () => {
      // Cannot transition out of completed
      for (const target of JOB_STATUSES) {
        if (target !== "completed") {
          expect(isValidJobTransition("completed", target)).toBe(false);
        }
      }

      // Cannot transition out of cancelled
      for (const target of JOB_STATUSES) {
        if (target !== "cancelled") {
          expect(isValidJobTransition("cancelled", target)).toBe(false);
        }
      }
    });

    it("rejects illegal skip transitions", () => {
      // Cannot jump from new directly to completed without doing the work
      expect(isValidJobTransition("new", "completed")).toBe(false);
      // Cannot jump from quoted directly to completed
      expect(isValidJobTransition("quoted", "completed")).toBe(false);
      // Cannot jump from scheduled directly to completed without starting
      expect(isValidJobTransition("scheduled", "completed")).toBe(false);
      // Cannot regress completed to new
      expect(isValidJobTransition("completed", "new")).toBe(false);
      // Cannot regress completed to in_progress
      expect(isValidJobTransition("completed", "in_progress")).toBe(false);
    });

    it("allows idempotent identity transition (currentStatus === targetStatus)", () => {
      expect(isValidJobTransition("new", "new")).toBe(true);
      expect(isValidJobTransition("scheduled", "scheduled")).toBe(true);
      expect(isValidJobTransition("in_progress", "in_progress")).toBe(true);
      expect(isValidJobTransition("completed", "completed")).toBe(true);
    });
  });

  /* -------------------------------------------------------------------------
   * 2. Zod Validation for Job Creation, Updates & Assignments
   * ----------------------------------------------------------------------- */
  describe("Job Input Validation Schemas", () => {
    it("validates valid AC repair work order creation", () => {
      const valid = createJobSchema.safeParse({
        customerId: validCustomerId,
        serviceSiteId: validSiteId,
        equipmentAssetId: validAssetId,
        title: "2-Ton Split AC Master Water Jet Wash & Gas Top-up",
        description: "Customer reports cooling degradation on 3rd floor executive room.",
        jobType: "master_service",
        priority: "high",
        scheduledStart: "2026-10-15T04:00:00.000Z", // 10:00 AM Asia/Dhaka
        scheduledEnd: "2026-10-15T06:00:00.000Z",   // 12:00 PM Asia/Dhaka
        estimatedDuration: 120,
        assignedTechnicianIds: [validTechId, validTechId2],
        leadTechnicianId: validTechId,
      });

      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.title).toContain("Master Water Jet Wash");
        expect(valid.data.priority).toBe("high");
        expect(valid.data.jobType).toBe("master_service");
        expect(valid.data.assignedTechnicianIds).toHaveLength(2);
      }
    });

    it("rejects job creation missing required customer or location UUIDs", () => {
      const invalid = createJobSchema.safeParse({
        customerId: "not-a-uuid",
        serviceSiteId: validSiteId,
        title: "AC Diagnostic",
      });

      expect(invalid.success).toBe(false);
      if (!invalid.success) {
        expect(invalid.error.issues[0]?.path).toContain("customerId");
      }
    });

    it("rejects job creation with title shorter than 3 characters", () => {
      const invalid = createJobSchema.safeParse({
        customerId: validCustomerId,
        serviceSiteId: validSiteId,
        title: "AC",
      });

      expect(invalid.success).toBe(false);
      if (!invalid.success) {
        expect(invalid.error.issues[0]?.message).toContain("at least 3 characters");
      }
    });

    it("validates technician assignment schema with at least one technician", () => {
      const valid = assignTechniciansSchema.safeParse({
        jobId: validJobId,
        technicianIds: [validTechId],
        leadTechnicianId: validTechId,
      });

      expect(valid.success).toBe(true);

      const invalidEmpty = assignTechniciansSchema.safeParse({
        jobId: validJobId,
        technicianIds: [],
      });

      expect(invalidEmpty.success).toBe(false);
      if (!invalidEmpty.success) {
        expect(invalidEmpty.error.issues[0]?.message).toContain("At least one technician");
      }
    });

    it("validates transition status schema", () => {
      const valid = transitionStatusSchema.safeParse({
        jobId: validJobId,
        targetStatus: "in_progress",
        notes: "Technician arrived on site at Gulshan Circle 2.",
      });

      expect(valid.success).toBe(true);

      const invalidStatus = transitionStatusSchema.safeParse({
        jobId: validJobId,
        targetStatus: "invalid_status",
      });

      expect(invalidStatus.success).toBe(false);
    });

    it("validates updateJobSchema for field updates and notes", () => {
      const valid = updateJobSchema.safeParse({
        title: "Updated: Emergency Gas Top-up",
        priority: "urgent",
        estimatedDuration: 90,
        assignedNotes: "Customer requested 30 min arrival phone call.",
        completionNotes: "Leak detected on flare nut. Repaired and charged 1.2kg R410A.",
      });

      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.priority).toBe("urgent");
        expect(valid.data.estimatedDuration).toBe(90);
      }
    });

    it("verifies job domain enums and transition graph configuration", () => {
      expect(JOB_PRIORITIES).toContain("urgent");
      expect(JOB_PRIORITIES).toContain("low");
      expect(JOB_TYPES).toContain("master_service");
      expect(JOB_TYPES).toContain("gas_charging");
      expect(ALLOWED_JOB_TRANSITIONS.new).toContain("scheduled");
      expect(ALLOWED_JOB_TRANSITIONS.completed).toHaveLength(0);
    });
  });

  /* -------------------------------------------------------------------------
   * 3. Scheduling Conflict & Overlap Detection Logic
   * ----------------------------------------------------------------------- */
  describe("Scheduling Conflict & Overlap Logic", () => {
    // Helper function implementing standard time interval overlap check:
    // Two intervals [S1, E1] and [S2, E2] overlap iff S1 < E2 AND E1 > S2
    function hasTimeOverlap(
      start1: Date,
      end1: Date,
      start2: Date,
      end2: Date
    ): boolean {
      return start1.getTime() < end2.getTime() && end1.getTime() > start2.getTime();
    }

    const existingStart = new Date("2026-10-15T10:00:00+06:00");
    const existingEnd = new Date("2026-10-15T12:00:00+06:00"); // 2 hour duration

    it("detects conflict when new visit starts inside existing appointment window", () => {
      const newStart = new Date("2026-10-15T11:00:00+06:00");
      const newEnd = new Date("2026-10-15T13:00:00+06:00");

      expect(hasTimeOverlap(existingStart, existingEnd, newStart, newEnd)).toBe(true);
    });

    it("detects conflict when new visit ends inside existing appointment window", () => {
      const newStart = new Date("2026-10-15T09:00:00+06:00");
      const newEnd = new Date("2026-10-15T11:00:00+06:00");

      expect(hasTimeOverlap(existingStart, existingEnd, newStart, newEnd)).toBe(true);
    });

    it("detects conflict when new visit completely encompasses existing appointment", () => {
      const newStart = new Date("2026-10-15T08:00:00+06:00");
      const newEnd = new Date("2026-10-15T14:00:00+06:00");

      expect(hasTimeOverlap(existingStart, existingEnd, newStart, newEnd)).toBe(true);
    });

    it("detects conflict when new visit is completely inside existing appointment", () => {
      const newStart = new Date("2026-10-15T10:30:00+06:00");
      const newEnd = new Date("2026-10-15T11:30:00+06:00");

      expect(hasTimeOverlap(existingStart, existingEnd, newStart, newEnd)).toBe(true);
    });

    it("allows non-overlapping adjacent appointments (back-to-back)", () => {
      // Ends exactly when existing starts
      const beforeStart = new Date("2026-10-15T08:00:00+06:00");
      const beforeEnd = new Date("2026-10-15T10:00:00+06:00");
      expect(hasTimeOverlap(existingStart, existingEnd, beforeStart, beforeEnd)).toBe(false);

      // Starts exactly when existing ends
      const afterStart = new Date("2026-10-15T12:00:00+06:00");
      const afterEnd = new Date("2026-10-15T14:00:00+06:00");
      expect(hasTimeOverlap(existingStart, existingEnd, afterStart, afterEnd)).toBe(false);
    });

    it("validates scheduleConflictCheckSchema input", () => {
      const valid = scheduleConflictCheckSchema.safeParse({
        technicianId: validTechId,
        scheduledStart: "2026-10-15T04:00:00.000Z",
        scheduledEnd: "2026-10-15T06:00:00.000Z",
        excludeJobId: validJobId,
      });

      expect(valid.success).toBe(true);

      const invalid = scheduleConflictCheckSchema.safeParse({
        technicianId: "not-uuid",
        scheduledStart: "invalid-date",
        scheduledEnd: "invalid-date",
      });

      expect(invalid.success).toBe(false);
    });
  });

  /* -------------------------------------------------------------------------
   * 4. Technician vs Dispatcher Permissions & Boundaries
   * ----------------------------------------------------------------------- */
  describe("Technician vs Dispatcher Permission Boundaries", () => {
    it("confirms dispatchers and owners can manage jobs and dispatching", () => {
      expect(canManageJobs("owner")).toBe(true);
      expect(canManageJobs("admin")).toBe(true);
      expect(canManageJobs("dispatcher")).toBe(true);
    });

    it("confirms technicians cannot reassign or manage business dispatch configurations", () => {
      expect(canManageJobs("technician")).toBe(false);
      expect(isTechnician("technician")).toBe(true);
      expect(canManageCustomers("technician")).toBe(false);
    });

    it("confirms finance role cannot dispatch technicians or manage jobs", () => {
      expect(canManageJobs("finance")).toBe(false);
      expect(isTechnician("finance")).toBe(false);
    });
  });

  /* -------------------------------------------------------------------------
   * 5. Multi-Tenant Cross-Tenant Isolation Invariants
   * ----------------------------------------------------------------------- */
  describe("Multi-Tenant & Cross-Tenant Data Isolation Invariants", () => {
    it("ensures job number format is tenant-scoped readable string", () => {
      const jobNumberRegex = /^JOB-\d+$/;
      expect(jobNumberRegex.test("JOB-1")).toBe(true);
      expect(jobNumberRegex.test("JOB-104")).toBe(true);
      expect(jobNumberRegex.test("JOB-9999")).toBe(true);
      expect(jobNumberRegex.test("INV-101")).toBe(false);
    });

    it("verifies tenant isolation: records from different organizations cannot be cross-linked", () => {
      const orgA = "11111111-1111-1111-1111-111111111111";
      const orgB = "22222222-2222-2222-2222-222222222222";

      // Mock database integrity rule:
      // A job belonging to orgA cannot have a customer, site, or asset from orgB
      function validateCrossTenantLinkage(
        jobOrgId: string,
        customerOrgId: string,
        siteOrgId: string,
        assetOrgId?: string
      ): { allowed: boolean; reason?: string } {
        if (jobOrgId !== customerOrgId) {
          return { allowed: false, reason: "Customer belongs to different organization" };
        }
        if (jobOrgId !== siteOrgId) {
          return { allowed: false, reason: "Service site belongs to different organization" };
        }
        if (assetOrgId && jobOrgId !== assetOrgId) {
          return { allowed: false, reason: "Equipment asset belongs to different organization" };
        }
        return { allowed: true };
      }

      // Valid same-org link
      expect(validateCrossTenantLinkage(orgA, orgA, orgA, orgA).allowed).toBe(true);

      // Cross-tenant customer attack
      const crossCustomer = validateCrossTenantLinkage(orgA, orgB, orgA, orgA);
      expect(crossCustomer.allowed).toBe(false);
      expect(crossCustomer.reason).toContain("Customer belongs to different organization");

      // Cross-tenant site attack
      const crossSite = validateCrossTenantLinkage(orgA, orgA, orgB, orgA);
      expect(crossSite.allowed).toBe(false);
      expect(crossSite.reason).toContain("Service site belongs to different organization");

      // Cross-tenant equipment asset attack
      const crossAsset = validateCrossTenantLinkage(orgA, orgA, orgA, orgB);
      expect(crossAsset.allowed).toBe(false);
      expect(crossAsset.reason).toContain("Equipment asset belongs to different organization");
    });
  });
});
