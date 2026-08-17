import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SideNav } from "@/components/portal/side-nav";
import { signOut } from "./actions";
import type { UserRole } from "@/lib/types";

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex min-h-full flex-col sm:flex-row">
      <SideNav
        fullName={profile?.full_name ?? ""}
        email={profile?.email ?? user.email ?? ""}
        role={(profile?.role as UserRole) ?? "read_only"}
        onSignOut={signOut}
      />
      <main className="min-w-0 flex-1 bg-background px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
