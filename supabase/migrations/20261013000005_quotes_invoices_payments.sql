-- FieldOps BD — Quotations, Invoices, and Payments Migration
-- Migration: 20261013000005_quotes_invoices_payments.sql

-- 1. Enhance quotes table
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Enhance quote_items table
ALTER TABLE public.quote_items
  ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'service';

-- 3. Enhance invoices table
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 4. Enhance invoice_items table
ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'service';

-- 5. Indexes for financial queries
CREATE INDEX IF NOT EXISTS idx_quotes_org_status ON public.quotes(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_quotes_org_date ON public.quotes(organization_id, issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_org_date ON public.invoices(organization_id, issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_org_date ON public.payments(organization_id, payment_date DESC);

-- 6. Atomic function to record manual invoice payment (Cash, bKash, Nagad, Bank transfer, etc.)
CREATE OR REPLACE FUNCTION public.record_invoice_payment(
  p_org_id UUID,
  p_invoice_id UUID,
  p_amount NUMERIC,
  p_method TEXT,
  p_date DATE,
  p_reference TEXT,
  p_notes TEXT,
  p_recorded_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invoice RECORD;
  v_new_payment_id UUID;
  v_new_paid NUMERIC(14, 2);
  v_new_balance NUMERIC(14, 2);
  v_new_status TEXT;
BEGIN
  -- 1. Validate payment method
  IF p_method NOT IN ('cash', 'bkash', 'nagad', 'rocket', 'bank_transfer', 'cheque', 'other') THEN
    RAISE EXCEPTION 'Invalid payment method: %', p_method;
  END IF;

  -- 2. Validate amount is positive
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero. Received: %', p_amount;
  END IF;

  -- 3. Lock invoice row for atomic update
  SELECT id, organization_id, total_amount, paid_amount, balance_due, status, invoice_number
  INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id AND organization_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice % not found in organization %', p_invoice_id, p_org_id;
  END IF;

  -- 4. Reject payments on draft or void invoices
  IF v_invoice.status = 'draft' THEN
    RAISE EXCEPTION 'Cannot record payment on a draft invoice. Please issue the invoice first.';
  END IF;

  IF v_invoice.status = 'void' THEN
    RAISE EXCEPTION 'Cannot record payment on a voided invoice.';
  END IF;

  -- 5. Reject overpayment
  IF p_amount > v_invoice.balance_due THEN
    RAISE EXCEPTION 'Payment amount of % BDT exceeds the remaining balance due of % BDT for invoice %',
      p_amount, v_invoice.balance_due, v_invoice.invoice_number;
  END IF;

  -- 6. Calculate new paid and balance amounts with strict 2-decimal precision
  v_new_paid := ROUND((v_invoice.paid_amount + p_amount)::numeric, 2);
  v_new_balance := ROUND((v_invoice.total_amount - v_new_paid)::numeric, 2);

  IF v_new_balance <= 0 THEN
    v_new_balance := 0.00;
    v_new_status := 'paid';
  ELSE
    v_new_status := 'partially_paid';
  END IF;

  -- 7. Insert payment transaction
  INSERT INTO public.payments (
    organization_id,
    invoice_id,
    amount,
    payment_method,
    payment_date,
    transaction_reference,
    notes,
    recorded_by,
    status
  ) VALUES (
    p_org_id,
    p_invoice_id,
    p_amount,
    p_method,
    p_date,
    p_reference,
    p_notes,
    p_recorded_by,
    'verified_manual'
  )
  RETURNING id INTO v_new_payment_id;

  -- 8. Update invoice balances
  UPDATE public.invoices
  SET
    paid_amount = v_new_paid,
    balance_due = v_new_balance,
    status = v_new_status,
    updated_at = now()
  WHERE id = p_invoice_id;

  -- 9. Audit trail in activity_logs
  INSERT INTO public.activity_logs (
    organization_id,
    actor_id,
    entity_type,
    entity_id,
    action,
    details
  ) VALUES (
    p_org_id,
    p_recorded_by,
    'payment',
    v_new_payment_id,
    'payment.recorded',
    jsonb_build_object(
      'invoice_id', p_invoice_id,
      'invoice_number', v_invoice.invoice_number,
      'amount', p_amount,
      'payment_method', p_method,
      'previous_balance', v_invoice.balance_due,
      'new_balance', v_new_balance,
      'new_status', v_new_status
    )
  );

  RETURN jsonb_build_object(
    'payment_id', v_new_payment_id,
    'invoice_id', p_invoice_id,
    'paid_amount', v_new_paid,
    'balance_due', v_new_balance,
    'status', v_new_status
  );
END;
$$;

-- 7. Atomic function to void a recorded payment and restore invoice balance
CREATE OR REPLACE FUNCTION public.void_invoice_payment(
  p_org_id UUID,
  p_payment_id UUID,
  p_reason TEXT,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payment RECORD;
  v_invoice RECORD;
  v_new_paid NUMERIC(14, 2);
  v_new_balance NUMERIC(14, 2);
  v_new_status TEXT;
BEGIN
  -- 1. Fetch and lock payment
  SELECT id, organization_id, invoice_id, amount, status
  INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id AND organization_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment % not found in organization %', p_payment_id, p_org_id;
  END IF;

  IF v_payment.status = 'voided' THEN
    RAISE EXCEPTION 'Payment % is already voided', p_payment_id;
  END IF;

  -- 2. Fetch and lock invoice
  SELECT id, total_amount, paid_amount, balance_due, status, invoice_number, due_date
  INTO v_invoice
  FROM public.invoices
  WHERE id = v_payment.invoice_id AND organization_id = p_org_id
  FOR UPDATE;

  -- 3. Calculate restored amounts
  v_new_paid := ROUND(GREATEST(0, v_invoice.paid_amount - v_payment.amount)::numeric, 2);
  v_new_balance := ROUND((v_invoice.total_amount - v_new_paid)::numeric, 2);

  IF v_new_paid = 0 THEN
    IF v_invoice.due_date < CURRENT_DATE THEN
      v_new_status := 'overdue';
    ELSE
      v_new_status := 'issued';
    END IF;
  ELSE
    v_new_status := 'partially_paid';
  END IF;

  -- 4. Mark payment voided
  UPDATE public.payments
  SET
    status = 'voided',
    notes = COALESCE(notes || ' ', '') || '[VOIDED: ' || COALESCE(p_reason, 'No reason specified') || ']'
  WHERE id = p_payment_id;

  -- 5. Update invoice
  UPDATE public.invoices
  SET
    paid_amount = v_new_paid,
    balance_due = v_new_balance,
    status = v_new_status,
    updated_at = now()
  WHERE id = v_payment.invoice_id;

  -- 6. Audit trail
  INSERT INTO public.activity_logs (
    organization_id,
    actor_id,
    entity_type,
    entity_id,
    action,
    details
  ) VALUES (
    p_org_id,
    p_user_id,
    'payment',
    p_payment_id,
    'payment.voided',
    jsonb_build_object(
      'invoice_id', v_payment.invoice_id,
      'invoice_number', v_invoice.invoice_number,
      'amount', v_payment.amount,
      'reason', p_reason,
      'new_balance', v_new_balance,
      'new_status', v_new_status
    )
  );

  RETURN jsonb_build_object(
    'payment_id', p_payment_id,
    'invoice_id', v_payment.invoice_id,
    'paid_amount', v_new_paid,
    'balance_due', v_new_balance,
    'status', v_new_status
  );
END;
$$;

-- 8. Atomic function to convert an accepted quotation into an invoice
CREATE OR REPLACE FUNCTION public.convert_quote_to_invoice(
  p_org_id UUID,
  p_quote_id UUID,
  p_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_quote RECORD;
  v_new_inv_id UUID;
  v_inv_number TEXT;
  v_item RECORD;
BEGIN
  -- 1. Fetch quote
  SELECT *
  INTO v_quote
  FROM public.quotes
  WHERE id = p_quote_id AND organization_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote % not found', p_quote_id;
  END IF;

  -- Mark quote as accepted if not already
  IF v_quote.status != 'accepted' THEN
    UPDATE public.quotes
    SET status = 'accepted', accepted_at = COALESCE(accepted_at, now()), updated_at = now()
    WHERE id = p_quote_id;
  END IF;

  -- 2. Generate unique invoice number
  v_inv_number := public.get_next_document_number(p_org_id, 'invoice', 'INV');

  -- 3. Create invoice with repeat-safe values matching quote exactly
  INSERT INTO public.invoices (
    organization_id,
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
    notes,
    payment_terms,
    created_by
  ) VALUES (
    p_org_id,
    v_inv_number,
    v_quote.customer_id,
    v_quote.job_id,
    p_quote_id,
    v_quote.subtotal,
    v_quote.discount_amount,
    v_quote.vat_rate,
    v_quote.vat_amount,
    v_quote.total_amount,
    0.00,
    v_quote.total_amount,
    'issued',
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '14 days',
    v_quote.notes,
    COALESCE(v_quote.terms, 'Payment due within 14 days of invoice date.'),
    p_user_id
  )
  RETURNING id INTO v_new_inv_id;

  -- 4. Copy line items
  FOR v_item IN (SELECT * FROM public.quote_items WHERE quote_id = p_quote_id ORDER BY sort_order ASC) LOOP
    INSERT INTO public.invoice_items (
      invoice_id,
      description,
      quantity,
      unit_price,
      line_total,
      item_type,
      sort_order
    ) VALUES (
      v_new_inv_id,
      v_item.description,
      v_item.quantity,
      v_item.unit_price,
      v_item.line_total,
      COALESCE(v_item.item_type, 'service'),
      v_item.sort_order
    );
  END LOOP;

  -- 5. Audit log
  INSERT INTO public.activity_logs (
    organization_id,
    actor_id,
    entity_type,
    entity_id,
    action,
    details
  ) VALUES (
    p_org_id,
    p_user_id,
    'invoice',
    v_new_inv_id,
    'invoice.created_from_quote',
    jsonb_build_object(
      'quote_id', p_quote_id,
      'quote_number', v_quote.quote_number,
      'invoice_number', v_inv_number,
      'total_amount', v_quote.total_amount
    )
  );

  RETURN v_new_inv_id;
END;
$$;

-- 9. Atomic function to convert an accepted quotation into a job
CREATE OR REPLACE FUNCTION public.convert_quote_to_job(
  p_org_id UUID,
  p_quote_id UUID,
  p_user_id UUID,
  p_title TEXT,
  p_scheduled_start TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_quote RECORD;
  v_new_job_id UUID;
  v_job_number TEXT;
  v_site_id UUID;
BEGIN
  -- 1. Fetch quote
  SELECT *
  INTO v_quote
  FROM public.quotes
  WHERE id = p_quote_id AND organization_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote % not found', p_quote_id;
  END IF;

  -- Mark quote as accepted
  IF v_quote.status != 'accepted' THEN
    UPDATE public.quotes
    SET status = 'accepted', accepted_at = COALESCE(accepted_at, now()), updated_at = now()
    WHERE id = p_quote_id;
  END IF;

  -- 2. Find customer's primary service site
  SELECT id INTO v_site_id
  FROM public.service_sites
  WHERE customer_id = v_quote.customer_id AND organization_id = p_org_id
  LIMIT 1;

  IF v_site_id IS NULL THEN
    -- Fallback: create default site for customer
    INSERT INTO public.service_sites (
      organization_id, customer_id, site_name, address, address_line1, city
    ) VALUES (
      p_org_id, v_quote.customer_id, 'Main Service Site', 'Dhaka, Bangladesh', 'Dhaka, Bangladesh', 'Dhaka'
    )
    RETURNING id INTO v_site_id;
  END IF;

  -- 3. Generate job number
  v_job_number := public.get_next_document_number(p_org_id, 'job', 'JOB');

  -- 4. Create Job
  INSERT INTO public.jobs (
    organization_id,
    job_number,
    customer_id,
    service_site_id,
    site_id,
    title,
    description,
    priority,
    status,
    job_type,
    scheduled_start,
    scheduled_end,
    estimated_duration_minutes,
    created_by
  ) VALUES (
    p_org_id,
    v_job_number,
    v_quote.customer_id,
    v_site_id,
    v_site_id,
    COALESCE(p_title, 'Service Order for Quote #' || v_quote.quote_number),
    v_quote.notes,
    'medium',
    'scheduled',
    'maintenance',
    COALESCE(p_scheduled_start, now() + INTERVAL '1 day'),
    COALESCE(p_scheduled_start, now() + INTERVAL '1 day') + INTERVAL '2 hours',
    120,
    p_user_id
  )
  RETURNING id INTO v_new_job_id;

  -- 5. Link quote to job
  UPDATE public.quotes
  SET job_id = v_new_job_id, updated_at = now()
  WHERE id = p_quote_id;

  -- 6. Seed AC checklist for job
  PERFORM public.seed_job_standard_checklist(v_new_job_id);

  -- 7. Audit log
  INSERT INTO public.activity_logs (
    organization_id,
    actor_id,
    entity_type,
    entity_id,
    action,
    details
  ) VALUES (
    p_org_id,
    p_user_id,
    'job',
    v_new_job_id,
    'job.created_from_quote',
    jsonb_build_object(
      'quote_id', p_quote_id,
      'quote_number', v_quote.quote_number,
      'job_number', v_job_number
    )
  );

  RETURN v_new_job_id;
END;
$$;
