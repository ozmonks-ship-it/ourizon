# Ourizon Web App (Prototype)

React prototype for **Ourizon**, a budget tracking tool. It covers net worth, monthly planning and occasion budgets for a household.

Based on the design prototype in [`/prototype`](../prototype).

## Run locally

```bash
npm install
npm run dev
```

## Screens

- **Home** – first-run checklist for new users; then net worth with its monthly change, a forecast (with legend, assumptions and a table view), what you own, this month's plan and budgets that need attention.
- **Assets** – accounts grouped by type, "Update balances" to record all balances at once, and a balance history list to fix or delete past records.
- **Monthly plan** – income and spending categories for a month, pre-filled from the last saved month, with a summary of what's left to save.
- **Budgets** – money set aside for an occasion, with expenses logged against it.
- **Household** – add people by email to share everything.

## Accessibility

The app targets WCAG 2.2 AA. Keep to these conventions when adding UI:

- Buttons and inputs are at least 44 × 44px (`iconBtn`, `btnPrimary` etc. in `src/app/components/ui/buttonStyles.ts`).
- Don't remove focus outlines; a global `:focus-visible` style lives in `src/styles/theme.css`.
- Money fields use `MoneyInput`; forms show inline errors with `Field` / `FieldError` (`src/app/components/ui/kit.tsx`).
- Deletes go through `ConfirmDialog`; confirmations use `useToast()` so screen readers hear them.
- Show state with words and an icon (`StatusChip`), not colour alone.
- Don't use the full-page `PageLoader` inside the app; it's only for start-up. Data hooks cache through `src/app/lib/dataCache.ts` and refresh in the background (`trackBusy` drives the bar under the header). A screen's first load renders `ScreenSkeleton`, and content that's being replaced stays visible with `.is-stale` and `inert`.

See [`docs/ux-audit/`](docs/ux-audit/) for the audit these follow from.

## Database

Apply the SQL migrations in [`supabase/migrations/`](supabase/migrations/) via the Supabase Dashboard (see [`supabase/README.md`](supabase/README.md)). The Supabase CLI is optional.

Requires `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`.
