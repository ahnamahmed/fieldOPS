-- Migration: 20261014000001_contracts_reminders_reports.sql
-- Description: Maintenance Contracts, Covered Assets, Planned Visits, Automated Reminders, and Reporting Foundation

-- 1. Alter and Enhance service_contracts Table
DO $$
BEGIN
  -- Add service_site_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'service_contracts' AND column_name = 'service_site_id'
  ) THEN
    ALTER TABLE public.service_contracts 
      ADD COLUMN service_site_id UUID REFERENCES public.service_sites(id) ON DELETE SET NULL;
  END IF;

  -- Add contract_name
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'service_contracts' AND column_name = 'contract_name'
  ) THEN
    ALTER TABLE public.service_contracts 
      ADD COLUMN contract_name TEXT;
  END IF;

  -- Add description
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'service_contracts' AND column_name = 'description'
  ) THEN
    ALTER TABLE public.service_contracts 
      ADD COLUMN description TEXT;
  END IF;

  -- Add service_frequency
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'service_contracts' AND column_name = 'service_frequency'
  ) THEN
    ALTER TABLE public.service_contracts 
      ADD COLUMN service_frequency TEXT DEFAULT 'quarterly';
  END IF;

  -- Add contract_amount
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'service_contracts' AND column_name = 'contract_amount'
  ) THEN
    ALTER TABLE public.service_contracts 
      ADD COLUMN contract_amount NUMERIC(14, 2) DEFAULT 0.00;
  END IF;

  -- Add terms
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'service_contracts' AND column_name = 'terms'
  ) THEN
    ALTER TABLE public.service_contracts 
      ADD COLUMN terms TEXT;
  END IF;

  -- Add created_by
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'service_contracts' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.service_contracts 
      ADD COLUMN created_by UUID REFERENCES public.profiles(id);
  END IF;

  -- Add renewed_from_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'service_contracts' AND column_name = 'renewed_from_id'
  ) THEN
    ALTER TABLE public.service_contracts 
      ADD COLUMN renewed_from_id UUID REFERENCES public.service_contracts(id) ON DELETE SET NULL;
  END IF;

  -- Add renewed_to_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'service_contracts' AND column_name = 'renewed_to_id'
  ) THEN
    ALTER TABLE public.service_contracts 
      ADD COLUMN renewed_to_id UUID REFERENCES public.service_contracts(id) ON DELETE SET NULL;
  END IF;

  -- Add renewal_notes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'service_contracts' AND column_name = 'renewal_notes'
  ) THEN
    ALTER TABLE public.service_contracts 
      ADD COLUMN renewal_notes TEXT;
  END IF;
END $$;

-- Update contract_name and contract_amount from existing columns if empty
UPDATE public.service_contracts 
SET 
  contract_name = COALESCE(contract_name, title),
  contract_amount = CASE WHEN contract_amount = 0.00 THEN total_contract_value ELSE contract_amount END,
  terms = COALESCE(terms, special_terms);

-- Adjust status check constraint on service_contracts to allow renewal_due, renewed, archived
ALTER TABLE public.service_contracts DROP CONSTRAINT IF EXISTS service_contracts_status_check;
ALTER TABLE public.service_contracts ADD CONSTRAINT service_contracts_status_check
  CHECK (status IN ('draft', 'active', 'renewal_due', 'expired', 'terminated', 'renewed', 'archived'));

-- Create additional indexes on service_contracts
CREATE INDEX IF NOT EXISTS idx_service_contracts_org_status ON public.service_contracts(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_service_contracts_dates ON public.service_contracts(organization_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_service_contracts_site ON public.service_contracts(service_site_id);

-- 2. Enhance service_contract_assets Table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'service_contract_assets' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.service_contract_assets 
      ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'service_contract_assets' AND column_name = 'notes'
  ) THEN
    ALTER TABLE public.service_contract_assets 
      ADD COLUMN notes TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'service_contract_assets' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.service_contract_assets 
      ADD COLUMN created_at TIMESTAMPTZ DEFAULT now();
  END IF;
END $$;

-- Populate organization_id on service_contract_assets from parent contract
UPDATE public.service_contract_assets a
SET organization_id = c.organization_id
FROM public.service_contracts c
WHERE a.contract_id = c.id AND a.organization_id IS NULL;

-- 3. Create Dedicated Planned Visits Table (contract_planned_visits)
CREATE TABLE IF NOT EXISTS public.contract_planned_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES public.service_contracts(id) ON DELETE CASCADE,
  service_site_id UUID REFERENCES public.service_sites(id) ON DELETE SET NULL,
  visit_number INTEGER NOT NULL DEFAULT 1,
  planned_date DATE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'due_soon', 'due_today', 'overdue', 'job_created', 'completed', 'cancelled', 'skipped')),
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_contract_planned_visit_num UNIQUE(contract_id, visit_number)
);

