# Sky Lounge — RPAS Pilot & Asset Compliance Module
## Implementation Plan (Transport Canada CARs Part IX, RPOC holder)

**Version:** 1.0
**Date:** 2026-09-03
**Scope:** Pilot qualification tracking, aircraft/asset tracking, company training & authorization records, onboarding workflows (including foreign-national hires), and inspection-ready export.

**Regulatory basis:** CARs Part IX (as amended by SOR/2025-70, in force 2025-04-01), Standard 921, Standard 922, AC 901-002 (Issue 2, 2025-11-04), TP 15263, TP 15530.

> This plan is an engineering specification, not legal advice. Field names map to regulatory citations so an inspector can trace each record back to the CAR that requires it. Confirm the mapping with your Accountable Executive / Chief Pilot before go-live.

---

## 1. Design principles

1. **Certificate ≠ competency.** The system must model *three independent gates* on every flight assignment:
   - **Gate A — Transport Canada credential** (pilot certificate + recency)
   - **Gate B — Company authorization** (Ops Manual, SMS, emergency, RPOC training under CAR 901.219)
   - **Gate C — Aircraft/payload type competency** (per-airframe, per-payload sign-off)

   A pilot is "green" only when all three gates pass for the *specific aircraft and operation type* being assigned. This is the single most important rule in the app.

2. **Every record has a regulatory anchor.** Each table stores a `car_reference` so reports can be filtered as "everything CAR 901.223 requires."

3. **Nothing expires silently.** Every date-bearing record has a computed `expires_on` and feeds one alerting engine.

4. **Immutable audit trail.** Sign-offs, authorizations and record edits are append-only. TC inspections and post-incident investigations depend on this.

5. **Retention floors, not ceilings.** Default retention: 2 years for technical/safety records (AC 901-002 §5.7(2), §8.2(3) of Appendix C); 12 months after last entry for maintenance personnel records (AC 901-002 App. B §6.3(6)); 24 months for recency evidence. Keep longer where practical — never auto-purge below the floor.

6. **Privacy.** DOB, immigration/work-authorization status and passport-linked identity data are sensitive personal information under PIPEDA. Store the minimum necessary, encrypt at rest, restrict to HR + Accountable Executive roles, and log every read.

---

## 2. Data model

### 2.1 `pilots`
| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `legal_first_name`, `legal_middle_names`, `legal_last_name` | text | must match TC certificate exactly |
| `preferred_name` | text | |
| `date_of_birth` | date | restricted field — drives age gates (16 Advanced / 18 L1 Complex) |
| `employment_status` | enum | employee, contractor, agent, representative |
| `position` | text | |
| `rpas_role` | enum[] | PIC, Visual Observer, Chief Pilot, Training Pilot, PRM, Accountable Executive |
| `reports_to_id` | uuid → pilots | supervisor / operational manager |
| `work_authorization_status` | enum | citizen, PR, work_permit, other — **restricted** |
| `work_authorization_expires_on` | date | nullable; alerting source |
| `is_foreign_national` | bool | derived; drives the foreign-hire workflow |
| `onboarding_status` | enum | phase_1 … phase_6, released, suspended |
| `status` | enum | active, inactive, suspended, terminated |

### 2.2 `pilot_certificates` (Gate A)
| Field | Type | Notes |
|---|---|---|
| `pilot_id` | uuid | |
| `certificate_level` | enum | basic, advanced, level_1_complex |
| `certificate_number` | text | |
| `issued_on` | date | certificates do **not** expire |
| `document_url` | file | PDF from the Drone Management Portal |
| `car_reference` | text | 901.55 / 901.64 / 901.90 |
| `verified_by`, `verified_on` | uuid, date | company verification of authenticity |

### 2.3 `pilot_exams`
`pilot_id`, `exam_type` (small_basic, small_advanced, level_1_complex), `passed_on`, `score`, `document_url`.
L1 Complex requires ≥80% (Standard 921.07). Advanced exam is a prerequisite to the L1C exam.

### 2.4 `flight_reviews`
`pilot_id`, `review_type` (advanced, level_1_complex), `completed_on`, `reviewer_name`, `reviewer_certificate_no`, `flight_reviewer_rating_ref`, `result`, `document_url`.
**Rule:** for certificate application, the flight review must have been completed within the **12 months before the date of application** (CAR 901.64(c)). Flag stale reviews before a certificate application is submitted.

