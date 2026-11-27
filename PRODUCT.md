# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Support Admins (`org:admin`):** Founders, heads of support, and operations leads who configure the AI assistant, curate the Knowledge Base, customize the embeddable widget, manage team seats, and handle billing.
- **Support Agents (`org:member`):** Customer support and success team members who triage the Shared Team Inbox, monitor AI conversations, take over live chats, and manage captured leads.
- **End-User Visitors:** Customers on a workspace's website interacting with the embedded chat widget and Help Center.

## Product Purpose

Resolvd is a multi-tenant AI customer support platform. Each Clerk Organization maps 1:1 to an isolated Convex workspace where teams train an AI support agent on their own articles, uploaded documents, and crawled websites, embed a single-line chat widget on any site, and step in with one-click human takeover inside a real-time shared inbox.

## Positioning

A unified real-time support workspace built on Convex and Clerk Organizations: instant token-by-token streaming AI answers grounded in workspace-isolated RAG citations, paired seamlessly with live team presence and zero-friction human handoff.

## Operating Context

- **Dashboard (`/dashboard/*`) — `Operate` mode:** High-clarity workspace shell for daily triage, KB curation, widget configuration, lead pipeline, and team management.
- **Embeddable Widget & Help Center (`/embed/[workspaceId]`) — `Read` / `Operate` mode:** Zero-chrome isolated iframe with Home, streaming Chat, and searchable Help Center.
- **Marketing & Pricing (`/`, `/pricing`) — `Persuade` mode:** Public product showcase with interactive preview and live embedded Resolvd widget.

## Capabilities and Constraints

- **Multi-tenancy:** Strict tenant isolation derived server-side from Clerk JWT `org_id` and `tokenIdentifier`; never from client-supplied org or user IDs.
- **RBAC:** `org:admin` gates Knowledge Base, Widget Customizer, Team Management, and Billing; `org:member` accesses Overview, Inbox, and Leads.
- **Stack:** Next.js 16.4 (App Router), React 19, Tailwind CSS v4, shadcn/ui, Motion, Convex (`@convex-dev/agent`, `rag`, `presence`, `rate-limiter`, `workpool`, `aggregate`), Clerk Organizations & Billing.

## Product Principles

1. **Tenant isolation is structural:** Every query, mutation, and vector namespace is scoped to the authenticated workspace.
2. **Operate with calm precision:** Dashboard surfaces prioritize scanability, keyboard efficiency, and clear status over decorative chrome.
3. **Graceful human handoff:** AI and human agents share a single durable thread without losing context.
