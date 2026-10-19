import { z } from "zod";

export const checklistResponseSchema = z.object({
  itemKey: z.string().min(1, "Item key is required"),
  result: z.enum(["pass", "fail", "na", "pending"], {
    error: "Result must be pass, fail, na, or pending",
  }),
  valueNumber: z.number().nullable().optional(),
  valueBoolean: z.boolean().nullable().optional(),
  valueText: z.string().max(500).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export type ChecklistResponseInput = z.infer<typeof checklistResponseSchema>;

export const partUsedSchema = z.object({
  partName: z.string().min(2, "Part name must be at least 2 characters").max(100),
  quantity: z.number().positive("Quantity must be greater than zero"),
  unitOfMeasure: z.string().min(1).default("pc"),
  notes: z.string().max(500).nullable().optional(),
});

export type PartUsedInput = z.infer<typeof partUsedSchema>;

export const completeJobSchema = z.object({
  workPerformed: z
    .string()
    .min(5, "Please describe the work performed (at least 5 characters)")
    .max(2000),
  completionNotes: z.string().max(2000).optional().default(""),
  followUpRecommendation: z.string().max(1000).optional().default(""),
});

export type CompleteJobInput = z.infer<typeof completeJobSchema>;

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10MB

export function validatePhotoUpload(file: { type: string; size: number }): {
  valid: boolean;
  error?: string;
} {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return {
      valid: false,
      error: `Invalid file type: ${file.type}. Allowed formats: JPG, PNG, WEBP.`,
    };
  }

  if (file.size > MAX_PHOTO_BYTES) {
    return {
      valid: false,
      error: `File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Max allowed size is 10MB.`,
    };
  }

  return { valid: true };
}

export const TECHNICIAN_ALLOWED_TRANSITIONS: Record<string, string[]> = {
  scheduled: ["in_progress"],
  in_progress: ["on_hold", "completed"],
  on_hold: ["in_progress"],
  completed: [], // Terminal
  cancelled: [], // Terminal
};

export function canTechnicianTransition(
  fromStatus: string,
  toStatus: string
): boolean {
  const allowed = TECHNICIAN_ALLOWED_TRANSITIONS[fromStatus];
  return !!allowed && allowed.includes(toStatus);
}
