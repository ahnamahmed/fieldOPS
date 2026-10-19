import type { ServiceFrequency, PlannedVisitStatus } from "./types";

/**
 * Returns number of days in a given month of a given year (1-indexed month: 1=Jan, 12=Dec).
 * Properly handles leap years (e.g. 2028 is leap year with 29 days in Feb).
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Checks whether a given year is a leap year.
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Clamps target day to the last day of target month, correctly handling leap years.
 */
export function addMonthsClamped(date: Date, months: number): Date {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed
  const day = date.getDate();

  let targetMonth = month + months;
  let targetYear = year;
  while (targetMonth > 11) {
    targetMonth -= 12;
    targetYear += 1;
  }
  while (targetMonth < 0) {
    targetMonth += 12;
    targetYear -= 1;
  }

  const daysInTargetMonth = getDaysInMonth(targetYear, targetMonth + 1);
  const clampedDay = Math.min(day, daysInTargetMonth);

  return new Date(targetYear, targetMonth, clampedDay);
}

/**
 * Converts a ServiceFrequency to interval in months.
 */
export function frequencyToMonths(frequency: ServiceFrequency): number {
  switch (frequency) {
    case "monthly":
      return 1;
    case "bi_monthly":
      return 2;
    case "quarterly":
      return 3;
    case "half_yearly":
      return 6;
    case "annually":
      return 12;
    default:
      return 3;
  }
}

export interface GeneratedVisitDate {
  visitNumber: number;
  plannedDate: string; // "YYYY-MM-DD"
  title: string;
}

/**
 * Generates planned visit dates between startDate and endDate based on service frequency.
 * Handles month-end clamping (e.g. Jan 31 -> Feb 28/29, Mar 31, Apr 30)
 * and leap years deterministically.
 */
export function generatePlannedVisitDates(
  startDateStr: string,
  endDateStr: string,
  frequency: ServiceFrequency,
  contractTitleOrNumber?: string
): GeneratedVisitDate[] {
  const [startYear, startMonth, startDay] = startDateStr.split("-").map(Number);
  const [endYear, endMonth, endDay] = endDateStr.split("-").map(Number);

  const startUtc = Date.UTC(startYear, startMonth - 1, startDay);
  const endUtc = Date.UTC(endYear, endMonth - 1, endDay);

  if (startUtc > endUtc) {
    return [];
  }

  const intervalMonths = frequencyToMonths(frequency);
  const visits: GeneratedVisitDate[] = [];

  let currentYear = startYear;
  let currentMonth = startMonth; // 1-indexed
  const targetDay = startDay;
  let visitNumber = 1;

  while (true) {
    // Determine days in current month, clamping target day
    const daysInCurrMonth = getDaysInMonth(currentYear, currentMonth);
    const actualDay = Math.min(targetDay, daysInCurrMonth);

    const visitUtc = Date.UTC(currentYear, currentMonth - 1, actualDay);
    if (visitUtc > endUtc) {
      break;
    }

    const monthStr = String(currentMonth).padStart(2, "0");
    const dayStr = String(actualDay).padStart(2, "0");
    const dateStr = `${currentYear}-${monthStr}-${dayStr}`;

    const titlePrefix = contractTitleOrNumber ? `AMC ${contractTitleOrNumber} — ` : "";
    visits.push({
      visitNumber,
      plannedDate: dateStr,
      title: `${titlePrefix}Scheduled Maintenance #${visitNumber}`,
    });

    visitNumber++;

    // Advance by interval months
    let nextMonth = currentMonth + intervalMonths;
    let nextYear = currentYear;
    while (nextMonth > 12) {
      nextMonth -= 12;
      nextYear += 1;
    }

    currentMonth = nextMonth;
    currentYear = nextYear;
  }

  return visits;
}

/**
 * Evaluates the status of a planned visit relative to a reference date (default today).
 */
export function evaluateVisitDueStatus(
  plannedDateStr: string,
  referenceDateStr?: string,
  currentStatus?: PlannedVisitStatus,
  hasJobId?: boolean
): PlannedVisitStatus {
  if (currentStatus === "completed" || currentStatus === "cancelled" || currentStatus === "skipped") {
    return currentStatus;
  }

  if (hasJobId || currentStatus === "job_created") {
    return "job_created";
  }

  const refStr = referenceDateStr || new Date().toISOString().split("T")[0];

  const [pYear, pMonth, pDay] = plannedDateStr.split("-").map(Number);
  const [rYear, rMonth, rDay] = refStr.split("-").map(Number);

  const plannedUtc = Date.UTC(pYear, pMonth - 1, pDay);
  const refUtc = Date.UTC(rYear, rMonth - 1, rDay);

  const diffMs = plannedUtc - refUtc;
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));

  if (diffDays < 0) {
    return "overdue";
  } else if (diffDays === 0) {
    return "due_today";
  } else if (diffDays <= 7) {
    return "due_soon";
  } else {
    return "planned";
  }
}

/**
 * Formats an ISO string or Date into YYYY-MM-DD in Asia/Dhaka timezone.
 */
export function formatDhakaDate(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Formats an ISO string or Date into readable string in Asia/Dhaka timezone.
 */
export function formatDhakaDateTime(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}
