"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateOwnProfile } from "@/app/(portal)/profile/actions";

export function ProfileForm({ fullName }: { fullName: string }) {
  const [value, setValue] = useState(fullName);
  const [saving, setSaving] = useState(false);

  const dirty = value.trim() !== fullName.trim();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    const result = await updateOwnProfile(new FormData(event.currentTarget));

    setSaving(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Profile updated.");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="full_name">Your name</Label>
        <Input
          id="full_name"
          name="full_name"
          required
          maxLength={120}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="sm:max-w-sm"
        />
        <p className="text-xs text-muted-foreground">
          Shown on records you create and on approvals you sign off.
        </p>
      </div>
      <div>
        <Button type="submit" disabled={saving || !dirty}>
          {saving ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
