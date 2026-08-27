"use client";

import { useState, useTransition } from "react";
import { Building2, Plus, Power, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { slugify, isValidSlug } from "@/lib/slug";
import {
  createOrganisation,
  inviteFirstAdmin,
  setOrganisationActive,
} from "@/app/(portal)/platform/actions";

export type OrganisationRow = {
  id: string;
  name: string;
  slug: string;
  legal_name: string | null;
  contact_email: string | null;
  active: boolean;
  created_at: string;
  member_count: number;
  admin_count: number;
};

function InviteAdminDialog({
  organisation,
  open,
  onOpenChange,
}: {
  organisation: OrganisationRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [sending, setSending] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (!organisation) return;
            setSending(true);
            const form = event.currentTarget;
            const data = new FormData(form);
            const result = await inviteFirstAdmin(
              organisation.id,
              String(data.get("email") ?? ""),
              String(data.get("full_name") ?? ""),
            );
            setSending(false);
            if (result.error) {
              toast.error(result.error);
              return;
            }
            form.reset();
            onOpenChange(false);
            toast.success("Invitation sent.");
          }}
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>Invite an administrator</DialogTitle>
            <DialogDescription>
              They arrive as a system administrator of {organisation?.name ?? "this operator"} —
              the only way the account is usable, since there is nobody else there to grant them
              anything.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="invite_name">Name</Label>
            <Input id="invite_name" name="full_name" placeholder="Sam Whitfield" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="invite_email">Email</Label>
            <Input
              id="invite_email"
              name="email"
              type="email"
              placeholder="sam@operator.example"
              required
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={sending}>
              <UserPlus className="size-4" />
              {sending ? "Sending..." : "Send invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function OrganisationsPanel({ organisations }: { organisations: OrganisationRow[] }) {
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [inviting, setInviting] = useState<OrganisationRow | null>(null);
  const [isPending, startTransition] = useTransition();

  // The address follows the name until someone edits it, at which point it is
  // theirs. Overwriting a deliberate choice on the next keystroke is worse
  // than making them fill in one more field.
  const [slugTouched, setSlugTouched] = useState(false);
  const effectiveSlug = slugTouched ? slugify(slug) : slugify(name);

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-2xl text-sm text-muted-foreground">
            Each operator is sealed off from every other: separate fleet, crew, records and audit
            trail. Creating one here and inviting its first administrator is the whole of what this
            page can do — it cannot read anybody&apos;s operational data.
          </p>
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            New operator
          </Button>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2">
          {organisations.map((organisation) => (
            <li
              key={organisation.id}
              className="flex flex-col gap-3 rounded-md border border-border p-4"
            >
              <div className="flex flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <Building2 className="size-4 shrink-0 text-brand-teal" />
                  <span className="font-medium">{organisation.name}</span>
                  {organisation.active ? null : <Badge variant="outline">Deactivated</Badge>}
                </span>
                <code className="font-mono text-xs text-muted-foreground">
                  {organisation.slug}
                </code>
                <span className="text-xs text-muted-foreground">
                  {organisation.member_count} {organisation.member_count === 1 ? "person" : "people"}
                  {organisation.admin_count === 0 ? " · nobody can administer it yet" : ""}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setInviting(organisation)}>
                  <UserPlus className="size-3.5" />
                  Invite administrator
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await setOrganisationActive(
                        organisation.id,
                        !organisation.active,
                      );
                      if (result.error) {
                        toast.error(result.error);
                        return;
                      }
                      toast.success(
                        organisation.active
                          ? `${organisation.name} deactivated.`
                          : `${organisation.name} is active again.`,
                      );
                    })
                  }
                >
                  <Power className="size-3.5" />
                  {organisation.active ? "Deactivate" : "Reactivate"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <Dialog
        open={creating}
        onOpenChange={(next) => {
          setCreating(next);
          if (!next) {
            setName("");
            setSlug("");
            setSlugTouched(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setSaving(true);
              const data = new FormData(event.currentTarget);
              data.set("slug", effectiveSlug);
              const result = await createOrganisation(data);
              setSaving(false);
              if (result.error) {
                toast.error(result.error);
                return;
              }
              setCreating(false);
              setName("");
              setSlug("");
              setSlugTouched(false);
              toast.success("Operator created. Invite their administrator next.");
            }}
            className="flex flex-col gap-4"
          >
            <DialogHeader>
              <DialogTitle>New operator</DialogTitle>
              <DialogDescription>
                They start with the standard roles and document review cycles, which they can then
                change to suit how they work.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-2">
              <Label htmlFor="org_name">Name</Label>
              <Input
                id="org_name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Northern Survey & Mapping"
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="org_slug">Address</Label>
              <Input
                id="org_slug"
                value={slugTouched ? slug : effectiveSlug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value);
                }}
                placeholder="northern-survey"
              />
              <p className="text-xs text-muted-foreground">
                {effectiveSlug === "" || isValidSlug(effectiveSlug)
                  ? "Lowercase letters, digits and hyphens. Used in web addresses and in the paths their files are stored under, so it cannot change later."
                  : "That will not work as an address — it needs at least two characters, all lowercase letters, digits or hyphens."}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="org_legal">Legal name</Label>
              <Input id="org_legal" name="legal_name" placeholder="Northern Survey Ltd." />
              <p className="text-xs text-muted-foreground">
                What appears on their reports and evidence packs, which is not always the name
                people use day to day.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="org_email">Contact email</Label>
              <Input id="org_email" name="contact_email" type="email" />
            </div>

            <DialogFooter>
              <Button type="submit" disabled={saving || !isValidSlug(effectiveSlug)}>
                {saving ? "Creating..." : "Create operator"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <InviteAdminDialog
        organisation={inviting}
        open={inviting !== null}
        onOpenChange={(next) => {
          if (!next) setInviting(null);
        }}
      />
    </>
  );
}
