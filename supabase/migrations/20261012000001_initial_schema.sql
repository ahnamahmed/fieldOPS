-- FieldOps BD — Initial Schema Migration
-- Migration: 20261012000001_initial_schema.sql
-- Description: Multi-tenant database foundation, tables, indexes, constraints, RLS policies, and triggers

-- 1. Helper function for updated_at timestamps
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 2. Profiles table (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 3. Organizations (Tenants)
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  contact_email TEXT,
  contact_phone TEXT NOT NULL,
  address TEXT,
  city TEXT NOT NULL DEFAULT 'Dhaka',
  currency TEXT NOT NULL DEFAULT 'BDT',
  timezone TEXT NOT NULL DEFAULT 'Asia/Dhaka',
  tax_id TEXT,
  settings JSONB NOT NULL DEFAULT '{"job_prefix":"JOB","quote_prefix":"QTE","invoice_prefix":"INV","contract_prefix":"AMC","default_tax_rate":0}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4. Organization Members (Multi-Tenant Role Association)
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'dispatcher', 'technician', 'finance')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_org_member UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.organization_members(organization_id);

CREATE TRIGGER set_org_members_updated_at
  BEFORE UPDATE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 5. RLS Security Definer Helpers
CREATE OR REPLACE FUNCTION public.get_user_organizations()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
  SELECT organization_id
  FROM public.organization_members
  WHERE user_id = auth.uid()
    AND status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.user_has_role(target_org_id UUID, allowed_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE organization_id = target_org_id
      AND user_id = auth.uid()
      AND role = ANY(allowed_roles)
      AND status = 'active'
  );
$$;

-- 6. Sequential Number Generator Table (Race-condition safe per tenant)
CREATE TABLE IF NOT EXISTS public.document_sequences (
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('job', 'quote', 'invoice', 'contract', 'request')),
  current_val BIGINT NOT NULL DEFAULT 1000,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, document_type)
);

CREATE OR REPLACE FUNCTION public.get_next_document_number(target_org_id UUID, doc_type TEXT, prefix TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_num BIGINT;
BEGIN
  INSERT INTO public.document_sequences (organization_id, document_type, current_val)
  VALUES (target_org_id, doc_type, 1001)
  ON CONFLICT (organization_id, document_type)
  DO UPDATE SET current_val = public.document_sequences.current_val + 1, updated_at = now()
  RETURNING current_val INTO next_num;

  RETURN prefix || '-' || next_num::TEXT;
END;
$$;

-- 7. Customers
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_type TEXT NOT NULL DEFAULT 'commercial' CHECK (customer_type IN ('residential', 'commercial', 'corporate')),
  company_name TEXT,
  contact_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  alternate_phone TEXT,
  email TEXT,
  billing_address TEXT,
  notes TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_org_phone ON public.customers(organization_id, phone);
CREATE INDEX IF NOT EXISTS idx_customers_org_name ON public.customers(organization_id, contact_name);

CREATE TRIGGER set_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 8. Service Sites (Locations where work is performed)
CREATE TABLE IF NOT EXISTS public.service_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  site_name TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  area TEXT,
  city TEXT NOT NULL DEFAULT 'Dhaka',
  district TEXT NOT NULL DEFAULT 'Dhaka',
  postal_code TEXT,
  landmark TEXT,
  site_contact_name TEXT,
  site_contact_phone TEXT,
  access_instructions TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sites_org_customer ON public.service_sites(organization_id, customer_id);

CREATE TRIGGER set_service_sites_updated_at
  BEFORE UPDATE ON public.service_sites
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 9. Equipment Assets (AC & Refrigeration units)
CREATE TABLE IF NOT EXISTS public.equipment_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES public.service_sites(id) ON DELETE CASCADE,
  asset_tag TEXT,
  equipment_type TEXT NOT NULL CHECK (equipment_type IN ('split_ac', 'cassette_ac', 'standing_ac', 'vrf_system', 'chiller', 'cold_room', 'refrigerator', 'deep_freezer', 'other')),
  brand TEXT NOT NULL,
  model_number TEXT,
  serial_number TEXT,
  capacity TEXT,
  refrigerant_type TEXT CHECK (refrigerant_type IN ('R22', 'R32', 'R410A', 'R134a', 'R404A', 'R290', 'other')),
  location_in_facility TEXT,
  installation_date DATE,
  warranty_expiry DATE,
  condition_status TEXT NOT NULL DEFAULT 'operational' CHECK (condition_status IN ('operational', 'needs_service', 'under_repair', 'decommissioned')),
  notes TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assets_org_site ON public.equipment_assets(organization_id, site_id);
CREATE INDEX IF NOT EXISTS idx_assets_org_serial ON public.equipment_assets(organization_id, serial_number);

CREATE TRIGGER set_equipment_assets_updated_at
  BEFORE UPDATE ON public.equipment_assets
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 10. Service Contracts (AMC)
CREATE TABLE IF NOT EXISTS public.service_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contract_number TEXT NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  contract_type TEXT NOT NULL CHECK (contract_type IN ('comprehensive', 'non_comprehensive', 'labor_only')),
  billing_frequency TEXT NOT NULL CHECK (billing_frequency IN ('monthly', 'quarterly', 'half_yearly', 'annually', 'one_time')),
  service_interval_months INTEGER NOT NULL DEFAULT 3,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_contract_value NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (total_contract_value >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'expired', 'terminated')),
  special_terms TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_contract_number UNIQUE(organization_id, contract_number)
);

