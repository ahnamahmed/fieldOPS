"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, type CurrentUserSession, type UserMembership } from "@/lib/auth";
import {
  calculateDocumentTotals,
  roundMoney,
} from "@/lib/money";
import type { Database } from "@/types/database.types";
import {
  createQuoteSchema,
  createInvoiceSchema,
  recordPaymentSchema,
  type CreateQuoteInput,
  type CreateInvoiceInput,
  type RecordPaymentInput,
} from "./schemas";
import type {
  QuoteSummary,
  QuoteDetail,
  InvoiceSummary,
  InvoiceDetail,
  BillingLineItem,
  PaymentRecord,
  QuoteStatus,
  InvoiceStatus,
} from "./types";

type AuthContextResult =
  | {
      supabase: Awaited<ReturnType<typeof createClient>>;
      session: CurrentUserSession & { membership: UserMembership };
      error: null;
    }
  | {
      supabase: Awaited<ReturnType<typeof createClient>>;
      session: null;
      error: string;
    };

/**
 * Ensures user is authenticated and is a finance manager (owner, admin, finance, dispatcher).
 */
async function getBillingAuthContext(requireManagePermission: boolean = false): Promise<AuthContextResult> {
  const supabase = await createClient();
  const session = await getCurrentUser();

  if (!session || !session.membership) {
    return { supabase, session: null, error: "Authentication required" };
  }

  const role = session.membership.role;
  const canManage = ["owner", "admin", "finance"].includes(role);
  const canView = ["owner", "admin", "finance", "dispatcher"].includes(role);

  if (requireManagePermission && !canManage) {
    return {
      supabase,
      session: null,
      error: "Access denied: Finance or manager permissions required.",
    };
  }

  if (!canView) {
    return {
      supabase,
      session: null,
      error: "Access denied: You do not have permission to access financial records.",
    };
  }

  return {
    supabase,
    session: session as CurrentUserSession & { membership: UserMembership },
    error: null,
  };
}

/**
 * Fetch all quotations for the active organization.
 */
export async function getQuotes(params?: {
  limit?: number;
  offset?: number;
}): Promise<{
  success: boolean;
  data?: QuoteSummary[];
  error?: string;
}> {
  try {
    const { supabase, session, error } = await getBillingAuthContext(false);
    if (error || !session) return { success: false, error: error || "Unauthorized" };

    const orgId = session.membership.organizationId;
    const limit = Math.min(Math.max(params?.limit ?? 100, 1), 500);
    const offset = Math.max(params?.offset ?? 0, 0);

    const { data: rawQuotes, error: queryError } = await supabase
      .from("quotes")
      .select(
        `
        id,
        quote_number,
        customer_id,
        job_id,
        subtotal,
        discount_amount,
        vat_rate,
        vat_amount,
        total_amount,
        status,
        valid_until,
        issue_date,
        terms,
        notes,
        accepted_at,
        created_at,
        customers (
          contact_name,
          company_name,
          phone
        ),
        jobs (
          title
        )
      `
      )
      .eq("organization_id", orgId)
      .order("issue_date", { ascending: false })
      .range(offset, offset + limit - 1);

    if (queryError) return { success: false, error: queryError.message };

    const quotes: QuoteSummary[] = (rawQuotes || []).map((q) => {
      const customer = Array.isArray(q.customers) ? q.customers[0] : q.customers;
      const job = Array.isArray(q.jobs) ? q.jobs[0] : q.jobs;

      return {
        id: q.id,
        quoteNumber: q.quote_number,
        customerId: q.customer_id,
        customerName: customer?.company_name || customer?.contact_name || "Customer",
        customerPhone: customer?.phone || "",
        jobId: q.job_id,
        jobTitle: job?.title || null,
        issueDate: q.issue_date,
        validUntil: q.valid_until,
        subtotal: Number(q.subtotal),
        discountAmount: Number(q.discount_amount),
        vatRate: Number(q.vat_rate),
        vatAmount: Number(q.vat_amount),
        totalAmount: Number(q.total_amount),
        status: q.status as QuoteStatus,
        notes: q.notes,
        terms: q.terms,
        acceptedAt: q.accepted_at,
        createdAt: q.created_at,
      };
    });

    return { success: true, data: quotes };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to load quotes" };
  }
}

