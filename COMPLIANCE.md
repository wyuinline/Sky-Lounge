# RPAS compliance module — status against the plan

Tracks `sky-lounge-rpas-compliance-plan.md` (v1.0, 2026-09-03) section by
section. The plan is an engineering specification; this file says what of it
exists in the portal today.

**This module records compliance. It is not a determination that you are
compliant.** The Accountable Executive and Chief Pilot still have to confirm
the mapping, exactly as the plan's own preamble says.

Last updated: 3 September 2026.

---

## §1 Design principles

| Principle | State |
|---|---|
| Three gates on every assignment | **Built** — `src/lib/readiness.ts`, 39 tests |
| Every record has a regulatory anchor | **Built** — `car_reference` on every new table |
| Nothing expires silently | **Partial** — recency and training derive expiries; the alert engine does not yet scan them |
| Immutable audit trail | **Not built** — no append-only enforcement, no audit log |
| Retention floors | **Not built** |
| Privacy | **Built** — restricted fields in their own table, own permission area, read log |

## §2 Data model

| Section | Table | State |
|---|---|---|
| 2.1 | `pilots` + `pilot_personal_data` | **Built** — legal names, employment, RPAS roles, supervisor, onboarding status; DOB and work authorization held separately behind the `personal_data` area |
| 2.2 | `pilot_certificates` | **Built** — no expiry column, deliberately |
| 2.3 | `pilot_exams` | **Built** |
| 2.4 | `flight_reviews` | **Built** |
| 2.5 | `ground_school_records` | **Built** |
| 2.6 | `recency_records` | **Built** — `expires_on` generated as +24 months |
| 2.7 | `foreign_qualifications` | **Built** — zero credit, stated in the table comment |
| 2.8 | `training_completions` | **Built** — evaluator recorded separately from deliverer |
| 2.9 | `training_modules` | **Built** — 16 modules seeded per operator from AC 901-002 App. A §11 |
| 2.9 | `training_effectiveness_reviews` | **Built** — the annual 901.219(2)(c) obligation as its own object |
| 2.10 | `uavs` extensions | **Built** — category, class, propulsion, registered owner, marking verified, Remote ID fields |
| 2.11 | `aircraft_declarations` + `declaration_requirements` | **Built** — all eight rows of the matrix, and the gate that enforces it |
| 2.12 | payloads | **Partial** — `components` covers them; no calibration due date |
| 2.13 | `type_competencies` | **Built** — airframe, payload, GCS, RTK, software |
| 2.14 | `pilot_authorisations` | **Partial** — per pilot × operation with expiry. Not aircraft-scoped, not versioned, not signed |
| 2.15 | `flight_logs` | **Built** before this module, plus `proximity_to_people` |
| 2.16 | `maintenance_records` | **Partial** — no deferrals, no PRM sign-off, no retention floor |
| 2.17 | sites / site surveys | **Partial** — `projects` carries a site; no survey record |
| 2.17 | occurrences | **Built** as incidents + hazard register + audit findings |
| 2.17 | documents | **Built**, versioned — **no acknowledgements table** |
| 2.17 | batteries | **Built** before this module |

## §3 Rules engine

**Built and tested; partly wired.**

`evaluateReadiness()` runs eleven predicates across the three gates plus the
aircraft, returns `{pass, reason, carReference, remediation, severity}` for
each, and never short-circuits — someone blocked on four things sees four
things. Advisories (supervision required, unverified certificate, unverified
marking, unacknowledged documents) are separated from blocking failures.

`loadReadiness()` gathers the records and calls it.

**What is wired into a real gate today:** the aircraft declaration check, on
flight-request submission *and* again on approval. The rest of the engine runs
but is not yet the thing that refuses a flight — the existing airworthiness and
authorisation gates still do that.

One predicate is knowingly weaker than it looks: `coversAircraft` always
passes, because authorisations are per operation rather than per aircraft.
Stated in the code at the point it happens.

## §4 Screens

Dashboard, fleet, pilots, flight ops, safety, documents, reports and the RPOC
evidence pack existed before this module. **Not built:** any screen for the new
record tables. Certificates, exams, flight reviews, recency, training
completions, type competencies and aircraft declarations can be enforced but
not yet entered through the interface.

## §5 Onboarding workflow

**Not built.** `onboarding_status` exists on `pilots` as an enum covering the
six phases; the Kanban, the task templates and the Phase 6 blocking rule do not.

## §6 Remote ID

**Built as specified.** `remote_id_capable`, `remote_id_method` and
`remote_id_serial` on `uavs`, with a column comment saying never to gate on
them. `regulatory_watch` exists and is seeded with NPA 2026-005.

## §7 Alerting & reporting

**Partial.** The weekly reminder job scans certificates, training records,
documents, maintenance and audits. It does **not** yet scan the new tables:
recency records, training completions, type competencies, work-authorization
expiry, or the annual effectiveness review.

The RPOC evidence pack exists with nine sections. The full inspection bundle in
§7 is broader than that.

## §8 Roles

The permission matrix predates this module and is per-operator. `personal_data`
was added as its own area and is **closed to every role except system
administrator by default** — an operator turns it on deliberately.

Separation of duties (§8, AC 901-002 App. A §11(4)) is recorded — evaluator is
a separate column from deliverer — but not enforced.

---

## What to build next, in order

1. **Screens for the record tables.** Everything in §2 is enforced and can only
   be populated by SQL. This is the gap that stops the module being usable.
2. **Wire the full engine** into flight requests and logs, replacing the two
   ad-hoc gates with the eleven-predicate verdict.
3. **Aircraft-scoped, versioned, signed authorizations** (§2.14) — closes the
   one predicate that currently always passes.
4. **Document acknowledgements** (§2.17) — the last advisory that has no data
   behind it.
5. **Extend the alert scan** to the new expiry sources (§7).
6. **Onboarding Kanban** (§5), then the inspection bundle (§7).

## Open questions from §11

Answered: multi-tenancy (§11.5) — the portal is multi-tenant as of 27 August.

Still open, and they change what gets built:

1. Are you conducting Level 1 Complex operations today, or is the RPOC held for
   future BVLOS work?
2. Do you operate any medium RPA over 25 kg? The declaration matrix is seeded
   for both, but it changes which half matters.
3. Who signs the pilot authorization — Chief Pilot, RPAS Manager, or the AE?
4. What is your minimum supervised-flight count before unrestricted release?
