import { z } from "zod";

export const billingLineItemSchema = z.object({
  id: z.string().optional(),
  description: z
    .string()
    .min(1, "Item description is required")
    .max(255, "Description must be under 255 characters"),
  quantity: z
    .number()
    .positive("Quantity must be greater than zero"),
  unitPrice: z
    .number()
    .min(0, "Unit price cannot be negative"),
  itemType: z
    .enum(["service", "labour", "part", "other"])
    .default("service"),
  sortOrder: z.number().int().optional(),
});

export const createQuoteSchema = z.object({
  customerId: z.string().uuid("Please select a valid customer"),
  jobId: z.string().uuid().nullable().optional(),
  issueDate: z.string().optional(),
  validUntil: z.string().nullable().optional(),
  items: z
    .array(billingLineItemSchema)
    .min(1, "At least one item is required on the quotation"),
  discountAmount: z.number().min(0, "Discount cannot be negative").default(0),
  vatRate: z
    .number()
    .min(0, "VAT rate cannot be negative")
    .max(100, "VAT rate cannot exceed 100%")
    .default(0),
  notes: z.string().max(2000).nullable().optional(),
  terms: z.string().max(2000).nullable().optional(),
});

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;

export const createInvoiceSchema = z.object({
  customerId: z.string().uuid("Please select a valid customer"),
  jobId: z.string().uuid().nullable().optional(),
  quoteId: z.string().uuid().nullable().optional(),
  issueDate: z.string().optional(),
  dueDate: z.string().min(1, "Due date is required"),
  items: z
    .array(billingLineItemSchema)
    .min(1, "At least one item is required on the invoice"),
  discountAmount: z.number().min(0, "Discount cannot be negative").default(0),
  vatRate: z
    .number()
    .min(0, "VAT rate cannot be negative")
    .max(100, "VAT rate cannot exceed 100%")
    .default(0),
  notes: z.string().max(2000).nullable().optional(),
  paymentTerms: z.string().max(500).nullable().optional(),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

export const recordPaymentSchema = z.object({
  invoiceId: z.string().uuid("Invalid invoice ID"),
  amount: z
    .number()
    .positive("Payment amount must be greater than zero"),
  paymentMethod: z.enum([
    "cash",
    "bkash",
    "nagad",
    "rocket",
    "bank_transfer",
    "cheque",
    "other",
  ]),
  paymentDate: z.string().optional(),
  transactionReference: z.string().max(100).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
