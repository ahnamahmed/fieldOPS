# FieldOps BD — Deployment & Operations Guide

## 1. Hosting Environment
- **Platform**: Vercel (Edge network, Next.js optimized).
- **Database**: Supabase PostgreSQL 17 (ap-northeast-1).
- **Storage**: Supabase Private S3-compatible storage.

## 2. Environment Variables Configuration
In the Vercel Project Settings or local `.env.local`:

| Variable | Description | Exposure |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project API URL | Public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon / Publishable API key | Public |
| `NEXT_PUBLIC_APP_URL` | Base application URL (e.g. `https://fieldops.bd` or `http://localhost:3000`) | Public |

## 3. Database Migration Execution
All migrations reside under `supabase/migrations/` and follow timestamp versioning:
- `20261012000001_initial_schema.sql`

To apply future migrations:
1. Review generated SQL carefully.
2. Apply using Supabase MCP tool or Supabase CLI (`supabase db push`).
3. Re-generate TypeScript types via `generate_typescript_types` to keep `src/types/database.types.ts` in sync.

## 4. Verification Commands
- Lint check: `npm run lint`
- Type & Build check: `npm run build`
- Unit test suite: `npm test`
