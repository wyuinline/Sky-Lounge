"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plane, ChevronDown, LogOut, Menu, X, UserRound } from "lucide-react";
import { navItems } from "@/lib/nav-items";
import { roleLabels, type UserRole } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/app/(portal)/actions";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function NavLinks({ role, onNavigate }: { role: UserRole; onNavigate?: () => void }) {
  const pathname = usePathname();
  const visible = navItems.filter((item) => !item.adminOnly || role === "uav_admin");
  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
      {visible.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center gap-2.5 rounded-md py-2 pr-3 pl-4 text-sm font-medium text-sidebar-foreground/70 transition-colors",
              "before:absolute before:top-1.5 before:bottom-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-transparent before:transition-colors",
              "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              active && "bg-sidebar-accent text-white before:bg-brand-lime",
            )}
          >
            <item.icon className={cn("size-4 shrink-0", active && "text-brand-lime")} />
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}

function UserMenu({
  fullName,
  email,
  role,
}: {
  fullName: string;
  email: string;
  role: UserRole;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-sidebar-accent">
        <Avatar className="size-8 shrink-0">
          <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
            {initials(fullName || email)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-sidebar-foreground">{fullName || email}</p>
          <p className="truncate text-xs text-sidebar-foreground/60">{roleLabels[role]}</p>
        </div>
        <ChevronDown className="size-4 shrink-0 text-sidebar-foreground/60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-56">
        {/*
          A plain div, not DropdownMenuLabel. That maps to Base UI's
          Menu.GroupLabel, which throws unless it sits inside a Menu.Group —
          and this is a header for the menu, not a label for a group of items.
        */}
        <div className="flex flex-col gap-1 px-1.5 py-1">
          <span className="truncate text-sm font-medium">{fullName || email}</span>
          <Badge variant="secondary" className="w-fit text-xs">
            {roleLabels[role]}
          </Badge>
        </div>
        <DropdownMenuSeparator />
        <Link
          href="/profile"
          className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-sm hover:bg-accent hover:text-accent-foreground"
        >
          <UserRound className="size-4" />
          Your profile
        </Link>
        <DropdownMenuSeparator />
        {/*
          A form action rather than onClick. Wiring a Server Action straight to
          onClick hands it React's synthetic MouseEvent as its first argument,
          which cannot be serialised for the server call and throws in the
          browser. A form also lets the action's redirect complete normally.
        */}
        <form action={signOut}>
          <button
            type="submit"
            className="relative flex w-full cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-destructive outline-hidden select-none hover:bg-destructive/10 focus-visible:bg-destructive/10"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SideNav({
  fullName,
  email,
  role,
}: {
  fullName: string;
  email: string;
  role: UserRole;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground sm:flex">
        <div className="flex h-16 shrink-0 items-center gap-2 px-4 text-lg font-semibold tracking-[-0.02em]">
          <Plane className="size-5 shrink-0" />
          UAV Ops Portal
        </div>
        <NavLinks role={role} />
        <div className="border-t border-sidebar-border p-3">
          <UserMenu fullName={fullName} email={email} role={role} />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 bg-sidebar px-4 text-sidebar-foreground sm:hidden">
        <Link href="/" className="flex items-center gap-2 text-base font-semibold tracking-[-0.02em]">
          <Plane className="size-5" />
          UAV Ops Portal
        </Link>
        <Button
          size="icon"
          variant="ghost"
          className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="size-5" />
        </Button>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-sidebar text-sidebar-foreground shadow-xl">
            <div className="flex h-14 shrink-0 items-center justify-between px-4 text-base font-semibold tracking-[-0.02em]">
              <span className="flex items-center gap-2">
                <Plane className="size-5" />
                UAV Ops Portal
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                onClick={() => setMobileOpen(false)}
              >
                <X className="size-5" />
              </Button>
            </div>
            <NavLinks role={role} onNavigate={() => setMobileOpen(false)} />
            <div className="border-t border-sidebar-border p-3">
              <UserMenu fullName={fullName} email={email} role={role} />
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