CREATE INDEX IF NOT EXISTS idx_contracts_org_cust ON public.service_contracts(organization_id, customer_id);

CREATE TRIGGER set_service_contracts_updated_at
  BEFORE UPDATE ON public.service_contracts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 11. Service Contract Assets
CREATE TABLE IF NOT EXISTS public.service_contract_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.service_contracts(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES public.equipment_assets(id) ON DELETE CASCADE,
  CONSTRAINT uq_contract_asset UNIQUE(contract_id, asset_id)
);

-- 12. Service Requests (Inquiries)
CREATE TABLE IF NOT EXISTS public.service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  request_number TEXT NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  site_id UUID REFERENCES public.service_sites(id) ON DELETE SET NULL,
  contact_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  urgency TEXT NOT NULL DEFAULT 'normal' CHECK (urgency IN ('low', 'normal', 'high', 'emergency')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'converted_to_job', 'declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_req_number UNIQUE(organization_id, request_number)
);

CREATE INDEX IF NOT EXISTS idx_requests_org_status ON public.service_requests(organization_id, status);

CREATE TRIGGER set_service_requests_updated_at
  BEFORE UPDATE ON public.service_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 13. Jobs (Work Orders)
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_number TEXT NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  site_id UUID NOT NULL REFERENCES public.service_sites(id) ON DELETE RESTRICT,
  asset_id UUID REFERENCES public.equipment_assets(id) ON DELETE SET NULL,
  request_id UUID REFERENCES public.service_requests(id) ON DELETE SET NULL,
  contract_id UUID REFERENCES public.service_contracts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  job_type TEXT NOT NULL CHECK (job_type IN ('repair', 'master_service', 'gas_charging', 'installation', 'uninstallation', 'inspection', 'amc_routine')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'scheduled', 'in_progress', 'on_hold', 'completed', 'cancelled')),
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  estimated_duration_minutes INTEGER DEFAULT 120,
  completion_notes TEXT,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_job_number UNIQUE(organization_id, job_number)
);

CREATE INDEX IF NOT EXISTS idx_jobs_org_status ON public.jobs(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_org_scheduled ON public.jobs(organization_id, scheduled_start);
CREATE INDEX IF NOT EXISTS idx_jobs_org_customer ON public.jobs(organization_id, customer_id);

CREATE TRIGGER set_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 14. Contract Schedules (Linking contracts to future visits/jobs)
CREATE TABLE IF NOT EXISTS public.service_contract_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.service_contracts(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  visit_title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'job_generated', 'skipped')),
  generated_job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 15. Job Assignments (Assigning Technicians to Jobs)
