# FieldOps BD — System Architecture

## 1. High-Level Architecture Overview
FieldOps BD is built with Next.js App Router (version 16+), React 19, TypeScript strict mode, and Tailwind CSS. Data persistence, authentication, and private file storage are managed by Supabase (PostgreSQL 17).

## 2. Server & Client Boundaries
- **Server Components (Default)**: Used for layout shells, initial data queries, and server-side authorization checks.
- **Server Actions**: Used for transactional mutations, validating input with Zod schemas, checking session cookies, and executing queries with typed Supabase clients.
- **Client Components**: Isolated to interactive UI elements (interactive data filters, signature pads, camera capture components, modals, and forms).
- **Session Management**: Cookie-based sessions handled via `@supabase/ssr` with Next.js middleware refreshing tokens across requests.

## 3. Directory Layout
- `src/app/`: Route segments, layouts, and route handlers.
- `src/components/`: Reusable accessible UI components (buttons, badges, modals, data tables).
- `src/lib/`: Shared utilities, formatters, permissions, and Supabase client initializers.
- `src/types/`: Database schema types generated directly from PostgreSQL.
- `supabase/migrations/`: Ordered, declarative SQL migrations.
- `tests/unit/`: Vitest test suites for validation, permission rules, and formatters.
