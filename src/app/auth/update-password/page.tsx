"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { updatePassword } from "./actions";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);

    const result = await updatePassword(password, confirmation);

    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Password set. You're signed in.");
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-sidebar px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <KeyRound className="size-5" />
          </div>
          <CardTitle className="text-xl">Choose a password</CardTitle>
          <CardDescription>
            Set the password you&rsquo;ll use to sign in to the UAV Operations Portal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={10}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">At least 10 characters.</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirmation">Confirm password</Label>
              <Input
                id="confirmation"
                type="password"
                autoComplete="new-password"
                required
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Set password and continue"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