CREATE TABLE IF NOT EXISTS public.job_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_lead BOOLEAN NOT NULL DEFAULT false,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_job_tech_assignment UNIQUE(job_id, technician_id)
);

CREATE INDEX IF NOT EXISTS idx_job_assignments_tech ON public.job_assignments(organization_id, technician_id);

-- 16. Job Visits
CREATE TABLE IF NOT EXISTS public.job_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  visit_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'en_route', 'started', 'completed', 'cancelled', 'rescheduled')),
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end TIMESTAMPTZ NOT NULL,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  technician_notes TEXT,
  customer_signature_url TEXT,
  customer_sign_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visits_org_job ON public.job_visits(organization_id, job_id);

CREATE TRIGGER set_job_visits_updated_at
  BEFORE UPDATE ON public.job_visits
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 17. Job Checklists (AC & Refrigeration technical records)
CREATE TABLE IF NOT EXISTS public.job_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  visit_id UUID REFERENCES public.job_visits(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('boolean', 'number', 'text', 'choice')),
  value_boolean BOOLEAN,
  value_number NUMERIC(10, 2),
  value_text TEXT,
  is_mandatory BOOLEAN NOT NULL DEFAULT false,
  passed BOOLEAN,
  recorded_by UUID REFERENCES public.profiles(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checklists_job ON public.job_checklists(organization_id, job_id);

-- 18. Job Parts Used
CREATE TABLE IF NOT EXISTS public.job_parts_used (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  part_name TEXT NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL CHECK (quantity > 0),
  unit_of_measure TEXT NOT NULL DEFAULT 'pcs',
  unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (unit_cost >= 0),
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (unit_price >= 0),
  is_billable BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parts_job ON public.job_parts_used(organization_id, job_id);

-- 19. Job Attachments
CREATE TABLE IF NOT EXISTS public.job_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  visit_id UUID REFERENCES public.job_visits(id) ON DELETE SET NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  attachment_type TEXT NOT NULL CHECK (attachment_type IN ('before_photo', 'during_photo', 'after_photo', 'nameplate', 'part_photo', 'signature', 'document')),
  caption TEXT,
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attachments_job ON public.job_attachments(organization_id, job_id);

-- 20. Quotations
CREATE TABLE IF NOT EXISTS public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  quote_number TEXT NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
  discount_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
  vat_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (vat_rate >= 0),
  vat_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (vat_amount >= 0),
  total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired')),
  valid_until DATE,
  terms TEXT,
  notes TEXT,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_quote_number UNIQUE(organization_id, quote_number)
);

CREATE INDEX IF NOT EXISTS idx_quotes_org_cust ON public.quotes(organization_id, customer_id);

CREATE TRIGGER set_quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 21. Quote Items
CREATE TABLE IF NOT EXISTS public.quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  line_total NUMERIC(14, 2) NOT NULL CHECK (line_total >= 0),
  sort_order INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_quote_items_quote ON public.quote_items(quote_id);

-- 22. Invoices
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  subtotal NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
  discount_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
  vat_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (vat_rate >= 0),
  vat_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (vat_amount >= 0),
  total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
  paid_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0),
  balance_due NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'partially_paid', 'paid', 'overdue', 'void')),
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  notes TEXT,
  payment_terms TEXT DEFAULT 'Due upon receipt',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_invoice_number UNIQUE(organization_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_invoices_org_status ON public.invoices(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_org_cust ON public.invoices(organization_id, customer_id);

CREATE TRIGGER set_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 23. Invoice Items
CREATE TABLE IF NOT EXISTS public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
  line_total NUMERIC(14, 2) NOT NULL CHECK (line_total >= 0),
  sort_order INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_items(invoice_id);

-- 24. Payments Ledger (Manual BDT transactions)
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'bkash', 'nagad', 'rocket', 'bank_transfer', 'cheque', 'other')),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  transaction_reference TEXT,
  notes TEXT,
  recorded_by UUID NOT NULL REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'verified_manual' CHECK (status IN ('verified_manual', 'voided')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_org_inv ON public.payments(organization_id, invoice_id);

-- 25. Activity Logs (Audit Trail)
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_org_entity ON public.activity_logs(organization_id, entity_type, entity_id);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS on all tenant-sensitive tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_contract_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_contract_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_parts_used ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_sequences ENABLE ROW LEVEL SECURITY;

-- 1. Profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Users can view teammates in same org" ON public.profiles
  FOR SELECT USING (
    id IN (
      SELECT om2.user_id FROM public.organization_members om1
      JOIN public.organization_members om2 ON om1.organization_id = om2.organization_id
      WHERE om1.user_id = auth.uid() AND om1.status = 'active'
    )
  );

-- 2. Organizations
CREATE POLICY "Org members can view their organization" ON public.organizations
  FOR SELECT USING (id IN (SELECT public.get_user_organizations()));

CREATE POLICY "Org owners can update their organization" ON public.organizations
  FOR UPDATE USING (public.user_has_role(id, ARRAY['owner']));

-- 3. Organization Members
CREATE POLICY "Members view team roster" ON public.organization_members
  FOR SELECT USING (organization_id IN (SELECT public.get_user_organizations()));

CREATE POLICY "Owners and admins manage members" ON public.organization_members
  FOR ALL USING (public.user_has_role(organization_id, ARRAY['owner', 'admin']));

-- 4. Document Sequences
CREATE POLICY "Org members access sequences" ON public.document_sequences
  FOR ALL USING (organization_id IN (SELECT public.get_user_organizations()));

-- 5. Customers
CREATE POLICY "Org members view customers" ON public.customers
  FOR SELECT USING (organization_id IN (SELECT public.get_user_organizations()));

CREATE POLICY "Staff manage customers" ON public.customers
  FOR ALL USING (public.user_has_role(organization_id, ARRAY['owner', 'admin', 'dispatcher']));

-- 6. Service Sites
CREATE POLICY "Org members view sites" ON public.service_sites
  FOR SELECT USING (organization_id IN (SELECT public.get_user_organizations()));

CREATE POLICY "Staff manage sites" ON public.service_sites
  FOR ALL USING (public.user_has_role(organization_id, ARRAY['owner', 'admin', 'dispatcher']));

-- 7. Equipment Assets
CREATE POLICY "Org members view assets" ON public.equipment_assets
  FOR SELECT USING (organization_id IN (SELECT public.get_user_organizations()));

CREATE POLICY "Staff manage assets" ON public.equipment_assets
  FOR ALL USING (public.user_has_role(organization_id, ARRAY['owner', 'admin', 'dispatcher']));

-- 8. Service Requests
CREATE POLICY "Staff view and manage service requests" ON public.service_requests
  FOR ALL USING (public.user_has_role(organization_id, ARRAY['owner', 'admin', 'dispatcher', 'finance']));

-- 9. Jobs
CREATE POLICY "Staff view all org jobs" ON public.jobs
  FOR SELECT USING (public.user_has_role(organization_id, ARRAY['owner', 'admin', 'dispatcher', 'finance']));

CREATE POLICY "Technicians view assigned jobs" ON public.jobs
  FOR SELECT USING (
    public.user_has_role(organization_id, ARRAY['technician'])
    AND EXISTS (
      SELECT 1 FROM public.job_assignments
      WHERE job_assignments.job_id = jobs.id
        AND job_assignments.technician_id = auth.uid()
    )
  );

CREATE POLICY "Dispatchers and managers manage jobs" ON public.jobs
  FOR ALL USING (public.user_has_role(organization_id, ARRAY['owner', 'admin', 'dispatcher']));

CREATE POLICY "Technicians update assigned job status" ON public.jobs
  FOR UPDATE USING (
    public.user_has_role(organization_id, ARRAY['technician'])
    AND EXISTS (
      SELECT 1 FROM public.job_assignments
      WHERE job_assignments.job_id = jobs.id
        AND job_assignments.technician_id = auth.uid()
    )
  );

-- 10. Job Assignments
CREATE POLICY "Org members view assignments" ON public.job_assignments
  FOR SELECT USING (organization_id IN (SELECT public.get_user_organizations()));

CREATE POLICY "Dispatchers manage assignments" ON public.job_assignments
  FOR ALL USING (public.user_has_role(organization_id, ARRAY['owner', 'admin', 'dispatcher']));

-- 11. Job Visits
CREATE POLICY "Staff view visits" ON public.job_visits
  FOR SELECT USING (organization_id IN (SELECT public.get_user_organizations()));

CREATE POLICY "Dispatchers manage visits" ON public.job_visits
  FOR ALL USING (public.user_has_role(organization_id, ARRAY['owner', 'admin', 'dispatcher']));

CREATE POLICY "Technicians update assigned visits" ON public.job_visits
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.job_assignments
      WHERE job_assignments.job_id = job_visits.job_id
        AND job_assignments.technician_id = auth.uid()
    )
  );