### 2.5 `ground_school_records`
`pilot_id`, `provider_name`, `provider_type` (flight_school), `hours` (≥20 for L1C), `syllabus_ref` (TP 15530), `completed_on`, `certificate_url`.

### 2.6 `recency_records` (Gate A, rolling)
| Field | Notes |
|---|---|
| `pilot_id` | |
| `activity_type` | enum: exam_retake, flight_review, tc_endorsed_seminar, recurrent_training_program, self_paced_study |
| `completed_on` | |
| `expires_on` | computed = `completed_on + 24 months` |
| `evidence_url` | e.g. the completed TC self-paced study questionnaire |
| `car_reference` | 901.56 / 901.65 / 901.91 (and 901.93 where L1C applies) |

**Rule:** a pilot must have a non-expired recency record *and* be carrying certificate + recency proof in flight (CAR 901.57, 901.66). Block flight assignment when expired.

### 2.7 `foreign_qualifications` (informational only)
`pilot_id`, `issuing_state`, `authority`, `credential_name`, `credential_number`, `issued_on`, `expires_on`, `logged_hours`, `aircraft_types_flown`, `document_url`, `translation_url`, `verification_notes`.

> **Flag prominently in the UI:** these records carry **no regulatory credit in Canada**. Transport Canada states there are no special certification procedures or credits for foreign pilots, and there is no RPAS equivalent of the crewed-aviation Foreign Licence Validation Certificate. This data exists only to inform the *company's* risk assessment and training plan.

### 2.8 `training_records` (Gate B — CAR 901.219)
| Field | Notes |
|---|---|
| `pilot_id`, `module_id`, `delivered_by`, `delivered_on` | |
| `training_category` | indoctrination, initial, recurrent, annual, on_the_job |
| `hours` | |
| `assessment_result` | pass/fail + score |
| `evaluator_id`, `evaluator_signature_ref` | |
| `expires_on` | per-module interval (see 2.9) |

### 2.9 `training_modules` (seed data)
Company-configurable catalogue; ships with these defaults derived from AC 901-002 App. A §11:

| Module | Default interval | Anchor |
|---|---|---|
| Operations Manual orientation | 24 mo / on amendment | 901.217 |
| SMS / safety processes | 24 mo | 901.218 |
| Human factors | **36 mo** (renewed every 3 years) | AC 901-002 A§11(2)(d) |
| Emergency procedures | 12 mo | 901.23(b) |
| Contingency / abnormal procedures | 12 mo | 901.23 |
| Flight planning & site survey | 12 mo | 901.24, 901.27, 901.28 |
| Airspace, NOTAM, NAV CANADA RPAS Flight Authorization | 12 mo | 901.14, 901.47, 901.71, 901.73 |
| Lost link / C2 failure / flyaway / flight termination | 12 mo | 901.32, 901.44 |
| Communications & crew handover | 24 mo | 901.42 |
| Incident / accident reporting | 24 mo | 901.49 |
| Pre/post-flight inspection & elementary work | 12 mo | 901.29, MCM |
| Battery handling & Li-ion fire response | 12 mo | AC 700-065 |
| Transportation of Dangerous Goods (if applicable) | per TDG | TDG Act |
| Visual Observer duties | 24 mo | 901.20, 901.38 |
| Weight & balance / payload limits | 24 mo | 901.31, 901.43 |
| Records & logbook procedures | 24 mo | 901.48, 901.223, 103.04 |

Add `annual_effectiveness_review` at the *program* level — CAR 901.219(2)(c) requires the operator to evaluate training effectiveness annually. Model this as its own reviewable object with an owner and due date.

### 2.10 `aircraft` (assets)
| Field | Notes |
|---|---|
| `id`, `nickname` | |
| `manufacturer`, `model`, `serial_number` | e.g. DJI Matrice 300 RTK, Matrice 4E |
| `registration_number` | TC registration (CAR 901.02) |
| `registration_marking_verified_on` | marking must be affixed and legible |
| `registered_owner` | must be a Canadian citizen, PR, or Canadian-incorporated corporation (CAR 901.04) — **your company, never the foreign employee** |
| `category` | small (250 g–25 kg), medium (>25–150 kg) |
| `class` | multirotor, fixed_wing, VTOL, helicopter, hybrid |
| `mtow_kg`, `propulsion` | electric / hybrid / liquid fuel |
| `in_service_since`, `status` | active, unserviceable, quarantined, retired |
| `remote_id_capable` | bool — **future-proofing only; see §6** |

