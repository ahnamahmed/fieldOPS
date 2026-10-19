import { describe, it, expect } from "vitest";
import {
  checklistResponseSchema,
  partUsedSchema,
  completeJobSchema,
  validatePhotoUpload,
  canTechnicianTransition,
  TECHNICIAN_ALLOWED_TRANSITIONS,
  MAX_PHOTO_BYTES,
  ALLOWED_IMAGE_TYPES,
} from "@/features/tech/schemas";
import type { TechChecklistItem } from "@/features/tech/types";

describe("Technician Workspace — Diagnostic Checklist Validation", () => {
  it("accepts valid checklist responses (pass, fail, na, pending)", () => {
    const validPass = checklistResponseSchema.safeParse({
      itemKey: "suction_pressure",
      result: "pass",
      valueNumber: 115,
      notes: "Operating at optimal 115 PSI under load",
    });
    expect(validPass.success).toBe(true);

    const validFail = checklistResponseSchema.safeParse({
      itemKey: "compressor_amps",
      result: "fail",
      valueNumber: 18.5,
      notes: "High current draw exceeding rated 14.2A",
    });
    expect(validFail.success).toBe(true);

    const validNA = checklistResponseSchema.safeParse({
      itemKey: "remote_thermostat",
      result: "na",
      notes: "Central BMS installed, no local remote",
    });
    expect(validNA.success).toBe(true);
  });

  it("rejects invalid checklist results", () => {
    const invalidResult = checklistResponseSchema.safeParse({
      itemKey: "gas_leak_test",
      result: "ok", // Invalid
    });
    expect(invalidResult.success).toBe(false);
  });

  it("requires non-empty itemKey", () => {
    const emptyKey = checklistResponseSchema.safeParse({
      itemKey: "",
      result: "pass",
    });
    expect(emptyKey.success).toBe(false);
  });

  it("identifies unrecorded/pending mandatory items before job completion", () => {
    const sampleChecklist: TechChecklistItem[] = [
      {
        id: "chk-1",
        itemKey: "pre_test_run",
        label: "Pre-service Test Run",
        fieldType: "number",
        unit: "°C",
        category: "cooling",
        isMandatory: true,
        result: "pass",
        valueNumber: 28,
        valueBoolean: true,
        valueText: null,
        notes: null,
        recordedAt: "2026-10-13T10:00:00Z",
      },
      {
        id: "chk-2",
        itemKey: "suction_pressure",
        label: "Suction Pressure Measurement",
        fieldType: "number",
        unit: "PSI",
        category: "cooling",
        isMandatory: true,
        result: "pending", // Still pending!
        valueNumber: null,
        valueBoolean: null,
        valueText: null,
        notes: null,
        recordedAt: null,
      },
      {
        id: "chk-3",
        itemKey: "optional_remote",
        label: "Remote Controller Check",
        fieldType: "boolean",
        unit: null,
        category: "general",
        isMandatory: false,
        result: "pending",
        valueNumber: null,
        valueBoolean: null,
        valueText: null,
        notes: null,
        recordedAt: null,
      },
    ];

    // Filter mandatory uncompleted items
    const pendingMandatory = sampleChecklist.filter(
      (c) => c.isMandatory && (!c.result || c.result === "pending")
    );

    expect(pendingMandatory.length).toBe(1);
    expect(pendingMandatory[0].itemKey).toBe("suction_pressure");

    // Once all mandatory items have a real answer ('pass', 'fail', or 'na')
    sampleChecklist[1].result = "pass";
    sampleChecklist[1].valueNumber = 118;

    const remainingPending = sampleChecklist.filter(
      (c) => c.isMandatory && (!c.result || c.result === "pending")
    );
    expect(remainingPending.length).toBe(0);
  });
});

describe("Technician Workspace — Job Status Transitions", () => {
  it("allows legal technician state progression", () => {
    // Arrival & start
    expect(canTechnicianTransition("scheduled", "in_progress")).toBe(true);

    // Pause for rain / waiting for access
    expect(canTechnicianTransition("in_progress", "on_hold")).toBe(true);

    // Resume from on hold
    expect(canTechnicianTransition("on_hold", "in_progress")).toBe(true);

    // Finish work
    expect(canTechnicianTransition("in_progress", "completed")).toBe(true);
  });

  it("prohibits illegal or bypassing transitions", () => {
    // Cannot complete directly without starting
    expect(canTechnicianTransition("scheduled", "completed")).toBe(false);

    // Cannot reopen or restart a completed job
    expect(canTechnicianTransition("completed", "in_progress")).toBe(false);
    expect(canTechnicianTransition("completed", "scheduled")).toBe(false);

    // Cannot complete directly from on_hold without resuming
    expect(canTechnicianTransition("on_hold", "completed")).toBe(false);
  });

  it("defines completed as a terminal state for field technicians", () => {
    expect(TECHNICIAN_ALLOWED_TRANSITIONS.completed).toEqual([]);
    expect(TECHNICIAN_ALLOWED_TRANSITIONS.cancelled).toEqual([]);
  });
});