-- 12. Job Checklists
CREATE POLICY "Org members view checklists" ON public.job_checklists
  FOR SELECT USING (organization_id IN (SELECT public.get_user_organizations()));

CREATE POLICY "Technicians and staff edit checklists" ON public.job_checklists
  FOR ALL USING (
    public.user_has_role(organization_id, ARRAY['owner', 'admin', 'dispatcher'])
    OR (
      public.user_has_role(organization_id, ARRAY['technician'])
      AND EXISTS (
        SELECT 1 FROM public.job_assignments
        WHERE job_assignments.job_id = job_checklists.job_id
          AND job_assignments.technician_id = auth.uid()
      )
    )
  );

-- 13. Job Parts Used
CREATE POLICY "Org members view parts used" ON public.job_parts_used
  FOR SELECT USING (organization_id IN (SELECT public.get_user_organizations()));

CREATE POLICY "Technicians and staff record parts" ON public.job_parts_used
  FOR ALL USING (
    public.user_has_role(organization_id, ARRAY['owner', 'admin', 'dispatcher'])
    OR (
      public.user_has_role(organization_id, ARRAY['technician'])
      AND EXISTS (
        SELECT 1 FROM public.job_assignments
        WHERE job_assignments.job_id = job_parts_used.job_id
          AND job_assignments.technician_id = auth.uid()
      )
    )
  );