### 2.11 `aircraft_declarations` (the gap most operators miss)
Each *operation type* a drone is used for needs the corresponding manufacturer safety-assurance declaration.

`aircraft_id`, `operation_type`, `rpas_standard`, `declaration_type` (declaration / pre-validated declaration), `car_reference`, `declared_by_manufacturer`, `evidence_url`.

Seed values:

| Operation | Standard | Type | CAR |
|---|---|---|---|
| Small, VLOS in controlled airspace | 922.04 | Declaration | 901.69(a) |
| Small, near people (<30 m, >5 m) | 922.05 | Declaration | 901.69(b) |
| Small, over people (<5 m) | 922.06 | Declaration | 901.69(c) |
| Small, sheltered ops in controlled airspace | 922.04 | Declaration | 901.69(d) |
| Medium, VLOS away from people (>500 ft) | 922.08(1,2) | Declaration | 901.69(e) |
| Medium, near people (<500 ft, >100 ft) | 922.07 | Pre-validated | 901.69(f) |
| Medium, over people (<100 ft) | 922.07 | Pre-validated | 901.69(g) |
| Medium, VLOS in controlled airspace | 922.04 + 922.08(1,2) | Declaration | 901.69(h) |

**Rule:** the flight-assignment validator must confirm the assigned aircraft holds a declaration covering the planned operation type. Fines for flying without a required declaration run to $5,000 for a corporation.

### 2.12 `payloads`
`id`, `type` (LiDAR, photogrammetry camera, multispectral, RTK base station, thermal), `manufacturer`, `model`, `serial_number`, `compatible_aircraft_ids[]`, `weight_kg`, `calibration_due_on`.

### 2.13 `type_competencies` (Gate C)
`pilot_id`, `aircraft_id` *or* `aircraft_model`, `payload_id` (nullable), `competency_type` (airframe, payload, controller/GCS, RTK/base station, software), `assessed_by`, `assessed_on`, `method` (OPC, written, observed flight), `result`, `limitations`, `expires_on`, `evidence_url`.

### 2.14 `pilot_authorizations` (Gate B output — the operational release)
The signed internal **RPAS Pilot Authorization / Competency Record**:

`pilot_id`, `authorized_aircraft_ids[]`, `authorized_payload_ids[]`, `authorized_operation_types[]` (basic / advanced-near-people / advanced-over-people / controlled airspace / sheltered / EVLOS / medium / L1 complex), `geographic_limitations`, `operational_limitations` (e.g. day only, wind ≤ X, temperature floor), `supervision_required` (bool), `supervisor_id`, `effective_from`, `review_due_on`, `signed_by_id` (Chief Pilot / RPAS Manager), `signature_hash`, `revoked_on`, `revocation_reason`.

Version this table — never overwrite. Each amendment creates a new row.

### 2.15 `flight_logs` (CAR 901.48, 901.223, 103.04)
`flight_id`, `date`, `pilot_id`, `aircraft_id`, `payload_ids[]`, `visual_observer_ids[]`, `site_id`, `operation_type`, `airspace_class`, `nav_canada_authorization_ref`, `takeoff_time`, `landing_time`, `duration_min`, `battery_cycles`, `weather_summary`, `notams_checked`, `site_survey_id`, `outcome`, `occurrence_id` (nullable).

### 2.16 `maintenance_records` (AC 901-002 App. B §5.7)
`aircraft_id` or `payload_id`, `action_type` (mandatory_action, scheduled, repair, modification, elementary_work), `description`, `performed_by_name`, `performed_on`, `parts_installed`, `instructions_ref`, `deferral` (bool + limitations + expiry), `test_flight_result`, `signed_off_by` (PRM), `retention_until` = performed_on + 2 years.

