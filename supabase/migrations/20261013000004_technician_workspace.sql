-- FieldOps BD — Technician Mobile Workspace Migration
-- Migration: 20261013000004_technician_workspace.sql
-- Description: Enhances checklists, parts used, attachments, visits, and jobs for mobile field service execution

-- 1. Enhance jobs table with actual execution timestamps and completion notes
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS actual_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS actual_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS work_performed TEXT,
  ADD COLUMN IF NOT EXISTS follow_up_recommendation TEXT;

-- 2. Enhance job_checklists table with result, unit, notes, and category
ALTER TABLE public.job_checklists
  ADD COLUMN IF NOT EXISTS result TEXT CHECK (result IN ('pass', 'fail', 'na', 'pending')),
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS unit TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general';

-- Composite unique constraint on job_checklists
ALTER TABLE public.job_checklists DROP CONSTRAINT IF EXISTS uq_job_checklists_job_item;
ALTER TABLE public.job_checklists ADD CONSTRAINT uq_job_checklists_job_item UNIQUE (job_id, item_key);

ALTER TABLE public.job_checklists DROP CONSTRAINT IF EXISTS uq_job_checklists_id_org;
ALTER TABLE public.job_checklists ADD CONSTRAINT uq_job_checklists_id_org UNIQUE (id, organization_id);

ALTER TABLE public.job_checklists DROP CONSTRAINT IF EXISTS fk_job_checklists_job_org;
ALTER TABLE public.job_checklists ADD CONSTRAINT fk_job_checklists_job_org
  FOREIGN KEY (job_id, organization_id)
  REFERENCES public.jobs(id, organization_id)
  ON DELETE CASCADE;

-- Trigger to sync and validate job_checklists organization_id
CREATE OR REPLACE FUNCTION public.sync_job_checklists_org()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_job_org_id UUID;
BEGIN
  SELECT organization_id INTO v_job_org_id FROM public.jobs WHERE id = NEW.job_id;
  IF v_job_org_id IS NULL THEN
    RAISE EXCEPTION 'Job % does not exist', NEW.job_id;
  END IF;
  NEW.organization_id := v_job_org_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_job_checklists_sync ON public.job_checklists;
CREATE TRIGGER trg_job_checklists_sync
  BEFORE INSERT OR UPDATE ON public.job_checklists
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_job_checklists_org();

-- 3. Enhance job_parts_used table with notes and multi-tenant constraints
ALTER TABLE public.job_parts_used
  ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE public.job_parts_used DROP CONSTRAINT IF EXISTS uq_job_parts_used_id_org;
ALTER TABLE public.job_parts_used ADD CONSTRAINT uq_job_parts_used_id_org UNIQUE (id, organization_id);

ALTER TABLE public.job_parts_used DROP CONSTRAINT IF EXISTS fk_job_parts_used_job_org;
ALTER TABLE public.job_parts_used ADD CONSTRAINT fk_job_parts_used_job_org
  FOREIGN KEY (job_id, organization_id)
  REFERENCES public.jobs(id, organization_id)
  ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.sync_job_parts_used_org()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_job_org_id UUID;
BEGIN
  SELECT organization_id INTO v_job_org_id FROM public.jobs WHERE id = NEW.job_id;
  IF v_job_org_id IS NULL THEN
    RAISE EXCEPTION 'Job % does not exist', NEW.job_id;
  END IF;
  NEW.organization_id := v_job_org_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_job_parts_used_sync ON public.job_parts_used;
CREATE TRIGGER trg_job_parts_used_sync
  BEFORE INSERT OR UPDATE ON public.job_parts_used
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_job_parts_used_org();

-- 4. Enhance job_attachments table with multi-tenant constraints and sync
ALTER TABLE public.job_attachments DROP CONSTRAINT IF EXISTS uq_job_attachments_id_org;
ALTER TABLE public.job_attachments ADD CONSTRAINT uq_job_attachments_id_org UNIQUE (id, organization_id);

ALTER TABLE public.job_attachments DROP CONSTRAINT IF EXISTS fk_job_attachments_job_org;
ALTER TABLE public.job_attachments ADD CONSTRAINT fk_job_attachments_job_org
  FOREIGN KEY (job_id, organization_id)
  REFERENCES public.jobs(id, organization_id)
  ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.sync_job_attachments_org()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_job_org_id UUID;
BEGIN
  SELECT organization_id INTO v_job_org_id FROM public.jobs WHERE id = NEW.job_id;
  IF v_job_org_id IS NULL THEN
    RAISE EXCEPTION 'Job % does not exist', NEW.job_id;
  END IF;
  NEW.organization_id := v_job_org_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_job_attachments_sync ON public.job_attachments;
CREATE TRIGGER trg_job_attachments_sync
  BEFORE INSERT OR UPDATE ON public.job_attachments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_job_attachments_org();

-- 5. Helper function to seed standard AC checklist items for a job
CREATE OR REPLACE FUNCTION public.seed_job_standard_checklist(p_job_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_org_id UUID;
  v_inserted_count INTEGER := 0;
BEGIN
  SELECT organization_id INTO v_org_id FROM public.jobs WHERE id = p_job_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Job % not found', p_job_id;
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

-- 6. Indexes for technician workspace performance
CREATE INDEX IF NOT EXISTS idx_job_checklists_job_cat ON public.job_checklists(job_id, category);
CREATE INDEX IF NOT EXISTS idx_job_parts_job ON public.job_parts_used(job_id);
CREATE INDEX IF NOT EXISTS idx_job_attachments_job_type ON public.job_attachments(job_id, attachment_type);
