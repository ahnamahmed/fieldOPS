import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { generateInvoicePdf } from "@/features/billing/pdf";
import type { InvoiceDetail, OrganizationBillingInfo, BillingLineItem, PaymentRecord } from "@/features/billing/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await params;
    const supabase = await createClient();
    const session = await getCurrentUser();

    if (!session || !session.membership) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const orgId = session.membership.organizationId;

    // Fetch invoice
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
      return new NextResponse("Invoice not found", { status: 404 });
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
      customerName: customer?.company_name || customer?.contact_name || "Valued Client",
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
      status: inv.status as InvoiceDetail["status"],
      notes: inv.notes,
      paymentTerms: inv.payment_terms,
      createdAt: inv.created_at,
      items,
      payments,
    };

    const orgInfo: OrganizationBillingInfo = {
      name: session.membership.organizationName,
      phone: null,
      address: "Dhaka, Bangladesh",
      currency: session.membership.currency,
      timezone: session.membership.timezone,
    };

    const pdfBytes = await generateInvoicePdf(detail, orgInfo);

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Invoice-${detail.invoiceNumber}.pdf"`,
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "PDF generation failed";
    return new NextResponse(msg, { status: 500 });
  }
}
