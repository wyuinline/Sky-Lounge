"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plane, ChevronDown, LogOut } from "lucide-react";
import { navItems } from "@/lib/nav-items";
import { roleLabels, type UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function TopNav({
  fullName,
  email,
  role,
  onSignOut,
}: {
  fullName: string;
  email: string;
  role: UserRole;
  onSignOut: () => void;
}) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 bg-sidebar text-sidebar-foreground shadow-sm">
      <div className="flex h-16 items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold">
          <Plane className="size-5" />
          <span className="hidden sm:inline">UAV Ops Portal</span>
        </Link>

        <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  active && "bg-sidebar-accent text-sidebar-accent-foreground",
                )}
              >
                <item.icon className="size-4" />
                {item.title}
              </Link>
            );
          })}
        </nav>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex shrink-0 items-center gap-2 rounded-md px-2 py-1.5 hover:bg-sidebar-accent">
            <Avatar className="size-8">
              <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
                {initials(fullName || email)}
              </AvatarFallback>
            </Avatar>
            <ChevronDown className="size-4 text-sidebar-foreground/60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">{fullName || email}</span>
                <Badge variant="secondary" className="w-fit text-xs">
                  {roleLabels[role]}
                </Badge>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onSignOut}>
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
