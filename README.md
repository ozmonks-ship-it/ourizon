# Ourizon Web App (Prototype)

React prototype for **Ourizon**, a budget tracking tool. This build implements the **Assets** screen only — other navigation items are visible but inactive.

Based on the design prototype in [`/prototype`](../prototype).

## Run locally

```bash
npm install
npm run dev
```

## Features (Assets)

- Empty state for new users (add your first asset)
- Asset groups (Cash, Stocks, Crypto, Property, Super)
- Batch balance updates saved as timestamped snapshots
- Net worth chart built from saved snapshots (hidden until the first snapshot)
- Add and delete assets (persisted in Supabase)

## Database

Apply the SQL migrations in [`supabase/migrations/`](supabase/migrations/) via the Supabase Dashboard (see [`supabase/README.md`](supabase/README.md)). The Supabase CLI is optional.

Requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`.

## Scope

| Screen   | Status    |
|----------|-----------|
| Home     | Inactive  |
| Assets   | Active    |
| Log      | Inactive  |
| Forecast | Inactive  |
| Family   | Inactive  |
