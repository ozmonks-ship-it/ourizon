# Supabase database

## Option A — Supabase Dashboard (no CLI required)

This is the easiest approach if `supabase` is not installed.

1. Open your project at [supabase.com/dashboard](https://supabase.com/dashboard)
2. Go to **SQL Editor → New query**
3. Paste and run `migrations/20250607000000_assets.sql`
4. Paste and run `migrations/20250607100000_snapshot_edit.sql`
5. Paste and run `migrations/20250608100000_collaboration.sql`
6. Paste and run `migrations/20250608110000_fix_collaboration_rls.sql`
7. Paste and run `migrations/20250609100000_buckets.sql`

Run them in that order. If you already applied earlier migrations, only run the ones you have not applied yet.

## Option B — Supabase CLI

The CLI is not installed by default. Install it first, then link your project.

### Install (pick one)

**macOS (Homebrew):**
```bash
brew install supabase/tap/supabase
```

**npm (project-local, no global install):**
```bash
cd react-web-app
npm install supabase --save-dev
```

Then use `npx supabase` instead of `supabase`.

### Link and push

```bash
cd react-web-app
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

`YOUR_PROJECT_REF` is the ID in your Supabase project URL: `https://supabase.com/dashboard/project/YOUR_PROJECT_REF`.

## Schema

| Table | Purpose |
|-------|---------|
| `profiles` | Google display name and avatar per user |
| `budget_collaborators` | Email invites and active collaborators for a shared budget |
| `assets` | User-owned accounts/investments (name, institution, type) |
| `balance_snapshots` | Net worth at a point in time (`recorded_at`, `total_worth`) |
| `balance_snapshot_entries` | Balance per asset within a snapshot |
| `buckets` | Income/expense bucket definitions (amount or % allocation) |
| `monthly_logs` | One log per calendar month (`net_income`, year, month) |
| `monthly_log_entries` | Per-bucket values and resolved amounts for a monthly log |

Saving balances calls the `save_balance_snapshot(jsonb)` RPC, which validates that every asset has an entry, stores the total, and writes all per-asset balances atomically.

Editing an existing snapshot uses `update_balance_snapshot(uuid, jsonb)`, which replaces entries and recalculates `total_worth` while keeping `recorded_at`. Deleting a snapshot cascades to its entries via RLS.

Row level security restricts financial data to budget members via `can_access_budget()`. Collaborators are invited by email in the app (no email is sent); when the invitee signs in with Google using that address, they get full access to the owner's assets and snapshots.
