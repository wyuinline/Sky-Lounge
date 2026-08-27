import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SideNav } from "@/components/portal/side-nav";
import { OfflineSync } from "@/components/portal/offline-sync";
import { logoUrl, safeAccent } from "@/lib/branding";
import { getAccess, accessAreaOrder } from "@/lib/permissions";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, access] = await Promise.all([
    supabase.from("profiles").select("full_name, email").eq("id", user.id).single(),
    getAccess(),
  ]);

  const manages = accessAreaOrder.filter((area) => access?.canManage(area));

  // The accent is set as a custom property on the shell rather than in a
  // stylesheet, because it varies per operator and per request. safeAccent
  // guarantees it is six hex digits, which is why interpolating it here is not
  // a style injection.
  const accent = safeAccent(access?.organisation.accentColour ?? null);

  return (
    <div
      className="flex min-h-full flex-col sm:flex-row"
      style={{ "--brand-lime": accent } as React.CSSProperties}
    >
      <SideNav
        fullName={profile?.full_name ?? ""}
        email={profile?.email ?? user.email ?? ""}
        role={access?.role ?? "read_only"}
        manages={manages}
        organisationName={access?.organisation.name ?? ""}
        logoUrl={logoUrl(access?.organisation.logoPath ?? null)}
        isPlatformAdmin={access?.isPlatformAdmin ?? false}
      />
      <main className="min-w-0 flex-1 bg-background px-4 py-6 sm:px-6">{children}</main>
      <OfflineSync />
    </div>
  );
}
