"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { ImageOff, Save, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateOrganisation,
  uploadLogo,
  removeLogo,
} from "@/app/(portal)/admin/organisation/actions";

export type OrganisationSettings = {
  name: string;
  legalName: string | null;
  slug: string;
  rpocNumber: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  accentColour: string | null;
  logoUrl: string | null;
};

/** The portal's own colour, used when an operator has not chosen one. */
const DEFAULT_ACCENT = "#c4e86c";

export function OrganisationForm({
  settings,
  canManage,
}: {
  settings: OrganisationSettings;
  canManage: boolean;
}) {
  const [saving, setSaving] = useState(false);
  const [accent, setAccent] = useState(settings.accentColour ?? DEFAULT_ACCENT);
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setSaving(true);
          const result = await updateOrganisation(new FormData(event.currentTarget));
          setSaving(false);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          toast.success("Settings saved.");
        }}
        className="flex flex-col gap-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="org_name">Name</Label>
            <Input
              id="org_name"
              name="name"
              defaultValue={settings.name}
              disabled={!canManage}
              required
            />
            <p className="text-xs text-muted-foreground">What appears in the portal.</p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="org_legal">Legal name</Label>
            <Input
              id="org_legal"
              name="legal_name"
              defaultValue={settings.legalName ?? ""}
              disabled={!canManage}
              placeholder={settings.name}
            />
            <p className="text-xs text-muted-foreground">
              What appears on reports and evidence packs.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="org_rpoc">Operator certificate number</Label>
            <Input
              id="org_rpoc"
              name="rpoc_number"
              defaultValue={settings.rpocNumber ?? ""}
              disabled={!canManage}
              placeholder="Not yet held"
            />
            <p className="text-xs text-muted-foreground">
              Printed on the RPOC evidence pack. Leave blank until you hold one.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="org_slug">Address</Label>
            <Input id="org_slug" value={settings.slug} readOnly disabled />
            <p className="text-xs text-muted-foreground">
              Fixed. Your files are stored under it, so changing it would orphan every one.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="org_email">Contact email</Label>
            <Input
              id="org_email"
              name="contact_email"
              type="email"
              defaultValue={settings.contactEmail ?? ""}
              disabled={!canManage}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="org_phone">Contact phone</Label>
            <Input
              id="org_phone"
              name="contact_phone"
              defaultValue={settings.contactPhone ?? ""}
              disabled={!canManage}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="org_accent">Accent colour</Label>
          <div className="flex flex-wrap items-center gap-3">
            <input
              id="org_accent"
              name="accent_colour"
              type="color"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              disabled={!canManage}
              className="h-9 w-16 cursor-pointer rounded-md border border-[var(--control-edge)] bg-[var(--control-face)] p-1 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <code className="font-mono text-sm">{accent}</code>
            <span
              className="rounded-md px-3 py-1.5 text-sm font-medium text-brand-ink"
              style={{ backgroundColor: accent }}
            >
              How it reads
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Used for the rule under headings and the marks that draw the eye. Text and status
            colours are left alone, so a pale accent cannot make anything unreadable.
          </p>
        </div>

        {canManage ? (
          <div>
            <Button type="submit" disabled={saving}>
              <Save className="size-4" />
              {saving ? "Saving..." : "Save settings"}
            </Button>
          </div>
        ) : null}
      </form>

      <div className="flex flex-col gap-3 border-t border-border pt-5">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium">Logo</h3>
          <p className="text-xs text-muted-foreground">
            Shown in the corner of every page. A wide mark reads better than a square one at this
            size.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-16 w-40 items-center justify-center rounded-md border border-border bg-brand-ink px-3">
            {settings.logoUrl ? (
              <Image
                src={settings.logoUrl}
                alt={`${settings.name} logo`}
                width={140}
                height={48}
                className="max-h-12 w-auto object-contain"
                unoptimized
              />
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-white/60">
                <ImageOff className="size-3.5" />
                No logo
              </span>
            )}
          </div>

          {canManage ? (
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                setUploading(true);
                const form = event.currentTarget;
                const result = await uploadLogo(new FormData(form));
                setUploading(false);
                if (result.error) {
                  toast.error(result.error);
                  return;
                }
                form.reset();
                toast.success("Logo updated.");
              }}
              className="flex flex-wrap items-center gap-2"
            >
              <Input
                name="file"
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                required
                className="max-w-xs"
              />
              <Button type="submit" size="sm" disabled={uploading}>
                <Upload className="size-3.5" />
                {uploading ? "Uploading..." : "Upload"}
              </Button>
              {settings.logoUrl ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await removeLogo();
                      if (result.error) {
                        toast.error(result.error);
                        return;
                      }
                      toast.success("Logo removed.");
                    })
                  }
                >
                  Remove
                </Button>
              ) : null}
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
