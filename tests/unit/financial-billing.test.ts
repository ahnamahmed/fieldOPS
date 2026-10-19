import { describe, it, expect } from "vitest";
import {
  roundMoney,
  toPaisas,
  fromPaisas,
  calculateLineTotal,
  calculateDocumentTotals,
  calculateBalances,
  validatePaymentAmount,
} from "@/lib/money";
import {
  createQuoteSchema,
  createInvoiceSchema,
  recordPaymentSchema,
} from "@/features/billing/schemas";
import {
  canManageQuotes,
  canManageInvoices,
  canRecordPayments,
  canViewFinancialReports,
} from "@/lib/permissions";
import { generateQuotePdf, generateInvoicePdf } from "@/features/billing/pdf";
import type { QuoteDetail, InvoiceDetail, OrganizationBillingInfo } from "@/features/billing/types";

describe("Financial Calculation Engine (lib/money.ts)", () => {
  it("mitigates IEEE-754 floating point arithmetic issues", () => {
    // In raw JS: 0.1 + 0.2 = 0.30000000000000004
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);

    // 0.7 * 3 in raw JS is 2.0999999999999996
    expect(roundMoney(0.7 * 3)).toBe(2.1);

    // 19.99 * 3 in raw JS is 59.970000000000006
    expect(roundMoney(19.99 * 3)).toBe(59.97);
  });

  it("converts to and from integer paisas accurately", () => {
    expect(toPaisas(1500.5)).toBe(150050);
    expect(fromPaisas(150050)).toBe(1500.5);
    expect(toPaisas(0.05)).toBe(5);
    expect(fromPaisas(5)).toBe(0.05);
  });

  it("calculates line items with fractional quantities correctly", () => {
    // 2.5 kg of refrigerant gas at 2,800 BDT/kg
    const total = calculateLineTotal(2.5, 2800);
    expect(total).toBe(7000.0);

    // 1.75 hours of diagnostic labour at 1,500 BDT/hr
    const labourTotal = calculateLineTotal(1.75, 1500);
    expect(labourTotal).toBe(2625.0);

    // Negative or invalid quantities clamp to 0
    expect(calculateLineTotal(-5, 1000)).toBe(0);
    expect(calculateLineTotal(5, -1000)).toBe(0);
  });

  it("calculates document totals with discounts and government VAT", () => {
    const items = [
      { quantity: 4, unitPrice: 2500 }, // 10,000
      { quantity: 2, unitPrice: 1500 }, // 3,000
      { quantity: 1, unitPrice: 2000 }, // 2,000
    ];
    // Subtotal: 15,000
    // Discount: 1,000 -> Taxable: 14,000
    // VAT 5%: 14,000 * 0.05 = 700
    // Total: 14,700
    const totals = calculateDocumentTotals(items, 1000, 5);

    expect(totals.subtotal).toBe(15000);
    expect(totals.discountAmount).toBe(1000);
    expect(totals.taxableBase).toBe(14000);
    expect(totals.vatRate).toBe(5);
    expect(totals.vatAmount).toBe(700);
    expect(totals.totalAmount).toBe(14700);
  });

  it("clamps discounts so they cannot exceed subtotal", () => {
    const items = [{ quantity: 1, unitPrice: 5000 }];
    const totals = calculateDocumentTotals(items, 8000, 0);

    expect(totals.subtotal).toBe(5000);
    expect(totals.discountAmount).toBe(5000); // clamped
    expect(totals.taxableBase).toBe(0);
    expect(totals.totalAmount).toBe(0);
  });

  it("handles zero VAT correctly", () => {
    const items = [{ quantity: 3, unitPrice: 1200 }];
    const totals = calculateDocumentTotals(items, 200, 0);

    expect(totals.subtotal).toBe(3600);
    expect(totals.discountAmount).toBe(200);
    expect(totals.vatAmount).toBe(0);
    expect(totals.totalAmount).toBe(3400);
  });

  it("calculates balances for partial payments and full settlement", () => {
    const totalAmount = 25000;

    // No payments
    const zeroState = calculateBalances(totalAmount, []);
    expect(zeroState.paidAmount).toBe(0);
    expect(zeroState.balanceDue).toBe(25000);
    expect(zeroState.isFullyPaid).toBe(false);
    expect(zeroState.isPartiallyPaid).toBe(false);

    // First partial payment (bKash advance 10,000)
    const partialState = calculateBalances(totalAmount, [
      { amount: 10000, status: "completed" },
    ]);
    expect(partialState.paidAmount).toBe(10000);
    expect(partialState.balanceDue).toBe(15000);
    expect(partialState.isFullyPaid).toBe(false);
    expect(partialState.isPartiallyPaid).toBe(true);

    // Second partial payment (Bank transfer 15,000)
    const fullState = calculateBalances(totalAmount, [
      { amount: 10000, status: "completed" },
      { amount: 15000, status: "completed" },
    ]);
    expect(fullState.paidAmount).toBe(25000);
    expect(fullState.balanceDue).toBe(0);
    expect(fullState.isFullyPaid).toBe(true);
    expect(fullState.isPartiallyPaid).toBe(false);
  });

  it("ignores voided payments when calculating balances", () => {
    const totalAmount = 18000;
    const payments = [
      { amount: 5000, status: "completed" },
      { amount: 6000, status: "voided" }, // cancelled check or voided entry
      { amount: 3000, status: "completed" },
    ];

    const result = calculateBalances(totalAmount, payments);
    expect(result.paidAmount).toBe(8000); // 5000 + 3000
    expect(result.balanceDue).toBe(10000);
  });

  it("enforces overpayment rejection via validatePaymentAmount", () => {
    const balanceDue = 7500;

    // Valid partial
    expect(validatePaymentAmount(balanceDue, 3000).valid).toBe(true);

    // Valid exact settlement
    expect(validatePaymentAmount(balanceDue, 7500).valid).toBe(true);

    // Invalid overpayment
    const overpay = validatePaymentAmount(balanceDue, 7500.01);
    expect(overpay.valid).toBe(false);
    expect(overpay.error).toContain("exceeds the remaining balance due");

    // Invalid zero or negative
    expect(validatePaymentAmount(balanceDue, 0).valid).toBe(false);
    expect(validatePaymentAmount(balanceDue, -500).valid).toBe(false);
  });
});

