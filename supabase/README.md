# Supabase database

Apply the migration in the Supabase SQL editor or via the CLI:

```bash
supabase db push
```

Or paste the contents of `migrations/20250607000000_assets.sql` into **Supabase → SQL → New query**.

## Schema

| Table | Purpose |
|-------|---------|
| `assets` | User-owned accounts/investments (name, institution, type) |
| `balance_snapshots` | Net worth at a point in time (`recorded_at`, `total_worth`) |
| `balance_snapshot_entries` | Balance per asset within a snapshot |

Saving balances calls the `save_balance_snapshot(jsonb)` RPC, which validates that every asset has an entry, stores the total, and writes all per-asset balances atomically.

Editing an existing snapshot uses `update_balance_snapshot(uuid, jsonb)`, which replaces entries and recalculates `total_worth` while keeping `recorded_at`. Deleting a snapshot cascades to its entries via RLS.

Row level security restricts all tables to `auth.uid()`.
