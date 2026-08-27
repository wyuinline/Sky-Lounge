import { redirect } from "next/navigation";
import { HeroBand } from "@/components/portal/hero-band";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  OrganisationForm,
  type OrganisationSettings,
} from "@/components/portal/admin/organisation-form";
import { createClient } from "@/lib/supabase/server";
import { getAccess } from "@/lib/permissions";
import { logoUrl } from "@/lib/branding";

export default async function OrganisationPage() {
  const supabase = await createClient();
  const access = await getAccess();

  if (!access) redirect("/login");

  const { data: organisation } = await supabase
    .from("organisations")
    .select("name, legal_name, slug, rpoc_number, contact_email, contact_phone, accent_colour, logo_path")
    .eq("id", access.organisation.id)
    .single();

  if (!organisation) redirect("/");

  const settings: OrganisationSettings = {
    name: organisation.name,
    legalName: organisation.legal_name,
    slug: organisation.slug,
    rpocNumber: organisation.rpoc_number,
    contactEmail: organisation.contact_email,
    contactPhone: organisation.contact_phone,
    accentColour: organisation.accent_colour,
    logoUrl: logoUrl(organisation.logo_path),
  };

  return (
    <div className="flex flex-col gap-6">
      <HeroBand
        eyebrow="Administration"
        title="Organisation"
        subtitle="How this operation identifies itself: on screen, on a printed report, and on the evidence pack a reviewer reads."
      />

      <Card className="rounded-md">
        <CardHeader>
          <CardTitle className="text-base font-semibold tracking-[-0.01em]">
            Identity and branding
          </CardTitle>
        </CardHeader>
        <CardContent>
          <OrganisationForm settings={settings} canManage={access.canManage("users")} />
        </CardContent>
      </Card>
    </div>
  );
}
