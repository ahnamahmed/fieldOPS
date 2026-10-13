-- FieldOps BD — Jobs, Calendar, and Dispatch Module Migration
-- Migration: 20261013000003_jobs_calendar_dispatch.sql
-- Description: Schema enhancements, composite foreign keys, triggers, and RLS policies for jobs, service requests, job assignments, and visits

-- 1. Update jobs table: Add missing columns and adapt constraints
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS service_site_id UUID,
  ADD COLUMN IF NOT EXISTS equipment_asset_id UUID,
  ADD COLUMN IF NOT EXISTS assigned_notes TEXT,
  ADD COLUMN IF NOT EXISTS estimated_duration INTEGER DEFAULT 120;

-- Update jobs status check to include 'quoted'
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_status_check
  CHECK (status IN ('new', 'quoted', 'scheduled', 'in_progress', 'on_hold', 'completed', 'cancelled'));

-- Composite unique constraint on jobs for multi-tenant foreign keys
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS uq_jobs_id_org;
ALTER TABLE public.jobs ADD CONSTRAINT uq_jobs_id_org UNIQUE (id, organization_id);

-- Enforce multi-tenant composite foreign keys on jobs
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS fk_jobs_customer_org;
ALTER TABLE public.jobs ADD CONSTRAINT fk_jobs_customer_org
  FOREIGN KEY (customer_id, organization_id)
  REFERENCES public.customers(id, organization_id)
  ON DELETE RESTRICT;

ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS fk_jobs_site_org;
ALTER TABLE public.jobs ADD CONSTRAINT fk_jobs_site_org
  FOREIGN KEY (site_id, organization_id)
  REFERENCES public.service_sites(id, organization_id)
  ON DELETE RESTRICT;

ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS fk_jobs_asset_org;
ALTER TABLE public.jobs ADD CONSTRAINT fk_jobs_asset_org
  FOREIGN KEY (asset_id, organization_id)
  REFERENCES public.equipment_assets(id, organization_id)
  ON DELETE SET NULL;

-- 2. Trigger for jobs field synchronization & cross-record integrity
CREATE OR REPLACE FUNCTION public.sync_jobs_fields_and_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_site_customer_id UUID;
  v_site_org_id UUID;
  v_asset_customer_id UUID;
  v_asset_site_id UUID;
  v_asset_org_id UUID;
BEGIN
  -- Sync site_id and service_site_id
  IF NEW.service_site_id IS NOT NULL AND NEW.site_id IS NULL THEN
    NEW.site_id := NEW.service_site_id;
  ELSIF NEW.site_id IS NOT NULL AND NEW.service_site_id IS NULL THEN
    NEW.service_site_id := NEW.site_id;
  ELSIF NEW.service_site_id IS NOT NULL AND NEW.site_id IS NOT NULL AND NEW.site_id <> NEW.service_site_id THEN
    NEW.site_id := NEW.service_site_id;
  END IF;

  -- Sync asset_id and equipment_asset_id
  IF NEW.equipment_asset_id IS NOT NULL AND NEW.asset_id IS NULL THEN
    NEW.asset_id := NEW.equipment_asset_id;
  ELSIF NEW.asset_id IS NOT NULL AND NEW.equipment_asset_id IS NULL THEN
    NEW.equipment_asset_id := NEW.asset_id;
  ELSIF NEW.equipment_asset_id IS NOT NULL AND NEW.asset_id IS NOT NULL AND NEW.asset_id <> NEW.equipment_asset_id THEN
    NEW.asset_id := NEW.equipment_asset_id;
  END IF;

  -- Sync estimated duration
  IF NEW.estimated_duration IS NOT NULL AND NEW.estimated_duration_minutes IS NULL THEN
    NEW.estimated_duration_minutes := NEW.estimated_duration;
  ELSIF NEW.estimated_duration_minutes IS NOT NULL AND NEW.estimated_duration IS NULL THEN
    NEW.estimated_duration := NEW.estimated_duration_minutes;
  END IF;

  -- Validate site belongs to customer and organization
  IF NEW.site_id IS NOT NULL THEN
    SELECT customer_id, organization_id INTO v_site_customer_id, v_site_org_id
    FROM public.service_sites
    WHERE id = NEW.site_id;

    IF v_site_customer_id IS NULL THEN
      RAISE EXCEPTION 'Service site % does not exist', NEW.site_id;
    END IF;

    IF v_site_org_id <> NEW.organization_id THEN
      RAISE EXCEPTION 'Cross-tenant violation: Service site belongs to organization %, not %', v_site_org_id, NEW.organization_id;
    END IF;

    IF v_site_customer_id <> NEW.customer_id THEN
      RAISE EXCEPTION 'Integrity violation: Service site % does not belong to customer %', NEW.site_id, NEW.customer_id;
    END IF;
  END IF;

  -- If asset is provided, validate it belongs to customer, site, and organization
  IF NEW.asset_id IS NOT NULL THEN
    SELECT customer_id, COALESCE(service_site_id, site_id), organization_id
    INTO v_asset_customer_id, v_asset_site_id, v_asset_org_id
    FROM public.equipment_assets
    WHERE id = NEW.asset_id;

    IF v_asset_customer_id IS NULL THEN
      RAISE EXCEPTION 'Equipment asset % does not exist', NEW.asset_id;
    END IF;

    IF v_asset_org_id <> NEW.organization_id THEN
      RAISE EXCEPTION 'Cross-tenant violation: Equipment asset belongs to organization %, not %', v_asset_org_id, NEW.organization_id;
    END IF;

    IF v_asset_customer_id <> NEW.customer_id THEN
      RAISE EXCEPTION 'Integrity violation: Equipment asset % does not belong to customer %', NEW.asset_id, NEW.customer_id;
    END IF;

    IF v_asset_site_id IS NOT NULL AND NEW.site_id IS NOT NULL AND v_asset_site_id <> NEW.site_id THEN
      RAISE EXCEPTION 'Integrity violation: Equipment asset % is installed at site %, not job site %', NEW.asset_id, v_asset_site_id, NEW.site_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_jobs_sync_and_integrity ON public.jobs;