### 2.17 Supporting tables
- `sites` — recurring operating locations with cached airspace class, nearest aerodrome, hazards.
- `site_surveys` — per CAR 901.27; linked to flight logs.
- `occurrences` — reactive/proactive safety reports, hazard registry, risk matrix score, root cause, corrective actions with immediate/30-day/90-day tracks, follow-up effectiveness check (CAR 901.218).
- `documents` — Ops Manual, MCM, Processes, versioned with acknowledgement tracking.
- `document_acknowledgements` — `pilot_id`, `document_id`, `version`, `acknowledged_on`. Re-triggers on every version bump.
- `batteries` — serial, cycle count, health, retirement threshold, storage state.

---

## 3. Compliance rules engine

A single evaluator produces a **flight-readiness verdict** for a `(pilot, aircraft, payload, operation_type, date)` tuple.

```
READY = certificate_ok
      AND recency_ok
      AND age_ok
      AND company_authorization_ok
      AND type_competency_ok
      AND aircraft_registration_ok
      AND aircraft_declaration_ok
      AND aircraft_serviceable
      AND documents_acknowledged
      AND (work_authorization_ok if foreign national)
```

Each predicate returns `{pass, reason, car_reference, remediation_link}` so the UI can show *why* someone is blocked and what to do about it. Verdicts are cached per assignment and recomputed nightly plus on any underlying record change.

Suggested predicate detail:

| Predicate | Logic |
|---|---|
| `certificate_ok` | active certificate at or above the level the operation requires. L1 Complex ops additionally require the operation to be conducted under the company RPOC. |
| `recency_ok` | latest `recency_records.expires_on` > flight date |
| `age_ok` | ≥16 for Advanced, ≥18 for L1 Complex at certificate issuance |
| `company_authorization_ok` | non-revoked `pilot_authorizations` row covering this aircraft + operation type; `supervision_required` surfaces as a warning with named supervisor rather than a hard block |
| `type_competency_ok` | airframe + payload + GCS competencies present and unexpired |
| `aircraft_declaration_ok` | matching row in `aircraft_declarations` for the operation type |
| `aircraft_serviceable` | no open unresolved defect; deferrals within their limits; maintenance not overdue |

---

## 4. Modules / screens

1. **Dashboard** — fleet readiness tiles, pilots-at-risk (expiring in 30/60/90 days), open occurrences, overdue maintenance, upcoming annual training-effectiveness review.
2. **Pilot roster** — list with a three-dot Gate A/B/C indicator per pilot; drill-through to the full record.
3. **Pilot detail** — tabs: Identity & employment · TC credentials · Recency · Foreign qualifications (clearly labelled "no Canadian credit") · Company training · Type competencies · Authorizations · Flight history · Documents acknowledged.
4. **Onboarding workflow** — the Phase 1–6 pipeline as a Kanban with per-task owners, due dates, evidence upload, and a blocking rule that Phase 6 cannot be signed until Phases 2–5 are complete. Branch templates for *Canadian hire* vs *foreign-national hire* (§5).
5. **Fleet** — aircraft cards with registration, marking verification, declarations matrix, maintenance status, assigned payloads, battery pool.
6. **Assets** — payloads, controllers, RTK base stations, batteries; calibration and cycle tracking.
7. **Authorization builder** — generates the signed RPAS Pilot Authorization / Competency Record as a PDF from `pilot_authorizations`; e-signature by Chief Pilot; immutable once signed.
8. **Flight log** — entry form pre-validated by the rules engine; refuses to accept a log for a pilot/aircraft combination that was not READY on that date, or records it as an occurrence.
9. **Safety / SMS** — hazard registry, safety reports, 3×3 risk matrix (configurable), corrective actions, management review, safety performance indicators.
10. **Documents** — versioned Ops Manual / MCM / Processes with acknowledgement chase-up.
11. **Inspection export** — one button producing a TC-inspection bundle (see §7).
12. **Admin** — RBAC, training catalogue, alert thresholds, retention policy.

---

## 5. Foreign-national onboarding workflow (revised)

Your six-phase structure is sound. These are the corrections and additions to encode in the template.

**Phase 1 — Verify person**
- Work authorization (IRCC matter, not Transport Canada) with expiry date + renewal alert.
- Citizenship/PR is **not** required to hold a TC pilot certificate. It *is* required to hold the RPOC and to register aircraft — both stay with the company.
- Foreign RPAS credentials and flight history: collect for internal risk assessment; record as zero-credit.
- Age check against the target certificate level.

