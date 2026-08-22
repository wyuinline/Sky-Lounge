export type DocumentCategory =
  | "sop"
  | "policy"
  | "flight_manual"
  | "maintenance_manual"
  | "regulatory"
  | "incident_report"
  | "training_material"
  | "safety_document"
  | "roc_a";

export const documentCategories: { value: DocumentCategory; label: string; bucketId: string }[] = [
  { value: "sop", label: "SOPs", bucketId: "sops" },
  { value: "policy", label: "Policies", bucketId: "policies" },
  { value: "flight_manual", label: "Flight Manuals", bucketId: "flight-manuals" },
  { value: "maintenance_manual", label: "Maintenance Manuals", bucketId: "maintenance-manuals" },
  { value: "regulatory", label: "Regulatory Documents", bucketId: "regulatory-documents" },
  { value: "incident_report", label: "Incident Reports", bucketId: "incident-reports" },
  { value: "training_material", label: "Training Materials", bucketId: "training-materials" },
  { value: "safety_document", label: "Safety Documents", bucketId: "safety-documents" },
  // Uploaded from a pilot's row rather than the general document library, so
  // that each certificate is linked to the pilot it belongs to.
  { value: "roc_a", label: "ROC-A Certificates", bucketId: "roc-a-certificates" },
];

export function bucketForCategory(category: DocumentCategory): string {
  return documentCategories.find((c) => c.value === category)?.bucketId ?? "policies";
}

export function labelForCategory(category: DocumentCategory): string {
  return documentCategories.find((c) => c.value === category)?.label ?? category;
}
