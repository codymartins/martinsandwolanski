# Martins & Wolanski Capital: Dashboard

Revenue, expenses, profit and owner reimbursements across all M&W ventures.
See [docs/SPEC.md](docs/SPEC.md) for the build spec.

Stack: Next.js (App Router) on Vercel, Supabase Postgres + Auth.

## Setup

1. Create a Supabase project. In the SQL editor, run these in order:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_claim_owner.sql`
   - `supabase/seed.sql` (put each owner's real login email in first)
2. In Supabase > Authentication > URL Configuration, set the Site URL to your Vercel URL and add
   `https://<your-domain>/auth/callback` to Redirect URLs.
3. Copy `.env.example` to `.env.local` and fill in the Supabase URL and anon key.
4. `npm install && npm run dev`
5. On Vercel, import the repo and add the same two env vars.

Login is a magic link. Only emails listed in `owners` get in; anyone else is signed straight back out,
and row-level security blocks them from reading anything regardless.

## How the money is recorded

- Amounts are integer cents, signed from M&W's point of view (+ in, − out).
- A purchase on a personal card is an M&W expense that adds to what M&W owes that owner.
- A reimbursement pays that balance down and does not affect profit.
- Transfers, contributions and distributions are left out of P&L.