describe("Billing Validation Schemas (features/billing/schemas.ts)", () => {
  it("validates valid quotation inputs", () => {
    const valid = createQuoteSchema.safeParse({
      customerId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      issueDate: "2026-10-13",
      validUntil: "2026-10-27",
      items: [
        {
          description: "Overhaul 2-Ton Cassette AC",
          quantity: 2,
          unitPrice: 4500,
          itemType: "service",
        },
      ],
      discountAmount: 500,
      vatRate: 5,
    });
    expect(valid.success).toBe(true);
  });

  it("rejects quotation with empty items or negative pricing", () => {
    const noItems = createQuoteSchema.safeParse({
      customerId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      items: [],
    });
    expect(noItems.success).toBe(false);

    const negativePrice = createQuoteSchema.safeParse({
      customerId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      items: [
        {
          description: "Defective component",
          quantity: 1,
          unitPrice: -500,
          itemType: "part",
        },
      ],
    });
    expect(negativePrice.success).toBe(false);
  });

  it("validates invoice inputs with payment terms and due dates", () => {
    const valid = createInvoiceSchema.safeParse({
      customerId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      dueDate: "2026-10-20",
      items: [
        {
          description: "Emergency Fan Motor Replacement",
          quantity: 1,
          unitPrice: 6500,
          itemType: "part",
        },
      ],
      paymentTerms: "Due upon receipt via bKash or Cash",
    });
    expect(valid.success).toBe(true);
  });

  it("validates manual payment recording inputs and channels", () => {
    const validBkash = recordPaymentSchema.safeParse({
      invoiceId: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      amount: 4500,
      paymentMethod: "bkash",
      transactionReference: "BKX928491823",
      notes: "Received via bKash Merchant counter",
    });
    expect(validBkash.success).toBe(true);

    const validCash = recordPaymentSchema.safeParse({
      invoiceId: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      amount: 2000,
      paymentMethod: "cash",
      notes: "Cash handed to lead technician on site",
    });
    expect(validCash.success).toBe(true);

    const invalidMethod = recordPaymentSchema.safeParse({
      invoiceId: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      amount: 1000,
      paymentMethod: "crypto_bitcoin" as unknown,
    });
    expect(invalidMethod.success).toBe(false);
  });
});

describe("Role-Based Financial Permissions (lib/permissions.ts)", () => {
  it("enforces that only owner, admin, and finance can manage quotes & invoices", () => {
    // Authorized
    expect(canManageQuotes("owner")).toBe(true);
    expect(canManageQuotes("admin")).toBe(true);
    expect(canManageQuotes("finance")).toBe(true);

    // Denied
    expect(canManageQuotes("dispatcher")).toBe(false);
    expect(canManageQuotes("technician")).toBe(false);
    expect(canManageQuotes(null)).toBe(false);

    // Invoices
    expect(canManageInvoices("owner")).toBe(true);
    expect(canManageInvoices("admin")).toBe(true);
    expect(canManageInvoices("finance")).toBe(true);
    expect(canManageInvoices("dispatcher")).toBe(false);
    expect(canManageInvoices("technician")).toBe(false);
  });

  it("enforces that only owner, admin, and finance can record payments", () => {
    expect(canRecordPayments("owner")).toBe(true);
    expect(canRecordPayments("admin")).toBe(true);
    expect(canRecordPayments("finance")).toBe(true);

    expect(canRecordPayments("dispatcher")).toBe(false);
    expect(canRecordPayments("technician")).toBe(false);
  });

  it("enforces financial report visibility restrictions", () => {
    expect(canViewFinancialReports("owner")).toBe(true);
    expect(canViewFinancialReports("admin")).toBe(true);
    expect(canViewFinancialReports("finance")).toBe(true);

    expect(canViewFinancialReports("dispatcher")).toBe(false);
    expect(canViewFinancialReports("technician")).toBe(false);
  });
});

