# FieldOps BD — Production Deployment & Operations Guide

This guide details the complete production deployment workflow for **FieldOps BD** on **Vercel** with **Supabase** as the PostgreSQL database, authentication, and file storage backend.

---

## 1. Hosting Architecture

- **Application Frontend & API Server**: Vercel (Next.js 16 App Router on Node.js runtime).
- **Relational Database**: Supabase PostgreSQL 17 (recommended region: `ap-northeast-1` / Tokyo or Singapore for low-latency from Bangladesh).
- **Authentication**: Supabase Auth with `@supabase/ssr` cookie session management.
- **File Storage**: Supabase Storage private S3-compatible bucket (`job-attachments`).
- **CDN & DNS**: Vercel Edge Network with SSL termination.

---

## 2. Required Environment Variables

Configure these variables in your **Vercel Project Settings $\to$ Environment Variables** (and `.env.local` for local staging):

| Variable Name | Environment | Description | Example / Note |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview | Supabase project API URL | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview | Public anon key (RLS protected) | `eyJhbGciOi...` |
| `NEXT_PUBLIC_APP_URL` | Production, Preview | Canonical application root URL | `https://app.fieldopsbd.com` |

> [!IMPORTANT]
> **Zero Service Role Key Exposure**: Never set `SUPABASE_SERVICE_ROLE_KEY` in `NEXT_PUBLIC_` variables or expose it to client code. All routine application workflows operate under least-privilege authenticated RLS policies.

---

## 3. Database Migration Runbook

All database changes are managed through sequential SQL migrations under `supabase/migrations/`:

| Migration File | Description |
| :--- | :--- |
| `20261012000001_initial_schema.sql` | Core multi-tenant tables, profiles, RLS foundation, sequence numbers |
| `20261013000001_auth_onboarding_foundation.sql` | Registration transaction, owner assignment, membership helper |
| `20261013000002_customers_sites_equipment.sql` | Customers, sites, equipment assets, and address syncing |
| `20261013000003_jobs_calendar_dispatch.sql` | Jobs, technician assignments, visits, service requests |
| `20261013000004_technician_workspace.sql` | Mobile checklists, parts used, photo attachment references |
| `20261013000005_quotes_invoices_payments.sql` | Financial schema, quotes, invoices, payments, conversion functions |
| `20261014000001_contracts_reminders_reports.sql` | Service contracts, planned visits, reminders, operational reports |
| `20261019000001_security_hardening.sql` | Hardening of stored procedures (`SET search_path`, caller authorization check) |

### Applying Migrations to Remote Supabase:

1. **Install Supabase CLI**:
   ```bash
   npm install -g supabase
   ```
2. **Login and Link Project**:
   ```bash
   supabase login
   supabase link --project-ref <your-supabase-project-id>
   ```
3. **Deploy Migrations**:
   ```bash
   supabase db push
   ```
4. **Verify Application**:
   Execute the verification query in Supabase SQL Editor:
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   ORDER BY table_name;
   ```
   Confirm all 25 tables are present with RLS enabled:
   ```sql
   SELECT relname, relrowsecurity 
   FROM pg_class 
   WHERE relnamespace = 'public'::regnamespace AND relkind = 'r';
   ```

---

## 4. Supabase Auth & Redirect URL Configuration

1. In the Supabase Dashboard, navigate to **Authentication $\to$ URL Configuration**.
2. Set **Site URL**:
   ```
   https://app.fieldopsbd.com
   ```
3. Add **Redirect URLs**:
   ```
   https://app.fieldopsbd.com/auth/callback
   https://app.fieldopsbd.com/reset-password
   http://localhost:3000/auth/callback (for local development only)
   ```
4. Ensure Email confirmation settings match your business requirement (enable email verification for production tenants).

---

## 5. Storage Bucket Setup & Access Policies

1. Verify the `job-attachments` bucket exists and is private:
   - Name: `job-attachments`
   - Public: `false` (Private)
2. Storage Access Policy:
   Ensure the hardened RLS policy is active on `storage.objects`:
   ```sql
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
   );
   ```
3. Upload Path Convention:
   Files are uploaded strictly under:
   ```
   <organization_id>/jobs/<job_id>/<attachment_uuid>.<ext>
   ```

---

## 6. Production Domain Configuration (Vercel)

1. In Vercel Project Settings $\to$ **Domains**, add your custom domain:
   - `app.fieldopsbd.com`
2. Configure DNS records with your registrar:
   - Type: `CNAME`
   - Name: `app`
   - Value: `cname.vercel-dns.com`
3. Wait for automatic SSL certificate generation by Let's Encrypt / Vercel.

---

## 7. Creating the First Production Tenant & Owner

1. Navigate to your production URL: `https://app.fieldopsbd.com/register`.
2. Sign up with the primary owner's email, name, phone, and password.
3. Upon registration, the secure server trigger `handle_new_user()` creates their profile record.
4. Complete the `/onboarding` step:
   - Provide Service Company Name (e.g., "Dhaka AC Solutions Ltd.").
   - Business Phone (e.g., `01712345678`).
   - Operating City (`Dhaka`), Currency (`BDT`), and Timezone (`Asia/Dhaka`).
5. The atomic stored procedure `create_organization_with_owner()` assigns the `owner` role, initializes sequential document number sequences (`QT-1001`, `INV-1001`, `JOB-1001`, `AMC-1001`), and redirects to `/app/dashboard`.

---

## 8. Zero Demo Data Policy in Production

- The application contains **zero demo fixtures** in production code paths.
- All dashboard KPIs, jobs, customer counts, invoices, and activity logs are queried dynamically from PostgreSQL tables scoped to the caller's `organization_id`.
- If an organization is newly created, all pages cleanly display helpful **Empty States** guiding the user to create their first customer, job, quotation, or maintenance contract.

---

## 9. Backup, Monitoring & Recovery

- **Automated Point-in-Time Recovery (PITR)**: Enable Supabase Pro PITR for continuous WAL archiving (up to 7 days rollback capability).
- **Daily Backups**: Supabase performs daily physical backups.
- **Health & Error Monitoring**:
  - Connect Sentry or Vercel Analytics for Next.js runtime error tracking.
  - Supabase Database Health: Monitor CPU, connection pool (PgBouncer/Supavisor), and disk I/O in the Supabase Dashboard.
