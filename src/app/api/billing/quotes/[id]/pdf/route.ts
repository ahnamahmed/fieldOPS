import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { generateQuotePdf } from "@/features/billing/pdf";
import type { QuoteDetail, OrganizationBillingInfo, BillingLineItem } from "@/features/billing/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: quoteId } = await params;
    const supabase = await createClient();
    const session = await getCurrentUser();

    if (!session || !session.membership) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const orgId = session.membership.organizationId;

    // Fetch quote
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
      return new NextResponse("Quote not found", { status: 404 });
    }

    // Fetch line items
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
      customerName: customer?.company_name || customer?.contact_name || "Valued Client",
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
      status: q.status as QuoteDetail["status"],
      notes: q.notes,
      terms: q.terms,
      acceptedAt: q.accepted_at,
      createdAt: q.created_at,
      items,
    };

    const orgInfo: OrganizationBillingInfo = {
      name: session.membership.organizationName,
      phone: null,
      address: "Dhaka, Bangladesh",
      currency: session.membership.currency,
      timezone: session.membership.timezone,
    };

    const pdfBytes = await generateQuotePdf(detail, orgInfo);

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Quotation-${detail.quoteNumber}.pdf"`,
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "PDF generation failed";
    return new NextResponse(msg, { status: 500 });
  }
}