/**
 * Fetch detailed quotation including customer and line items.
 */
export async function getQuoteDetail(
  quoteId: string
): Promise<{ success: boolean; data?: QuoteDetail; error?: string }> {
  try {
    const { supabase, session, error } = await getBillingAuthContext(false);
    if (error || !session) return { success: false, error: error || "Unauthorized" };

    const orgId = session.membership.organizationId;

    const { data: q, error: qError } = await supabase
      .from("quotes")
      .select(
        `
        id,
        quote_number,
        customer_id,
        job_id,
        subtotal,
        discount_amount,
        vat_rate,
        vat_amount,
        total_amount,
        status,
        valid_until,
        issue_date,
        terms,
        notes,
        accepted_at,
        created_at,
        customers (
          contact_name,
          company_name,
          phone,
          email,
          billing_address
        ),
        jobs (
          title
        )
      `
      )
      .eq("id", quoteId)
      .eq("organization_id", orgId)
      .single();

    if (qError || !q) {
      return { success: false, error: qError?.message || "Quote not found" };
    }

    const { data: rawItems } = await supabase
      .from("quote_items")
      .select("*")
      .eq("quote_id", quoteId)
      .order("sort_order", { ascending: true });

    const items: BillingLineItem[] = (rawItems || []).map((i) => ({
      id: i.id,
      description: i.description,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unit_price),
      lineTotal: Number(i.line_total),
      itemType: (i.item_type as BillingLineItem["itemType"]) || "service",
      sortOrder: i.sort_order || 0,
    }));

    const customer = Array.isArray(q.customers) ? q.customers[0] : q.customers;
    const job = Array.isArray(q.jobs) ? q.jobs[0] : q.jobs;

    const detail: QuoteDetail = {
      id: q.id,
      quoteNumber: q.quote_number,
      customerId: q.customer_id,
      customerName: customer?.company_name || customer?.contact_name || "Customer",
      customerPhone: customer?.phone || "",
      customerEmail: customer?.email || null,
      customerAddress: customer?.billing_address || null,
      jobId: q.job_id,
      jobTitle: job?.title || null,
      issueDate: q.issue_date,
      validUntil: q.valid_until,
      subtotal: Number(q.subtotal),
      discountAmount: Number(q.discount_amount),
      vatRate: Number(q.vat_rate),
      vatAmount: Number(q.vat_amount),
      totalAmount: Number(q.total_amount),
      status: q.status as QuoteStatus,
      notes: q.notes,
      terms: q.terms,
      acceptedAt: q.accepted_at,
      createdAt: q.created_at,
      items,
    };

    return { success: true, data: detail };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to load quote details" };
  }
}

/**
 * Create a new quotation with validated financial calculations.
 */
