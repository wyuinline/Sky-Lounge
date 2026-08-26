"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plane } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requestPasswordReset } from "./actions";

/** Messages the auth callback route can hand back on a failed link. */
const LINK_ERRORS: Record<string, string> = {
  link_expired: "That link has expired or was already used. Request a new one below.",
  link_invalid: "That link is not valid. Request a new one below.",
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Read from the URL directly rather than useSearchParams: that hook forces
  // the page under a Suspense boundary to stay statically rendered, and this is
  // a one-shot client-side announcement either way.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    if (code && LINK_ERRORS[code]) {
      toast.error(LINK_ERRORS[code]);
      // Clear it so a refresh does not re-announce a problem already dealt with.
      router.replace("/login");
    }
  }, [router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      toast.error("Enter your email address first, then choose Forgot password.");
      return;
    }

    setResetting(true);
    const result = await requestPasswordReset(email);
    setResetting(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    // Deliberately unconditional: confirming whether an address is registered
    // would make this form an account-enumeration tool.
    toast.success("If that address has an account, a reset link is on its way.");
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-sidebar px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Plane className="size-5" />
          </div>
          <CardTitle className="text-xl">UAV Operations Portal</CardTitle>
          <CardDescription>Sign in to access fleet, pilot, and compliance data.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor="password">Password</Label>
<Button
                  type="button"
                  variant="link"
                  size="xs"
                  onClick={handleForgotPassword}
                  disabled={resetting}
                  className="h-auto px-0 text-xs"
                >
                  {resetting ? "Sending..." : "Forgot password?"}
                </Button>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={loading} className="mt-2">
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