describe("Authentic Binary PDF Generation (features/billing/pdf.ts)", () => {
  const dummyOrg: OrganizationBillingInfo = {
    name: "FrostGuard Bangladesh Engineering",
    phone: "01711000000",
    address: "House 12, Road 4, Gulshan-1, Dhaka 1212",
    currency: "BDT",
    timezone: "Asia/Dhaka",
  };

  const dummyQuote: QuoteDetail = {
    id: "q-1",
    quoteNumber: "QT-1001",
    customerId: "c-1",
    customerName: "Square Pharmaceuticals HQ",
    customerPhone: "01819234567",
    customerEmail: "maintenance@squarepharma.com",
    customerAddress: "Square Centre, 48 Mohakhali C/A, Dhaka 1212",
    jobId: null,
    jobTitle: "HVAC Compressor Servicing",
    issueDate: "2026-10-13",
    validUntil: "2026-10-27",
    subtotal: 15000,
    discountAmount: 1000,
    vatRate: 5,
    vatAmount: 700,
    totalAmount: 14700,
    status: "sent",
    notes: "Includes 90-day compressor gas pressure warranty.",
    terms: "50% advance for spare parts, 50% on job completion.",
    acceptedAt: null,
    createdAt: "2026-10-13T10:00:00Z",
    items: [
      {
        id: "qi-1",
        description: "Outdoor Unit Chemical Foam Jet Clean",
        quantity: 2,
        unitPrice: 3500,
        lineTotal: 7000,
        itemType: "service",
        sortOrder: 1,
      },
      {
        id: "qi-2",
        description: "R410A Refrigerant Full Charge (3 kg)",
        quantity: 1,
        unitPrice: 8000,
        lineTotal: 8000,
        itemType: "part",
        sortOrder: 2,
      },
    ],
  };

  const dummyInvoice: InvoiceDetail = {
    id: "inv-1",
    invoiceNumber: "INV-1001",
    customerId: "c-1",
    customerName: "Square Pharmaceuticals HQ",
    customerPhone: "01819234567",
    customerEmail: "maintenance@squarepharma.com",
    customerAddress: "Square Centre, 48 Mohakhali C/A, Dhaka 1212",
    jobId: null,
    jobTitle: null,
    quoteId: "q-1",
    quoteNumber: "QT-1001",
    issueDate: "2026-10-13",
    dueDate: "2026-10-20",
    subtotal: 15000,
    discountAmount: 1000,
    vatRate: 5,
    vatAmount: 700,
    totalAmount: 14700,
    paidAmount: 5000,
    balanceDue: 9700,
    status: "partially_paid",
    notes: "Commissioned and tested satisfactory.",
    paymentTerms: "Due within 7 days via bKash Merchant or Bank transfer.",
    createdAt: "2026-10-13T11:00:00Z",
    items: [
      {
        id: "ii-1",
        description: "Outdoor Unit Chemical Foam Jet Clean",
        quantity: 2,
        unitPrice: 3500,
        lineTotal: 7000,
        itemType: "service",
        sortOrder: 1,
      },
      {
        id: "ii-2",
        description: "R410A Refrigerant Full Charge (3 kg)",
        quantity: 1,
        unitPrice: 8000,
        lineTotal: 8000,
        itemType: "part",
        sortOrder: 2,
      },
    ],
    payments: [
      {
        id: "p-1",
        invoiceId: "inv-1",
        amount: 5000,
        paymentMethod: "bkash",
        paymentDate: "2026-10-13",
        transactionReference: "BKX928491823",
        notes: "Advance via bKash Merchant",
        recordedBy: "u-1",
        recorderName: "Ashik Rahman (Finance)",
        status: "verified_manual",
        createdAt: "2026-10-13T11:30:00Z",
      },
    ],
  };

  it("generates genuine downloadable binary PDF for quotations", async () => {
    const pdfBytes = await generateQuotePdf(dummyQuote, dummyOrg);

    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(1000);

    // Verify PDF header magic bytes %PDF-
    const headerStr = String.fromCharCode(...pdfBytes.slice(0, 5));
    expect(headerStr).toBe("%PDF-");
  });

  it("generates genuine downloadable binary PDF for invoices with payment instructions", async () => {
    const pdfBytes = await generateInvoicePdf(dummyInvoice, dummyOrg);

    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(1000);

    // Verify PDF header magic bytes %PDF-
    const headerStr = String.fromCharCode(...pdfBytes.slice(0, 5));
    expect(headerStr).toBe("%PDF-");
  });
});
