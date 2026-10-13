/**
 * FieldOps BD — Bangladesh Localization Formatters & Validators
 * Timezone: Asia/Dhaka (UTC+6)
 * Currency: BDT (৳)
 */

/**
 * Formats a numeric or decimal string value into BDT currency string
 * e.g. 15000 -> ৳15,000.00
 * Uses South Asian numbering format standard in Bangladesh.
 */
export function formatBDT(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) {
    return "৳0.00";
  }
  const numeric = typeof amount === "string" ? parseFloat(amount) : amount;
  if (Number.isNaN(numeric)) {
    return "৳0.00";
  }
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);

  return `৳${formatted}`;
}

/**
 * Normalizes input to 2 decimal places using fixed string math to prevent binary float inaccuracies
 */
export function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Validates Bangladesh mobile phone numbers
 * Accepts: 013XXXXXXXX, 014XXXXXXXX, 015XXXXXXXX, 016XXXXXXXX, 017XXXXXXXX, 018XXXXXXXX, 019XXXXXXXX
 * With or without +88 / 88 prefix
 */
export const BD_PHONE_REGEX = /^(?:\+?880|0)?1[3-9]\d{8}$/;

export function isValidBDPhone(phone: string): boolean {
  if (!phone) return false;
  return BD_PHONE_REGEX.test(phone.trim().replace(/[\s-]/g, ""));
}

/**
 * Normalizes a BD phone number to E.164 standard format (+8801XXXXXXXXX)
 */
export function normalizeBDPhone(phone: string): string {
  const clean = phone.trim().replace(/[\s-]/g, "");
  if (clean.startsWith("+880")) return clean;
  if (clean.startsWith("880")) return `+${clean}`;
  if (clean.startsWith("0")) return `+88${clean}`;
  if (clean.length === 10 && clean.startsWith("1")) return `+880${clean}`;
  return clean;
}

/**
 * Formats BD phone number for human display (e.g. +880 1712-345678)
 */
export function formatBDPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return "";
  const normalized = normalizeBDPhone(phone);
  if (!normalized.startsWith("+8801") || normalized.length !== 14) {
    return phone;
  }
  const prefix = normalized.slice(0, 4); // +880
  const part1 = normalized.slice(4, 8); // 1712
  const part2 = normalized.slice(8); // 345678
  return `${prefix} ${part1}-${part2}`;
}

/**
 * Timezone-aware date formatter in Asia/Dhaka
 */
export function formatDhakaDateTime(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";

  return new Intl.DateTimeFormat("en-BD", {
    timeZone: "Asia/Dhaka",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

export function formatDhakaDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";

  return new Intl.DateTimeFormat("en-BD", {
    timeZone: "Asia/Dhaka",
    dateStyle: "medium",
  }).format(d);
}

export function formatDhakaTime(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";

  return new Intl.DateTimeFormat("en-BD", {
    timeZone: "Asia/Dhaka",
    timeStyle: "short",
  }).format(d);
}