**Phase 2 — Canadian certification**
- Advanced: advanced exam → flight review → apply in the Drone Management Portal ($25). Flight review must be within 12 months before application.
- Level 1 Complex: advanced exam → ≥20 h ground school at a flight school → L1C exam (≥80%) → L1C flight review → apply ($125). 18+.
- Add a "no Foreign SFOC-RPAS required" checkbox with the rationale recorded: employees, agents and representatives of a Canadian RPOC holder are exempt from the Foreign SFOC-RPAS requirement. Keep evidence of the employment relationship on file.

**Phase 3 — Company qualification** (as you drafted, plus)
- Visual Observer training if they will act as or supervise a VO.
- Human factors (3-year cycle).
- TDG if payloads or fuel require it.
- Battery/Li-ion handling.
- Explicit note: supervised training flights are permitted under Part IX's supervised-operation provisions before the certificate is issued — verify the exact provision for your division before relying on it, and log the supervisor on every such flight.

**Phase 4 — Documentation** (as drafted, plus)
- Exam transcripts and scores, not just pass/fail.
- Ground school certificate with hours.
- Signed Ops Manual and MCM acknowledgements tied to document *version*.

**Phase 5 — Aircraft** (revised)
- Registration + physical marking verification (fines up to $25,000 for a corporation flying unregistered or unmarked).
- **Safety assurance declarations per operation type** — the missing item in the original list; see §2.11.
- Manufacturer limitations: temperature, wind, precipitation, icing (CAR 901.34, 901.35). Relevant to your cold-weather work.
- Maintenance records and MCM conformance.
- **Remote ID: not currently a legal requirement.** Build the field, don't gate on it. See §6.

**Phase 6 — Operational release**
- Chief Pilot / RPAS Manager signature on the authorization record.
- First N flights flagged `supervision_required` with a named supervisor, then a review checkpoint before unrestricted release.

---

## 6. Remote ID — build the field, not the gate

Transport Canada published NPA 2026-005 on 2026-06-08 proposing performance-based Remote ID (broadcast or network, ASTM F3411) for drones from 250 g to 150 kg in Basic, Advanced and Level 1 Complex operations. The consultation closed 2026-09-09 and the NPA's own schedule targets Canada Gazette Part I in winter 2027. It is **not law today**.

Implementation guidance:
- Add `remote_id_capable`, `remote_id_method` (broadcast/network/retrofit_module/none) and `remote_id_serial` to `aircraft` now.
- Do **not** include Remote ID in the flight-readiness predicate. Add it as an advisory badge.
- Add a `regulatory_watch` table so the RPOC holder can track NPAs and effective dates with an owner and a review date. This is the "management of change" hook AC 901-002 asks for.

---

## 7. Alerting & reporting

**Alert engine:** nightly job scanning every `expires_on`. Thresholds at 90 / 60 / 30 / 7 days and overdue. Channels: in-app, email digest to the pilot + Chief Pilot, escalation to Accountable Executive at overdue.

Alert sources: recency (24 mo), training modules, type competencies, authorization review dates, work-authorization expiry, maintenance due, battery cycle limits, payload calibration, document acknowledgement gaps, annual training-effectiveness review, management review of processes.

**Inspection export bundle** (single ZIP + index PDF):
- Personnel roster with roles, qualifications, duties (AC 901-002 App. A §3)
- Fleet list: model + registration (App. A §4)
- Per-pilot: certificate, recency evidence, training records, competency assessments, signed authorization
- Flight records with pilot names (901.48, 901.223, 103.04)
- Maintenance and technical records (901.223(1)(e), 901.48(1)(b))
- Training program and annual effectiveness evaluation (901.219(2)(c))
- Safety reports, hazard registry, corrective actions, management review (901.218)
- Current Ops Manual, MCM, Processes versions with acknowledgement log

---

## 8. Roles & permissions