export async function createQuote(
  input: CreateQuoteInput
): Promise<{ success: boolean; quoteId?: string; error?: string }> {
  try {
    const parsed = createQuoteSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const { supabase, session, error } = await getBillingAuthContext(true);
    if (error || !session) return { success: false, error: error || "Unauthorized" };

    const orgId = session.membership.organizationId;
    const userId = session.user.id;
    const data = parsed.data;

    // 1. Calculate document totals using decimal arithmetic
    const lineItemInputs = data.items.map((i) => ({
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    }));
    const totals = calculateDocumentTotals(lineItemInputs, data.discountAmount, data.vatRate);

    // 2. Generate unique document number
    const { data: docNumber, error: seqErr } = await supabase.rpc("get_next_document_number", {
      doc_type: "quote",
      prefix: "QT",
      target_org_id: orgId,
    });
    if (seqErr || !docNumber) {
      return { success: false, error: seqErr?.message || "Failed to generate quote number" };
    }

    // 3. Insert Quote
    const issueDate = data.issueDate || new Date().toISOString().split("T")[0];
    const { data: newQuote, error: insErr } = await supabase
      .from("quotes")
      .insert({
        organization_id: orgId,
        quote_number: docNumber,
        customer_id: data.customerId,
        job_id: data.jobId || null,
        subtotal: totals.subtotal,
        discount_amount: totals.discountAmount,
        vat_rate: totals.vatRate,
        vat_amount: totals.vatAmount,
        total_amount: totals.totalAmount,
        status: "draft",
        issue_date: issueDate,
        valid_until: data.validUntil || null,
        notes: data.notes || null,
        terms: data.terms || "Valid for 14 days. Standard service warranty applies.",
        created_by: userId,
      })
      .select("id")
      .single();

    if (insErr || !newQuote) {
      return { success: false, error: insErr?.message || "Failed to create quote" };
    }

    // 4. Insert Quote Items
    const itemsToInsert = data.items.map((item, idx) => ({
      quote_id: newQuote.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      line_total: roundMoney(item.quantity * item.unitPrice),
      item_type: item.itemType || "service",
      sort_order: idx + 1,
    }));

    const { error: itemsErr } = await supabase.from("quote_items").insert(itemsToInsert);
    if (itemsErr) {
      return { success: false, error: itemsErr.message };
    }

    // 5. Activity log
    await supabase.from("activity_logs").insert({
      organization_id: orgId,
      actor_id: userId,
      entity_type: "quote",
      entity_id: newQuote.id,
      action: "quote.created",
      details: {
        quote_number: docNumber,
        total_amount: totals.totalAmount,
      },
    });

    revalidatePath("/app/quotes");
    return { success: true, quoteId: newQuote.id };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to create quote" };
  }
}

/**
 * Update quotation status (draft -> sent -> accepted / rejected / expired)
 */
export async function updateQuoteStatus(
  quoteId: string,
  newStatus: QuoteStatus
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, session, error } = await getBillingAuthContext(true);
    if (error || !session) return { success: false, error: error || "Unauthorized" };

    const orgId = session.membership.organizationId;
    const nowIso = new Date().toISOString();

    const updatePayload: Database["public"]["Tables"]["quotes"]["Update"] = {
      status: newStatus,
      updated_at: nowIso,
    };

    if (newStatus === "accepted") {
      updatePayload.accepted_at = nowIso;
    }

    const { error: updateError } = await supabase
      .from("quotes")
      .update(updatePayload)
      .eq("id", quoteId)
      .eq("organization_id", orgId);

    if (updateError) return { success: false, error: updateError.message };

    // Audit log
    await supabase.from("activity_logs").insert({
      organization_id: orgId,
      actor_id: session.user.id,
      entity_type: "quote",
      entity_id: quoteId,
      action: `quote.status_${newStatus}`,
      details: { new_status: newStatus },
    });

    revalidatePath("/app/quotes");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update quote status" };
  }
}

/**
 * Atomic conversion of an accepted quotation to an invoice.
 */
export async function convertQuoteToInvoice(
  quoteId: string
): Promise<{ success: boolean; invoiceId?: string; error?: string }> {
  try {
    const { supabase, session, error } = await getBillingAuthContext(true);
    if (error || !session) return { success: false, error: error || "Unauthorized" };

    const orgId = session.membership.organizationId;
    const userId = session.user.id;

    const { data: invId, error: rpcErr } = await supabase.rpc("convert_quote_to_invoice", {
      p_org_id: orgId,
      p_quote_id: quoteId,
      p_user_id: userId,
    });

    if (rpcErr || !invId) {
      return { success: false, error: rpcErr?.message || "Failed to convert quote to invoice" };
    }

    revalidatePath("/app/quotes");
    revalidatePath("/app/invoices");
    return { success: true, invoiceId: invId };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to convert quote" };
  }
}

/**
 * Atomic conversion of an accepted quotation to a service job.
 */
