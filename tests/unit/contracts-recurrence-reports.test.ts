import { describe, it, expect } from "vitest";
import {
  addMonthsClamped,
  generatePlannedVisitDates,
  frequencyToMonths,
  evaluateVisitDueStatus,
  formatDhakaDate,
  formatDhakaDateTime,
  isLeapYear,
} from "@/features/contracts/recurrence";
import {
  createContractSchema,
  renewContractSchema,
  convertVisitToJobSchema,
} from "@/features/contracts/schemas";
import { roundMoney } from "@/lib/formatters";

describe("Contracts Recurrence Engine (features/contracts/recurrence.ts)", () => {
  it("accurately detects leap years", () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2028)).toBe(true);
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(2023)).toBe(false);
    expect(isLeapYear(2025)).toBe(false);
    expect(isLeapYear(2100)).toBe(false); // Century non-leap
  });

  describe("addMonthsClamped - Month-end & Leap Year Behavior", () => {
    it("adds months cleanly for mid-month dates", () => {
      const d1 = new Date(2026, 0, 15); // Jan 15, 2026
      const res1 = addMonthsClamped(d1, 1);
      expect(res1.getFullYear()).toBe(2026);
      expect(res1.getMonth()).toBe(1); // Feb
      expect(res1.getDate()).toBe(15);
    });

    it("clamps Jan 31 to Feb 28 on a non-leap year (2025)", () => {
      const jan31 = new Date(2025, 0, 31);
      const feb = addMonthsClamped(jan31, 1);
      expect(feb.getFullYear()).toBe(2025);
      expect(feb.getMonth()).toBe(1); // Feb
      expect(feb.getDate()).toBe(28); // Clamped to 28
    });

    it("clamps Jan 31 to Feb 29 on a leap year (2024)", () => {
      const jan31 = new Date(2024, 0, 31);
      const feb = addMonthsClamped(jan31, 1);
      expect(feb.getFullYear()).toBe(2024);
      expect(feb.getMonth()).toBe(1); // Feb
      expect(feb.getDate()).toBe(29); // Clamped to 29
    });

    it("clamps 31st to 30th on 30-day months (March 31 -> April 30, Aug 31 -> Sep 30)", () => {
      const mar31 = new Date(2026, 2, 31);
      const apr = addMonthsClamped(mar31, 1);
      expect(apr.getMonth()).toBe(3); // April
      expect(apr.getDate()).toBe(30);

      const aug31 = new Date(2026, 7, 31);
      const sep = addMonthsClamped(aug31, 1);
      expect(sep.getMonth()).toBe(8); // Sept
      expect(sep.getDate()).toBe(30);
    });
  });

  describe("generatePlannedVisitDates", () => {
    it("generates 12 monthly visits for a 1-year contract", () => {
      const visits = generatePlannedVisitDates(
        "2026-01-01",
        "2026-12-31",
        "monthly"
      );

      expect(visits).toHaveLength(12);
      expect(visits[0].plannedDate).toBe("2026-01-01");
      expect(visits[1].plannedDate).toBe("2026-02-01");
      expect(visits[11].plannedDate).toBe("2026-12-01");
    });

    it("generates 4 quarterly visits for annual AC maintenance", () => {
      const visits = generatePlannedVisitDates(
        "2026-01-01",
        "2026-12-31",
        "quarterly",
        "HQ-2026"
      );

      expect(visits).toHaveLength(4);
      expect(visits[0].plannedDate).toBe("2026-01-01"); // Q1
      expect(visits[1].plannedDate).toBe("2026-04-01"); // Q2
      expect(visits[2].plannedDate).toBe("2026-07-01"); // Q3
      expect(visits[3].plannedDate).toBe("2026-10-01"); // Q4
      expect(visits[0].title).toContain("HQ-2026");
    });

    it("generates 6 bi-monthly visits", () => {
      const visits = generatePlannedVisitDates(
        "2026-01-15",
        "2026-12-31",
        "bi_monthly"
      );

      expect(visits).toHaveLength(6);
      expect(visits[0].plannedDate).toBe("2026-01-15");
      expect(visits[1].plannedDate).toBe("2026-03-15");
      expect(visits[5].plannedDate).toBe("2026-11-15");
    });

    it("generates 2 half-yearly visits", () => {
      const visits = generatePlannedVisitDates(
        "2026-01-01",
        "2026-12-31",
        "half_yearly"
      );

      expect(visits).toHaveLength(2);
      expect(visits[0].plannedDate).toBe("2026-01-01");
      expect(visits[1].plannedDate).toBe("2026-07-01");
    });

    it("generates 1 annual visit", () => {
      const visits = generatePlannedVisitDates(
        "2026-03-01",
        "2027-02-28",
        "annually"
      );

      expect(visits).toHaveLength(1);
      expect(visits[0].plannedDate).toBe("2026-03-01");
    });

    it("stops cleanly when interval exceeds end date", () => {
      const visits = generatePlannedVisitDates(
        "2026-01-01",
        "2026-05-15", // 5.5 months contract
        "quarterly" // 3 months
      );

      expect(visits).toHaveLength(2); // Jan 1 and Apr 1 (July 1 is past May 15)
      expect(visits[0].plannedDate).toBe("2026-01-01");
      expect(visits[1].plannedDate).toBe("2026-04-01");
    });
  });

  describe("frequencyToMonths helper", () => {
    it("maps standard frequencies to proper month intervals", () => {
      expect(frequencyToMonths("monthly")).toBe(1);
      expect(frequencyToMonths("bi_monthly")).toBe(2);
      expect(frequencyToMonths("quarterly")).toBe(3);
      expect(frequencyToMonths("half_yearly")).toBe(6);
      expect(frequencyToMonths("annually")).toBe(12);
      expect(frequencyToMonths("custom")).toBe(3);
    });
  });

  describe("evaluateVisitDueStatus", () => {
    const today = "2026-10-15";

    it("preserves terminal statuses like completed or cancelled", () => {
      expect(
        evaluateVisitDueStatus("2026-09-01", today, "completed")
      ).toBe("completed");

      expect(
        evaluateVisitDueStatus("2026-09-01", today, "cancelled")
      ).toBe("cancelled");
    });

    it("preserves job_created when job is already dispatched", () => {
      expect(
        evaluateVisitDueStatus("2026-10-01", today, "planned", true)
      ).toBe("job_created");
    });

    it("marks past dates as overdue", () => {
      expect(
        evaluateVisitDueStatus("2026-10-10", today, "planned")
      ).toBe("overdue");
    });

    it("marks today's date as due_today", () => {
      expect(
        evaluateVisitDueStatus("2026-10-15", today, "planned")
      ).toBe("due_today");
    });

    it("marks dates within 7 days as due_soon", () => {
      expect(
        evaluateVisitDueStatus("2026-10-19", today, "planned") // 4 days later
      ).toBe("due_soon");
    });

    it("marks dates > 7 days as planned", () => {
      expect(
        evaluateVisitDueStatus("2026-11-01", today, "planned") // 17 days later
      ).toBe("planned");
    });
  });

  describe("Asia/Dhaka Timezone Formatting", () => {
    it("formats ISO timestamps in Dhaka timezone correctly", () => {
      // 2026-10-14 20:00:00 UTC is 2026-10-15 02:00:00 in Dhaka (UTC+6)
      const utcIso = "2026-10-14T20:00:00.000Z";
      const dhakaDate = formatDhakaDate(utcIso);
      expect(dhakaDate).toBe("2026-10-15");

      const dhakaDateTime = formatDhakaDateTime(utcIso);
      expect(dhakaDateTime).toContain("2026");
    });
  });
});

