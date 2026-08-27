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
  FileSpreadsheet,
  Briefcase,
  ClipboardCheck as ChecklistIcon,
  Radar,
  Plug,
  Building2,
  Landmark,
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
  /**
   * Shown only to someone who runs the platform rather than an operation.
   * Same caveat: the page redirects, and the one thing behind it that reaches
   * across organisations checks again in the database.
   */
  platformOnly?: boolean;
};

export const navItems: NavItem[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboard },
  { title: "UAV Fleet", href: "/fleet", icon: Plane },
  { title: "Pilots & Crew", href: "/pilots", icon: Users },
  { title: "Flight Operations", href: "/flights", icon: Send },
  { title: "Projects & Clients", href: "/projects", icon: Briefcase },
  { title: "Audits & Compliance", href: "/audits", icon: ClipboardCheck },
  { title: "Maintenance", href: "/maintenance", icon: Wrench },
  { title: "Checklists", href: "/checklists", icon: ChecklistIcon },
  { title: "Incidents & Safety", href: "/incidents", icon: ShieldAlert },
  { title: "Hazard Register", href: "/hazards", icon: Radar },
  { title: "Training Portal", href: "/training", icon: GraduationCap },
  { title: "Documents", href: "/documents", icon: FileText },
  { title: "Analytics", href: "/analytics", icon: BarChart3 },
  { title: "Reports", href: "/reports", icon: FileSpreadsheet },
  { title: "Notifications", href: "/notifications", icon: Bell },
  { title: "User Management", href: "/admin/users", icon: ShieldCheck, manages: "users" },
  { title: "Roles & Access", href: "/admin/permissions", icon: KeyRound, manages: "permissions" },
  { title: "Integrations", href: "/admin/integrations", icon: Plug, manages: "users" },
  { title: "Organisation", href: "/admin/organisation", icon: Building2, manages: "users" },
  { title: "Operators", href: "/platform", icon: Landmark, platformOnly: true },
];
