"use client";

import { OrganizationProfile, useAuth } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { ArrowLeft, Loader2, ShieldAlert, Users } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";

export default function TeamPage() {
  const { isLoaded, orgRole } = useAuth();
  const currentWorkspace = useQuery(api.workspaces.getCurrentWorkspace);
  const members = useQuery(
    api.memberships.listWorkspaceMembers,
    currentWorkspace?.workspace ? {} : "skip",
  );

  if (!isLoaded || currentWorkspace === undefined) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span>Loading team...</span>
        </div>
      </div>
    );
  }

  const effectiveRole = currentWorkspace?.role ?? orgRole;
  if (effectiveRole !== "org:admin") {
    return (
      <div className="mx-auto max-w-lg py-12">
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <h1 className="mt-4 text-lg font-semibold text-foreground">
            Admin access required
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Team management and member invitations are restricted to{" "}
            <span className="font-mono text-foreground">org:admin</span>{" "}
            members.
          </p>
          <div className="mt-6">
            <Link href="/dashboard">
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to overview
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="border-b border-border pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Team & Permissions
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Invite support agents, assign admin or member roles, and view synced
          Convex workspace memberships.
        </p>
      </div>

      {/* Synced Convex Memberships Table */}
      <section className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Users className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">
              Synced workspace members
            </h2>
          </div>
          <span className="tabular-nums text-xs font-medium text-muted-foreground">
            {members ? `${members.length} member${members.length === 1 ? "" : "s"}` : "—"}
          </span>
        </div>

        {members === undefined ? (
          <div className="p-6 text-sm text-muted-foreground">
            Loading synced members...
          </div>
        ) : members.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            No synced members yet. Provision the workspace or invite members
            below to sync via Clerk webhooks.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {members.map((member) => (
              <div
                key={member._id}
                className="flex flex-wrap items-center justify-between gap-4 px-6 py-3.5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                    {member.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">
                      {member.name}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {member.email || member.clerkUserId}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={
                      member.role === "org:admin"
                        ? "rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground"
                        : "rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
                    }
                  >
                    {member.role}
                  </span>
                  <span className="tabular-nums text-xs text-muted-foreground">
                    Joined {new Date(member.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Clerk Organization Profile */}
      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold text-foreground">
          Organization directory & invitations
        </h2>
        <div className="overflow-x-auto">
          <OrganizationProfile routing="hash" />
        </div>
      </section>
    </div>
  );
}
