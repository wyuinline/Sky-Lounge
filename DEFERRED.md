# Deferred work

Everything consciously postponed, to be picked up **after Phase 5**. Nothing
here is forgotten or blocked — each item was a deliberate decision to keep
moving, with the reason recorded so the decision can be re-judged later.

Roadmap phases are in the [parity roadmap](https://claude.ai/code/artifact/958f6078-45d2-49d0-b43d-839ac1d6b591);
the competitive picture behind them is in the [gap analysis](https://claude.ai/code/artifact/7b0535ca-f1cb-4eb7-be35-0642dde99fdd).

Last updated: 26 August 2026, after Phase 3.

---

## From the roadmap

### Named inspection plans — Phase 2, workstream 6
The only Phase 2 item not built. Reusable service schedules per aircraft
model, triggered on hours, cycles or calendar — whichever falls first — with
the next due date derived per plan item rather than a single interval per
airframe.

Needs a `plan_item_id` link on `maintenance_records` and a view computing, for
each airframe and plan item, the last completion and the next due point.
Deferred because it is the largest remaining piece of Phase 2 and was better
started fresh than appended to a long stretch of work.

**Effort:** ~1–2 weeks. **Blocks:** nothing.

### Operations manual structure — Phase 3, workstream 1
The document module already delivers the substance: categories, versions,
approval status, review cycles, and the evidence pack section that lists every
procedure at its current revision. What is missing is only *manual structure* —
grouping documents into a numbered manual with sections and a contents page.

Judged not worth a separate model while the operation runs on a handful of
SOPs. Revisit if a reviewer asks for a single bound manual rather than a
document set.

**Effort:** ~3 days. **Blocks:** nothing.

---

## Interface consistency

### Dropdowns show raw stored values
Base UI's `SelectValue` renders the stored value rather than the option label,
so triggers read `airworthy`, `all`, `advanced_operations` instead of
"Airworthy", "All statuses", "Advanced Operations".

Fixed in the newer dialogs by passing a function child:

```tsx
<SelectValue>{(v) => labelForCategory(v as DocumentCategory)}</SelectValue>
```

Remaining bare `<SelectValue />` instances: find with `grep -rn "<SelectValue />" src/`.
Label maps already exist — `roleLabel`, `labelForCategory`,
`certificateTypeLabel`, `reviewCycleLabel`, `batteryStatusLabel`,
`componentStatusLabel`, `projectStatusLabel`.

**Effort:** an hour. Spread across ~8 files, which is why it was not folded
into a feature commit.

### Unused type imports
About a dozen ESLint warnings, all `'X' is defined but never used` on type
imports left behind when `.returns<>()` casts were removed. Zero errors — the
build is clean. Tidy in one pass rather than piecemeal.

---

## Known limits, deliberately accepted

### PDF is browser-print, not server-generated
Reports are laid out for paper and produce excellent output through
"Save as PDF". There is no server-side generator, so the portal cannot attach
a PDF to an email or generate one on a schedule. Adding `@react-pdf/renderer`
or a headless browser would be the fix, at the cost of a heavy dependency.
Revisit if scheduled or emailed reports are wanted.

### Dark mode is unreachable and unverified
Tokens are written to the same standard as light, but nothing in the app
toggles a theme and the preview environment pins `class="light"`, so dark has
never been rendered. If dark mode is ever offered, budget a pass to check it
rather than assuming it works.

### No visual verification
The Browser pane in this development environment does not composite frames, so
screenshots time out. Everything built has been verified by measurement —
computed styles, contrast ratios, DOM inspection, generated CSS rules, real
code paths driven with synthetic events — but **not by looking at it**. Worth a
human pass over the newer pages: batteries, components, projects, checklists,
reports.

---

## Environment and cutover

Tracked in full at the v2 database reset. Repeated here so this file is the one
place to look:

- **Rotate the Supabase database password** — the one used during the build was
  pasted into chat on 17 August 2026 and should be considered exposed.
- **Set `SUPABASE_SECRET_KEY` in Vercel** — the weekly reminders cron and the
  user-invite flow both need it. Invitations return a clear message rather than
  failing silently until it is set.
- **Accept the Resend marketplace terms** —
  `https://vercel.com/sky-lounge/~/integrations/accept-terms/resend?source=cli`.
  Blocks reminder emails only; in-app reminders work without it.
- **Reset and seed the database** for the deliverable, with the real airframes,
  pilots and a baseline service record so hours-based intervals have a start
  point.
- **Drop unused enum values** left from the pre-v2 schema.
- **Add Supabase redirect URLs** — `https://uav-lounge.vercel.app/**` and
  `http://localhost:3000/**` under Auth → URL Configuration, or invite and
  password-reset links fall back to the Site URL.

---

## Still ahead on the roadmap

Not deferred — simply not reached yet.

| Phase | Scope |
|---|---|
| 3 | RPOC and safety-management: operations manual, hazard register, closed safety loop, authorisation matrix, evidence pack |
| 4 | Flight data: log ingestion, telemetry store, track map, battery cell analytics. DJI ingestion needs a two-week spike before committing |
| 5 | Field capture (offline PWA), SharePoint integration, read API |

**One decision needed before Phase 3 hardens more schema:** whether this stays
an internal tool or becomes a product sold to other operators. Retrofitting
`organisation_id` into every table and RLS policy is far more expensive than
designing for it.
