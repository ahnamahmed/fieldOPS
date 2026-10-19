"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { normalizeBDPhone } from "@/lib/formatters";
import type {
  ServiceReminder,
  ReminderStats,
  ReminderType,
  ReminderStatus,
  WhatsAppMessagePayload,
} from "./types";

/**
 * Sync and fetch upcoming service reminders for the authenticated organization.
 */
export async function getUpcomingServiceReminders(filters?: {
  type?: ReminderType;
  status?: ReminderStatus;
  limit?: number;
}): Promise<{
  success: boolean;
  reminders: ServiceReminder[];
  stats: ReminderStats;
  error?: string;
}> {
  try {
    const session = await getCurrentUser();
    if (!session || !session.membership) {
      return {
        success: false,
        reminders: [],
        stats: { overdueCount: 0, dueTodayCount: 0, dueSoonCount: 0, contractRenewalCount: 0, totalPending: 0 },
        error: "Unauthorized",
      };
    }

    const orgId = session.membership.organizationId;
    const supabase = await createClient();

    // 1. Sync reminders from live database visits and contracts
    try {
      await supabase.rpc("sync_service_reminders", { p_org_id: orgId });
    } catch (syncErr) {
      console.warn("sync_service_reminders non-critical warning:", syncErr);
    }

    // 2. Fetch all reminders for this organization
    let query = supabase
      .from("service_reminders")
      .select(`
        id,
        organization_id,
        customer_id,
        reminder_type,
        title,
        message,
        due_date,
        status,
        channel,
        contract_id,
        planned_visit_id,
        job_id,
        invoice_id,
        delivered_at,
        delivered_by,
        delivery_details,
        created_at,
        updated_at,
        customers (
          contact_name,
          company_name,
          phone
        ),
        service_contracts (
          contract_number,
          contract_name,
          service_sites (
            site_name
          )
        ),
        contract_planned_visits (
          visit_number,
          title
        ),
        jobs (
          job_number
        )
      `)
      .eq("organization_id", orgId)
      .order("due_date", { ascending: true });

    if (filters?.type) {
      query = query.eq("reminder_type", filters.type);
    }
    if (filters?.status) {
      query = query.eq("status", filters.status);
    } else {
      // Default to pending unless specified
      query = query.neq("status", "dismissed");
    }

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }

    const { data: rawReminders, error: fetchErr } = await query;
    if (fetchErr) {
      return {
        success: false,
        reminders: [],
        stats: { overdueCount: 0, dueTodayCount: 0, dueSoonCount: 0, contractRenewalCount: 0, totalPending: 0 },
        error: fetchErr.message,
      };
    }

    type RawReminderRow = {
      id: string;
      organization_id: string;
      customer_id: string;
      reminder_type: string;
      title: string;
      message: string;
      due_date: string;
      status: string;
      channel: string;
      contract_id: string | null;
      planned_visit_id: string | null;
      job_id: string | null;
      invoice_id: string | null;
      delivered_at: string | null;
      delivered_by: string | null;
      delivery_details: Record<string, unknown> | null;
      created_at: string;
      updated_at: string;
      customers: { contact_name?: string; company_name?: string; phone?: string } | null;
      service_contracts: {
        contract_number?: string;
        contract_name?: string;
        service_sites?: { site_name?: string } | null;
      } | null;
      contract_planned_visits: { visit_number?: number; title?: string } | null;
      jobs: { job_number?: string } | null;
    };

    // Map rows to typed ServiceReminder
    const reminders: ServiceReminder[] = (
      (rawReminders as unknown as RawReminderRow[]) || []
    ).map((row: RawReminderRow) => {
      const cust = row.customers;
      const contract = row.service_contracts;
      const visit = row.contract_planned_visits;
      const job = row.jobs;

      const customerName = cust?.company_name
        ? `${cust.company_name} (${cust.contact_name})`
        : cust?.contact_name || "Customer";
      const customerPhone = cust?.phone || "";
      const siteName = contract?.service_sites?.site_name || null;

      return {
        id: row.id,
        organizationId: row.organization_id,
        customerId: row.customer_id,
        customerName,
        customerPhone,
        siteName,
        reminderType: row.reminder_type as ReminderType,
        title: row.title,
        message: row.message,
        dueDate: row.due_date,
        status: row.status as ReminderStatus,
        channel: row.channel,
        contractId: row.contract_id,
        contractNumber: contract?.contract_number || null,
        contractName: contract?.contract_name || null,
        plannedVisitId: row.planned_visit_id,
        visitNumber: visit?.visit_number || null,
        jobId: row.job_id,
        jobNumber: job?.job_number || null,
        deliveredAt: row.delivered_at,
        deliveredBy: row.delivered_by,
        deliveryDetails: (row.delivery_details as Record<string, unknown>) || null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });

    // 3. Compute stats
    let overdueCount = 0;
    let dueTodayCount = 0;
    let dueSoonCount = 0;
    let contractRenewalCount = 0;
    let totalPending = 0;

    for (const r of reminders) {
      if (r.status === "pending") {
        totalPending++;
        if (r.reminderType === "visit_overdue") overdueCount++;
        else if (r.reminderType === "visit_due_today") dueTodayCount++;
        else if (r.reminderType === "visit_due_soon") dueSoonCount++;
        else if (r.reminderType === "contract_renewal") contractRenewalCount++;
      }
    }

    return {
      success: true,
      reminders,
      stats: {
        overdueCount,
        dueTodayCount,
        dueSoonCount,
        contractRenewalCount,
        totalPending,
      },
    };
  } catch (err: unknown) {
    return {
      success: false,
      reminders: [],
      stats: { overdueCount: 0, dueTodayCount: 0, dueSoonCount: 0, contractRenewalCount: 0, totalPending: 0 },
      error: err instanceof Error ? err.message : "Failed to fetch reminders",
    };
  }
}