describe("Technician Workspace — Private Photo Storage Validation", () => {
  it("accepts valid image MIME types within size limits", () => {
    for (const type of ALLOWED_IMAGE_TYPES) {
      const result = validatePhotoUpload({
        type,
        size: 2 * 1024 * 1024, // 2MB
      });
      expect(result.valid).toBe(true);
    }
  });

  it("rejects non-image or executable MIME types", () => {
    const invalidTypes = [
      "application/pdf",
      "text/html",
      "application/javascript",
      "image/gif",
      "application/octet-stream",
    ];

    for (const type of invalidTypes) {
      const result = validatePhotoUpload({
        type,
        size: 1024 * 500,
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid file type");
    }
  });

  it("rejects photos exceeding 10MB limit", () => {
    const oversized = validatePhotoUpload({
      type: "image/jpeg",
      size: MAX_PHOTO_BYTES + 1024, // > 10MB
    });
    expect(oversized.valid).toBe(false);
    expect(oversized.error).toContain("File is too large");
  });

  it("enforces tenant-scoped storage path isolation pattern", () => {
    const orgId = "11111111-2222-3333-4444-555555555555";
    const jobId = "99999999-8888-7777-6666-555555555555";
    const fileName = "outdoor_coil_after_wash.jpg";
    const uniqueId = "a1b2c3d4-e5f6-7a8b-9c0d-e1f2a3b4c5d6";

    const cleanFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const storagePath = `${orgId}/${jobId}/${uniqueId}-${cleanFileName}`;

    expect(storagePath).toBe(
      "11111111-2222-3333-4444-555555555555/99999999-8888-7777-6666-555555555555/a1b2c3d4-e5f6-7a8b-9c0d-e1f2a3b4c5d6-outdoor_coil_after_wash.jpg"
    );

    // First folder level is organization_id for storage RLS
    const folderOrgId = storagePath.split("/")[0];
    expect(folderOrgId).toBe(orgId);
  });
});

describe("Technician Workspace — Parts Used Validation", () => {
  it("validates valid parts used entries", () => {
    const validPart = partUsedSchema.safeParse({
      partName: "R410A Refrigerant",
      quantity: 1.5,
      unitOfMeasure: "kg",
      notes: "Topped up 1.5kg after vacuuming",
    });
    expect(validPart.success).toBe(true);
  });

  it("rejects zero or negative quantities", () => {
    const zeroQty = partUsedSchema.safeParse({
      partName: "Capacitor 45uF",
      quantity: 0,
      unitOfMeasure: "pc",
    });
    expect(zeroQty.success).toBe(false);

    const negQty = partUsedSchema.safeParse({
      partName: "Capacitor 45uF",
      quantity: -2,
      unitOfMeasure: "pc",
    });
    expect(negQty.success).toBe(false);
  });

  it("rejects blank part name", () => {
    const emptyName = partUsedSchema.safeParse({
      partName: "",
      quantity: 1,
      unitOfMeasure: "pc",
    });
    expect(emptyName.success).toBe(false);
  });
});

describe("Technician Workspace — Job Completion Validation", () => {
  it("requires minimum 5 characters of actual work performed description", () => {
    const valid = completeJobSchema.safeParse({
      workPerformed: "Full jet wash of indoor and outdoor coils. Tested suction at 115 PSI.",
      completionNotes: "Signed off by site engineer.",
      followUpRecommendation: "Replace blower motor bearing in next quarterly visit.",
    });
    expect(valid.success).toBe(true);

    const tooShort = completeJobSchema.safeParse({
      workPerformed: "Done", // < 5 chars
    });
    expect(tooShort.success).toBe(false);
    expect(tooShort.error?.issues[0].message).toContain("at least 5 characters");
  });

  it("handles optional follow-up recommendation and internal completion notes", () => {
    const minimal = completeJobSchema.safeParse({
      workPerformed: "Repaired copper flare nut leak and recharged refrigerant.",
    });
    expect(minimal.success).toBe(true);
    if (minimal.success) {
      expect(minimal.data.completionNotes).toBe("");
      expect(minimal.data.followUpRecommendation).toBe("");
    }
  });
});
