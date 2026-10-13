-- FieldOps BD — Customers, Service Sites & Equipment Module Migration
-- Migration: 20261013000002_customers_sites_equipment.sql
-- Description: Adds schema compatibility columns, composite cross-tenant constraints, and integrity triggers

-- 1. Customers Table Enhancements
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS name TEXT;

-- Populate name for existing rows if needed
UPDATE public.customers
SET name = COALESCE(company_name, contact_name)
WHERE name IS NULL;

-- Trigger to keep name, company_name, and contact_name synchronized
CREATE OR REPLACE FUNCTION public.sync_customer_names()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.name IS NOT NULL AND (NEW.contact_name IS NULL OR NEW.contact_name = '') THEN
    NEW.contact_name := NEW.name;
  END IF;
  IF NEW.name IS NOT NULL AND (NEW.company_name IS NULL OR NEW.company_name = '') THEN
    NEW.company_name := NEW.name;
  END IF;
  IF NEW.name IS NULL AND NEW.company_name IS NOT NULL THEN
    NEW.name := NEW.company_name;
  ELSIF NEW.name IS NULL AND NEW.contact_name IS NOT NULL THEN
    NEW.name := NEW.contact_name;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_customer_names ON public.customers;
CREATE TRIGGER trg_sync_customer_names
  BEFORE INSERT OR UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.sync_customer_names();

-- Composite unique constraint on customers for cross-tenant FK reference
ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS uq_customers_id_org,
  ADD CONSTRAINT uq_customers_id_org UNIQUE (id, organization_id);

-- 2. Service Sites Table Enhancements
ALTER TABLE public.service_sites
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS postcode TEXT,
  ADD COLUMN IF NOT EXISTS access_notes TEXT;

-- Sync existing site address fields if present
UPDATE public.service_sites
SET
  address = COALESCE(address, address_line1),
  postcode = COALESCE(postcode, postal_code),
  access_notes = COALESCE(access_notes, access_instructions)
WHERE address IS NULL OR postcode IS NULL OR access_notes IS NULL;

-- Trigger to sync site address fields
CREATE OR REPLACE FUNCTION public.sync_site_address_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.address IS NOT NULL AND (NEW.address_line1 IS NULL OR NEW.address_line1 = '') THEN
    NEW.address_line1 := NEW.address;
  ELSIF NEW.address_line1 IS NOT NULL AND (NEW.address IS NULL OR NEW.address = '') THEN
    NEW.address := NEW.address_line1;
  END IF;

  IF NEW.postcode IS NOT NULL AND (NEW.postal_code IS NULL OR NEW.postal_code = '') THEN
    NEW.postal_code := NEW.postcode;
  ELSIF NEW.postal_code IS NOT NULL AND (NEW.postcode IS NULL OR NEW.postcode = '') THEN
    NEW.postcode := NEW.postal_code;
  END IF;

  IF NEW.access_notes IS NOT NULL AND (NEW.access_instructions IS NULL OR NEW.access_instructions = '') THEN
    NEW.access_instructions := NEW.access_notes;
  ELSIF NEW.access_instructions IS NOT NULL AND (NEW.access_notes IS NULL OR NEW.access_notes = '') THEN
    NEW.access_notes := NEW.access_instructions;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_site_address ON public.service_sites;
CREATE TRIGGER trg_sync_site_address
  BEFORE INSERT OR UPDATE ON public.service_sites
  FOR EACH ROW EXECUTE FUNCTION public.sync_site_address_fields();

-- Composite unique constraint on service_sites
ALTER TABLE public.service_sites
  DROP CONSTRAINT IF EXISTS uq_service_sites_id_org,
  ADD CONSTRAINT uq_service_sites_id_org UNIQUE (id, organization_id);

-- Composite foreign key constraint preventing cross-tenant customer linkage
ALTER TABLE public.service_sites
  DROP CONSTRAINT IF EXISTS fk_service_sites_customer_org,
  ADD CONSTRAINT fk_service_sites_customer_org
  FOREIGN KEY (customer_id, organization_id)
  REFERENCES public.customers(id, organization_id)
  ON DELETE CASCADE;

