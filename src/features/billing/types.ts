export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";

export type InvoiceStatus =
  | "draft"
  | "issued"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "void";

export type PaymentMethod =
  | "cash"
  | "bkash"
  | "nagad"
  | "rocket"
  | "bank_transfer"
  | "cheque"
  | "other";

export type PaymentStatus = "verified_manual" | "voided";

export type LineItemType = "service" | "labour" | "part" | "other";

export interface BillingLineItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  itemType: LineItemType;
  sortOrder?: number;
}

export interface QuoteSummary {
  id: string;
  quoteNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  jobId: string | null;
  jobTitle: string | null;
  issueDate: string;
  validUntil: string | null;
  subtotal: number;
  discountAmount: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  status: QuoteStatus;
  notes: string | null;
  terms: string | null;
  acceptedAt: string | null;
  createdAt: string;
}

export interface QuoteDetail extends QuoteSummary {
  customerEmail: string | null;
  customerAddress: string | null;
  items: BillingLineItem[];
}

export interface PaymentRecord {
  id: string;
  invoiceId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  transactionReference: string | null;
  notes: string | null;
  recordedBy: string;
  recorderName: string;
  status: PaymentStatus;
  createdAt: string;
}

export interface InvoiceSummary {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  jobId: string | null;
  jobTitle: string | null;
  quoteId: string | null;
  quoteNumber: string | null;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  discountAmount: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  status: InvoiceStatus;
  notes: string | null;
  paymentTerms: string | null;
  createdAt: string;
}

export interface InvoiceDetail extends InvoiceSummary {
  customerEmail: string | null;
  customerAddress: string | null;
  items: BillingLineItem[];
  payments: PaymentRecord[];
}

export interface OrganizationBillingInfo {
  name: string;
  phone: string | null;
  address: string | null;
  currency: string;
  timezone: string;
}
