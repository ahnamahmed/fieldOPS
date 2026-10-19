import { z } from "zod";

export const createContractSchema = z.object({
  customerId: z.string().uuid("Please select a valid customer account"),
  serviceSiteId: z.string().uuid().optional().nullable(),
  contractName: z
    .string()
    .min(3, "Contract name must be at least 3 characters")
    .max(255),
  description: z.string().optional().nullable(),
  contractType: z.enum(["comprehensive", "non_comprehensive", "labor_only"]),
  billingFrequency: z.enum([
    "monthly",
    "quarterly",
    "half_yearly",
    "annually",
    "one_time",
  ]),
  serviceFrequency: z.enum([
    "monthly",
    "bi_monthly",
    "quarterly",
    "half_yearly",
    "annually",
    "custom",
  ]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be YYYY-MM-DD"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be YYYY-MM-DD"),
  contractAmount: z.number().min(0, "Contract amount cannot be negative"),
  terms: z.string().optional().nullable(),
  assetIds: z.array(z.string().uuid()).default([]),
}).refine(
  (data) => data.startDate <= data.endDate,
  {
    message: "Contract start date cannot be after end date",
    path: ["endDate"],
  }
);

export type CreateContractInput = z.infer<typeof createContractSchema>;

export const updateContractSchema = z.object({
  contractId: z.string().uuid(),
  contractName: z.string().min(3).max(255),
  description: z.string().optional().nullable(),
  contractType: z.enum(["comprehensive", "non_comprehensive", "labor_only"]),
  billingFrequency: z.enum(["monthly", "quarterly", "half_yearly", "annually", "one_time"]),
  serviceFrequency: z.enum(["monthly", "bi_monthly", "quarterly", "half_yearly", "annually", "custom"]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  contractAmount: z.number().min(0),
  status: z.enum(["draft", "active", "renewal_due", "expired", "terminated", "renewed", "archived"]),
  terms: z.string().optional().nullable(),
  assetIds: z.array(z.string().uuid()).optional(),
});

export type UpdateContractInput = z.infer<typeof updateContractSchema>;

export const convertVisitToJobSchema = z.object({
  visitId: z.string().uuid(),
  technicianId: z.string().uuid().optional().nullable(),
});

export type ConvertVisitToJobInput = z.infer<typeof convertVisitToJobSchema>;

export const renewContractSchema = z.object({
  contractId: z.string().uuid(),
  newStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  newEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  newAmount: z.number().min(0),
  renewalNotes: z.string().optional().nullable(),
}).refine(
  (data) => data.newStartDate <= data.newEndDate,
  {
    message: "Renewal start date cannot be after end date",
    path: ["newEndDate"],
  }
);

export type RenewContractInput = z.infer<typeof renewContractSchema>;