export async function convertQuoteToJob(
  quoteId: string,
  title?: string,
  scheduledStart?: string
): Promise<{ success: boolean; jobId?: string; error?: string }> {
  try {
    const { supabase, session, error } = await getBillingAuthContext(true);
    if (error || !session) return { success: false, error: error || "Unauthorized" };

    const orgId = session.membership.organizationId;
    const userId = session.user.id;

    const { data: jobId, error: rpcErr } = await supabase.rpc("convert_quote_to_job", {
      p_org_id: orgId,
      p_quote_id: quoteId,
      p_user_id: userId,
      p_title: title || "",
      p_scheduled_start: scheduledStart || "",
    });

    if (rpcErr || !jobId) {
      return { success: false, error: rpcErr?.message || "Failed to convert quote to job" };
    }

    revalidatePath("/app/quotes");
    revalidatePath("/app/jobs");
    return { success: true, jobId };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to convert quote to job" };
  }
}

/**
 * Fetch all invoices for the active organization.
 */
export async function getInvoices(params?: {
  limit?: number;
  offset?: number;
}): Promise<{
  success: boolean;
  data?: InvoiceSummary[];
  error?: string;
}> {
  try {
    const { supabase, session, error } = await getBillingAuthContext(false);
    if (error || !session) return { success: false, error: error || "Unauthorized" };

    const orgId = session.membership.organizationId;
    const limit = Math.min(Math.max(params?.limit ?? 100, 1), 500);
    const offset = Math.max(params?.offset ?? 0, 0);

    const { data: rawInvoices, error: queryError } = await supabase
      .from("invoices")
      .select(
        `
        id,
        invoice_number,
        customer_id,
        job_id,
        quote_id,
        subtotal,
        discount_amount,
        vat_rate,
        vat_amount,
        total_amount,
        paid_amount,
        balance_due,
        status,
        issue_date,
        due_date,
        payment_terms,
        notes,
        created_at,
        customers (
          contact_name,
          company_name,
          phone
        ),
        jobs (
          title
        ),
        quotes (
          quote_number
        )
      `
      )
      .eq("organization_id", orgId)
      .order("issue_date", { ascending: false })
      .range(offset, offset + limit - 1);

    if (queryError) return { success: false, error: queryError.message };

    const todayStr = new Date().toISOString().split("T")[0];

    const invoices: InvoiceSummary[] = (rawInvoices || []).map((inv) => {
      const customer = Array.isArray(inv.customers) ? inv.customers[0] : inv.customers;
      const job = Array.isArray(inv.jobs) ? inv.jobs[0] : inv.jobs;
      const quote = Array.isArray(inv.quotes) ? inv.quotes[0] : inv.quotes;

      let status = inv.status as InvoiceStatus;
      // Auto-detect overdue if unpaid and past due date
      if (status === "issued" && inv.due_date < todayStr && Number(inv.balance_due) > 0) {
        status = "overdue";
      }

      return {
        id: inv.id,
        invoiceNumber: inv.invoice_number,
        customerId: inv.customer_id,
        customerName: customer?.company_name || customer?.contact_name || "Customer",
        customerPhone: customer?.phone || "",
        jobId: inv.job_id,
        jobTitle: job?.title || null,
        quoteId: inv.quote_id,
        quoteNumber: quote?.quote_number || null,
        issueDate: inv.issue_date,
        dueDate: inv.due_date,
        subtotal: Number(inv.subtotal),
        discountAmount: Number(inv.discount_amount),
        vatRate: Number(inv.vat_rate),
        vatAmount: Number(inv.vat_amount),
        totalAmount: Number(inv.total_amount),
        paidAmount: Number(inv.paid_amount),
        balanceDue: Number(inv.balance_due),
        status,
        notes: inv.notes,
        paymentTerms: inv.payment_terms,
        createdAt: inv.created_at,
      };
    });

    return { success: true, data: invoices };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to load invoices" };
  }
}

/**
 * Fetch detailed invoice with items and recorded payment history.
 */
