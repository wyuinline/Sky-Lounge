import type { LucideIcon } from "lucide-react";
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
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
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
];
