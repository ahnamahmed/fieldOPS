# AGENTS.md — FieldOps BD

## 1. Project mission

FieldOps BD is a multi-tenant, mobile-first field-service management SaaS for Bangladesh. The initial customer segment is AC and refrigeration servicing companies with approximately 3–20 technicians, especially companies maintaining offices, restaurants, shops, apartment buildings, and other commercial sites.

The product helps a service company manage its work from intake to completion and payment:

1. Capture customer requests.
2. Manage customers, service sites, and equipment assets.
3. Create service jobs and schedule visits.
4. Assign technicians and track field work.
5. Record checklists, notes, parts used, and service photos.
6. Prepare quotations and invoices.
7. Record payments and outstanding balances.
8. Manage recurring maintenance contracts and upcoming visits.
9. Review operational reports and activity history.

Build an original product and user experience. Jobber and other products may be used as references for common workflows only. Never copy proprietary source code, brand assets, text, or exact UI designs.

## 2. Core operating rules for the coding agent

- Inspect the existing codebase before making changes. Follow established project patterns where sound; do not overwrite a working app or scaffold a second app inside it.
- Read this file and relevant project documentation before starting a task.
- Work in small, reviewable milestones. Implement only the requested milestone and its necessary dependencies; do not attempt a broad rewrite.
- Before complex changes, summarize the intended implementation plan and identify affected routes, components, database objects, policies, and tests.
- Prefer a complete, tested vertical slice over many unfinished screens.
- Do not claim work is complete, deployed, migrated, or tested unless the corresponding action actually succeeded.
- If credentials, permissions, database access, or external services are unavailable, implement what can be completed safely and clearly list the manual steps still required.
- Never run destructive commands, drop data, reset a remote database, or deploy to production without explicit user approval.
- Do not overwrite user changes. Review `git status` and existing diffs before editing or reverting files.
- Keep changes focused. Avoid unrelated refactors, speculative abstractions, and dependencies that do not support the current milestone.
- Do not introduce fake functionality. Any visible primary action must work, be clearly disabled with an explanation, or explicitly identify itself as not yet available.
- After each milestone, run appropriate checks, fix issues caused by the change, summarize files changed and checks performed, and identify remaining work.

## 3. Approved technology direction

Use the versions and APIs compatible with the existing lockfile and current stable project dependencies. Do not upgrade major framework versions as an incidental part of feature work.

- Next.js App Router and React.
- TypeScript with strict mode.
- Tailwind CSS and shadcn/ui for reusable accessible UI components.
- Supabase PostgreSQL for data, Supabase Auth for identity, and Supabase Storage for private files.
- `@supabase/ssr` for the current cookie-based Next.js SSR authentication approach, following official documentation compatible with the installed Next.js version.
- Zod for input validation.
- React Hook Form where it improves complex forms.
- Lucide icons.
- Vitest for unit tests and Playwright for important end-to-end tests when configured.
- Vercel as the intended web hosting platform.
- SQL migrations as the source of truth for database structure and security policies.

Use npm when the repository is configured for npm. Preserve the existing package manager and lockfile if the project already uses another manager.

Do not add Prisma. Prefer explicit SQL migrations and typed Supabase queries. Add dependencies only when there is a concrete need.

## 4. Architecture and project conventions

Follow the existing directory structure if it is already coherent. Otherwise, keep concerns separated in a structure such as:

- `src/app/` — route segments, layouts, loading/error boundaries, and route handlers.
- `src/components/` — reusable UI and layout components.
- `src/features/` — feature-specific UI, schemas, data access, and types where appropriate.
- `src/lib/` — shared utilities, Supabase clients, permission checks, formatting, and server-only helpers.
- `src/types/` — shared generated and domain types when not colocated with a feature.
- `supabase/migrations/` — ordered, version-controlled SQL migrations.
- `supabase/tests/` — SQL or policy tests when supported by the selected workflow.
- `tests/` — unit, integration, and end-to-end tests.
- `docs/` — product, architecture, security, database, operations, and deployment documentation.

Keep server-only logic out of client components. Use Server Components by default and add Client Components only when interactivity requires them. Never import server-only modules into browser code. Keep database access, privileged operations, authorization, and secret usage on the server where appropriate.

