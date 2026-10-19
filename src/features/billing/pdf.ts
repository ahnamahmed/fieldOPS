import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { QuoteDetail, InvoiceDetail, OrganizationBillingInfo } from "./types";
import { formatBDPhoneDisplay } from "@/lib/formatters";

/**
 * Generates an authentic binary PDF for a Quotation using pdf-lib.
 */
export async function generateQuotePdf(
  quote: QuoteDetail,
  org: OrganizationBillingInfo
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);

  // A4 dimensions: 595.28 x 841.89 points
  const page = doc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const margin = 40;

  // Colors
  const navy = rgb(0.06, 0.13, 0.24); // #0f213d
  const slateDark = rgb(0.2, 0.25, 0.33);
  const slateLight = rgb(0.95, 0.96, 0.98);
  const blue = rgb(0.12, 0.44, 0.88);
  const borderGray = rgb(0.85, 0.87, 0.9);

  let y = height - margin;

  // Header Background Accent Bar
  page.drawRectangle({
    x: margin,
    y: y - 55,
    width: width - margin * 2,
    height: 55,
    color: navy,
  });

  // Business Name & Title
  page.drawText(org.name || "FieldOps BD Service", {
    x: margin + 16,
    y: y - 24,
    size: 16,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText("Commercial HVAC & Refrigeration Service", {
    x: margin + 16,
    y: y - 40,
    size: 9,
    font: fontRegular,
    color: rgb(0.8, 0.85, 0.95),
  });

  page.drawText("QUOTATION", {
    x: width - margin - 110,
    y: y - 32,
    size: 16,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  y -= 75;

  // Meta Information Box
  page.drawRectangle({
    x: margin,
    y: y - 60,
    width: width - margin * 2,
    height: 60,
    color: slateLight,
    borderColor: borderGray,
    borderWidth: 1,
  });

  // Left: Customer Details
  page.drawText("CLIENT / RECIPIENT:", {
    x: margin + 12,
    y: y - 16,
    size: 8,
    font: fontBold,
    color: slateDark,
  });

  page.drawText(quote.customerName, {
    x: margin + 12,
    y: y - 30,
    size: 11,
    font: fontBold,
    color: navy,
  });

  const phoneText = quote.customerPhone ? formatBDPhoneDisplay(quote.customerPhone) : "";
  page.drawText(`${phoneText}${quote.customerEmail ? " • " + quote.customerEmail : ""}`, {
    x: margin + 12,
    y: y - 44,
    size: 9,
    font: fontRegular,
    color: slateDark,
  });

  // Right: Quote Meta
  const rightX = width - margin - 180;
  page.drawText(`Quote #: ${quote.quoteNumber}`, {
    x: rightX,
    y: y - 16,
    size: 10,
    font: fontBold,
    color: navy,
  });

  page.drawText(`Issue Date: ${quote.issueDate}`, {
    x: rightX,
    y: y - 30,
    size: 9,
    font: fontRegular,
    color: slateDark,
  });

  page.drawText(`Valid Until: ${quote.validUntil || "14 days from issue"}`, {
    x: rightX,
    y: y - 44,
    size: 9,
    font: fontRegular,
    color: slateDark,
  });

  y -= 85;

  // Line Items Table Header
  const colX = {
    desc: margin + 10,
    type: margin + 260,
    qty: margin + 330,
    rate: margin + 380,
    total: width - margin - 70,
  };

  page.drawRectangle({
    x: margin,
    y: y - 22,
    width: width - margin * 2,
    height: 22,
    color: navy,
  });

  page.drawText("DESCRIPTION", { x: colX.desc, y: y - 15, size: 8, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText("TYPE", { x: colX.type, y: y - 15, size: 8, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText("QTY", { x: colX.qty, y: y - 15, size: 8, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText("UNIT (BDT)", { x: colX.rate, y: y - 15, size: 8, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText("TOTAL (BDT)", { x: colX.total - 10, y: y - 15, size: 8, font: fontBold, color: rgb(1, 1, 1) });

  y -= 26;

  // Line Items Rows
  let isAlt = false;
  for (const item of quote.items) {
    const rowHeight = 22;

    if (isAlt) {
      page.drawRectangle({
        x: margin,
        y: y - rowHeight + 4,
        width: width - margin * 2,
        height: rowHeight,
        color: rgb(0.97, 0.98, 0.99),
      });
    }

    // Truncate description if too long
    const shortDesc = item.description.length > 40 ? item.description.substring(0, 38) + "..." : item.description;

    page.drawText(shortDesc, { x: colX.desc, y: y - 10, size: 9, font: fontRegular, color: navy });
    page.drawText((item.itemType || "service").toUpperCase(), { x: colX.type, y: y - 10, size: 7.5, font: fontBold, color: slateDark });
    page.drawText(String(item.quantity), { x: colX.qty + 5, y: y - 10, size: 9, font: fontRegular, color: navy });
    page.drawText(item.unitPrice.toLocaleString("en-US", { minimumFractionDigits: 2 }), {
      x: colX.rate,
      y: y - 10,
      size: 9,
      font: fontRegular,
      color: navy,
    });
    page.drawText(item.lineTotal.toLocaleString("en-US", { minimumFractionDigits: 2 }), {
      x: colX.total,
      y: y - 10,
      size: 9,
      font: fontBold,
      color: navy,
    });

    y -= rowHeight;
    isAlt = !isAlt;
  }

  // Divider Line
  page.drawLine({
    start: { x: margin, y: y },
    end: { x: width - margin, y: y },
    thickness: 1,
    color: borderGray,
  });

  y -= 15;

  // Summary Totals on the right
  const totalsX = width - margin - 190;
  const totalsValX = width - margin - 60;

  page.drawText("Subtotal:", { x: totalsX, y: y, size: 9, font: fontRegular, color: slateDark });
  page.drawText(`BDT ${quote.subtotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, {
    x: totalsValX,
    y: y,
    size: 9,
    font: fontRegular,
    color: navy,
  });
  y -= 16;

  if (quote.discountAmount > 0) {
    page.drawText("Discount:", { x: totalsX, y: y, size: 9, font: fontRegular, color: slateDark });
    page.drawText(`- BDT ${quote.discountAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, {
      x: totalsValX,
      y: y,
      size: 9,
      font: fontRegular,
      color: rgb(0.8, 0.2, 0.2),
    });
    y -= 16;
  }

  if (quote.vatAmount > 0) {
    page.drawText(`VAT / Tax (${quote.vatRate}%):`, { x: totalsX, y: y, size: 9, font: fontRegular, color: slateDark });
    page.drawText(`+ BDT ${quote.vatAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, {
      x: totalsValX,
      y: y,
      size: 9,
      font: fontRegular,
      color: navy,
    });
    y -= 16;
  }

  // Grand Total Box
  page.drawRectangle({
    x: totalsX - 10,
    y: y - 8,
    width: width - margin - totalsX + 10,
    height: 24,
    color: blue,
  });

  page.drawText("GRAND TOTAL:", { x: totalsX, y: y, size: 10, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText(`BDT ${quote.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, {
    x: totalsValX - 10,
    y: y,
    size: 11,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  y -= 45;

  // Terms & Notes Box
  page.drawRectangle({
    x: margin,
    y: y - 55,
    width: width - margin * 2,
    height: 55,
    color: slateLight,
    borderColor: borderGray,
    borderWidth: 1,
  });

  page.drawText("TERMS & CONDITIONS:", {
    x: margin + 12,
    y: y - 14,
    size: 8,
    font: fontBold,
    color: slateDark,
  });

  const termsString = quote.terms || "Standard commercial AC service terms apply. Valid for 14 days from issue date.";
  page.drawText(termsString.substring(0, 95), {
    x: margin + 12,
    y: y - 28,
    size: 8,
    font: fontRegular,
    color: slateDark,
  });

  if (quote.notes) {
    page.drawText(`Notes: ${quote.notes.substring(0, 90)}`, {
      x: margin + 12,
      y: y - 42,
      size: 8,
      font: fontRegular,
      color: slateDark,
    });
  }

  // Footer
  page.drawText("Generated by FieldOps BD • Multi-Tenant Field Service SaaS • Asia/Dhaka", {
    x: margin,
    y: margin,
    size: 7.5,
    font: fontRegular,
    color: slateDark,
  });

  return await doc.save();
}

/**
 * Generates an authentic binary PDF for an Invoice with payment details using pdf-lib.
 */
export async function generateInvoicePdf(
  invoice: InvoiceDetail,
  org: OrganizationBillingInfo
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);

  // A4 dimensions
  const page = doc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const margin = 40;

  const navy = rgb(0.06, 0.13, 0.24);
  const slateDark = rgb(0.2, 0.25, 0.33);
  const slateLight = rgb(0.95, 0.96, 0.98);
  const emerald = rgb(0.05, 0.55, 0.35);
  const borderGray = rgb(0.85, 0.87, 0.9);

  let y = height - margin;

  // Header Banner
  page.drawRectangle({
    x: margin,
    y: y - 55,
    width: width - margin * 2,
    height: 55,
    color: navy,
  });

  page.drawText(org.name || "FieldOps BD Service", {
    x: margin + 16,
    y: y - 24,
    size: 16,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText("Commercial HVAC & Refrigeration Service Operations", {
    x: margin + 16,
    y: y - 40,
    size: 9,
    font: fontRegular,
    color: rgb(0.8, 0.85, 0.95),
  });

  page.drawText("TAX INVOICE", {
    x: width - margin - 120,
    y: y - 32,
    size: 16,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  y -= 75;

  // Meta Information Box
  page.drawRectangle({
    x: margin,
    y: y - 65,
    width: width - margin * 2,
    height: 65,
    color: slateLight,
    borderColor: borderGray,
    borderWidth: 1,
  });

  // Client Details
  page.drawText("INVOICE TO:", {
    x: margin + 12,
    y: y - 16,
    size: 8,
    font: fontBold,
    color: slateDark,
  });

  page.drawText(invoice.customerName, {
    x: margin + 12,
    y: y - 30,
    size: 11,
    font: fontBold,
    color: navy,
  });

  const phoneText = invoice.customerPhone ? formatBDPhoneDisplay(invoice.customerPhone) : "";
  page.drawText(`${phoneText}${invoice.customerEmail ? " • " + invoice.customerEmail : ""}`, {
    x: margin + 12,
    y: y - 44,
    size: 9,
    font: fontRegular,
    color: slateDark,
  });

  if (invoice.customerAddress) {
    page.drawText(invoice.customerAddress.substring(0, 50), {
      x: margin + 12,
      y: y - 56,
      size: 8,
      font: fontRegular,
      color: slateDark,
    });
  }

  // Invoice Details
  const rightX = width - margin - 180;
  page.drawText(`Invoice #: ${invoice.invoiceNumber}`, {
    x: rightX,
    y: y - 16,
    size: 10,
    font: fontBold,
    color: navy,
  });

  page.drawText(`Issue Date: ${invoice.issueDate}`, {
    x: rightX,
    y: y - 30,
    size: 9,
    font: fontRegular,
    color: slateDark,
  });

  page.drawText(`Due Date: ${invoice.dueDate}`, {
    x: rightX,
    y: y - 44,
    size: 9,
    font: fontBold,
    color: invoice.status === "overdue" ? rgb(0.8, 0.2, 0.2) : navy,
  });

  page.drawText(`Status: ${invoice.status.toUpperCase()}`, {
    x: rightX,
    y: y - 56,
    size: 8.5,
    font: fontBold,
    color: invoice.status === "paid" ? emerald : navy,
  });

  y -= 85;

  // Table Header
  const colX = {
    desc: margin + 10,
    type: margin + 260,
    qty: margin + 330,
    rate: margin + 380,
    total: width - margin - 70,
  };

  page.drawRectangle({
    x: margin,
    y: y - 22,
    width: width - margin * 2,
    height: 22,
    color: navy,
  });

  page.drawText("DESCRIPTION", { x: colX.desc, y: y - 15, size: 8, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText("TYPE", { x: colX.type, y: y - 15, size: 8, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText("QTY", { x: colX.qty, y: y - 15, size: 8, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText("UNIT (BDT)", { x: colX.rate, y: y - 15, size: 8, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText("TOTAL (BDT)", { x: colX.total - 10, y: y - 15, size: 8, font: fontBold, color: rgb(1, 1, 1) });

  y -= 26;

  // Line Item Rows
  let isAlt = false;
  for (const item of invoice.items) {
    const rowHeight = 22;

    if (isAlt) {
      page.drawRectangle({
        x: margin,
        y: y - rowHeight + 4,
        width: width - margin * 2,
        height: rowHeight,
        color: rgb(0.97, 0.98, 0.99),
      });
    }

    const shortDesc = item.description.length > 40 ? item.description.substring(0, 38) + "..." : item.description;

    page.drawText(shortDesc, { x: colX.desc, y: y - 10, size: 9, font: fontRegular, color: navy });
    page.drawText((item.itemType || "service").toUpperCase(), { x: colX.type, y: y - 10, size: 7.5, font: fontBold, color: slateDark });
    page.drawText(String(item.quantity), { x: colX.qty + 5, y: y - 10, size: 9, font: fontRegular, color: navy });
    page.drawText(item.unitPrice.toLocaleString("en-US", { minimumFractionDigits: 2 }), {
      x: colX.rate,
      y: y - 10,
      size: 9,
      font: fontRegular,
      color: navy,
    });
    page.drawText(item.lineTotal.toLocaleString("en-US", { minimumFractionDigits: 2 }), {
      x: colX.total,
      y: y - 10,
      size: 9,
      font: fontBold,
      color: navy,
    });

    y -= rowHeight;
    isAlt = !isAlt;
  }

  // Divider
  page.drawLine({
    start: { x: margin, y: y },
    end: { x: width - margin, y: y },
    thickness: 1,
    color: borderGray,
  });

  y -= 15;

  // Financial Summary Breakdown
  const totalsX = width - margin - 200;
  const totalsValX = width - margin - 60;

  page.drawText("Subtotal:", { x: totalsX, y: y, size: 9, font: fontRegular, color: slateDark });
  page.drawText(`BDT ${invoice.subtotal.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, {
    x: totalsValX,
    y: y,
    size: 9,
    font: fontRegular,
    color: navy,
  });
  y -= 15;

  if (invoice.discountAmount > 0) {
    page.drawText("Discount:", { x: totalsX, y: y, size: 9, font: fontRegular, color: slateDark });
    page.drawText(`- BDT ${invoice.discountAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, {
      x: totalsValX,
      y: y,
      size: 9,
      font: fontRegular,
      color: rgb(0.8, 0.2, 0.2),
    });
    y -= 15;
  }

  if (invoice.vatAmount > 0) {
    page.drawText(`VAT / Tax (${invoice.vatRate}%):`, { x: totalsX, y: y, size: 9, font: fontRegular, color: slateDark });
    page.drawText(`+ BDT ${invoice.vatAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, {
      x: totalsValX,
      y: y,
      size: 9,
      font: fontRegular,
      color: navy,
    });
    y -= 15;
  }

  page.drawText("Invoice Total:", { x: totalsX, y: y, size: 9, font: fontBold, color: navy });
  page.drawText(`BDT ${invoice.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, {
    x: totalsValX,
    y: y,
    size: 9,
    font: fontBold,
    color: navy,
  });
  y -= 15;

  page.drawText("Amount Paid:", { x: totalsX, y: y, size: 9, font: fontRegular, color: emerald });
  page.drawText(`BDT ${invoice.paidAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, {
    x: totalsValX,
    y: y,
    size: 9,
    font: fontRegular,
    color: emerald,
  });
  y -= 18;

  // Balance Due Banner
  const isPaid = invoice.balanceDue <= 0;
  page.drawRectangle({
    x: totalsX - 10,
    y: y - 8,
    width: width - margin - totalsX + 10,
    height: 24,
    color: isPaid ? emerald : rgb(0.85, 0.2, 0.2),
  });

  page.drawText(isPaid ? "PAID IN FULL" : "BALANCE DUE:", {
    x: totalsX,
    y: y,
    size: 10,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText(`BDT ${invoice.balanceDue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, {
    x: totalsValX - 10,
    y: y,
    size: 11,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  y -= 45;

  // Payment Instructions & Methods Box
  page.drawRectangle({
    x: margin,
    y: y - 55,
    width: width - margin * 2,
    height: 55,
    color: slateLight,
    borderColor: borderGray,
    borderWidth: 1,
  });

  page.drawText("MANUAL PAYMENT INSTRUCTIONS:", {
    x: margin + 12,
    y: y - 14,
    size: 8,
    font: fontBold,
    color: slateDark,
  });

  page.drawText("Accepted Methods: Cash, bKash Merchant, Nagad, or Bank Transfer.", {
    x: margin + 12,
    y: y - 28,
    size: 8,
    font: fontRegular,
    color: slateDark,
  });

  page.drawText(`Please quote Invoice #${invoice.invoiceNumber} on payment receipt. Thank you for your business.`, {
    x: margin + 12,
    y: y - 42,
    size: 8,
    font: fontRegular,
    color: slateDark,
  });

  // Footer
  page.drawText("FieldOps BD • Bangladesh AC & Refrigeration Operations SaaS • Asia/Dhaka", {
    x: margin,
    y: margin,
    size: 7.5,
    font: fontRegular,
    color: slateDark,
  });

  return await doc.save();
}