| Role | Capabilities |
|---|---|
| Accountable Executive | full read; approves authorizations, safety policy, management review; sees restricted HR fields |
| Chief Pilot / RPAS Manager | signs pilot authorizations, assigns flights, runs competency assessments |
| Training Pilot | creates/records training and assessments |
| Person Responsible for Maintenance | fleet, maintenance, deferrals, elementary-work authorizations |
| Pilot | own record read; log flights; upload own evidence; acknowledge documents |
| Visual Observer | limited: own record, assigned flights |
| HR / Admin | identity + work authorization fields; no operational sign-off |
| Auditor (read-only) | scoped export access, time-boxed |

Separation of duties: the person who delivers training must not be the sole signer of the competency assessment for the same pilot where avoidable (AC 901-002 App. A §11(4) — objectivity in evaluation).

---

## 9. Technical notes

- **Stack:** whatever Sky Lounge already runs on. If greenfield: Postgres (row-level security for restricted fields), a typed API layer, background job runner for the nightly alert scan, S3-compatible object storage with server-side encryption for evidence files.
- **Append-only tables:** `pilot_authorizations`, `training_records`, `flight_logs`, `maintenance_records`, `occurrences`. Corrections create a new row referencing `supersedes_id`; nothing is hard-deleted before its retention floor.
- **Audit log:** actor, action, entity, before/after, timestamp, IP. Include reads of restricted personal fields.
- **Signatures:** store `signature_hash` = hash(record payload + signer id + timestamp) so tampering is detectable without a full PKI build.
- **Offline:** field crews lose connectivity. Flight log entry should work offline with local queue and conflict-safe sync; readiness verdicts cached to the device before departure.
- **Time zones:** store UTC, display local to the operating site.
- **Localization:** EN/FR — you are dealing with a bilingual regulator.

---

## 10. Delivery roadmap

**Phase 1 — Records of truth (weeks 1–4)**
Pilots, certificates, exams, flight reviews, recency, aircraft, registration. Manual data entry. No automation. Goal: replace whatever spreadsheet exists today.

**Phase 2 — Company qualification (weeks 5–8)**
Training modules + records, type competencies, document versioning and acknowledgements, pilot authorization builder with PDF output and e-signature.

**Phase 3 — Rules engine + alerts (weeks 9–12)**
Flight-readiness evaluator, nightly expiry scan, dashboard, onboarding Kanban with the Canadian/foreign templates.

**Phase 4 — Operations (weeks 13–18)**
Flight logs, site surveys, maintenance records, payload/battery tracking, deferrals.

**Phase 5 — Safety & inspection (weeks 19–24)**
Occurrence reporting, hazard registry, risk matrix, corrective actions, management review, one-click inspection export.

**Phase 6 — Hardening**
Offline mode, French localization, regulatory watch, retention automation.

---

## 11. Open questions for the Accountable Executive

1. Are you conducting Level 1 Complex operations today, or is the RPOC held for future BVLOS work? This determines whether the L1C pathway is a hard requirement for the new hire or optional.
2. Do you operate any medium RPA (>25 kg)? The hybrid platforms under evaluation for cold-weather survey may cross that line, which changes the declaration matrix and pre-validated declaration requirements.
3. Who signs the Pilot Authorization — Chief Pilot, RPAS Manager, or the AE? Encode one, not a committee.
4. What is your minimum supervised-flight count before unrestricted release?
5. Do you need multi-tenant support (multiple RPOC holders / client organizations) or single-org?

---

## 12. Source references

- Transport Canada — Get permission to fly a drone as a foreign pilot (updated 2026-06-12)
- Transport Canada — Getting a drone pilot certificate (updated 2025-11-04)
- Transport Canada — Advanced operations / Level 1 Complex operations category pages
- Transport Canada — Keep your drone pilot skills up to date (recency)
- Transport Canada — Apply for an RPAS Operator Certificate (RPOC)
- AC 901-002 Issue 2 — Guidance on Manual Development for RPOC Holders (2025-11-04)
- CARs Part IX (SOR/96-433), as amended by SOR/2025-70
- Standard 921 — Remotely Piloted Aircraft; Standard 922 — RPAS Safety Assurance
- TP 15263 (Basic/Advanced knowledge requirements, 4th ed. 03/2025); TP 15530 (Level 1 Complex)
- NPA 2026-005 — Remote ID, Community-Based Organizations, Designated RPAS Airspace (consultation closed 2026-09-09)
