"use client";

import { useState, type FormEvent } from "react";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { roleDescription, roleLabel, roleOrder, type UserRole } from "@/lib/access";
import { inviteUser } from "@/app/(portal)/admin/users/actions";

export function InviteUserDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("read_only");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);

    const result = await inviteUser(email, role, fullName);

    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(`Invitation sent to ${email.trim().toLowerCase()}.`);
    setOpen(false);
    setEmail("");
    setFullName("");
    setRole("read_only");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button size="sm">
          <UserPlus className="size-4" />
          Invite User
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite someone to the portal</DialogTitle>
          <DialogDescription>
            They receive an email with a link, choose their own password, and land signed in. You
            never see or set it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite_email">Email address</Label>
            <Input
              id="invite_email"
              type="email"
              required
              autoComplete="off"
              placeholder="name@inlinegroupinc.ca"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="invite_name">Full name</Label>
            <Input
              id="invite_name"
              autoComplete="off"
              placeholder="Optional — they can set it themselves"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => v && setRole(v as UserRole)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roleOrder.map((r) => (
                  <SelectItem key={r} value={r}>
                    {roleLabel[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{roleDescription[role]}</p>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Sending..." : "Send invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
