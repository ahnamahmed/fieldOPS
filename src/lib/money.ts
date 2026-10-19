/**
 * FieldOps BD — Financial Monetary Calculation Engine
 * 
 * Rules:
 * - Never use raw binary floating-point arithmetic for totals.
 * - Store and round all financial calculations to 2 decimal places (paisa precision).
 * - Default currency: BDT (৳).
 */

/**
 * Rounds a number to exactly 2 decimal places using standard commercial rounding.
 * Mitigates IEEE-754 floating point precision issues (e.g. 0.1 + 0.2 = 0.30000000000000004).
 */
export function roundMoney(amount: number): number {
  if (isNaN(amount) || !isFinite(amount)) return 0;
  // Convert to paisa integer, round, then back to fractional taka
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Converts a BDT amount into integer paisas (cents).
 */
export function toPaisas(taka: number): number {
  return Math.round((taka + Number.EPSILON) * 100);
}

/**
 * Converts integer paisas back to BDT Taka with 2-decimal precision.
 */
export function fromPaisas(paisas: number): number {
  return Math.round(paisas) / 100;
}

export interface LineItemCalculationInput {
  quantity: number;
  unitPrice: number;
}

/**
 * Calculates a single line item total: round(quantity * unit_price)
 */
export function calculateLineTotal(quantity: number, unitPrice: number): number {
  const qty = Math.max(0, Number(quantity) || 0);
  const price = Math.max(0, Number(unitPrice) || 0);
  return roundMoney(qty * price);
}

export interface DocumentTotals {
  subtotal: number;
  discountAmount: number;
  taxableBase: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
}

/**
 * Calculates complete document totals:
 * 1. subtotal = sum(line_totals)
 * 2. discount = clamped between 0 and subtotal
 * 3. taxableBase = subtotal - discount
 * 4. vatAmount = round(taxableBase * (vatRate / 100))
 * 5. totalAmount = taxableBase + vatAmount
 */
export function calculateDocumentTotals(
  items: LineItemCalculationInput[],
  discountInput: number = 0,
  vatRateInput: number = 0
): DocumentTotals {
  // 1. Calculate sum of line totals in integer paisas
  let subtotalPaisas = 0;
  for (const item of items) {
    const lineTotal = calculateLineTotal(item.quantity, item.unitPrice);
    subtotalPaisas += toPaisas(lineTotal);
  }
  const subtotal = fromPaisas(subtotalPaisas);

  // 2. Validate & clamp discount
  const rawDiscount = Math.max(0, Number(discountInput) || 0);
  const discountPaisas = Math.min(toPaisas(rawDiscount), subtotalPaisas);
  const discountAmount = fromPaisas(discountPaisas);

  // 3. Taxable base
  const taxablePaisas = subtotalPaisas - discountPaisas;
  const taxableBase = fromPaisas(taxablePaisas);

  // 4. VAT / Tax calculation
  const vatRate = Math.max(0, Number(vatRateInput) || 0);
  let vatPaisas = 0;
  if (vatRate > 0) {
    vatPaisas = Math.round(taxablePaisas * (vatRate / 100));
  }
  const vatAmount = fromPaisas(vatPaisas);

  // 5. Total amount
  const totalPaisas = taxablePaisas + vatPaisas;
  const totalAmount = fromPaisas(totalPaisas);

  return {
    subtotal,
    discountAmount,
    taxableBase,
    vatRate,
    vatAmount,
    totalAmount,
  };
}

export interface BalanceCalculationResult {
  paidAmount: number;
  balanceDue: number;
  isFullyPaid: boolean;
  isPartiallyPaid: boolean;
}

/**
 * Calculates paid amount and balance due from a list of verified payments.
 */
export function calculateBalances(
  totalAmount: number,
  payments: Array<{ amount: number; status?: string }>
): BalanceCalculationResult {
  const totalPaisas = toPaisas(Math.max(0, totalAmount));

  // Sum active/verified payments only
  let paidPaisas = 0;
  for (const p of payments) {
    if (p.status !== "voided") {
      paidPaisas += toPaisas(Math.max(0, Number(p.amount) || 0));
    }
  }

  // Prevent negative balance
  const balancePaisas = Math.max(0, totalPaisas - paidPaisas);
  const paidAmount = fromPaisas(paidPaisas);
  const balanceDue = fromPaisas(balancePaisas);

  return {
    paidAmount,
    balanceDue,
    isFullyPaid: balanceDue === 0 && totalAmount > 0,
    isPartiallyPaid: paidAmount > 0 && balanceDue > 0,
  };
}

/**
 * Validates a prospective payment against the current invoice balance.
 */
export function validatePaymentAmount(
  balanceDue: number,
  paymentAmount: number
): { valid: boolean; error?: string } {
  const amount = Number(paymentAmount);
  if (isNaN(amount) || amount <= 0) {
    return {
      valid: false,
      error: "Payment amount must be greater than zero.",
    };
  }

  const roundedAmount = roundMoney(amount);
  const roundedBalance = roundMoney(balanceDue);

  if (roundedAmount > roundedBalance) {
    return {
      valid: false,
      error: `Payment amount of ৳${roundedAmount.toLocaleString()} exceeds the remaining balance due of ৳${roundedBalance.toLocaleString()}. Overpayments are not permitted.`,
    };
  }

  return { valid: true };
}