export async function getInvoiceDetail(
  invoiceId: string
): Promise<{ success: boolean; data?: InvoiceDetail; error?: string }> {
  try {
    const { supabase, session, error } = await getBillingAuthContext(false);
    if (error || !session) return { success: false, error: error || "Unauthorized" };

    const orgId = session.membership.organizationId;

    const { data: inv, error: invError } = await supabase
      .from("invoices")
      .select(
        `
        id,
        invoice_number,
        customer_id,
        job_id,
        quote_id,
        subtotal,
        discount_amount,
        vat_rate,
        vat_amount,
        total_amount,
        paid_amount,
        balance_due,
        status,
        issue_date,
        due_date,
        payment_terms,
        notes,
        created_at,
        customers (
          contact_name,
          company_name,
          phone,
          email,
          billing_address
        ),
        jobs (
          title
        ),
        quotes (
          quote_number
        )
      `
      )
      .eq("id", invoiceId)
      .eq("organization_id", orgId)
      .single();

    if (invError || !inv) {
      return { success: false, error: invError?.message || "Invoice not found" };
    }

    // Fetch line items
    const { data: rawItems } = await supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("sort_order", { ascending: true });

    const items: BillingLineItem[] = (rawItems || []).map((i) => ({
      id: i.id,
      description: i.description,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unit_price),
      lineTotal: Number(i.line_total),
      itemType: (i.item_type as BillingLineItem["itemType"]) || "service",
      sortOrder: i.sort_order || 0,
    }));

    // Fetch payments
    const { data: rawPayments } = await supabase
      .from("payments")
      .select(
        `
        id,
        invoice_id,
        amount,
        payment_method,
        payment_date,
        transaction_reference,
        notes,
        recorded_by,
        status,
        created_at,
        profiles (
          full_name
        )
      `
      )
      .eq("invoice_id", invoiceId)
      .order("payment_date", { ascending: true });

    const payments: PaymentRecord[] = (rawPayments || []).map((p) => {
      const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
      return {
        id: p.id,
        invoiceId: p.invoice_id,
        amount: Number(p.amount),
        paymentMethod: p.payment_method as PaymentRecord["paymentMethod"],
        paymentDate: p.payment_date,
        transactionReference: p.transaction_reference,
        notes: p.notes,
        recordedBy: p.recorded_by,
        recorderName: profile?.full_name || "Staff Member",
        status: p.status as PaymentRecord["status"],
        createdAt: p.created_at,
      };
    });

    const customer = Array.isArray(inv.customers) ? inv.customers[0] : inv.customers;
    const job = Array.isArray(inv.jobs) ? inv.jobs[0] : inv.jobs;
    const quote = Array.isArray(inv.quotes) ? inv.quotes[0] : inv.quotes;

    const detail: InvoiceDetail = {
      id: inv.id,
      invoiceNumber: inv.invoice_number,
      customerId: inv.customer_id,
      customerName: customer?.company_name || customer?.contact_name || "Customer",
      customerPhone: customer?.phone || "",
      customerEmail: customer?.email || null,
      customerAddress: customer?.billing_address || null,
      jobId: inv.job_id,
      jobTitle: job?.title || null,
      quoteId: inv.quote_id,
      quoteNumber: quote?.quote_number || null,
      issueDate: inv.issue_date,
      dueDate: inv.due_date,
      subtotal: Number(inv.subtotal),
      discountAmount: Number(inv.discount_amount),
      vatRate: Number(inv.vat_rate),
      vatAmount: Number(inv.vat_amount),
      totalAmount: Number(inv.total_amount),
      paidAmount: Number(inv.paid_amount),
      balanceDue: Number(inv.balance_due),
      status: inv.status as InvoiceStatus,
      notes: inv.notes,
      paymentTerms: inv.payment_terms,
      createdAt: inv.created_at,
      items,
      payments,
    };

    return { success: true, data: detail };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to load invoice details" };
  }
}

/**
 * Direct Invoice creation.
 */