describe("Duplicate Visit Prevention Logic", () => {
  function canConvertVisit(visit: { status: string; jobId: string | null }): boolean {
    if (visit.jobId) return false;
    if (["completed", "cancelled", "skipped", "job_created"].includes(visit.status)) {
      return false;
    }
    return true;
  }

  it("permits converting planned, overdue, due_today, and due_soon visits", () => {
    expect(canConvertVisit({ status: "planned", jobId: null })).toBe(true);
    expect(canConvertVisit({ status: "overdue", jobId: null })).toBe(true);
    expect(canConvertVisit({ status: "due_today", jobId: null })).toBe(true);
    expect(canConvertVisit({ status: "due_soon", jobId: null })).toBe(true);
  });

  it("prevents converting visits that already have a job card", () => {
    expect(
      canConvertVisit({
        status: "planned",
        jobId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      })
    ).toBe(false);
  });

  it("prevents converting completed or cancelled visits", () => {
    expect(canConvertVisit({ status: "completed", jobId: null })).toBe(false);
    expect(canConvertVisit({ status: "cancelled", jobId: null })).toBe(false);
    expect(canConvertVisit({ status: "job_created", jobId: null })).toBe(false);
  });
});

describe("Report Financial & Operational Calculations", () => {
  it("calculates completion rate percentages safely without division by zero", () => {
    function getCompletionRate(completed: number, activeOrScheduled: number) {
      const total = completed + activeOrScheduled;
      return total > 0 ? Math.round((completed / total) * 100) : 0;
    }

    expect(getCompletionRate(0, 0)).toBe(0);
    expect(getCompletionRate(10, 0)).toBe(100);
    expect(getCompletionRate(5, 5)).toBe(50);
    expect(getCompletionRate(1, 2)).toBe(33); // 1 / 3 = 33.33% -> 33%
  });

  it("computes separate aggregates for invoices and collected payments without Cartesian cross-product", () => {
    // 3 invoices
    const sampleInvoices = [
      { id: "1", total: 50000, balance: 0, status: "paid" },
      { id: "2", total: 30000, balance: 10000, status: "partially_paid" },
      { id: "3", total: 20000, balance: 20000, status: "issued" },
    ];

    // 2 payments
    const samplePayments = [
      { id: "p1", amount: 50000, status: "completed" },
      { id: "p2", amount: 20000, status: "completed" },
    ];

    const totalInvoiced = roundMoney(
      sampleInvoices.reduce((acc, inv) => acc + inv.total, 0)
    );
    const totalOutstanding = roundMoney(
      sampleInvoices.reduce((acc, inv) => acc + inv.balance, 0)
    );
    const totalCollected = roundMoney(
      samplePayments.reduce((acc, p) => acc + p.amount, 0)
    );

    expect(totalInvoiced).toBe(100000);
    expect(totalOutstanding).toBe(30000);
    expect(totalCollected).toBe(70000);
    expect(totalInvoiced - totalCollected).toBe(totalOutstanding);

    // Realization rate
    const realizationRate = Math.round((totalCollected / totalInvoiced) * 100);
    expect(realizationRate).toBe(70);
  });
});

