import { redirect } from "next/navigation";
import { Info } from "lucide-react";
import { HeroBand } from "@/components/portal/hero-band";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ProfileForm } from "@/components/portal/profile/profile-form";
import { createClient } from "@/lib/supabase/server";
import { roleLabels, type UserRole } from "@/lib/types";
import { certificateTypeLabel, recencyDue } from "@/lib/compliance";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, { data: pilot }] = await Promise.all([
    supabase.from("profiles").select("full_name, email, role").eq("id", user.id).single(),
    // RLS limits this to the caller's own pilot record, if one is linked.
    supabase
      .from("pilots")
      .select(
        "full_name, certificate_number, certificate_type, certificate_issued, certificate_expires, last_recency_activity",
      )
      .eq("profile_id", user.id)
      .maybeSingle(),
  ]);

  const role = (profile?.role as UserRole) ?? "read_only";

  return (
    <div className="flex flex-col gap-6">
      <HeroBand
        eyebrow="Your Account"
        title="Profile"
        subtitle="Your account details, role, and linked pilot record."
      />

      <Card className="rounded-md">
        <CardHeader>
          <CardTitle className="text-base font-semibold tracking-[-0.01em]">
            Account details
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <ProfileForm fullName={profile?.full_name ?? ""} />

          <div className="grid grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold tracking-[0.06em] text-brand-teal uppercase">
                Email
              </p>
              <p className="mt-1 text-sm">{profile?.email ?? user.email}</p>
            </div>
            <div>
              <p className="text-xs font-semibold tracking-[0.06em] text-brand-teal uppercase">
                Role
              </p>
              <Badge variant="secondary" className="mt-1">
                {roleLabels[role]}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {pilot ? (
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle className="text-base font-semibold tracking-[-0.01em]">
              Your pilot record
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Certificate #</p>
              <p className="mt-0.5 font-mono text-xs">{pilot.certificate_number ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Type</p>
              <p className="mt-0.5">
                {pilot.certificate_type ? certificateTypeLabel[pilot.certificate_type] : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Expires</p>
              <p className="mt-0.5 tabular-nums">{pilot.certificate_expires ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Last recency</p>
              <p className="mt-0.5 tabular-nums">{pilot.last_recency_activity ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Recency due</p>
              <p className="mt-0.5 tabular-nums">
                {recencyDue(pilot.last_recency_activity) ?? "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Alert>
        <Info />
        <AlertTitle>What you can change here</AlertTitle>
        <AlertDescription>
          You can update your own name. Your role is set by an administrator, and pilot certificate
          details are maintained by an operations manager so the compliance record stays
          authoritative — ask them if something is wrong.
        </AlertDescription>
      </Alert>
    </div>
  );
}
