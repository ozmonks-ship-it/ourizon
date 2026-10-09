# Ourizon UX audit (October 2026)

UX and accessibility audit of Ourizon. It checks the app against WCAG 2.2 AA and how easy it is to understand for someone without finance know-how.

- **Full report with annotated screenshots:** https://claude.ai/artifact/1M2eNy34UWiyKhnCakc2MG
- **Interactive prototype with the fixes applied:** https://claude.ai/artifact/Np72W1fo2eAmbYKopT4M2A (source: [`prototype.html`](prototype.html))
- **Annotated screenshots:** [`screenshots/`](screenshots/)

31 findings: 12 high, 12 medium, 7 low.

## Fix these five first

1. **A1 – Dialogs ignore the dark theme.** `App.tsx` puts `dark` on a wrapper `div`, but Radix portals mount on `<body>`, so every dialog and select renders in the light palette (axe finds contrast failures at 4.07:1). Put `dark` on `<html>`.
2. **A2 – Focus is nearly invisible.** `outline-ring/50` is 2.38:1, and many inputs set `focus:outline-none`. Use one global 3px `:focus-visible` ring.
3. **A7 – One-tap permanent deletes.** Assets, buckets, budgets (including all their expenses), expenses and household members are deleted from 24–26px bin icons, with no confirmation and no undo.
4. **U1 / U6 – Jargon and unexplained numbers.** "Snapshot", "parent expense buckets", "unallocated". The forecast has no legend and doesn't state its assumption (monthly saving × months, no growth), and the "Today" label overlaps the axis.
5. **U3 / A5 – Buckets month state is unclear.** Carried-over values are shown as 2.9:1 placeholders, there's no saved/unsaved status, and the button just says "Save".

## Measurements

| Element | Measured | Needs |
|---|---|---|
| Placeholder / carried-over values | 2.90:1 | 4.5:1 |
| Focus outline | 2.38:1 | 3:1 |
| Balance input against card | 1.28:1 | 3:1 |
| "Add item" link | 66 × 16px | ≥ 24px (44px recommended) |
| Edit / delete icons | 24–26px | 44px recommended |

## Roadmap

- **Quick wins (about 1 day):** A1 dark class on `<html>`, A2 focus ring, A3 44px targets, A15 `inputMode="decimal"`, A9 live regions, U6 chart label fixes.
- **Next (about 1 week):** A7 confirm/undo, A8 inline validation, A6 balance history list, U3/A5 month status and real pre-filled values, U5 over-income warning, A4/A14 input borders and 14px minimum text.
- **Then (about 2 weeks):** U1 plain-language renames, U2 first-run checklist, Home summary, forecast legend and table, SVG icons instead of emoji, then test with 5 users.

## Method

The real app was run against an in-memory stand-in for Supabase, seeded with a realistic household plus an empty account. Each screen was captured in headless Chromium at 390 × 844 and checked with axe-core 4.10 (WCAG 2.2 A/AA). Contrast was calculated from `src/styles/theme.css` tokens, and tap targets were measured in the DOM. Not covered: live Google sign-in, the PWA install flow on devices, and testing with real users.
