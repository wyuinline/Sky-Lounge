"use client";

import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addProject, updateProject } from "@/app/(portal)/projects/actions";

export type ProjectStatus = "planned" | "active" | "on_hold" | "complete" | "cancelled";

export const projectStatusLabel: Record<ProjectStatus, string> = {
  planned: "Planned",
  active: "Active",
  on_hold: "On hold",
  complete: "Complete",
  cancelled: "Cancelled",
};

export type ClientOption = { id: string; name: string };

export type ProjectFormValues = {
  id: string;
  project_code: string | null;
  name: string | null;
  client_id: string | null;
  site_name: string | null;
  latitude: number | null;
  longitude: number | null;
  status: ProjectStatus | null;
  start_date: string | null;
  end_date: string | null;
  hourly_rate: number | null;
  notes: string | null;
};

const NO_CLIENT = "__none__";

function ProjectForm({
  initial,
  clients,
  submitLabel,
  pendingLabel,
  onSubmit,
}: {
  initial?: ProjectFormValues;
  clients: ClientOption[];
  submitLabel: string;
  pendingLabel: string;
  onSubmit: (formData: FormData) => Promise<{ error: string | null }>;
}) {
  const [status, setStatus] = useState<ProjectStatus>(initial?.status ?? "planned");
  const [clientId, setClientId] = useState(initial?.client_id ?? NO_CLIENT);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    formData.set("status", status);
    formData.set("client_id", clientId === NO_CLIENT ? "" : clientId);
    const result = await onSubmit(formData);
    setLoading(false);
    if (result.error) toast.error(result.error);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="project_code">Job Number</Label>
          <Input
            id="project_code"
            name="project_code"
            required
            placeholder="IG-2026-118"
            defaultValue={initial?.project_code ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Client</Label>
          <Select value={clientId} onValueChange={(v) => v && setClientId(v)}>
            <SelectTrigger className="w-full">
              <SelectValue>
                {(v) =>
                  v === NO_CLIENT
                    ? "Internal / none"
                    : (clients.find((c) => c.id === v)?.name ?? "Internal / none")
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CLIENT}>Internal / none</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Project Name</Label>
        <Input
          id="name"
          name="name"
          required
          placeholder="Acheson pit — quarterly volumetric"
          defaultValue={initial?.name ?? ""}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="site_name">Site</Label>
          <Input
            id="site_name"
            name="site_name"
            placeholder="North cell"
            defaultValue={initial?.site_name ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="latitude">Latitude</Label>
          <Input
            id="latitude"
            name="latitude"
            type="number"
            step="0.000001"
            placeholder="53.5461"
            defaultValue={initial?.latitude ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="longitude">Longitude</Label>
          <Input
            id="longitude"
            name="longitude"
            type="number"
            step="0.000001"
            placeholder="-113.4938"
            defaultValue={initial?.longitude ?? ""}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="start_date">Start</Label>
          <Input
            id="start_date"
            name="start_date"
            type="date"
            defaultValue={initial?.start_date ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="end_date">End</Label>
          <Input
            id="end_date"
            name="end_date"
            type="date"
            defaultValue={initial?.end_date ?? ""}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => v && setStatus(v as ProjectStatus)}>
            <SelectTrigger className="w-full">
              <SelectValue>{(v) => projectStatusLabel[v as ProjectStatus]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(projectStatusLabel) as ProjectStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {projectStatusLabel[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="hourly_rate">Flying Rate</Label>
          <Input
            id="hourly_rate"
            name="hourly_rate"
            type="number"
            min="0"
            step="0.01"
            placeholder="per hour"
            defaultValue={initial?.hourly_rate ?? ""}
          />
          <p className="text-xs text-muted-foreground">
            Optional. Without it the portal reports hours only.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          placeholder="Access constraints, landowner contact, anything the crew needs."
          defaultValue={initial?.notes ?? ""}
        />
      </div>

      <DialogFooter>
        <Button type="submit" disabled={loading}>
          {loading ? pendingLabel : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function AddProjectDialog({ clients }: { clients: ClientOption[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button size="sm">
          <Plus className="size-4" />
          New Project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
        </DialogHeader>
        {open ? (
          <ProjectForm
            clients={clients}
            submitLabel="Create project"
            pendingLabel="Creating..."
            onSubmit={async (formData) => {
              const result = await addProject(formData);
              if (!result.error) {
                toast.success("Project created.");
                setOpen(false);
              }
              return result;
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function EditProjectDialog({
  project,
  clients,
  open,
  onOpenChange,
}: {
  project: ProjectFormValues | null;
  clients: ClientOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit {project?.project_code ?? "project"}</DialogTitle>
        </DialogHeader>
        {project ? (
          <ProjectForm
            key={project.id}
            initial={project}
            clients={clients}
            submitLabel="Save changes"
            pendingLabel="Saving..."
            onSubmit={async (formData) => {
              const result = await updateProject(project.id, formData);
              if (!result.error) {
                toast.success(`${formData.get("project_code")} updated.`);
                onOpenChange(false);
              }
              return result;
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