-- 3. Equipment Assets Table Enhancements
ALTER TABLE public.equipment_assets
  ADD COLUMN IF NOT EXISTS service_site_id UUID REFERENCES public.service_sites(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS location_description TEXT,
  ADD COLUMN IF NOT EXISTS service_notes TEXT;

-- Sync existing asset fields
UPDATE public.equipment_assets
SET
  service_site_id = COALESCE(service_site_id, site_id),
  model = COALESCE(model, model_number),
  location_description = COALESCE(location_description, location_in_facility),
  service_notes = COALESCE(service_notes, notes)
WHERE service_site_id IS NULL OR model IS NULL OR location_description IS NULL OR service_notes IS NULL;

-- Trigger to sync asset alias columns and enforce site-customer integrity
CREATE OR REPLACE FUNCTION public.sync_equipment_fields_and_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  site_cust_id UUID;
  site_org_id UUID;
BEGIN
  -- Sync site_id and service_site_id
  IF NEW.service_site_id IS NOT NULL AND NEW.site_id IS NULL THEN
    NEW.site_id := NEW.service_site_id;
  ELSIF NEW.site_id IS NOT NULL AND NEW.service_site_id IS NULL THEN
    NEW.service_site_id := NEW.site_id;
  ELSIF NEW.service_site_id IS NOT NULL AND NEW.site_id IS NOT NULL AND NEW.site_id != NEW.service_site_id THEN
    NEW.site_id := NEW.service_site_id;
  END IF;

  -- Sync model and model_number
  IF NEW.model IS NOT NULL AND (NEW.model_number IS NULL OR NEW.model_number = '') THEN
    NEW.model_number := NEW.model;
  ELSIF NEW.model_number IS NOT NULL AND (NEW.model IS NULL OR NEW.model = '') THEN
    NEW.model := NEW.model_number;
  END IF;

  -- Sync location_description and location_in_facility
  IF NEW.location_description IS NOT NULL AND (NEW.location_in_facility IS NULL OR NEW.location_in_facility = '') THEN
    NEW.location_in_facility := NEW.location_description;
  ELSIF NEW.location_in_facility IS NOT NULL AND (NEW.location_description IS NULL OR NEW.location_description = '') THEN
    NEW.location_description := NEW.location_in_facility;
  END IF;

  -- Sync service_notes and notes
  IF NEW.service_notes IS NOT NULL AND (NEW.notes IS NULL OR NEW.notes = '') THEN
    NEW.notes := NEW.service_notes;
  ELSIF NEW.notes IS NOT NULL AND (NEW.service_notes IS NULL OR NEW.service_notes = '') THEN
    NEW.service_notes := NEW.notes;
  END IF;

  -- Verify that the selected site belongs to the selected customer and same organization
  IF NEW.site_id IS NOT NULL THEN
    SELECT customer_id, organization_id INTO site_cust_id, site_org_id
    FROM public.service_sites
    WHERE id = NEW.site_id;

    IF site_cust_id IS NOT NULL AND site_cust_id != NEW.customer_id THEN
      RAISE EXCEPTION 'Equipment service site does not belong to the selected customer';
    END IF;

    IF site_org_id IS NOT NULL AND site_org_id != NEW.organization_id THEN
      RAISE EXCEPTION 'Cross-tenant site reference detected';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_equipment_fields ON public.equipment_assets;
CREATE TRIGGER trg_sync_equipment_fields
  BEFORE INSERT OR UPDATE ON public.equipment_assets
  FOR EACH ROW EXECUTE FUNCTION public.sync_equipment_fields_and_integrity();

-- Composite unique constraint on equipment_assets
ALTER TABLE public.equipment_assets
  DROP CONSTRAINT IF EXISTS uq_equipment_assets_id_org,
  ADD CONSTRAINT uq_equipment_assets_id_org UNIQUE (id, organization_id);

-- Composite foreign keys preventing cross-tenant customer/site linkage
ALTER TABLE public.equipment_assets
  DROP CONSTRAINT IF EXISTS fk_equipment_customer_org,
  ADD CONSTRAINT fk_equipment_customer_org
  FOREIGN KEY (customer_id, organization_id)
  REFERENCES public.customers(id, organization_id)
  ON DELETE CASCADE;

ALTER TABLE public.equipment_assets
  DROP CONSTRAINT IF EXISTS fk_equipment_site_org,
  ADD CONSTRAINT fk_equipment_site_org
  FOREIGN KEY (site_id, organization_id)
  REFERENCES public.service_sites(id, organization_id)
  ON DELETE CASCADE;

-- 4. Additional Performance & Filtering Indexes
CREATE INDEX IF NOT EXISTS idx_customers_name_search ON public.customers(organization_id, name);
CREATE INDEX IF NOT EXISTS idx_customers_type_archived ON public.customers(organization_id, customer_type, is_archived);
CREATE INDEX IF NOT EXISTS idx_service_sites_area_search ON public.service_sites(organization_id, area, is_archived);
CREATE INDEX IF NOT EXISTS idx_equipment_brand_type ON public.equipment_assets(organization_id, equipment_type, is_archived);
CREATE INDEX IF NOT EXISTS idx_equipment_condition ON public.equipment_assets(organization_id, condition_status);
