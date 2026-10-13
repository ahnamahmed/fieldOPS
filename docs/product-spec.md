# FieldOps BD — Product Specification

## 1. Target Market & User Persona
- **Industry Segment**: AC and refrigeration repair and servicing companies in Bangladesh.
- **Organization Size**: Small-to-medium teams with 3–20 technicians.
- **Operating Geography**: Urban commercial and residential clusters (Dhaka: Gulshan, Banani, Motijheel, Uttara, Dhanmondi; Chattogram: Agrabad, Nasirabad; Sylhet, etc.).
- **Primary Roles**:
  - **Owner**: Business oversight, pricing strategy, customer accounts, performance reporting.
  - **Admin**: Day-to-day operations and team coordination.
  - **Dispatcher**: Job creation, technician scheduling, route planning, incoming phone inquiries.
  - **Technician**: Field execution, diagnostic checklists (PSI, Amps), parts tracking, photo uploads, customer sign-off.
  - **Finance**: Quotation preparation, invoice issuance, recording manual payments (Cash, bKash, Nagad, Bank).

## 2. Core Workflows
1. **Intake & Customer Triage**: Log inbound calls from bank branches, restaurants, offices, or apartment owners into `service_requests`.
2. **Customer, Site & Asset Management**: Maintain customer profiles, distinct service sites with local landmarks, and maintained equipment units (brand, model, refrigerant, serial number, warranty).
3. **Dispatch & Scheduling**: Assign lead and supporting technicians, detect schedule conflicts, and schedule visits.
4. **Field Execution**: Technicians access mobile-optimized `/tech` views to complete mandatory AC checklists, record refrigerant kg used, take before/after photos, and collect customer signatures.
5. **Billing & Collections**: Generate invoices with BDT formatting and track manual collections across Cash, bKash TrxID, Nagad, and Bank Cheque.
6. **Annual Maintenance Contracts (AMC)**: Track recurring contracts and automatically schedule quarterly/semi-annual routine maintenance visits.

## 3. MVP Boundaries
- **In Scope**:
  - Complete multi-tenant data isolation via PostgreSQL RLS.
  - Responsive desktop dispatcher center and mobile-first technician workspace.
  - Full CRUD on Customers, Sites, Assets, Jobs, Visits, Checklists, Parts, Quotes, Invoices, Payments, and AMC Contracts.
  - Bangladesh localization: BDT currency, Asia/Dhaka timezone, mobile number formatting, manual MFS tracking.
- **Out of Scope for Initial MVP**:
  - Live automated SMS gateway or WhatsApp API integration (manual reminders and click-to-dial only).
  - Live payment gateway integration with SSLCommerz/bKash checkout (manual ledger entry only).
  - GPS real-time technician breadcrumb tracking.
