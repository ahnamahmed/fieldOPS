# FieldOps BD — Multi-Tenant Field Service Management SaaS

FieldOps BD is a multi-tenant, mobile-first field-service management SaaS tailored for the Bangladesh market, built specifically for HVAC, air conditioning, and refrigeration servicing businesses managing commercial and residential facilities.

---

## Key Modules & Capabilities

1. **Multi-Tenant Foundation & Onboarding**:
   - Secure tenant isolation backed by PostgreSQL Row Level Security (RLS) on all 25 database tables.
   - Zero client-supplied organization ID trust; session identity derived strictly via `@supabase/ssr` cookies and `auth.uid()`.
   - Idempotent organization and owner creation transactions.

2. **Customer, Site & Equipment Asset Registry**:
   - Multi-tier relationship: Customer $\to$ Multiple Service Sites $\to$ Multiple AC/Refrigeration Units.
   - Bangladesh localization: division, district, area (e.g. Gulshan, Banani, Motijheel), and BD mobile phone formatting (`+8801...` or `01...`).
   - Technical HVAC specs: Refrigerant types (`R22`, `R32`, `R410A`, `R134a`), cooling tonnage, compressor serials, and installation history.

3. **Job Scheduling & Dispatch**:
   - Scheduling calendar with Asia/Dhaka timezone formatting.
   - Conflict detection preventing double-booking of technicians across overlapping time windows.
   - Job priorities, work types (installation, repair, routine maintenance, emergency breakdown), and technician assignment.

4. **Mobile-First Technician Workspace (`/tech/jobs`)**:
   - Dedicated mobile workspace designed for field technicians on 390px+ screens.
   - Job details, customer contact with one-tap phone dialer, site address, and equipment service history.
   - Real-time job status transitions (`scheduled` $\to$ `in_progress` $\to$ `completed` / `on_hold`).
   - Interactive 10-point standard HVAC checklist with technical measurements (PSI, Amps, supply air temperature Delta-T).
   - Parts consumed logger and photo evidence upload to private Supabase storage.

5. **Quotations, Invoices & Payments**:
   - Multi-item quotation and invoice generator with fractional quantities and labour rates.
   - Precise financial calculation engine mitigating IEEE-754 floating-point inaccuracies using integer paisas and strict 2-decimal rounding.
   - Downloadable branded PDF generation (`/api/billing/invoices/[id]/pdf` and `/api/billing/quotes/[id]/pdf`).
   - Partial payment recording with cash, bKash, Nagad, Rocket, and bank transfer manual tracking.
   - Repeat-safe atomic state transitions and audit logging.

6. **Annual Maintenance Contracts (AMC) & Automated Reminders**:
   - Contract management supporting monthly, quarterly, half-yearly, and annual service frequencies.
   - Idempotent planned visit generator with duplicate conversion prevention.
   - Automated overdue and upcoming service reminder synchronization.
   - Audit trail tracking contract renewals and equipment coverage.

7. **Operational & Financial Reports**:
   - Real-time analytics computed directly from database records (no mock or static fixtures in production paths).
   - Revenue breakdown, technician job completion rates, and equipment servicing frequency.

---

## Technology Stack

- **Framework**: Next.js 16.4 (App Router, Turbopack, React 19)
- **Language**: TypeScript 5 (Strict Mode)
- **Database & Auth**: Supabase PostgreSQL 17, Supabase Auth SSR (`@supabase/ssr`), Supabase Storage
- **Styling**: Tailwind CSS, Shadcn UI patterns, Lucide React icons
- **Validation**: Zod schema validation on client and server boundaries
- **Testing**: Vitest 5 (155 automated unit and multi-tenant security tests)
- **Deployment**: Vercel (Edge-ready)

---

## Getting Started

### 1. Prerequisites
- Node.js 20+
- Supabase CLI or active Supabase project

### 2. Environment Setup
Copy the example environment file:
```bash
cp .env.example .env.local
```
Configure your keys in `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Database Migrations
Apply versioned migrations located in `supabase/migrations/`:
```bash
# Using Supabase CLI
supabase db push
```

### 4. Running Locally
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## Automated Verification Suite

Run all quality checks:

```bash
# Type check
npm run typecheck

# Lint check
npm run lint

# Unit & Multi-Tenant security tests
npm test

# Production build validation
npm run build
```

---

## Documentation Links

- [Architecture & Domain Model](docs/architecture.md)
- [Database Schema & Migrations](docs/database-plan.md)
- [Production Deployment Guide](docs/deployment.md)
- [Security Checklist & Multi-Tenant Matrix](docs/security-checklist.md)
- [Product Specifications](docs/product-spec.md)