export async function createInvoice(
  input: CreateInvoiceInput
): Promise<{ success: boolean; invoiceId?: string; error?: string }> {
  try {
    const parsed = createInvoiceSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const { supabase, session, error } = await getBillingAuthContext(true);
    if (error || !session) return { success: false, error: error || "Unauthorized" };

    const orgId = session.membership.organizationId;
    const userId = session.user.id;
    const data = parsed.data;

    // 1. Calculate totals
    const lineItemInputs = data.items.map((i) => ({
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    }));
    const totals = calculateDocumentTotals(lineItemInputs, data.discountAmount, data.vatRate);

    // 2. Generate unique invoice number
    const { data: docNumber, error: seqErr } = await supabase.rpc("get_next_document_number", {
      doc_type: "invoice",
      prefix: "INV",
      target_org_id: orgId,
    });
    if (seqErr || !docNumber) {
      return { success: false, error: seqErr?.message || "Failed to generate invoice number" };
    }

    // 3. Insert Invoice
    const issueDate = data.issueDate || new Date().toISOString().split("T")[0];
    const { data: newInv, error: insErr } = await supabase
      .from("invoices")
      .insert({
        organization_id: orgId,
        invoice_number: docNumber,
        customer_id: data.customerId,
        job_id: data.jobId || null,
        quote_id: data.quoteId || null,
        subtotal: totals.subtotal,
        discount_amount: totals.discountAmount,
        vat_rate: totals.vatRate,
        vat_amount: totals.vatAmount,
        total_amount: totals.totalAmount,
        paid_amount: 0.00,
        balance_due: totals.totalAmount,
        status: "issued",
        issue_date: issueDate,
        due_date: data.dueDate,
        notes: data.notes || null,
        payment_terms: data.paymentTerms || "Due upon receipt",
        created_by: userId,
      })
      .select("id")
      .single();

    if (insErr || !newInv) {
      return { success: false, error: insErr?.message || "Failed to create invoice" };
    }

    // 4. Insert Invoice Items
    const itemsToInsert = data.items.map((item, idx) => ({
      invoice_id: newInv.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      line_total: roundMoney(item.quantity * item.unitPrice),
      item_type: item.itemType || "service",
      sort_order: idx + 1,
    }));

    const { error: itemsErr } = await supabase.from("invoice_items").insert(itemsToInsert);
    if (itemsErr) return { success: false, error: itemsErr.message };

    // 5. Activity log
    await supabase.from("activity_logs").insert({
      organization_id: orgId,
      actor_id: userId,
      entity_type: "invoice",
      entity_id: newInv.id,
      action: "invoice.issued",
      details: {
        invoice_number: docNumber,
        total_amount: totals.totalAmount,
      },
    });

    revalidatePath("/app/invoices");
    return { success: true, invoiceId: newInv.id };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to create invoice" };
  }
}

/**
 * Record a manual BDT payment against an issued invoice (Cash, bKash, Nagad, Bank transfer, etc.)
 * Strictly enforces that amount cannot exceed remaining balance due.
 */
export async function recordPayment(
  input: RecordPaymentInput
): Promise<{ success: boolean; paymentId?: string; error?: string }> {
  try {
    const parsed = recordPaymentSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const { supabase, session, error } = await getBillingAuthContext(true);
    if (error || !session) return { success: false, error: error || "Unauthorized" };

    const orgId = session.membership.organizationId;
    const userId = session.user.id;
    const data = parsed.data;

    const paymentDate = data.paymentDate || new Date().toISOString().split("T")[0];

    // Call atomic Postgres stored procedure to avoid race conditions and overpayment
    const { data: resJson, error: rpcErr } = await supabase.rpc("record_invoice_payment", {
      p_org_id: orgId,
      p_invoice_id: data.invoiceId,
      p_amount: roundMoney(data.amount),
      p_method: data.paymentMethod,
      p_date: paymentDate,
      p_reference: data.transactionReference || "",
      p_notes: data.notes || "",
      p_recorded_by: userId,
    });

    if (rpcErr || !resJson) {
      return { success: false, error: rpcErr?.message || "Failed to record payment" };
    }

    const result = resJson as { payment_id?: string };

    revalidatePath("/app/invoices");
    return { success: true, paymentId: result.payment_id };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to record payment" };
  }
}

/**
 * Void an existing payment and restore invoice balance due.
 */
export async function voidPayment(
  paymentId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { supabase, session, error } = await getBillingAuthContext(true);
    if (error || !session) return { success: false, error: error || "Unauthorized" };

    const orgId = session.membership.organizationId;
    const userId = session.user.id;

    const { error: rpcErr } = await supabase.rpc("void_invoice_payment", {
      p_org_id: orgId,
      p_payment_id: paymentId,
      p_reason: reason || "Voided by finance administrator",
      p_user_id: userId,
    });

    if (rpcErr) return { success: false, error: rpcErr.message };

    revalidatePath("/app/invoices");
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to void payment" };
  }
}

