import { z } from "zod";

export const lineItemSchema = z.object({
  description: z.string().trim().min(1, "Description is required"),
  quantity: z.number().positive("Quantity must be greater than 0"),
  unitPrice: z.number().min(0, "Unit price must be non-negative"),
});

export const quoteSchema = z.object({
  customerId: z.string().uuid("Customer is required"),
  jobId: z.string().uuid().optional().nullable(),
  items: z.array(lineItemSchema).min(1, "At least one item is required"),
  discountAmount: z.number().min(0).default(0),
  vatRate: z.number().min(0).max(100).default(0),
  validUntil: z.string().optional().nullable(),
  terms: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export const invoiceSchema = z.object({
  customerId: z.string().uuid("Customer is required"),
  jobId: z.string().uuid().optional().nullable(),
  quoteId: z.string().uuid().optional().nullable(),
  items: z.array(lineItemSchema).min(1, "At least one item is required"),
  discountAmount: z.number().min(0).default(0),
  vatRate: z.number().min(0).max(100).default(0),
  issueDate: z.string(),
  dueDate: z.string(),
  paymentTerms: z.string().default("Due upon receipt"),
  notes: z.string().trim().optional(),
});

export const paymentSchema = z.object({
  invoiceId: z.string().uuid("Invoice is required"),
  amount: z.number().positive("Payment amount must be greater than 0"),
  paymentMethod: z.enum([
    "cash",
    "bkash",
    "nagad",
    "rocket",
    "bank_transfer",
    "cheque",
    "other",
  ]),
  paymentDate: z.string(),
  transactionReference: z.string().trim().optional(), // bKash TrxID, Cheque #
  notes: z.string().trim().optional(),
});

export type LineItemInput = z.infer<typeof lineItemSchema>;
export type QuoteInput = z.infer<typeof quoteSchema>;
export type InvoiceInput = z.infer<typeof invoiceSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
