import type { LucideIcon } from "lucide-react";
import type { AccessArea } from "@/lib/access";
import {
  LayoutDashboard,
  Plane,
  Users,
  Send,
  ClipboardCheck,
  Wrench,
  ShieldAlert,
  GraduationCap,
  FileText,
  BarChart3,
  Bell,
  ShieldCheck,
  KeyRound,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /**
   * Shown only to someone with full authority over this area. Presentation
   * only — the page itself redirects and RLS rejects the writes, so hiding the
   * link is a convenience, never the access control.
   */
  manages?: AccessArea;
};

export const navItems: NavItem[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "UAV Fleet", href: "/fleet", icon: Plane },
  { title: "Pilots & Crew", href: "/pilots", icon: Users },
  { title: "Flight Operations", href: "/flights", icon: Send },
  { title: "Audits & Compliance", href: "/audits", icon: ClipboardCheck },
  { title: "Maintenance", href: "/maintenance", icon: Wrench },
  { title: "Incidents & Safety", href: "/incidents", icon: ShieldAlert },
  { title: "Training Portal", href: "/training", icon: GraduationCap },
  { title: "Documents", href: "/documents", icon: FileText },
  { title: "Analytics", href: "/analytics", icon: BarChart3 },
  { title: "Notifications", href: "/notifications", icon: Bell },
  { title: "User Management", href: "/admin/users", icon: ShieldCheck, manages: "users" },
  { title: "Roles & Access", href: "/admin/permissions", icon: KeyRound, manages: "users" },
];