CREATE TRIGGER trg_jobs_sync_and_integrity
  BEFORE INSERT OR UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_jobs_fields_and_integrity();

-- 3. Update job_assignments table: Add status, assigner, and technician user ID
ALTER TABLE public.job_assignments
  ADD COLUMN IF NOT EXISTS technician_user_id UUID,
  ADD COLUMN IF NOT EXISTS assignment_status TEXT NOT NULL DEFAULT 'assigned',
  ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.job_assignments DROP CONSTRAINT IF EXISTS job_assignments_status_check;
ALTER TABLE public.job_assignments ADD CONSTRAINT job_assignments_status_check
  CHECK (assignment_status IN ('assigned', 'accepted', 'in_progress', 'completed', 'declined'));

ALTER TABLE public.job_assignments DROP CONSTRAINT IF EXISTS uq_job_assignments_id_org;
ALTER TABLE public.job_assignments ADD CONSTRAINT uq_job_assignments_id_org UNIQUE (id, organization_id);

ALTER TABLE public.job_assignments DROP CONSTRAINT IF EXISTS fk_job_assignments_job_org;
ALTER TABLE public.job_assignments ADD CONSTRAINT fk_job_assignments_job_org
  FOREIGN KEY (job_id, organization_id)
  REFERENCES public.jobs(id, organization_id)
  ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.sync_job_assignment_tech()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.technician_user_id IS NOT NULL AND NEW.technician_id IS NULL THEN
    NEW.technician_id := NEW.technician_user_id;
  ELSIF NEW.technician_id IS NOT NULL AND NEW.technician_user_id IS NULL THEN
    NEW.technician_user_id := NEW.technician_id;
  END IF;

  -- Ensure assigned technician is a member of the organization
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = NEW.organization_id
      AND user_id = NEW.technician_id
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Technician % is not an active member of organization %', NEW.technician_id, NEW.organization_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_job_assignments_sync ON public.job_assignments;
CREATE TRIGGER trg_job_assignments_sync
  BEFORE INSERT OR UPDATE ON public.job_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_job_assignment_tech();

-- 4. Update job_visits table
ALTER TABLE public.job_visits
  ADD COLUMN IF NOT EXISTS visit_status TEXT;

ALTER TABLE public.job_visits DROP CONSTRAINT IF EXISTS uq_job_visits_id_org;
ALTER TABLE public.job_visits ADD CONSTRAINT uq_job_visits_id_org UNIQUE (id, organization_id);