/**
 * Seed realistic billing data (commercial customer, quotations, invoices, partial payments)
 * to verify end-to-end functionality immediately in Supabase.
 */
export async function seedSampleBillingData(): Promise<{
  success: boolean;
  quoteId?: string;
  invoiceId?: string;
  error?: string;
}> {
  try {
    const { supabase, session, error } = await getBillingAuthContext(true);
    if (error || !session) return { success: false, error: error || "Unauthorized" };

    const orgId = session.membership.organizationId;

    // 1. Ensure customer
    let customerId: string;
    const { data: cust } = await supabase
      .from("customers")
      .select("id")
      .eq("organization_id", orgId)
      .limit(1)
      .maybeSingle();

    if (cust) {
      customerId = cust.id;
    } else {
      const { data: newCust, error: custErr } = await supabase
        .from("customers")
        .insert({
          organization_id: orgId,
          contact_name: "Mahmudul Hasan",
          company_name: "Meghna Executive Tower",
          phone: "01819234567",
          email: "facilities@meghna-group.com",
          billing_address: "Road 14, Banani C/A, Dhaka 1213",
          customer_type: "commercial",
          notes: "HQ building AC maintenance contract.",
        })
        .select("id")
        .single();
      if (custErr || !newCust) return { success: false, error: custErr?.message };
      customerId = newCust.id;
    }

    // 2. Create Sample Quotation
    const quoteRes = await createQuote({
      customerId,
      issueDate: new Date().toISOString().split("T")[0],
      validUntil: new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
      items: [
        {
          description: "Overhaul & Jet Foam Wash - 5x General Inverter ACs",
          quantity: 5,
          unitPrice: 2200,
          itemType: "service",
        },
        {
          description: "R410A Refrigerant Top-up Charge (2.5 kg)",
          quantity: 2.5,
          unitPrice: 2800,
          itemType: "part",
        },
        {
          description: "Master Drain Line Nitrogen Pressure Flush",
          quantity: 1,
          unitPrice: 3500,
          itemType: "labour",
        },
      ],
      discountAmount: 1500,
      vatRate: 5,
      notes: "Includes 90-day service warranty on gas pressure and cooling performance.",
      terms: "Payment terms: 50% advance upon quotation acceptance, 50% upon completion.",
    });

    if (!quoteRes.success || !quoteRes.quoteId) {
      return { success: false, error: quoteRes.error };
    }

    // 3. Create Sample Invoice
    const invRes = await createInvoice({
      customerId,
      quoteId: quoteRes.quoteId,
      issueDate: new Date().toISOString().split("T")[0],
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
      items: [
        {
          description: "Emergency Compressor Capacitor Replacement (55uF)",
          quantity: 2,
          unitPrice: 1800,
          itemType: "part",
        },
        {
          description: "Outdoor Unit Condenser Chemical De-scaling Service",
          quantity: 2,
          unitPrice: 3200,
          itemType: "service",
        },
        {
          description: "Field Diagnostic & Testing Fee",
          quantity: 1,
          unitPrice: 1500,
          itemType: "labour",
        },
      ],
      discountAmount: 500,
      vatRate: 0,
      notes: "Replaced 2 burnt contactor terminals. Restored server room cooling.",
      paymentTerms: "Due upon receipt via Cash or bKash Merchant.",
    });

    if (!invRes.success || !invRes.invoiceId) {
      return { success: false, error: invRes.error };
    }

    // 4. Record Partial Payment (bKash)
    await recordPayment({
      invoiceId: invRes.invoiceId,
      amount: 5000,
      paymentMethod: "bkash",
      transactionReference: "BKX928491823",
      notes: "5,000 BDT advance payment received via bKash Merchant by client facilities desk.",
    });

    revalidatePath("/app/quotes");
    revalidatePath("/app/invoices");

    return {
      success: true,
      quoteId: quoteRes.quoteId,
      invoiceId: invRes.invoiceId,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to seed sample billing data",
    };
  }
}