Prefer small, cohesive modules and explicit data contracts. Avoid giant components, duplicate business logic, untyped `any`, unsafe type assertions, and deeply nested conditionals. Do not suppress TypeScript or lint errors merely to get a passing build.

## 5. Domain model and relationships

The schema may evolve through reviewed migrations, but the data model should cover these concepts as needed by the current milestone:

- `profiles` — user profile linked to `auth.users`.
- `organizations` — a service company / tenant.
- `organization_members` — relationship between users and organizations, including role and membership status.
- `customers` — company customers.
- `service_sites` — physical places where work is performed; one customer may have multiple sites.
- `equipment_assets` — AC/refrigeration units or other maintained equipment at a site.
- `service_requests` — incoming inquiries prior to job creation.
- `jobs` — work orders and their status, priority, scheduling, site, and customer.
- `job_assignments` — technician assignments.
- `job_visits` — individual scheduled or completed visits, including repeat visits.
- Checklist response and attachment records — service execution evidence.
- `service_contracts` and related equipment/planned-visit records — recurring maintenance.
- `quotes` and `quote_items` — quotations.
- `invoices` and `invoice_items` — invoices.
- `payments` — recorded payment transactions against invoices.
- `activity_logs` — audit history for important changes.

Use UUID primary keys for entities unless a specific technical reason requires otherwise. Use foreign keys, uniqueness constraints, check constraints, and indexes deliberately. Include `created_at` and `updated_at` where appropriate. Use organization-scoped human-readable numbers for jobs, quotes, contracts, and invoices, backed by database constraints so concurrent requests cannot create duplicates.

Avoid destructive deletion of records referenced by service history or issued financial documents. Prefer archive/void/cancel states and preserve auditability. Use explicit transaction-safe operations for workflows that change multiple related records.

## 6. Mandatory multi-tenant security

Tenant isolation is a foundational security requirement, not a UI feature.

- Every organization-owned record must have a trustworthy organization relationship and be protected by PostgreSQL Row Level Security (RLS).
- Apply RLS to all tenant-sensitive tables, including future tables and storage metadata where applicable. Do not rely only on filtering by `organization_id` in the browser or application code.
- Determine organization access from authenticated identity and valid membership records. Never trust a client-supplied organization ID, role, email, or user-editable metadata as proof of access.
- Check authorization on the server for every protected Server Action, Route Handler, and privileged operation. Database policies must independently enforce allowed access.
- Define and enforce the role permissions below. A role name or organization selection stored only in client state is not authorization.
- Prevent cross-tenant foreign-key relationships. Validate that the customer, site, asset, job, quote, invoice, contract, payment, and attachment belong to the same organization before linking them.
- Avoid recursive membership RLS policies. If a helper function is necessary, design it carefully, constrain its search path, minimize privileges, and test it. Do not use `SECURITY DEFINER` casually.
- Never disable RLS to make a feature work. Diagnose the policy, query, or permission model and fix it safely.
- Never expose a Supabase service-role/secret key, database password, signing secret, or other privileged credential to client code or a `NEXT_PUBLIC_` variable.
- Prefer least-privilege operations. Never use a service-role key for routine user-facing requests where authenticated RLS-scoped access is sufficient.
- Protect private Storage files. Validate the user's membership and access to the underlying organization/job before upload, listing, or download. Use controlled signed URLs when appropriate; do not make job photos public by default.
- Validate uploaded file size, permitted type, content type, and storage path. Do not trust a filename or browser-supplied MIME type alone.
- Do not log passwords, access tokens, reset links, secrets, or unnecessary personal data.
- Test access with at least two separate organizations and multiple roles. Include direct API/database access attempts, not only UI hiding.

### Role baseline

Implement explicit server-side and database-enforced permissions. If a particular action is not defined below, default to deny and document the decision.

