import { createClient } from "@/lib/supabase/server";
import { getAccess } from "@/lib/permissions";
import { todayIso, certificateTypeLabel, derivePilotCertificateStatus, recencyDue } from "@/lib/compliance";
import { riskBand, bandLabel } from "@/lib/risk";
import { operationLabel, type OperationType } from "@/lib/operations";

/**
 * The RPOC evidence pack.
 *
 * An RPAS Operator Certificate application, and every review of one
 * afterwards, asks the same question in several forms: show me that your
 * policies and procedures match the size and complexity of what you do, and
 * that you follow them.
 *
 * Every part of that answer already exists in this portal, scattered across
 * seven pages. This assembles it into one document. It is the single thing
 * here that no competitor can produce, because none of them keeps the audit,
 * document-control and hazard records that make up four fifths of it.
 */

export type EvidenceSection = {
  id: string;
  title: string;
  /** What this section is evidence *of*, in the regulator's terms. */
  purpose: string;
  /** Rendered as a table when there are columns, prose when there are not. */
  columns: { key: string; label: string; numeric?: boolean }[];
  rows: Record<string, string | number | boolean | null>[];
  /** Shown when the section is empty — a gap the operator should close. */
  gapWarning: string;
};

export type EvidencePack = {
  generatedOn: string;
  organisation: string;
  /** The operator certificate this is submitted under, or null until held. */
  rpocNumber: string | null;
  sections: EvidenceSection[];
  /** Sections with nothing in them: what is missing from the submission. */
  gaps: string[];
};

function round1(n: number | null | undefined): number | null {
  return n === null || n === undefined ? null : Math.round(n * 10) / 10;
}

export async function buildEvidencePack(): Promise<
  { error: string; pack: null } | { error: null; pack: EvidencePack }
