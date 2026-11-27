"use client";

import {
  OrganizationSwitcher,
  UserButton,
  useAuth,
} from "@clerk/nextjs";
import { useQuery } from "convex/react";
import {
  BookOpen,
  Code2,
  CreditCard,
  Inbox,
  LayoutDashboard,
  Menu,
  Paintbrush,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ResolvdLogo } from "@/components/brand/ResolvdLogo";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
}

const WORKSPACE_NAV: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Inbox", href: "/dashboard/inbox", icon: Inbox },
  { label: "Leads", href: "/dashboard/leads", icon: Users },
];

const ADMIN_NAV: NavItem[] = [
  {
    label: "Knowledge Base",
    href: "/dashboard/knowledge-base",
    icon: BookOpen,
    adminOnly: true,
  },
  {
    label: "Customizer",
    href: "/dashboard/customizer",
    icon: Paintbrush,
    adminOnly: true,
  },
  { label: "Team", href: "/dashboard/team", icon: ShieldCheck, adminOnly: true },
  {
    label: "Billing",
    href: "/dashboard/billing",
    icon: CreditCard,
    adminOnly: true,
  },
  { label: "Install", href: "/dashboard/install", icon: Code2, adminOnly: true },
];

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { orgRole, isLoaded } = useAuth();
  const currentWorkspace = useQuery(api.workspaces.getCurrentWorkspace);

  const effectiveRole =
    currentWorkspace?.role ??
    (orgRole === "org:admin" ? "org:admin" : orgRole ? "org:member" : null);
  const isAdmin = effectiveRole === "org:admin";

  const renderNavLink = (item: NavItem) => {
    const isActive =
      item.href === "/dashboard"
        ? pathname === "/dashboard"
        : pathname.startsWith(item.href);
    const Icon = item.icon;

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={cn(
          "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span>{item.label}</span>
      </Link>
    );
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-sidebar border-r border-sidebar-border">
      <div className="flex h-14 items-center justify-between px-4 border-b border-sidebar-border">
        <Link href="/dashboard">
          <ResolvdLogo />
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="rounded-md p-1 text-muted-foreground hover:bg-sidebar-accent lg:hidden"
          aria-label="Close navigation"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          <div className="px-3 pb-1 text-xs font-medium text-muted-foreground">
            Workspace
          </div>
          {WORKSPACE_NAV.map(renderNavLink)}
        </div>

        {isAdmin && (
          <div className="space-y-1">
            <div className="px-3 pb-1 text-xs font-medium text-muted-foreground">
              Administration
            </div>
            {ADMIN_NAV.map(renderNavLink)}
          </div>
        )}
      </nav>

      {currentWorkspace?.workspace && (
        <div className="border-t border-sidebar-border p-3">
          <div className="rounded-md border border-border bg-card px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs font-medium text-foreground">
                {currentWorkspace.workspace.name}
              </span>
              <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium capitalize text-accent-foreground">
                {currentWorkspace.workspace.planTier}
              </span>
            </div>
            <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
              {currentWorkspace.workspace.slug}
            </p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 lg:block">{sidebarContent}</aside>

      {/* Mobile sidebar drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 w-64 max-w-[80vw]">
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <OrganizationSwitcher
              hidePersonal
              afterSelectOrganizationUrl="/dashboard"
              afterCreateOrganizationUrl="/dashboard"
              appearance={{
                elements: {
                  rootBox: "flex items-center",
                  organizationSwitcherTrigger:
                    "rounded-md border border-border bg-background px-2.5 py-1.5 text-sm font-medium hover:bg-muted",
                },
              }}
            />
          </div>

          <div className="flex items-center gap-3">
            {isLoaded && effectiveRole && (
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                  isAdmin
                    ? "bg-accent text-accent-foreground"
                    : "bg-secondary text-secondary-foreground",
                )}
              >
                {isAdmin ? "Admin" : "Member"}
              </span>
            )}
            <UserButton />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
