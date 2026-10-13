# FieldOps BD — Security Checklist & RLS Matrix

## 1. Multi-Tenant Row Level Security (RLS) Coverage
- [x] All 23 public tables have RLS explicitly enabled via `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`.
- [x] `public.get_user_organizations()` function is defined with `SECURITY DEFINER` and restricted search path (`public, auth`).
- [x] `public.user_has_role(org_id, roles[])` function is defined with `SECURITY DEFINER` and restricted search path.
- [x] Cross-tenant leak prevention: Every query checks `organization_id IN (SELECT public.get_user_organizations())`.
- [x] Role separation:
  - Technicians can only SELECT and UPDATE jobs where an explicit `job_assignments` record matches `auth.uid()`.
  - Finance personnel have access to quotes, invoices, and payments, but cannot modify dispatch assignments.
  - Dispatchers have full access to customers, assets, jobs, and visits, but cannot record or void financial transactions.
  - Owners and Admins have full administrative authority over their tenant records.

## 2. Supabase Storage Security
- [x] Private bucket `job-attachments` created with `public: false`.
- [x] Storage RLS policy enforces that only users belonging to the organization referenced in the storage folder path can access or upload files.
- [x] File paths strictly formatted as `<organization_id>/<job_id>/<file_uuid>.<ext>`.

## 3. Secret Management
- [x] No `SERVICE_ROLE_KEY` or privileged database passwords exposed to client code.
- [x] Client code only accesses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- [x] `.env.local` is ignored by Git, and `.env.example` contains only placeholder values.
