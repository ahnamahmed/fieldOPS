# FieldOps BD — Security Audit & Multi-Tenant Checklist

This document details the multi-tenant isolation, authorization model, stored procedure hardening, and cryptographic safeguards implemented across **FieldOps BD**.

---

## 1. Multi-Tenant Row Level Security (RLS) Coverage

All 25 application tables enforce PostgreSQL Row Level Security:

1. `profiles`
2. `organizations`
3. `organization_members`
4. `document_sequences`
5. `customers`
6. `service_sites`
7. `equipment_assets`
8. `service_requests`
9. `jobs`
10. `job_assignments`
11. `job_visits`
12. `job_checklists`
13. `job_parts_used`
14. `job_attachments`
15. `quotes`
16. `quote_items`
17. `invoices`
18. `invoice_items`
19. `payments`
20. `service_contracts`
21. `service_contract_assets`
22. `contract_planned_visits`
23. `service_contract_schedules`
24. `service_reminders`
25. `activity_logs`

### RLS Invariants Enforced:
- Every tenant-sensitive row contains an `organization_id UUID NOT NULL REFERENCES public.organizations(id)`.
- RLS policies query the caller's membership via `public.get_user_organizations()`.
- Client-supplied `organization_id` parameters in HTTP requests or mutation payloads are **never trusted** as proof of ownership. Session identity is derived strictly on the server from authenticated cookie sessions.

---

## 2. Hardened Stored Procedures & Functions

All `SECURITY DEFINER` functions have been hardened against search-path hijacking and unauthorized cross-tenant execution:

| Function Name | `SET search_path` | Caller Role Authorization Check |
| :--- | :--- | :--- |
| `get_next_document_number` | `public, pg_temp` | `user_has_role(org, ['owner', 'admin', 'dispatcher', 'finance', 'technician'])` |
| `seed_job_standard_checklist` | `public, pg_temp` | Caller belongs to the job's tenant organization |
| `record_invoice_payment` | `public, pg_temp` | `user_has_role(org, ['owner', 'admin', 'finance'])` |
| `void_invoice_payment` | `public, pg_temp` | `user_has_role(org, ['owner', 'admin', 'finance'])` |
| `convert_quote_to_invoice` | `public, pg_temp` | `user_has_role(org, ['owner', 'admin', 'dispatcher', 'finance'])` |
| `convert_quote_to_job` | `public, pg_temp` | `user_has_role(org, ['owner', 'admin', 'dispatcher'])` |
| `generate_contract_planned_visits` | `public, pg_temp` | `user_has_role(org, ['owner', 'admin', 'dispatcher'])` |
| `convert_planned_visit_to_job` | `public, pg_temp` | `user_has_role(org, ['owner', 'admin', 'dispatcher'])` |
| `renew_service_contract` | `public, pg_temp` | `user_has_role(org, ['owner', 'admin', 'dispatcher'])` |
| `sync_service_reminders` | `public, pg_temp` | `user_has_role(org, ['owner', 'admin', 'dispatcher', 'finance'])` |

---

## 3. Storage Bucket Security

- Bucket name: `job-attachments` (Configuration: `public: false`).
- RLS Policy:
  - Users can only read and write storage objects if the first folder segment (`(storage.foldername(name))[1]`) matches an active organization ID where the user is an enrolled member.
  - Non-UUID paths are safely rejected without throwing unhandled database type casting exceptions.

---

## 4. Role-Based Access Control (RBAC) Matrix

| Action / Capability | `owner` | `admin` | `dispatcher` | `finance` | `technician` |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Manage Team & Roles | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create / Edit Customers & Sites | ✅ | ✅ | ✅ | ❌ | ❌ |
| Create / Dispatch Jobs | ✅ | ✅ | ✅ | ❌ | ❌ |
| View Assigned Jobs in Tech Workspace | ✅ | ✅ | ✅ | ❌ | ✅ |
| Execute Checklists & Upload Photos | ✅ | ✅ | ✅ | ❌ | ✅ |
| Create / Issue Quotes & Invoices | ✅ | ✅ | ❌ | ✅ | ❌ |
| Record / Void Payments | ✅ | ✅ | ❌ | ✅ | ❌ |
| Manage AMC Maintenance Contracts | ✅ | ✅ | ✅ | ❌ | ❌ |
| View Financial Revenue Reports | ✅ | ✅ | ❌ | ✅ | ❌ |

---

## 5. Automated Multi-Tenant Verification Suite

A dedicated automated test suite (`tests/unit/multi-tenant-security.test.ts`) validates tenant isolation across 14 distinct test assertions:

1. Organization A queries cannot match or leak Organization B records.
2. Direct ID-based lookup attempts against foreign tenant entities return `404 Not Found` / empty results.
3. Mutations against foreign tenant IDs throw `Record not found in organization`.
4. RPC payment recording rejects cross-tenant callers.
5. RPC quote and visit conversion reject cross-tenant callers.
6. Storage object keys outside the caller's organization root directory are denied.
7. Role permission boundary checks ensure technicians cannot record payments or access management settings.

All 155 tests pass in CI/local runs (`npm test`).