- **owner** — full management access to their own organization, its members, settings, records, and billing-related records. Cannot access another tenant or platform secrets.
- **admin** — manages daily business configuration and operational records within their organization. Sensitive owner-only actions should remain restricted unless deliberately specified.
- **dispatcher** — manages customers/site details as permitted, service requests, jobs, schedules, and technician assignments; cannot change owner/security settings or record financial actions outside their permission.
- **technician** — sees jobs assigned to them and the customer/site/equipment information needed to execute those jobs. Can update permitted visit details, checklists, notes, and job evidence. Cannot browse all company financial data, change assignments, or access another technician's private data unless granted an explicit, documented permission.
- **finance** — accesses customer billing details, quotes, invoices, and payment records needed for finance work. Cannot manage authentication, organization security, or technician assignments unless explicitly authorized.

Do not assume frontend role-based navigation is a security boundary. Enforce access in server code and RLS. Document intentional differences between these baseline permissions and implemented product rules.

## 7. Authentication and onboarding requirements

- Follow official Supabase SSR authentication guidance compatible with installed dependencies.
- Validate sessions on the server for protected routes and mutations. Handle session refresh according to the supported Next.js pattern.
- Support sign-up, login, logout, and password reset according to the configured Supabase Auth settings.
- A newly registered user must not gain access to an organization until a secure onboarding or invitation flow creates valid membership.
- Organization creation and owner membership creation must be safe against partial failure, duplicate submission, and privilege escalation. Use a reviewed transactional database function or equivalent safe server-side operation when multiple writes must succeed together.
- Never allow ordinary users to self-assign the owner/admin role by modifying a request.
- Configure production Auth redirect URLs explicitly. Do not treat localhost redirects as production configuration.

## 8. Bangladesh localization and business rules

- Initial default currency: BDT (৳).
- Initial display timezone: `Asia/Dhaka`.
- Keep persisted timestamps timezone-aware (prefer `timestamptz`) and convert them for display in the organization's configured timezone.
- Do not assume the browser timezone matches the organization's timezone.
- Store phone numbers as strings; support common Bangladesh mobile formats and international prefixes. Do not coerce phone numbers to numeric types.
- Support Bangladesh addresses with address details, area, city, district, and postcode where applicable. Do not assume every site has latitude/longitude.
- Format money, dates, times, and numbers consistently using shared utilities.
- Record cash, bKash, Nagad, bank transfer, and other payments as manually entered records in the MVP.
- A recorded mobile-wallet payment is not proof of provider-side verification. Never state that a payment was verified by bKash/Nagad unless a genuine verified integration exists.
- The initial UI language is English, while keeping strings structured for future Bangla localization. Do not use Banglish for system labels unless explicitly requested.
- Use readable labels and realistic validation messages suitable for a small-business operator. Make common actions usable on low-width screens and weaker connections.

## 9. Financial correctness

- Store monetary values with PostgreSQL `NUMERIC`/`DECIMAL` precision, never database floating-point types.
- Use one shared and tested calculation strategy for line totals, discounts, subtotal, tax (if enabled), invoice totals, payments, and balances.
- Specify and test rounding rules. Do not use JavaScript binary floating-point arithmetic naively for monetary calculations; use integer minor units where appropriate or a suitable decimal arithmetic approach.
- Validate values on the server and, where feasible, in the database. Reject invalid negative quantities/prices and invalid payment amounts unless a documented credit/refund workflow explicitly permits them.
- Support partial payments and derive outstanding balance from a consistent, transaction-safe source of truth.
- Prevent concurrent or repeated submissions from creating duplicate payments, duplicate invoice numbers, duplicate visits, or duplicate jobs. Use database constraints and idempotency where appropriate.
- Issued quotations/invoices and recorded payments require an auditable change/cancel/void strategy. Do not silently rewrite financial history.
- Do not add live payment gateway processing to the initial MVP without an explicit product decision and secure provider integration design.

## 10. UI and UX standards

The visual design should feel like a credible professional B2B SaaS: practical, clear, restrained, and consistent. Use the existing design system rather than inventing new styling on every page.