/**
 * Builds formatted text and wa.me link for manual WhatsApp messaging
 */
export async function buildWhatsAppMessage(reminderId: string): Promise<{
  success: boolean;
  payload?: WhatsAppMessagePayload;
  error?: string;
}> {
  try {
    const session = await getCurrentUser();
    if (!session || !session.membership) return { success: false, error: "Unauthorized" };

    const orgId = session.membership.organizationId;
    const supabase = await createClient();

    // Fetch reminder with details
    const { data: reminder, error: remErr } = await supabase
      .from("service_reminders")
      .select(`
        *,
        customers ( contact_name, company_name, phone ),
        service_contracts ( contract_number, contract_name, end_date, service_sites ( site_name ) ),
        contract_planned_visits ( visit_number, title, planned_date ),
        organizations ( name, contact_phone )
      `)
      .eq("id", reminderId)
      .eq("organization_id", orgId)
      .single();

    if (remErr || !reminder) {
      return { success: false, error: "Reminder not found" };
    }

    const cust = reminder.customers as { contact_name?: string; company_name?: string; phone?: string } | null;
    const contract = reminder.service_contracts as {
      contract_number?: string;
      contract_name?: string;
      end_date?: string;
      service_sites?: { site_name?: string } | null;
    } | null;
    const org = reminder.organizations as { name?: string; contact_phone?: string } | null;

    const companyName = org?.name || "FieldOps Service";
    const companyPhone = org?.contact_phone || "";
    const customerName = cust?.contact_name || cust?.company_name || "Valued Customer";
    const rawPhone = cust?.phone || "";
    const siteName = contract?.service_sites?.site_name || "your designated facility";

    const cleanPhone = normalizeBDPhone(rawPhone).replace(/^\+/, "");

    let messageText = "";

    if (reminder.reminder_type === "contract_renewal") {
      messageText =
        `আসসালামু আলাইকুম / Greetings from ${companyName}.\n\n` +
        `Dear ${customerName},\n` +
        `This is a gentle notification that your AC Maintenance Contract ${contract?.contract_number || ""} (${contract?.contract_name || "Annual Maintenance"}) ` +
        `for ${siteName} is due for renewal on ${contract?.end_date || reminder.due_date}.\n\n` +
        `To ensure continued scheduled servicing and priority breakdown support for your cooling units, please let us know your preferred renewal schedule or call us directly at ${companyPhone}.\n\n` +
        `Thank you for your business,\n${companyName}`;
    } else {
      // Visit reminders (overdue, due today, due soon)
      const urgencyPrefix =
        reminder.reminder_type === "visit_overdue"
          ? "⚠️ IMPORTANT: AC Service Overdue Notice"
          : reminder.reminder_type === "visit_due_today"
          ? "📅 AC Service Scheduled for Today"
          : "ℹ️ Upcoming AC Maintenance Service Reminder";

      messageText =
        `আসসালামু আলাইকুম / Greetings from ${companyName}.\n\n` +
        `${urgencyPrefix}\n\n` +
        `Dear ${customerName},\n` +
        `Your periodic maintenance service for ${siteName} is scheduled for ${reminder.due_date}.\n` +
        `Contract: ${contract?.contract_number || "AMC"} (${contract?.contract_name || "Cooling Maintenance"})\n\n` +
        `Our field engineering team will visit during business hours to inspect and service your equipment.\n` +
        `If you need to reschedule or share specific site access instructions, please reply here or contact ${companyPhone}.\n\n` +
        `Best regards,\n${companyName}`;
    }

    const encodedUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`
      : "";

    return {
      success: true,
      payload: {
        recipientPhone: rawPhone,
        formattedText: messageText,
        encodedWhatsAppUrl: encodedUrl,
        reminderId: reminder.id,
      },
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to build WhatsApp message",
    };
  }
}

/**
 * Record that a staff member copied the message or triggered manual WhatsApp link.
 * Note: Does not claim external server delivery was confirmed.
 */
export async function markReminderCopiedToWhatsApp(reminderId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await getCurrentUser();
    if (!session || !session.membership) return { success: false, error: "Unauthorized" };

    const orgId = session.membership.organizationId;
    const userId = session.user.id;
    const supabase = await createClient();

    const { error: updateErr } = await supabase
      .from("service_reminders")
      .update({
        status: "delivered",
        delivered_at: new Date().toISOString(),
        delivered_by: userId,
        delivery_details: {
          channel: "manual_whatsapp",
          note: "Copied by staff member for manual WhatsApp dispatch",
          recorded_at: new Date().toISOString(),
        },
      })
      .eq("id", reminderId)
      .eq("organization_id", orgId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    revalidatePath("/app/dashboard");
    revalidatePath("/app/contracts");
    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to mark reminder",
    };
  }
}

/**
 * Dismiss a reminder
 */
export async function dismissReminder(reminderId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const session = await getCurrentUser();
    if (!session || !session.membership) return { success: false, error: "Unauthorized" };

    const orgId = session.membership.organizationId;
    const supabase = await createClient();

    const { error: updateErr } = await supabase
      .from("service_reminders")
      .update({
        status: "dismissed",
      })
      .eq("id", reminderId)
      .eq("organization_id", orgId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    revalidatePath("/app/dashboard");
    revalidatePath("/app/contracts");
    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to dismiss reminder",
    };
  }
}
