# FieldOps BD — Database Schema & Migration Plan

## 1. Relational Structure & Multi-Tenant Boundaries
Every tenant table enforces `organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`.

### Core Tables Applied (23 Tables):
1. `profiles`: User information linked to `auth.users(id)`.
2. `organizations`: Tenant companies (currency BDT, timezone Asia/Dhaka, numbering preferences).
3. `organization_members`: User-organization role assignment (owner, admin, dispatcher, technician, finance).
4. `document_sequences`: Race-condition free sequential number generation per tenant.
5. `customers`: Commercial and residential clients.
6. `service_sites`: Physical locations with local landmarks and access instructions.
7. `equipment_assets`: AC and refrigeration units with refrigerant types and condition status.
8. `service_contracts`: Annual Maintenance Contracts (AMC) with billing frequencies.
9. `service_contract_assets`: Equipment covered by specific AMC contracts.
10. `service_contract_schedules`: Planned service visits scheduled across contract terms.
11. `service_requests`: Intake inquiries.
12. `jobs`: Work orders with status, priority, and scheduled time windows.
13. `job_assignments`: Technician allocations with lead technician designation.
14. `job_visits`: Individual visits with check-in timestamps and technician notes.
15. `job_checklists`: AC inspection metrics (filter wash, PSI, running current amps).
16. `job_parts_used`: Parts, copper pipes, and refrigerant gas consumed.
17. `job_attachments`: File records linked to private Supabase Storage.
18. `quotes`: Estimates with subtotal, discount, VAT, and validity dates.
19. `quote_items`: Line items for quotes.
20. `invoices`: Billing documents with balance due and payment terms.
21. `invoice_items`: Line items for invoices.
22. `payments`: Manual transactions (Cash, bKash, Nagad, Rocket, Bank, Cheque).
23. `activity_logs`: Audit trail for security and state transitions.

## 2. Migration Discipline
- Applied Migration: `supabase/migrations/20261012000001_initial_schema.sql`
- Verified Status: Applied to Supabase project `mtseszmalzoyhgcepwrc` on 2026-10-12.