-- 14. Job Attachments
CREATE POLICY "Org members view attachments" ON public.job_attachments
  FOR SELECT USING (organization_id IN (SELECT public.get_user_organizations()));

CREATE POLICY "Technicians and staff upload attachments" ON public.job_attachments
  FOR ALL USING (
    public.user_has_role(organization_id, ARRAY['owner', 'admin', 'dispatcher'])
    OR (
      public.user_has_role(organization_id, ARRAY['technician'])
      AND EXISTS (
        SELECT 1 FROM public.job_assignments
        WHERE job_assignments.job_id = job_attachments.job_id
          AND job_assignments.technician_id = auth.uid()
      )
    )
  );

-- 15. Quotes & Quote Items
CREATE POLICY "Finance and managers access quotes" ON public.quotes
  FOR ALL USING (public.user_has_role(organization_id, ARRAY['owner', 'admin', 'finance']));

CREATE POLICY "Dispatchers view quotes" ON public.quotes
  FOR SELECT USING (public.user_has_role(organization_id, ARRAY['dispatcher']));

CREATE POLICY "Quote items accessible via quotes" ON public.quote_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.quotes
      WHERE quotes.id = quote_items.quote_id
        AND quotes.organization_id IN (SELECT public.get_user_organizations())
    )
  );

