-- FieldOps BD — Auth & Onboarding Foundation Migration
-- Migration: 20261013000001_auth_onboarding_foundation.sql
-- Description: Enhances user profile triggers, transactional onboarding with duplicate protection, and helper functions for SSR role authorization

-- 1. Ensure profiles table allows user self-insertion if trigger was bypassed
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- 2. Enhanced Trigger function for new auth users
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
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
    updated_at = now();
  RETURN NEW;
END;
$$;

-- 3. Robust transactional organization onboarding function
-- Transactional atomicity: Creates organization, owner membership, document sequences, and audit log.
-- Prevents duplicate owner memberships and handles slug collisions safely.
CREATE OR REPLACE FUNCTION public.create_organization_with_owner(
  org_name TEXT,
  org_slug TEXT,
  contact_phone TEXT,
  contact_email TEXT DEFAULT NULL,
  address TEXT DEFAULT NULL,
  city TEXT DEFAULT 'Dhaka',
  currency TEXT DEFAULT 'BDT',
  timezone TEXT DEFAULT 'Asia/Dhaka'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  new_org_id UUID;
  caller_id UUID := auth.uid();
  existing_org_id UUID;
  final_slug TEXT := lower(trim(org_slug));
  slug_exists BOOLEAN;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to register an organization';
  END IF;

  -- 1. Check if caller already has an active organization as owner (Idempotency / Duplicate Prevention)
  SELECT organization_id INTO existing_org_id
  FROM public.organization_members
  WHERE user_id = caller_id
    AND role = 'owner'
    AND status = 'active'
  LIMIT 1;

  IF existing_org_id IS NOT NULL THEN
    RETURN existing_org_id;
  END IF;

  -- 2. Ensure profile exists for the caller before linking foreign keys
  INSERT INTO public.profiles (id, full_name, phone)
  SELECT
    caller_id,
    COALESCE((SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = caller_id), 'Business Owner'),
    contact_phone
  ON CONFLICT (id) DO NOTHING;

  -- 3. Slug collision protection: append short random suffix if slug exists
  SELECT EXISTS(SELECT 1 FROM public.organizations WHERE slug = final_slug) INTO slug_exists;
  IF slug_exists THEN
    final_slug := final_slug || '-' || substr(md5(random()::text), 1, 4);
  END IF;

  -- 4. Insert organization
  INSERT INTO public.organizations (
    name,
    slug,
    contact_phone,
    contact_email,
    address,
    city,
    currency,
    timezone
  )
  VALUES (
    trim(org_name),
    final_slug,
    trim(contact_phone),
    nullif(trim(contact_email), ''),
    nullif(trim(address), ''),
    COALESCE(nullif(trim(city), ''), 'Dhaka'),
    COALESCE(nullif(trim(currency), ''), 'BDT'),
    COALESCE(nullif(trim(timezone), ''), 'Asia/Dhaka')
  )
  RETURNING id INTO new_org_id;

  -- 5. Insert caller as owner
  INSERT INTO public.organization_members (
    organization_id,
    user_id,
    role,
    status
  )
  VALUES (
    new_org_id,
    caller_id,
    'owner',
    'active'
  );

  -- 6. Initialize default human-readable document numbering sequences
  INSERT INTO public.document_sequences (organization_id, document_type, current_val)
  VALUES
    (new_org_id, 'job', 1000),
    (new_org_id, 'quote', 1000),
    (new_org_id, 'invoice', 1000),
    (new_org_id, 'contract', 1000),
    (new_org_id, 'request', 1000);

  -- 7. Record audit activity
  INSERT INTO public.activity_logs (
    organization_id,
    actor_id,
    entity_type,
    entity_id,
    action,
    details
  )
  VALUES (
    new_org_id,
    caller_id,
    'organization',
    new_org_id,
    'onboarded',
    jsonb_build_object(
      'name', trim(org_name),
      'slug', final_slug,
      'currency', currency,
      'timezone', timezone
    )
  );

  RETURN new_org_id;
END;
$$;

-- 4. Helper function to get current user's active membership details securely
CREATE OR REPLACE FUNCTION public.get_user_membership_details()
RETURNS TABLE (
  organization_id UUID,
  organization_name TEXT,
  organization_slug TEXT,
  role TEXT,
  status TEXT,
  currency TEXT,
  timezone TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
STABLE
AS $$
  SELECT
    o.id AS organization_id,
    o.name AS organization_name,
    o.slug AS organization_slug,
    om.role,
    om.status,
    o.currency,
    o.timezone
  FROM public.organization_members om
  JOIN public.organizations o ON om.organization_id = o.id
  WHERE om.user_id = auth.uid()
    AND om.status = 'active'
  LIMIT 1;
$$;
