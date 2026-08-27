# Deferred work

Everything consciously postponed. Each item was a deliberate decision to keep
moving, with the reason recorded so the decision can be re-judged later.

Roadmap phases are in the [parity roadmap](https://claude.ai/code/artifact/958f6078-45d2-49d0-b43d-839ac1d6b591);
the competitive picture behind them is in the [gap analysis](https://claude.ai/code/artifact/7b0535ca-f1cb-4eb7-be35-0642dde99fdd).

Last updated: 26 August 2026, after Phase 5 and the backlog clear-out.

---

## Cleared

All five roadmap phases have shipped, and every item that was parked behind
them has been picked up.

| Was deferred | Landed as |
|---|---|
| Named inspection plans (Phase 2, workstream 6) | `inspection_plans`, three clocks per item, `inspection_plan_status` view; critical items hold the aircraft at the airworthiness gate |
| Operations manual structure (Phase 3, workstream 1) | `manuals` + `manual_sections`, numbers derived from position, contents page, printable manual, RPOC evidence-pack section |
| Dropdowns showing raw stored values | One `OptionSelect` over shared option lists; 14 selects across 9 files |
| Unused type imports | Cleared, along with four orphaned row types. ESLint is now clean — zero errors, zero warnings |
| Offline field capture (Phase 5) | IndexedDB queue, PWA shell, service worker, flush on reconnect |
| Read API and webhooks (Phase 5) | Hashed API keys, `/api/v1`, signed webhook deliveries with a delivery log |
| SharePoint (Phase 5) | One-way document mirror via Microsoft Graph — **built but unverified**, see below |

A bug found on the way, worth naming: `flight_hours_at_service` was read in
four places and written in none, so "hours since service" silently meant
"hours since the airframe entered service" and never reset on a completed
service. Completing a record now stamps both hours and cycles.

---

## Built but not verified end to end

### SharePoint mirror
Every Graph call is written and gated on configuration, and the pure half —
config reading, path sanitising, chunk ranges, token freshness — is tested. But
this deployment has no Azure app registration, so **nothing has been run
against a live tenant**.

To finish: register an application in Azure with the `Sites.Selected`
application permission, grant it write access to the target site, and set
`AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`,
`SHAREPOINT_SITE_ID` and `SHAREPOINT_DRIVE_ID`. The Integrations page has a
"Check connection" button that proves all five without leaving a file behind.

### Read API and webhooks against real data
The authentication paths were exercised (no key → 401, malformed key → 401,
unknown resource → 404), but a working key could not be minted locally because
`SUPABASE_SECRET_KEY` is not set here. Both are ready the moment it is.

---

## Known limits, deliberately accepted

### PDF is browser-print, not server-generated
Reports and manuals are laid out for paper and produce good output through
"Save as PDF". There is no server-side generator, so the portal cannot attach a
PDF to an email or generate one on a schedule. Adding `@react-pdf/renderer` or
a headless browser would be the fix, at the cost of a heavy dependency.
Revisit if scheduled or emailed reports are wanted.

### Dark mode is unreachable and unverified
Tokens are written to the same standard as light, but nothing in the app
toggles a theme and the preview environment pins `class="light"`, so dark has
never been rendered. If dark mode is ever offered, budget a pass to check it
rather than assuming it works.

### No visual verification
The Browser pane in this development environment does not composite frames, so
screenshots time out. Everything has been verified by measurement — computed
styles, contrast ratios, DOM inspection, generated CSS, real code paths driven
with synthetic events, and SQL run against the live database inside a
transaction that was rolled back. But **not by looking at it**. Worth a human
pass over the newer pages: batteries, components, projects, checklists,
reports, integrations, inspection plans, manuals.

---

## Environment and cutover — needs your hands

None of these can be done from here.

- **Rotate the Supabase database password.** The one used during the build was
  pasted into chat on 17 August 2026 and should be considered exposed.
- **Set `SUPABASE_SECRET_KEY` in Vercel.** The weekly reminders cron, the
  user-invite flow, the read API and webhook delivery all need it. Each fails
  with a clear message rather than silently until it is set.
- **Accept the Resend marketplace terms** —
  `https://vercel.com/sky-lounge/~/integrations/accept-terms/resend?source=cli`.
  Blocks reminder emails only; in-app reminders work without it.
- **Add Supabase redirect URLs** — `https://uav-lounge.vercel.app/**` and
  `http://localhost:3000/**` under Auth → URL Configuration, or invite and
  password-reset links fall back to the Site URL.
- **Reset and seed the database** for the deliverable, with the real airframes,
  pilots, a baseline service record so hours-based intervals have a start
  point, and at least one inspection plan.
- **Drop unused enum values** left from the pre-v2 schema.

---

## One decision still open

Whether this stays an internal tool or becomes a product sold to other
operators. Retrofitting `organisation_id` into every table and RLS policy is
far more expensive than designing for it, and the schema has grown
considerably since the question was first raised.