> {
  const access = await getAccess();
  if (!access) return { error: "You are not signed in.", pack: null };

  // The pack spans crew, fleet, safety and documents. Anything less than full
  // visibility of all four would produce a submission with silent holes in it,
  // which is worse than no submission.
  const areas = ["pilots", "fleet", "incidents", "docs_general"] as const;
  const missing = areas.filter((a) => !access.canReadAll(a));
  if (missing.length > 0) {
    return {
      error:
        "The evidence pack needs full visibility of crew, fleet, safety and documents. Ask an administrator to run it.",
      pack: null,
    };
  }

  const supabase = await createClient();

  const [
    procedures,
    crew,
    authorisations,
    fleet,
    hazards,
    findings,
    incidents,
    training,
    checklists,
    manuals,
  ] = await Promise.all([
    supabase
      .from("document_review_status")
      .select("title, category, version, approval_status, effective_date, last_reviewed_at, review_interval_months, review_due")
      .in("category", ["sop", "policy", "flight_manual", "maintenance_manual", "safety_document", "regulatory"])
      .order("category"),
    supabase
      .from("pilot_certificate_status")
      .select("id, full_name, certificate_type, certificate_number, certificate_expires, last_recency_activity, has_roc_a, active")
      .eq("active", true)
      .order("full_name"),
    supabase
      .from("pilot_authorisation_status")
      .select("pilot_name, operation, evidence, expires_on, currently_valid, pilot_active"),
    supabase
      .from("uav_fleet_status")
      .select("drone_id, registration_number, model, manufacturer, weight_kg, status, flight_hours, last_maintenance_date, next_inspection_date")
      .neq("status", "retired")
      .order("drone_id"),
    supabase
      .from("hazard_register")
      .select("hazard_code, title, category, initial_score, residual_likelihood, residual_severity, residual_score, mitigation, owner_name, status, review_due")
      .neq("status", "closed")
      .order("hazard_code"),
    supabase
      .from("audit_findings")
      .select("severity, description, due_date, status, training_required, assignee:audit_findings_assigned_to_fkey(full_name)")
      .order("due_date"),
    supabase
      .from("incidents")
      .select("incident_date, incident_type, severity, status")
      .order("incident_date", { ascending: false })
      .limit(50),
    supabase
      .from("training_records")
      .select("certification_name, issue_date, expiry_date, competency_level, pilots(full_name)")
      .order("expiry_date"),
    supabase
      .from("checklist_templates")
      .select("name, applies_to_model, active, checklist_items(id, critical)")
      .eq("active", true)
      .order("name"),
    supabase.from("manual_summary").select("*").order("title"),
  ]);

  const sections: EvidenceSection[] = [
    {
      id: "manuals",
      title: "Operations manuals",
      purpose:
        "The bound manuals the operation is run to, at their current revision. A reviewer cites a section number, so this is what makes a finding answerable.",
      columns: [
        { key: "title", label: "Manual" },
        { key: "revision", label: "Revision" },
        { key: "effective", label: "Effective" },
        { key: "status", label: "Approval" },
        { key: "sections", label: "Sections", numeric: true },
        { key: "controlled", label: "Controlled docs", numeric: true },
        { key: "empty", label: "Empty sections", numeric: true },
      ],
      rows: (manuals.data ?? []).map((m) => ({
        title: m.title,
        revision: m.revision,
        effective: m.effective_date ?? "Not set",
        status: m.approval_status?.replace(/_/g, " ") ?? null,
        sections: m.section_count,
        controlled: m.document_count,
        // Surfaced rather than hidden: an empty section is the gap a reviewer
        // finds first, and finding it here is cheaper than finding it there.
        empty: m.empty_section_count,
      })),
      gapWarning:
        "No operations manual on file. A certificate rests on one; a set of loose procedures is not the same thing.",
    },
    {
      id: "procedures",
      title: "Documented procedures",
      purpose:
        "The policies and procedures the operation runs on, at their current revision, each with the date it was last reviewed and when the next review falls due.",
      columns: [
        { key: "title", label: "Document" },
        { key: "category", label: "Type" },
        { key: "version", label: "Version", numeric: true },
        { key: "status", label: "Approval" },
        { key: "effective", label: "Effective" },
        { key: "reviewed", label: "Last reviewed" },
        { key: "due", label: "Review due" },
      ],
      rows: (procedures.data ?? []).map((d) => ({
        title: d.title,
        category: d.category?.replace(/_/g, " ") ?? null,
        version: d.version,
        status: d.approval_status?.replace(/_/g, " ") ?? null,
        effective: d.effective_date,
        reviewed: d.last_reviewed_at ?? "Never",
        due: d.review_due ?? "Not on a cycle",
      })),
      gapWarning:
        "No procedures on file. An operator certificate rests on documented procedures; this is the first thing a reviewer will ask for.",
    },
    {
      id: "crew",
      title: "Crew credentials",
      purpose:
        "Every active pilot with their Transport Canada certificate, 24-month recency, radio operator certificate, and a plain verdict on whether they may currently fly.",
      columns: [
        { key: "name", label: "Pilot" },
        { key: "certificate", label: "Certificate" },
        { key: "number", label: "Number" },
        { key: "expires", label: "Expires" },
        { key: "recency", label: "Recency due" },
        { key: "roc_a", label: "ROC-A" },
        { key: "verdict", label: "Valid to fly" },
      ],
      rows: (crew.data ?? []).map((p) => {
        const status = derivePilotCertificateStatus(p.certificate_expires, p.last_recency_activity);
        return {
          name: p.full_name,
          certificate: p.certificate_type
            ? (certificateTypeLabel[p.certificate_type] ?? p.certificate_type)
            : "Not recorded",
          number: p.certificate_number,
          expires: p.certificate_expires,
          recency: recencyDue(p.last_recency_activity),
          roc_a: p.has_roc_a ?? false,
          verdict:
            status === null
              ? "No credentials on file"
              : status === "expired"
                ? "No — expired"
                : status === "due_soon"
                  ? "Yes — renewal due"
                  : "Yes",
        };
      }),
      gapWarning: "No active crew recorded.",
    },
    {
      id: "authorisations",
      title: "Operational authorisations",
      purpose:
        "What each pilot is separately cleared to do, and the evidence each clearance rests on.",
      columns: [
        { key: "pilot", label: "Pilot" },
        { key: "operation", label: "Operation" },
        { key: "evidence", label: "Evidence" },
        { key: "expires", label: "Valid until" },
        { key: "current", label: "Current" },
      ],
      rows: (authorisations.data ?? [])
        .filter((a) => a.pilot_active !== false)
        .map((a) => ({
          pilot: a.pilot_name,
          operation: operationLabel[a.operation as OperationType] ?? a.operation,
          evidence: a.evidence ?? "Not recorded",
          expires: a.expires_on ?? "Does not lapse",
          current: a.currently_valid ?? false,
        })),
      gapWarning:
        "No operational authorisations recorded. Without them the portal cannot show which crew are cleared for beyond-line-of-sight, night, or flight over people.",
    },
    {
      id: "fleet",
      title: "Aircraft and airworthiness",
      purpose:
        "The aircraft in service, their registration and weight, accumulated hours, and current maintenance position.",
      columns: [
        { key: "drone_id", label: "Aircraft" },
        { key: "registration", label: "Registration" },
        { key: "make_model", label: "Make / model" },
        { key: "weight", label: "Weight (kg)", numeric: true },
        { key: "hours", label: "Hours", numeric: true },
        { key: "last_service", label: "Last service" },
        { key: "next_inspection", label: "Next inspection" },
        { key: "status", label: "Status" },
      ],
      rows: (fleet.data ?? []).map((u) => ({
        drone_id: u.drone_id,
        registration: u.registration_number ?? "Not registered",
        make_model: [u.manufacturer, u.model].filter(Boolean).join(" ") || null,
        weight: u.weight_kg,
        hours: round1(u.flight_hours),
        last_service: u.last_maintenance_date ?? "None recorded",
        next_inspection: u.next_inspection_date ?? "Not scheduled",
        status: u.status,
      })),
      gapWarning: "No aircraft in service.",
    },
    {
      id: "hazards",
      title: "Hazard register",
      purpose:
        "Identified hazards with their inherent risk, the controls applied, and the residual risk that remains.",
      columns: [
        { key: "code", label: "Ref" },
        { key: "title", label: "Hazard" },
        { key: "category", label: "Category" },
        { key: "initial", label: "Inherent" },
        { key: "residual", label: "Residual" },
        { key: "mitigation", label: "Controls" },
        { key: "owner", label: "Owner" },
        { key: "due", label: "Review due" },
      ],
      rows: (hazards.data ?? []).map((h) => {
        const band = (score: number | null) =>
          score === null ? "Not assessed" : `${bandLabel[riskBand(score)]} (${score})`;
        return {
          code: h.hazard_code,
          title: h.title,
          category: h.category?.replace(/_/g, " ") ?? null,
          initial: band(h.initial_score),
          residual: band(h.residual_score),
          mitigation: h.mitigation ?? "None recorded",
          owner: h.owner_name ?? "Unassigned",
          due: h.review_due,
        };
      }),
      gapWarning:
        "No hazard register. This is the safety-management component a reviewer is most likely to find missing.",
    },
    {
      id: "checklists",
      title: "Operational checklists",
      purpose: "The checklists the crew works through, and how many items on each are no-go.",
      columns: [
        { key: "name", label: "Checklist" },
        { key: "applies", label: "Applies to" },
        { key: "items", label: "Items", numeric: true },
        { key: "critical", label: "No-go items", numeric: true },
      ],
      rows: (checklists.data ?? []).map((c) => ({
        name: c.name,
        applies: c.applies_to_model ?? "Any aircraft",
        items: c.checklist_items?.length ?? 0,
        critical: c.checklist_items?.filter((i) => i.critical).length ?? 0,
      })),
      gapWarning: "No active checklists.",
    },
    {
      id: "findings",
      title: "Audit findings and corrective actions",
      purpose:
        "What audits have raised, who owns each corrective action, when it is due, and whether it required retraining.",
      columns: [
        { key: "severity", label: "Severity" },
        { key: "description", label: "Finding" },
        { key: "owner", label: "Owner" },
        { key: "due", label: "Due" },
        { key: "training", label: "Retraining" },
        { key: "status", label: "Status" },
      ],
      rows: (findings.data ?? []).map((f) => ({
        severity: f.severity,
        description: f.description,
        owner: f.assignee?.full_name ?? "Unassigned",
        due: f.due_date,
        training: f.training_required ?? false,
        status: f.status,
      })),
      gapWarning: "No audit findings recorded — either nothing has been audited, or nothing found.",
    },
    {
      id: "incidents",
      title: "Occurrence record",
      purpose: "Reported incidents and near misses, with severity and current status.",
      columns: [
        { key: "date", label: "Date" },
        { key: "type", label: "Type" },
        { key: "severity", label: "Severity" },
        { key: "status", label: "Status" },
      ],
      rows: (incidents.data ?? []).map((i) => ({
        date: i.incident_date,
        type: i.incident_type?.replace(/_/g, " ") ?? null,
        severity: i.severity,
        status: i.status,
      })),
      gapWarning:
        "No occurrences recorded. A reporting culture with nothing in it is usually a reporting problem, not a safety achievement.",
    },
    {
      id: "training",
      title: "Training records",
      purpose: "Certifications and competency levels held by the crew.",
      columns: [
        { key: "pilot", label: "Pilot" },
        { key: "certification", label: "Certification" },
        { key: "issued", label: "Issued" },
        { key: "expires", label: "Expires" },
        { key: "level", label: "Competency" },
      ],
      rows: (training.data ?? []).map((t) => ({
        pilot: t.pilots?.full_name ?? "Unattributed",
        certification: t.certification_name,
        issued: t.issue_date,
        expires: t.expiry_date ?? "Does not expire",
        level: t.competency_level,
      })),
      gapWarning: "No training records on file.",
    },
  ];

  return {
    error: null,
    pack: {
      generatedOn: todayIso(),
      // The legal name where there is one: what a regulator needs on the cover
      // is the name on the certificate, not the one used in the corridor.
      organisation: access.organisation.legalName ?? access.organisation.name,
      rpocNumber: access.organisation.rpocNumber,
      sections,
      gaps: sections.filter((s) => s.rows.length === 0).map((s) => s.title),
    },
  };
}