describe("Contract Validation Schemas (Zod)", () => {
  const validUuid = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

  it("validates a compliant contract input", () => {
    const input = {
      customerId: validUuid,
      contractName: "Annual AC Servicing Agreement",
      contractType: "comprehensive",
      serviceFrequency: "quarterly",
      billingFrequency: "annually",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      contractAmount: 150000,
      terms: "Includes 4 periodic visits and emergency response",
      assetIds: [validUuid],
    };

    const res = createContractSchema.safeParse(input);
    expect(res.success).toBe(true);
  });

  it("rejects contract when start date is after end date", () => {
    const input = {
      customerId: validUuid,
      contractName: "Invalid Dates Agreement",
      contractType: "comprehensive",
      serviceFrequency: "quarterly",
      billingFrequency: "annually",
      startDate: "2026-12-31",
      endDate: "2026-01-01", // Invalid
      contractAmount: 50000,
    };

    const res = createContractSchema.safeParse(input);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].message).toContain("start date cannot be after end date");
    }
  });

  it("rejects negative contract amounts", () => {
    const input = {
      customerId: validUuid,
      contractName: "Negative Amount Agreement",
      contractType: "comprehensive",
      serviceFrequency: "quarterly",
      billingFrequency: "annually",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      contractAmount: -500, // Invalid
    };

    const res = createContractSchema.safeParse(input);
    expect(res.success).toBe(false);
  });

  it("validates renewal contract input", () => {
    const validRenewal = {
      contractId: validUuid,
      newStartDate: "2027-01-01",
      newEndDate: "2027-12-31",
      newAmount: 160000,
      renewalNotes: "Price indexed by 6.6%",
    };

    const res = renewContractSchema.safeParse(validRenewal);
    expect(res.success).toBe(true);
  });

  it("validates visit-to-job conversion schema", () => {
    const res = convertVisitToJobSchema.safeParse({
      visitId: validUuid,
      technicianId: validUuid,
    });
    expect(res.success).toBe(true);

    const invalid = convertVisitToJobSchema.safeParse({
      visitId: "not-a-uuid",
    });
    expect(invalid.success).toBe(false);
  });
});
