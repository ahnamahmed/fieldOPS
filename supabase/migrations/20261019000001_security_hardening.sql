-- FieldOps BD — Security Hardening Migration
-- Migration: 20261019000001_security_hardening.sql
-- Hardens all SECURITY DEFINER functions with explicit search_path and caller organization membership verification
-- Hardens storage policies against invalid UUID cast runtime exceptions

-- 1. Document sequence numbering: enforce search_path and caller org membership
CREATE OR REPLACE FUNCTION public.get_next_document_number(target_org_id UUID, doc_type TEXT, prefix TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  next_num BIGINT;
BEGIN
  -- Verify caller authorization if called from an authenticated session
  IF auth.uid() IS NOT NULL AND NOT public.user_has_role(target_org_id, ARRAY['owner', 'admin', 'dispatcher', 'finance', 'technician']) THEN
    RAISE EXCEPTION 'Access denied: caller does not have permission to generate numbers for organization %', target_org_id;
  END IF;

  INSERT INTO public.document_sequences (organization_id, document_type, current_val)
  VALUES (target_org_id, doc_type, 1001)
  ON CONFLICT (organization_id, document_type)
  DO UPDATE SET current_val = public.document_sequences.current_val + 1, updated_at = now()
  RETURNING current_val INTO next_num;

  RETURN prefix || '-' || next_num::TEXT;
END;
$$;

-- 2. Seed job standard checklist: enforce search_path and caller org membership
CREATE OR REPLACE FUNCTION public.seed_job_standard_checklist(p_job_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_id UUID;
  v_inserted_count INTEGER := 0;
BEGIN
  SELECT organization_id INTO v_org_id FROM public.jobs WHERE id = p_job_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Job % not found', p_job_id;
  END IF;

  IF auth.uid() IS NOT NULL AND NOT public.user_has_role(v_org_id, ARRAY['owner', 'admin', 'dispatcher', 'technician']) THEN
    RAISE EXCEPTION 'Access denied: caller does not have permission for organization %', v_org_id;
  END IF;

  INSERT INTO public.job_checklists (
    organization_id, job_id, item_key, label, field_type, unit, category, is_mandatory, result
  ) VALUES
    (v_org_id, p_job_id, 'pre_test_run', 'Pre-service Test Run & Room Temp', 'number', '°C', 'cooling', true, 'pending'),
    (v_org_id, p_job_id, 'suction_pressure', 'Suction Operating Pressure', 'number', 'PSI', 'cooling', true, 'pending'),
    (v_org_id, p_job_id, 'compressor_amps', 'Compressor Running Current', 'number', 'Amps', 'electrical', true, 'pending'),
    (v_org_id, p_job_id, 'indoor_coil_wash', 'Indoor Evaporator Coil & Filter Jet Wash', 'boolean', NULL, 'cleaning', true, 'pending'),
    (v_org_id, p_job_id, 'outdoor_condenser_wash', 'Outdoor Condenser Jet Wash & Comb', 'boolean', NULL, 'cleaning', true, 'pending'),
    (v_org_id, p_job_id, 'drain_line_flush', 'Drain Line Flush & Leak Test', 'boolean', NULL, 'cleaning', true, 'pending'),
    (v_org_id, p_job_id, 'gas_leak_test', 'Service Valve & Flare Nut Leak Test', 'boolean', NULL, 'cooling', true, 'pending'),
    (v_org_id, p_job_id, 'electrical_terminals', 'Terminal Tightening & Capacitor Check', 'boolean', NULL, 'electrical', true, 'pending'),
    (v_org_id, p_job_id, 'post_cooling_temp', 'Post-service Cooling Temp (Supply Air)', 'number', '°C', 'cooling', true, 'pending'),
    (v_org_id, p_job_id, 'remote_thermostat', 'Remote Controller & Thermostat Check', 'boolean', NULL, 'general', false, 'pending')
  ON CONFLICT (job_id, item_key) DO NOTHING;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  RETURN v_inserted_count;
END;
$$;

-- 3. Record invoice payment: enforce search_path and caller finance/owner/admin role
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
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invoice RECORD;
  v_new_payment_id UUID;
  v_new_paid NUMERIC(14, 2);
  v_new_balance NUMERIC(14, 2);
  v_new_status TEXT;
BEGIN
  -- Security check: caller must be owner, admin, or finance in p_org_id
  IF auth.uid() IS NOT NULL AND NOT public.user_has_role(p_org_id, ARRAY['owner', 'admin', 'finance']) THEN
    RAISE EXCEPTION 'Access denied: insufficient permissions to record payments for organization %', p_org_id;
  END IF;

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

-- 4. Void invoice payment: enforce search_path and caller finance/owner/admin role
CREATE OR REPLACE FUNCTION public.void_invoice_payment(
  p_org_id UUID,
  p_payment_id UUID,
  p_reason TEXT,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment RECORD;
  v_invoice RECORD;
  v_new_paid NUMERIC(14, 2);
  v_new_balance NUMERIC(14, 2);
  v_new_status TEXT;
BEGIN
  -- Security check: caller must be owner, admin, or finance in p_org_id
  IF auth.uid() IS NOT NULL AND NOT public.user_has_role(p_org_id, ARRAY['owner', 'admin', 'finance']) THEN
    RAISE EXCEPTION 'Access denied: insufficient permissions to void payments for organization %', p_org_id;
  END IF;

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

-- 5. Convert quote to invoice: enforce search_path and caller role
CREATE OR REPLACE FUNCTION public.convert_quote_to_invoice(
  p_org_id UUID,
  p_quote_id UUID,
  p_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_quote RECORD;
  v_new_inv_id UUID;
  v_inv_number TEXT;
  v_item RECORD;
BEGIN
  -- Security check: caller must be owner, admin, dispatcher, or finance
  IF auth.uid() IS NOT NULL AND NOT public.user_has_role(p_org_id, ARRAY['owner', 'admin', 'dispatcher', 'finance']) THEN
    RAISE EXCEPTION 'Access denied: insufficient permissions to convert quotes for organization %', p_org_id;
  END IF;

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

-- 6. Convert quote to job: enforce search_path and caller role
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
SET search_path = public, pg_temp
AS $$
DECLARE
  v_quote RECORD;
  v_new_job_id UUID;
  v_job_number TEXT;
  v_site_id UUID;
BEGIN
  -- Security check: caller must be owner, admin, or dispatcher
  IF auth.uid() IS NOT NULL AND NOT public.user_has_role(p_org_id, ARRAY['owner', 'admin', 'dispatcher']) THEN
    RAISE EXCEPTION 'Access denied: insufficient permissions to convert quotes to jobs for organization %', p_org_id;
  END IF;

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
    customer_id,
    site_id,
    service_site_id,
    quote_id,
    job_number,
    title,
    description,
    job_type,
    priority,
    status,
    scheduled_start,
    scheduled_end,
    created_by
  ) VALUES (
    p_org_id,
    v_quote.customer_id,
    v_site_id,
    v_site_id,
    p_quote_id,
    v_job_number,
    COALESCE(p_title, 'Service Job from Quote ' || v_quote.quote_number),
    COALESCE(v_quote.notes, 'Work generated from approved quotation ' || v_quote.quote_number),
    'repair',
    'medium',
    'scheduled',
    p_scheduled_start,
    p_scheduled_start + INTERVAL '3 hours',
    p_user_id
  )
  RETURNING id INTO v_new_job_id;

  -- 5. Seed standard checklist
  PERFORM public.seed_job_standard_checklist(v_new_job_id);

  -- 6. Link job back to quote
  UPDATE public.quotes
  SET job_id = v_new_job_id, updated_at = now()
  WHERE id = p_quote_id;

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

-- 7. Generate contract planned visits: enforce caller role
CREATE OR REPLACE FUNCTION public.generate_contract_planned_visits(
  p_org_id UUID,
  p_contract_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contract RECORD;
  v_interval_months INTEGER;
  v_current_date DATE;
  v_visit_num INTEGER := 1;
  v_count INTEGER := 0;
  v_visit_title TEXT;
BEGIN
  -- Security check: caller must be owner, admin, or dispatcher
  IF auth.uid() IS NOT NULL AND NOT public.user_has_role(p_org_id, ARRAY['owner', 'admin', 'dispatcher']) THEN
    RAISE EXCEPTION 'Access denied: insufficient permissions to generate contract visits for organization %', p_org_id;
  END IF;

  SELECT * INTO v_contract
  FROM public.service_contracts
  WHERE id = p_contract_id AND organization_id = p_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contract % not found for organization %', p_contract_id, p_org_id;
  END IF;

  -- Determine interval in months
  CASE v_contract.service_frequency
    WHEN 'monthly' THEN v_interval_months := 1;
    WHEN 'bi_monthly' THEN v_interval_months := 2;
    WHEN 'quarterly' THEN v_interval_months := 3;
    WHEN 'half_yearly' THEN v_interval_months := 6;
    WHEN 'annually' THEN v_interval_months := 12;
    ELSE v_interval_months := COALESCE(v_contract.service_interval_months, 3);
  END CASE;

  IF v_interval_months <= 0 THEN
    v_interval_months := 3;
  END IF;

  UPDATE public.service_contracts
  SET service_interval_months = v_interval_months
  WHERE id = p_contract_id;

  v_current_date := v_contract.start_date;

  WHILE v_current_date <= v_contract.end_date LOOP
    v_visit_title := 'Scheduled Maintenance #' || v_visit_num || ' — ' || COALESCE(v_contract.contract_name, v_contract.title);

    INSERT INTO public.contract_planned_visits (
      organization_id,
      contract_id,
      service_site_id,
      visit_number,
      planned_date,
      title,
      description,
      status
    ) VALUES (
      p_org_id,
      p_contract_id,
      v_contract.service_site_id,
      v_visit_num,
      v_current_date,
      v_visit_title,
      'Routine preventive maintenance visit under AMC ' || v_contract.contract_number,
      'planned'
    )
    ON CONFLICT (contract_id, visit_number) DO UPDATE
    SET planned_date = EXCLUDED.planned_date,
        service_site_id = EXCLUDED.service_site_id,
        title = EXCLUDED.title,
        updated_at = now();

    v_count := v_count + 1;
    v_visit_num := v_visit_num + 1;
    v_current_date := v_current_date + (v_interval_months || ' month')::interval;
  END LOOP;

  RETURN v_count;
END;
$$;

-- 8. Convert planned visit to job: enforce caller role
CREATE OR REPLACE FUNCTION public.convert_planned_visit_to_job(
  p_org_id UUID,
  p_visit_id UUID,
  p_user_id UUID,
  p_technician_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_visit RECORD;
  v_contract RECORD;
  v_job_number TEXT;
  v_new_job_id UUID;
  v_asset_id UUID := NULL;
  v_scheduled_start TIMESTAMPTZ;
  v_scheduled_end TIMESTAMPTZ;
BEGIN
  -- Security check: caller must be owner, admin, or dispatcher
  IF auth.uid() IS NOT NULL AND NOT public.user_has_role(p_org_id, ARRAY['owner', 'admin', 'dispatcher']) THEN
    RAISE EXCEPTION 'Access denied: insufficient permissions to convert planned visit for organization %', p_org_id;
  END IF;

  -- 1. Lock planned visit for update
  SELECT * INTO v_visit
  FROM public.contract_planned_visits
  WHERE id = p_visit_id AND organization_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Planned visit % not found for organization %', p_visit_id, p_org_id;
  END IF;

  -- 2. Prevent duplicate conversion
  IF v_visit.job_id IS NOT NULL THEN
    RETURN v_visit.job_id;
  END IF;

  IF v_visit.status = 'job_created' THEN
    RAISE EXCEPTION 'Visit #% is already converted to a job.', v_visit.visit_number;
  END IF;

  -- 3. Fetch contract details
  SELECT * INTO v_contract
  FROM public.service_contracts
  WHERE id = v_visit.contract_id;

  -- 4. Find primary covered equipment asset if available
  SELECT asset_id INTO v_asset_id
  FROM public.service_contract_assets
  WHERE contract_id = v_visit.contract_id
  ORDER BY created_at ASC
  LIMIT 1;

  -- 5. Generate unique job number
  v_job_number := public.get_next_document_number(p_org_id, 'job', 'JOB');

  -- 6. Set schedule times (Dhaka working hours 09:00 - 12:00)
  v_scheduled_start := (v_visit.planned_date::text || ' 09:00:00+06')::timestamptz;
  v_scheduled_end := (v_visit.planned_date::text || ' 12:00:00+06')::timestamptz;

  -- 7. Insert job
  INSERT INTO public.jobs (
    organization_id,
    customer_id,
    site_id,
    service_site_id,
    equipment_asset_id,
    contract_id,
    job_number,
    title,
    description,
    job_type,
    priority,
    status,
    scheduled_start,
    scheduled_end,
    estimated_duration_minutes,
    created_by
  ) VALUES (
    p_org_id,
    v_contract.customer_id,
    COALESCE(v_visit.service_site_id, v_contract.service_site_id),
    COALESCE(v_visit.service_site_id, v_contract.service_site_id),
    v_asset_id,
    v_visit.contract_id,
    v_job_number,
    v_visit.title,
    COALESCE(v_visit.description, 'Periodic preventive maintenance under AMC ' || v_contract.contract_number),
    'maintenance',
    'medium',
    'scheduled',
    v_scheduled_start,
    v_scheduled_end,
    180,
    p_user_id
  )
  RETURNING id INTO v_new_job_id;

  -- 8. Assign technician if specified
  IF p_technician_id IS NOT NULL THEN
    INSERT INTO public.job_assignments (
      organization_id,
      job_id,
      technician_id,
      is_lead
    ) VALUES (
      p_org_id,
      v_new_job_id,
      p_technician_id,
      true
    )
    ON CONFLICT (job_id, technician_id) DO NOTHING;
  END IF;

  -- 9. Seed Standard HVAC Checklist
  INSERT INTO public.job_checklists (
    job_id,
    organization_id,
    title,
    sort_order,
    is_required,
    status
  ) VALUES
    (v_new_job_id, p_org_id, 'Inspect and clean indoor evaporator coil & air filters', 1, true, 'pending'),
    (v_new_job_id, p_org_id, 'Measure operating refrigerant suction & discharge pressures', 2, true, 'pending'),
    (v_new_job_id, p_org_id, 'Check compressor running current & starting capacitor capacitance', 3, true, 'pending'),
    (v_new_job_id, p_org_id, 'Chemical jet foam wash of outdoor condenser coils', 4, true, 'pending'),
    (v_new_job_id, p_org_id, 'Test condensate drain pan and blow nitrogen flush through drain lines', 5, true, 'pending'),
    (v_new_job_id, p_org_id, 'Record indoor supply/return temperature differential (Delta-T)', 6, true, 'pending');

  -- 10. Update planned visit record
  UPDATE public.contract_planned_visits
  SET
    job_id = v_new_job_id,
    status = 'job_created',
    updated_at = now()
  WHERE id = p_visit_id;

  -- 11. Activity audit log
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
    'contract_visit',
    p_visit_id,
    'visit.converted_to_job',
    jsonb_build_object(
      'job_id', v_new_job_id,
      'job_number', v_job_number,
      'contract_id', v_visit.contract_id,
      'visit_number', v_visit.visit_number
    )
  );

  RETURN v_new_job_id;
END;
$$;

-- 9. Renew service contract: enforce caller role
CREATE OR REPLACE FUNCTION public.renew_service_contract(
  p_org_id UUID,
  p_contract_id UUID,
  p_user_id UUID,
  p_new_start_date DATE,
  p_new_end_date DATE,
  p_new_amount NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old_contract RECORD;
  v_new_contract_id UUID;
  v_new_contract_number TEXT;
BEGIN
  -- Security check: caller must be owner, admin, or dispatcher
  IF auth.uid() IS NOT NULL AND NOT public.user_has_role(p_org_id, ARRAY['owner', 'admin', 'dispatcher']) THEN
    RAISE EXCEPTION 'Access denied: insufficient permissions to renew contract for organization %', p_org_id;
  END IF;

  SELECT * INTO v_old_contract
  FROM public.service_contracts
  WHERE id = p_contract_id AND organization_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contract % not found for organization %', p_contract_id, p_org_id;
  END IF;

  v_new_contract_number := public.get_next_document_number(p_org_id, 'contract', 'AMC');

  INSERT INTO public.service_contracts (
    organization_id,
    contract_number,
    customer_id,
    service_site_id,
    contract_name,
    title,
    description,
    contract_type,
    billing_frequency,
    service_frequency,
    service_interval_months,
    start_date,
    end_date,
    contract_amount,
    total_contract_value,
    status,
    terms,
    special_terms,
    created_by,
    renewed_from_id
  ) VALUES (
    p_org_id,
    v_new_contract_number,
    v_old_contract.customer_id,
    v_old_contract.service_site_id,
    v_old_contract.contract_name || ' (Renewal)',
    v_old_contract.title || ' (Renewal)',
    'Renewal of contract ' || v_old_contract.contract_number,
    v_old_contract.contract_type,
    v_old_contract.billing_frequency,
    v_old_contract.service_frequency,
    v_old_contract.service_interval_months,
    p_new_start_date,
    p_new_end_date,
    p_new_amount,
    p_new_amount,
    'active',
    v_old_contract.terms,
    v_old_contract.special_terms,
    p_user_id,
    p_contract_id
  )
  RETURNING id INTO v_new_contract_id;

  INSERT INTO public.service_contract_assets (
    organization_id,
    contract_id,
    asset_id,
    notes
  )
  SELECT
    p_org_id,
    v_new_contract_id,
    asset_id,
    'Transferred from AMC ' || v_old_contract.contract_number
  FROM public.service_contract_assets
  WHERE contract_id = p_contract_id;

  PERFORM public.generate_contract_planned_visits(p_org_id, v_new_contract_id);

  UPDATE public.service_contracts
  SET
    status = 'renewed',
    renewed_to_id = v_new_contract_id,
    updated_at = now()
  WHERE id = p_contract_id;

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
    'contract',
    v_new_contract_id,
    'contract.renewed',
    jsonb_build_object(
      'old_contract_id', p_contract_id,
      'old_contract_number', v_old_contract.contract_number,
      'new_contract_id', v_new_contract_id,
      'new_contract_number', v_new_contract_number
    )
  );

  RETURN v_new_contract_id;
END;
$$;

-- 10. Sync service reminders: enforce caller role
CREATE OR REPLACE FUNCTION public.sync_service_reminders(
  p_org_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_visit RECORD;
  v_contract RECORD;
  v_count INTEGER := 0;
BEGIN
  -- Security check: caller must be member of p_org_id
  IF auth.uid() IS NOT NULL AND NOT public.user_has_role(p_org_id, ARRAY['owner', 'admin', 'dispatcher', 'finance']) THEN
    RAISE EXCEPTION 'Access denied: insufficient permissions to sync reminders for organization %', p_org_id;
  END IF;

  FOR v_visit IN
    SELECT v.*, c.customer_id, c.contract_number, cust.company_name, cust.contact_name
    FROM public.contract_planned_visits v
    JOIN public.service_contracts c ON v.contract_id = c.id
    JOIN public.customers cust ON c.customer_id = cust.id
    WHERE v.organization_id = p_org_id
      AND v.status IN ('planned', 'due_soon', 'due_today')
      AND v.planned_date < v_today
      AND v.job_id IS NULL
  LOOP
    UPDATE public.contract_planned_visits
    SET status = 'overdue', updated_at = now()
    WHERE id = v_visit.id;

    INSERT INTO public.service_reminders (
      organization_id,
      contract_id,
      planned_visit_id,
      customer_id,
      reminder_type,
      title,
      message,
      status,
      due_date
    ) VALUES (
      p_org_id,
      v_visit.contract_id,
      v_visit.id,
      v_visit.customer_id,
      'overdue_service',
      'Overdue Maintenance: ' || COALESCE(v_visit.company_name, v_visit.contact_name),
      'AMC ' || v_visit.contract_number || ' visit #' || v_visit.visit_number || ' was scheduled for ' || v_visit.planned_date::text || ' and is overdue for dispatch.',
      'pending',
      v_visit.planned_date
    )
    ON CONFLICT (planned_visit_id, reminder_type) DO NOTHING;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- 11. Harden storage bucket policy for job-attachments
ALTER POLICY "Org members access job files" ON storage.objects
USING (
  bucket_id = 'job-attachments'
  AND (
    SELECT EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id::text = (storage.foldername(name))[1]
        AND user_id = auth.uid()
        AND status = 'active'
    )
  )
)
WITH CHECK (
  bucket_id = 'job-attachments'
  AND (
    SELECT EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id::text = (storage.foldername(name))[1]
        AND user_id = auth.uid()
        AND status = 'active'
        AND role IN ('owner', 'admin', 'dispatcher', 'technician')
    )
  )
);