- Use a clean slate/navy navigation foundation, light content surfaces, restrained blue primary actions, subtle borders, consistent spacing, and legible typography unless the established project design system dictates otherwise.
- Keep it original; do not duplicate Jobber screens or visual identity.
- Make owner/dispatcher pages information-dense but readable. Design technician pages mobile-first with large touch targets and short, task-oriented flows.
- Reuse well-designed tables, form fields, page headers, status badges, filter patterns, confirmation dialogs, and toast/error patterns.
- Every data-driven page must handle loading, success, empty, and failure states.
- Forms need labels, validation messages, keyboard support, and protection against accidental data loss where sensible.
- Destructive actions require clear confirmation. Preserve historical records by archiving, cancelling, or voiding where appropriate.
- Provide useful search, filters, sorting, and pagination for potentially large tables. Do not download an unbounded tenant dataset just to filter it in the browser.
- Ensure accessible labels, keyboard navigation, focus indicators, semantic markup, and reasonable color contrast.
- Format BDT, dates, and times consistently.
- Avoid fake dashboard metrics in production. Clearly isolated demo fixtures may be used during UI development only and must never silently appear for real customer accounts.
- Avoid inert buttons. If an action is not implemented, disable it with a clear explanation or omit it until functional.

## 11. Feature workflow expectations

### Customers, sites, and assets

- A customer may have multiple service sites.
- A site may have multiple equipment assets.
- Use validated relations so an asset cannot be attached to the wrong customer's site or another organization.
- Preserve history when a customer/site/asset is archived.

### Jobs and scheduling

- Define job/visit status values in a shared domain type and enforce legal transitions server-side.
- Candidate statuses include new, quoted, scheduled, in progress, on hold, completed, and cancelled. Adjust only with a documented reason.
- A job may have multiple visits. Do not assume one work order always equals one visit.
- Detect technician schedule overlaps and show a meaningful warning or enforce an approved conflict rule; do not silently ignore conflicts.
- Protect assignment changes and completion transitions with permissions and audit history.
- Store scheduled/actual dates consistently and render them in `Asia/Dhaka` by default.

### Technician execution

- A technician should be able to open an assigned job, see the relevant site/equipment details, update permitted visit statuses, submit checklist answers, add notes, and upload service photos from a phone.
- Do not mark work complete if required checklist fields or completion evidence are missing according to the configured rule.
- Display upload progress and failure details. Avoid losing unsubmitted work without warning.

### Quotes, invoices, and payments

- Quote acceptance and invoice issue transitions must be explicit and audited.
- Make document creation and conversion repeat-safe.
- Keep financial data organization-scoped and apply finance/owner/admin permissions deliberately.
- Record payment method, amount, time, optional reference, and recording user.
- Derive paid/outstanding states correctly, including partial payments and due dates.

### Recurring contracts and reminders

- Model contracts, covered assets, and planned visits separately when that yields a sound schema.
- Make recurrence generation idempotent. Retrying a scheduler must not create duplicate visits.
- Handle month-end and leap-year date behavior deliberately and test it.
- Start with in-app upcoming/overdue reminders and copyable messaging when external messaging APIs are not configured.
- Never show a notification as sent unless the configured provider confirms success; record delivery results if integration is added.

## 12. Coding, validation, and error handling

- Use TypeScript strict mode. Define domain and query types; avoid `any` and unsafe casts.
- Validate all untrusted input at the server boundary using Zod or an equivalent explicit schema. Client-side validation improves UX but is not a security boundary.
- Validate IDs and check the caller's permissions before fetching or mutating protected records.
- Return safe, actionable user-facing errors. Do not leak stack traces, SQL, secrets, or internal identifiers unnecessarily.
- Handle expected errors explicitly; do not swallow errors or return success-shaped fallback data.
- Keep environment configuration documented and validated. Development defaults must not silently become production credentials.
- Use transactions for multi-record operations that must be atomic. Prefer database constraints for invariants shared across code paths.
- Add audit events for important actions: membership/security changes, job status and assignment changes, contract changes, document issue/cancel events, and payment recording/void events.
- If the chosen Supabase client doesn't support a required transaction safely, implement a narrow database function/RPC or other reviewed server-side strategy rather than assuming several independent writes are atomic.

## 13. Testing and required verification

For each feature, add tests appropriate to its risk:

- Unit tests for validation, permission rules, status transitions, recurrence calculations, formatting, and financial calculations.
- Integration/database tests for constraints, transactional workflows, and RLS.
- End-to-end tests for the core owner → dispatcher → technician → invoice journey as tooling permits.
- Negative tests for unauthenticated access, unauthorized roles, cross-tenant IDs, direct route requests, and private file access.