-- 16. Invoices & Invoice Items
CREATE POLICY "Finance and managers access invoices" ON public.invoices
  FOR ALL USING (public.user_has_role(organization_id, ARRAY['owner', 'admin', 'finance']));

CREATE POLICY "Dispatchers view invoices" ON public.invoices
  FOR SELECT USING (public.user_has_role(organization_id, ARRAY['dispatcher']));

CREATE POLICY "Invoice items accessible via invoices" ON public.invoice_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.invoices
      WHERE invoices.id = invoice_items.invoice_id
        AND invoices.organization_id IN (SELECT public.get_user_organizations())
    )
  );

-- 17. Payments
CREATE POLICY "Finance and managers access payments" ON public.payments
  FOR ALL USING (public.user_has_role(organization_id, ARRAY['owner', 'admin', 'finance']));

CREATE POLICY "Dispatchers view payments" ON public.payments
  FOR SELECT USING (public.user_has_role(organization_id, ARRAY['dispatcher']));

-- 18. Service Contracts & Schedules
CREATE POLICY "Org members view contracts" ON public.service_contracts
  FOR SELECT USING (organization_id IN (SELECT public.get_user_organizations()));

CREATE POLICY "Finance and managers manage contracts" ON public.service_contracts
  FOR ALL USING (public.user_has_role(organization_id, ARRAY['owner', 'admin', 'finance']));

CREATE POLICY "Contract assets accessible via contracts" ON public.service_contract_assets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.service_contracts
      WHERE service_contracts.id = service_contract_assets.contract_id
        AND service_contracts.organization_id IN (SELECT public.get_user_organizations())
    )
  );

CREATE POLICY "Contract schedules accessible via contracts" ON public.service_contract_schedules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.service_contracts
      WHERE service_contracts.id = service_contract_schedules.contract_id
        AND service_contracts.organization_id IN (SELECT public.get_user_organizations())
    )
  );

-- 19. Activity Logs
CREATE POLICY "Org members view activity logs" ON public.activity_logs
  FOR SELECT USING (organization_id IN (SELECT public.get_user_organizations()));

CREATE POLICY "System inserts activity logs" ON public.activity_logs
  FOR INSERT WITH CHECK (organization_id IN (SELECT public.get_user_organizations()));

-- 20. New User Trigger on auth.users -> public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 21. Transactional Organization Creation Helper
-- Guarantees atomicity when an owner signs up and onboards their business
CREATE OR REPLACE FUNCTION public.create_organization_with_owner(
  org_name TEXT,
  org_slug TEXT,
  contact_phone TEXT,
  city TEXT DEFAULT 'Dhaka'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  new_org_id UUID;
  caller_id UUID := auth.uid();
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- 1. Insert organization
  INSERT INTO public.organizations (name, slug, contact_phone, city)
  VALUES (org_name, org_slug, contact_phone, city)
  RETURNING id INTO new_org_id;

  -- 2. Insert caller as owner
  INSERT INTO public.organization_members (organization_id, user_id, role, status)
  VALUES (new_org_id, caller_id, 'owner', 'active');

  -- 3. Initialize sequences
  INSERT INTO public.document_sequences (organization_id, document_type, current_val)
  VALUES
    (new_org_id, 'job', 1000),
    (new_org_id, 'quote', 1000),
    (new_org_id, 'invoice', 1000),
    (new_org_id, 'contract', 1000),
    (new_org_id, 'request', 1000);

  -- 4. Log activity
  INSERT INTO public.activity_logs (organization_id, actor_id, entity_type, entity_id, action, details)
  VALUES (new_org_id, caller_id, 'organization', new_org_id, 'created', jsonb_build_object('name', org_name, 'slug', org_slug));

  RETURN new_org_id;
END;
$$;

-- 22. Storage Bucket for Service Attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-attachments', 'job-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Org members access job files" ON storage.objects
FOR ALL USING (
  bucket_id = 'job-attachments'
  AND (storage.foldername(name))[1]::UUID IN (SELECT public.get_user_organizations())
);