CREATE INDEX IF NOT EXISTS idx_planned_visits_org_date ON public.contract_planned_visits(organization_id, planned_date, status);
CREATE INDEX IF NOT EXISTS idx_planned_visits_contract ON public.contract_planned_visits(contract_id);
CREATE INDEX IF NOT EXISTS idx_planned_visits_job ON public.contract_planned_visits(job_id);

ALTER TABLE public.contract_planned_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view contract planned visits"
  ON public.contract_planned_visits FOR SELECT
  USING (organization_id IN (SELECT public.get_user_organizations()));

CREATE POLICY "Staff can manage contract planned visits"
  ON public.contract_planned_visits FOR ALL
  USING (
    organization_id IN (SELECT public.get_user_organizations()) AND
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = contract_planned_visits.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin', 'finance', 'dispatcher')
    )
  );

-- 4. Create Service Reminders Table (Upcoming Queue, Expiry & WhatsApp Manual Notice)
CREATE TABLE IF NOT EXISTS public.service_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('visit_due_soon', 'visit_due_today', 'visit_overdue', 'contract_renewal', 'invoice_overdue')),
  contract_id UUID REFERENCES public.service_contracts(id) ON DELETE CASCADE,
  planned_visit_id UUID REFERENCES public.contract_planned_visits(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  due_date DATE NOT NULL,
  channel TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app', 'whatsapp_manual', 'whatsapp_api', 'sms', 'email')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'copied_to_whatsapp', 'delivered', 'dismissed', 'failed')),
  delivery_details JSONB DEFAULT '{}'::jsonb,
  delivered_at TIMESTAMPTZ,
  delivered_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_reminders_org_status ON public.service_reminders(organization_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_service_reminders_customer ON public.service_reminders(customer_id);
CREATE INDEX IF NOT EXISTS idx_service_reminders_contract ON public.service_reminders(contract_id);
CREATE INDEX IF NOT EXISTS idx_service_reminders_visit ON public.service_reminders(planned_visit_id);

ALTER TABLE public.service_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view service reminders"
  ON public.service_reminders FOR SELECT
  USING (organization_id IN (SELECT public.get_user_organizations()));

CREATE POLICY "Staff can manage service reminders"
  ON public.service_reminders FOR ALL
  USING (
    organization_id IN (SELECT public.get_user_organizations()) AND
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = service_reminders.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin', 'finance', 'dispatcher')
    )
  );

-- 5. Stored Procedure: Generate Planned Visits for Contract
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

  -- Update contract interval months
  UPDATE public.service_contracts
  SET service_interval_months = v_interval_months
  WHERE id = p_contract_id;

  v_current_date := v_contract.start_date;

  WHILE v_current_date <= v_contract.end_date LOOP
    v_visit_title := 'Scheduled Maintenance #' || v_visit_num || ' — ' || COALESCE(v_contract.contract_name, v_contract.title);

    -- Insert planned visit if not already present for this visit number
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

-- 6. Stored Procedure: Convert Planned Visit to Service Job (With Atomic Duplication Protection)
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

-- 7. Stored Procedure: Renew Maintenance Contract
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
  -- 1. Fetch old contract
  SELECT * INTO v_old_contract
  FROM public.service_contracts
  WHERE id = p_contract_id AND organization_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contract % not found for organization %', p_contract_id, p_org_id;
  END IF;

  -- 2. Generate new contract number
  v_new_contract_number := public.get_next_document_number(p_org_id, 'contract', 'AMC');

  -- 3. Create renewed contract
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

  -- 4. Copy covered equipment
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

  -- 5. Generate planned visits for new contract
  PERFORM public.generate_contract_planned_visits(p_org_id, v_new_contract_id);

  -- 6. Mark old contract as renewed
  UPDATE public.service_contracts
  SET
    status = 'renewed',
    renewed_to_id = v_new_contract_id,
    updated_at = now()
  WHERE id = p_contract_id;

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

-- 8. Stored Procedure: Synchronize Reminders & Statuses
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
  -- 1. Scan planned visits that are overdue
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
      reminder_type,
      contract_id,
      planned_visit_id,
      customer_id,
      title,
      message,
      due_date,
      status
    )
    SELECT
      p_org_id,
      'visit_overdue',
      v_visit.contract_id,
      v_visit.id,
      v_visit.customer_id,
      'Overdue Service Visit: ' || v_visit.contract_number,
      'Scheduled maintenance #' || v_visit.visit_number || ' for ' || COALESCE(v_visit.company_name, v_visit.contact_name) || ' was due on ' || v_visit.planned_date || ' and requires immediate dispatch.',
      v_visit.planned_date,
      'pending'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.service_reminders
      WHERE organization_id = p_org_id
        AND planned_visit_id = v_visit.id
        AND reminder_type = 'visit_overdue'
    );

    v_count := v_count + 1;
  END LOOP;

  -- 2. Scan planned visits due today
  FOR v_visit IN
    SELECT v.*, c.customer_id, c.contract_number, cust.company_name, cust.contact_name
    FROM public.contract_planned_visits v
    JOIN public.service_contracts c ON v.contract_id = c.id
    JOIN public.customers cust ON c.customer_id = cust.id
    WHERE v.organization_id = p_org_id
      AND v.status = 'planned'
      AND v.planned_date = v_today
      AND v.job_id IS NULL
  LOOP
    UPDATE public.contract_planned_visits
    SET status = 'due_today', updated_at = now()
    WHERE id = v_visit.id;

    INSERT INTO public.service_reminders (
      organization_id,
      reminder_type,
      contract_id,
      planned_visit_id,
      customer_id,
      title,
      message,
      due_date,
      status
    )
    SELECT
      p_org_id,
      'visit_due_today',
      v_visit.contract_id,
      v_visit.id,
      v_visit.customer_id,
      'Maintenance Visit Due Today: ' || v_visit.contract_number,
      'AMC Visit #' || v_visit.visit_number || ' is scheduled for today for ' || COALESCE(v_visit.company_name, v_visit.contact_name) || '.',
      v_visit.planned_date,
      'pending'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.service_reminders
      WHERE organization_id = p_org_id
        AND planned_visit_id = v_visit.id
        AND reminder_type = 'visit_due_today'
    );

    v_count := v_count + 1;
  END LOOP;

  -- 3. Scan contracts nearing renewal (within 30 days)
  FOR v_contract IN
    SELECT c.*, cust.company_name, cust.contact_name
    FROM public.service_contracts c
    JOIN public.customers cust ON c.customer_id = cust.id
    WHERE c.organization_id = p_org_id
      AND c.status = 'active'
      AND c.end_date BETWEEN v_today AND (v_today + interval '30 days')::date
  LOOP
    UPDATE public.service_contracts
    SET status = 'renewal_due', updated_at = now()
    WHERE id = v_contract.id;

    INSERT INTO public.service_reminders (
      organization_id,
      reminder_type,
      contract_id,
      customer_id,
      title,
      message,
      due_date,
      status
    )
    SELECT
      p_org_id,
      'contract_renewal',
      v_contract.id,
      v_contract.customer_id,
      'AMC Renewal Approaching: ' || v_contract.contract_number,
      'Maintenance contract for ' || COALESCE(v_contract.company_name, v_contract.contact_name) || ' expires on ' || v_contract.end_date || '. Prepare quotation or renewal agreement.',
      v_contract.end_date,
      'pending'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.service_reminders
      WHERE organization_id = p_org_id
        AND contract_id = v_contract.id
        AND reminder_type = 'contract_renewal'
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