ALTER TABLE public.job_visits DROP CONSTRAINT IF EXISTS fk_job_visits_job_org;
ALTER TABLE public.job_visits ADD CONSTRAINT fk_job_visits_job_org
  FOREIGN KEY (job_id, organization_id)
  REFERENCES public.jobs(id, organization_id)
  ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.sync_job_visit_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.visit_status IS NOT NULL AND NEW.status IS NULL THEN
    NEW.status := NEW.visit_status;
  ELSIF NEW.status IS NOT NULL AND NEW.visit_status IS NULL THEN
    NEW.visit_status := NEW.status;
  ELSIF NEW.visit_status IS NOT NULL AND NEW.status IS NOT NULL AND NEW.status <> NEW.visit_status THEN
    NEW.status := NEW.visit_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_job_visits_sync ON public.job_visits;
CREATE TRIGGER trg_job_visits_sync
  BEFORE INSERT OR UPDATE ON public.job_visits
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_job_visit_status();

-- 5. Update service_requests table: sources, priorities, intake status
ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'phone_call',
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS intake_status TEXT NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS service_site_id UUID;

ALTER TABLE public.service_requests DROP CONSTRAINT IF EXISTS service_requests_source_check;
ALTER TABLE public.service_requests ADD CONSTRAINT service_requests_source_check
  CHECK (source IN ('phone_call', 'whatsapp', 'website', 'walk_in', 'referral', 'portal'));

ALTER TABLE public.service_requests DROP CONSTRAINT IF EXISTS service_requests_priority_check;
ALTER TABLE public.service_requests ADD CONSTRAINT service_requests_priority_check
  CHECK (priority IN ('low', 'medium', 'high', 'urgent'));

ALTER TABLE public.service_requests DROP CONSTRAINT IF EXISTS service_requests_intake_status_check;
ALTER TABLE public.service_requests ADD CONSTRAINT service_requests_intake_status_check
  CHECK (intake_status IN ('new', 'reviewing', 'converted_to_job', 'declined', 'cancelled'));

ALTER TABLE public.service_requests DROP CONSTRAINT IF EXISTS fk_requests_customer_org;
ALTER TABLE public.service_requests ADD CONSTRAINT fk_requests_customer_org
  FOREIGN KEY (customer_id, organization_id)
  REFERENCES public.customers(id, organization_id)
  ON DELETE SET NULL;

ALTER TABLE public.service_requests DROP CONSTRAINT IF EXISTS fk_requests_site_org;
ALTER TABLE public.service_requests ADD CONSTRAINT fk_requests_site_org
  FOREIGN KEY (site_id, organization_id)
  REFERENCES public.service_sites(id, organization_id)
  ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.sync_service_requests_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.service_site_id IS NOT NULL AND NEW.site_id IS NULL THEN
    NEW.site_id := NEW.service_site_id;
  ELSIF NEW.site_id IS NOT NULL AND NEW.service_site_id IS NULL THEN
    NEW.service_site_id := NEW.site_id;
  END IF;

  -- Sync status and intake_status
  IF NEW.intake_status IS NOT NULL AND NEW.status IS NULL THEN
    NEW.status := NEW.intake_status;
  ELSIF NEW.status IS NOT NULL AND NEW.intake_status IS NULL THEN
    NEW.intake_status := NEW.status;
  END IF;

  -- Sync urgency and priority
  IF NEW.priority IS NOT NULL AND NEW.urgency IS NULL THEN
    NEW.urgency := CASE NEW.priority WHEN 'urgent' THEN 'emergency' WHEN 'medium' THEN 'normal' ELSE NEW.priority END;
  ELSIF NEW.urgency IS NOT NULL AND NEW.priority IS NULL THEN
    NEW.priority := CASE NEW.urgency WHEN 'emergency' THEN 'urgent' WHEN 'normal' THEN 'medium' ELSE NEW.urgency END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_service_requests_sync ON public.service_requests;
CREATE TRIGGER trg_service_requests_sync
  BEFORE INSERT OR UPDATE ON public.service_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_service_requests_fields();

-- 6. Indexes for Dispatch, Calendar, and Search performance
CREATE INDEX IF NOT EXISTS idx_jobs_org_scheduled_range ON public.jobs (organization_id, scheduled_start, scheduled_end);
CREATE INDEX IF NOT EXISTS idx_jobs_org_priority ON public.jobs (organization_id, priority);
CREATE INDEX IF NOT EXISTS idx_jobs_org_number ON public.jobs (organization_id, job_number);
CREATE INDEX IF NOT EXISTS idx_job_assignments_tech_status ON public.job_assignments (organization_id, technician_id, assignment_status);
CREATE INDEX IF NOT EXISTS idx_job_visits_scheduled_range ON public.job_visits (organization_id, scheduled_start, scheduled_end);
CREATE INDEX IF NOT EXISTS idx_service_requests_intake ON public.service_requests (organization_id, intake_status);