At minimum, run applicable commands defined in `package.json`, normally including:

- lint
- TypeScript type check
- unit tests
- production build
- selected end-to-end tests where browser/database prerequisites are available

Do not invent package scripts. Inspect `package.json` and report the actual commands used. If a check cannot run, state why; do not mark it as passed.

Security tests must include two different organizations and more than one role. Test both allowed and denied access. UI-only tests are not sufficient evidence of RLS correctness.

## 14. Environment variables and secrets

Use `.env.local` for local private configuration and ensure it is ignored by Git. Maintain a `.env.example` with placeholder names only.

The initial client-side Supabase configuration may use:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Only add server-only variables when a specific implemented feature requires them, and document their purpose. Never put secrets in `NEXT_PUBLIC_` variables. Never commit real keys, database passwords, tokens, production customer data, or private credentials.

Do not ask the user to paste secrets into source files or chat. If credentials are required, explain how the user can configure them locally or in the provider's secret settings.

## 15. Database migration discipline

- Every schema or policy change must be captured in a new ordered migration under `supabase/migrations/`.
- Do not edit an already-applied migration to change deployed schema history; create a forward migration instead.
- Review generated SQL before applying it to a shared or production environment.
- Never reset a production database or run destructive SQL without explicit approval and a verified backup/recovery plan.
- Make migrations safe, deterministic, and appropriately idempotent where practical.
- Include indexes for common organization-scoped filters, foreign-key joins, dates, statuses, and unique business numbers where query patterns justify them.
- Keep types synchronized with the actual schema. Do not assume generated types prove migrations ran successfully.
- Clearly report which migrations were created, reviewed, and actually applied.

## 16. External integrations

The MVP does not require live WhatsApp, SMS, email-marketing, or payment gateway integrations. Keep future integrations behind well-defined server-side modules and explicit configuration.

- Use official provider documentation and supported APIs when integration work is approved.
- Keep provider secrets server-side.
- Include provider error handling, rate limits, retries, duplicate prevention, and delivery-status logging where relevant.
- Do not simulate a successful external action when it was not performed.
- Prefer manually copyable WhatsApp messages or in-app reminders as the initial fallback.

## 17. Git and release discipline

- Check `git status` before edits and keep unrelated user changes intact.
- Use small commits or clear checkpoints after each working milestone when Git is available.
- Never force-push, rewrite shared history, or discard uncommitted work without explicit permission.
- Keep secrets, `.env.local`, local build output, and real customer data out of version control.
- Do not deploy to production, change DNS, or run destructive data operations without explicit user approval.
- Before release, verify environment variables, Auth redirect URLs, RLS, Storage policies, migrations, build, and critical user journeys.

## 18. Definition of done

A task is done only when all applicable items are satisfied:

1. The feature fulfills the requested behavior and follows existing architecture.
2. Relevant UI states and validation are implemented.
3. Authorization is enforced server-side and by RLS where data access is involved.
4. Database changes are captured in reviewed migrations.
5. Tests cover the important success path and failure/permission cases.
6. Lint, type checks, and build pass, or any blocker is explicitly documented.
7. No fake data, fake success, placeholder secrets, or unexplained inert primary controls have been introduced.
8. Documentation is updated when schema, setup, permissions, or workflows change.
9. The final summary states changed files, checks actually run and their results, migrations applied versus pending, and remaining manual steps.

## 19. Useful initial documentation to maintain

Keep these current as the application evolves:

- `docs/product-spec.md` — target users, scope, workflows, and MVP boundaries.
- `docs/architecture.md` — routes, components, server/client boundaries, data flow, and integrations.
- `docs/database-plan.md` — entities, relationships, constraints, indexes, and migration notes.
- `docs/security-checklist.md` — RLS coverage, role matrix, Storage security, and verification evidence.
- `docs/deployment.md` — environment setup, migrations, Supabase Auth, Vercel deployment, backup, and recovery.

If a document does not exist, create it when the related implementation milestone begins. Do not fabricate verification evidence or claim a policy is secure without testing it.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
