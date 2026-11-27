"use client";

import { useAuth } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import {
  ArrowLeft,
  BookOpen,
  FileText,
  Globe,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ArticlesTab } from "@/components/knowledge-base/ArticlesTab";
import { CrawlerTab } from "@/components/knowledge-base/CrawlerTab";
import { DocumentsTab } from "@/components/knowledge-base/DocumentsTab";
import { Button } from "@/components/ui/button";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";

type KbTab = "articles" | "documents" | "crawler";

export default function KnowledgeBasePage() {
  const { isLoaded, orgRole } = useAuth();
  const currentWorkspace = useQuery(api.workspaces.getCurrentWorkspace);
  const [activeTab, setActiveTab] = useState<KbTab>("articles");

  const articles = useQuery(
    api.articles.listArticles,
    currentWorkspace?.workspace ? {} : "skip",
  );
  const documents = useQuery(
    api.documents.listDocuments,
    currentWorkspace?.workspace ? {} : "skip",
  );
  const websites = useQuery(
    api.crawler.listWebsiteSources,
    currentWorkspace?.workspace ? {} : "skip",
  );

  if (!isLoaded || currentWorkspace === undefined) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span>Loading knowledge base...</span>
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
            Knowledge Base curation, document ingestion, and website crawling
            are restricted to{" "}
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

  if (!currentWorkspace?.workspace) {
    return (
      <div className="mx-auto max-w-lg py-12">
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <h1 className="text-lg font-semibold text-foreground">
            Workspace not provisioned
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Provision your organization&apos;s workspace on the Overview page
            before adding knowledge base sources.
          </p>
          <div className="mt-6">
            <Link href="/dashboard">
              <Button size="sm">Go to Overview</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const tabs: {
    id: KbTab;
    label: string;
    icon: typeof BookOpen;
    count?: number;
  }[] = [
    {
      id: "articles",
      label: "Articles",
      icon: BookOpen,
      count: articles?.length,
    },
    {
      id: "documents",
      label: "Documents & Playground",
      icon: FileText,
      count: documents?.length,
    },
    {
      id: "crawler",
      label: "Website Crawler",
      icon: Globe,
      count: websites?.length,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Knowledge Base
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Manage helpdesk articles, upload documents, and crawl public websites
          to train your workspace&apos;s RAG-powered AI support agent.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] tabular-nums",
                    active
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-secondary text-secondary-foreground",
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active Tab Content */}
      {activeTab === "articles" && <ArticlesTab />}
      {activeTab === "documents" && <DocumentsTab />}
      {activeTab === "crawler" && <CrawlerTab />}
    </div>
  );
}
