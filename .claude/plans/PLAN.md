# Resolvd — Phased Implementation Plan

> **Status:** Draft — Awaiting final user approval before executing Phase 0.
> **Workflow Rule:** Build backend and frontend together in vertical slices so every backend function is immediately testable in the UI. Each major phase is divided into granular **subphases (A, B, C…)** for tight control and incremental verification. At the end of each major phase, open **one PR** (`feat/...` or `chore/...`), **stop**, and wait for user approval before merging and starting the next phase.

---

## Architecture Overview

- **Framework:** Next.js 16.4 (App Router, `proxy.ts`), React 19, Tailwind CSS v4, TypeScript
- **Backend & Real-Time:** Convex (`^1.51.0`) with Convex Components:
  - `@convex-dev/agent` — durable AI threads, `streamText` / `DeltaStreamer`, `useUIMessages` & `useSmoothText`
  - `@convex-dev/rag` — document chunking, vector embeddings, and namespace-isolated semantic retrieval
  - `@convex-dev/presence` — ephemeral room presence (who's viewing) & typing indicators
  - `@convex-dev/rate-limiter` — per-workspace/per-visitor API throttling & quota enforcement
  - `@convex-dev/workpool` — bounded-concurrency website crawling & document ingestion jobs
  - `@convex-dev/aggregate` — $O(\log n)$ counts for unread conversations, leads, and monthly usage meters
- **AI Provider:** OpenRouter via `@openrouter/ai-sdk-provider` + Vercel `ai` SDK (configurable chat model per workspace + `openai/text-embedding-3-small` for embeddings)
- **Auth & Billing:** Clerk (`@clerk/nextjs` `^7.10.9`)
  - Clerk Organizations (`orgId`, `orgRole`) map 1:1 to isolated Convex `workspaces`
  - Roles: `org:admin` (gates KB, Customizer, Billing, Team) and `org:member` (Inbox, Leads)
  - Clerk Billing (`<PricingTable for="organization" />`, `has()`, and Svix-verified webhooks in `convex/http.ts`) for `Free` / `Pro` / `Scale` tiers
- **UI & Motion:** `shadcn/ui`, `motion` (`motion.dev`), Kokonut UI, BKLit UI, `lucide-react`, guided by the `impeccable` design skill
- **Testing:** Vitest + `convex-test` + `@edge-runtime/vm` for Convex backend & authz tests, plus live UI verification per subphase

---

## Global Constraints

1. **Always consult latest docs** via Context7 MCP, `node_modules/next/dist/docs/`, `convex/_generated/ai/guidelines.md`, and installed Clerk/Convex/Impeccable skills before writing code.
2. **Strict tenant isolation:** Every workspace-scoped query/mutation derives `orgId` and `tokenIdentifier` from `ctx.auth.getUserIdentity()`, never from client-supplied user/org IDs (except public widget endpoints scoped strictly to a published `workspaceId` + visitor `sessionToken`).
3. **No unbounded `.collect()`:** Use `.withIndex()`, `.take(n)`, `.paginate(paginationOpts)`, or `@convex-dev/aggregate` per Convex guidelines.
4. **PR Gate:** Complete all subphases of a major phase, run `pnpm lint`, `pnpm build`, and `vitest run`, then open **one GitHub PR** (`feat/...`). Do not merge or proceed without explicit user approval.

---

## Phase 0: Baseline Commit, Impeccable Skill & Foundation Setup

**Branch / PR:** `chore/phase-0-foundation`  
**Goal:** Lock in a clean `main` baseline, install `impeccable` and all core UI/Convex/test dependencies, and establish the Convex component & schema skeleton.

- **Git Baseline:** Review and commit existing uncommitted Clerk + Convex starter files (`app/layout.tsx`, `app/ConvexClientProvider.tsx`, `app/sign-in/`, `app/sign-up/`, `proxy.ts`, `package.json`, `pnpm-lock.yaml`) to `main` (and push), then create branch `chore/phase-0-foundation`.
- **Impeccable Skill:** Install the `impeccable` skill (`npx skills add`) and verify `SKILL.md` is available.
- **UI & Motion Stack:** Install `shadcn/ui` init (Tailwind v4), `motion`, `lucide-react`, and Kokonut UI / BKLit UI primitives.
- **Convex Components, AI & Test Harness:** Install `@convex-dev/agent`, `@convex-dev/rag`, `@convex-dev/presence`, `@convex-dev/rate-limiter`, `@convex-dev/workpool`, `@convex-dev/aggregate`, `ai`, `@openrouter/ai-sdk-provider`, `svix`, `unpdf`, plus `vitest`, `convex-test`, `@edge-runtime/vm` (`vitest.config.ts` with `environment: "edge-runtime"`).
- **Convex Config & Schema:** Create `convex/convex.config.ts` (mounting `agent`, `rag`, `presence`, `rateLimiter`, `workpool`, `aggregate`) and `convex/schema.ts` (`workspaces`, `memberships`, `widgetConfigs`, `conversations`, `leads`, `articles`, `kbSources`, `crawlPages`, `usageMeters`).
- **Verification & PR Gate:** Run `npx convex codegen`, `pnpm build`, `pnpm lint`, and a smoke `vitest run` test -> open PR `chore/phase-0-foundation` -> stop for approval.

---

## Phase 1: Multi-Tenancy, Clerk Organizations, Onboarding & RBAC

**Branch / PR:** `feat/multi-tenancy-auth`  
**Goal:** Map Clerk Organizations 1:1 to isolated Convex workspaces with role-based access (`org:admin` vs `org:member`) and an authenticated dashboard shell.

### Phase 1A: Tenant Auth Helpers, Workspace Provisioning & Authz Tests
- **Backend:** `convex/lib/auth.ts` (`requireIdentity`, `requireWorkspaceMember`, `requireWorkspaceAdmin`) deriving `orgId` & `tokenIdentifier` from JWT claims.
- **Backend:** `convex/workspaces.ts` (`provisionWorkspace`, `getCurrentWorkspace`, `updateWorkspaceSettings`).
- **Tests:** `convex/__tests__/authz.test.ts` proving cross-tenant isolation (Org A cannot read/write Org B) and RBAC (`org:member` rejected from admin mutations).

### Phase 1B: Clerk Webhooks & Membership Sync
- **Backend:** Svix-verified Clerk webhook handler in `convex/http.ts` (or Next.js `/api/webhooks/clerk` calling internal Convex mutations) for `organization.created`, `organization.updated`, `organizationMembership.created`, `organizationMembership.updated`, `organizationMembership.deleted`.
- **Backend:** `convex/memberships.ts` queries/internal mutations to list workspace members and roles.

### Phase 1C: Impeccable Design Setup, Dashboard Shell, Onboarding & Team Management UI
- **Impeccable Step-by-Step Setup:**
  1. Run `.agents/skills/impeccable/scripts/impeccable context` and follow the `init` playbook to create `PRODUCT.md` (defining Resolvd's product truth, target enterprise users, and surface modes: `Operate` for `/dashboard`, `Read` for Help Center, `Persuade` for `/`).
  2. Follow `reference/new-work.md` + `reference/new-work-world.md` to establish Resolvd's visual world, typography, color tokens, and `DESIGN.md`.
  3. Read `reference/craft-floor.md` before writing UI components.
- **Frontend:** `app/dashboard/layout.tsx` responsive B2B shell (sidebar + topbar with `<OrganizationSwitcher />`, `<UserButton />`, role badge, and role-gated navigation).
- **Frontend:** `app/dashboard/page.tsx` workspace overview + automatic onboarding flow (`<CreateOrganization />` / `<OrganizationList />` + one-click workspace provisioning).
- **Frontend:** `app/dashboard/team/page.tsx` (`org:admin` gated) embedding Clerk `<OrganizationProfile />` alongside synced Convex workspace members.
- **PR Gate:** Verify in UI + `vitest run` + `pnpm build` -> open PR `feat/multi-tenancy-auth` -> stop for approval.

---

## Phase 2: Knowledge Base, Helpdesk Articles, Doc Ingestion & Website Crawler

**Branch / PR:** `feat/knowledge-base-crawler`  
**Goal:** Build the full Knowledge Base suite backed by `@convex-dev/rag`, `@convex-dev/workpool`, Convex File Storage, and an SSRF-guarded website crawler.

### Phase 2A: RAG Setup & Helpdesk Articles CRUD
- **Backend:** `convex/rag.ts` configuring `@convex-dev/rag` with OpenRouter embeddings (`openai/text-embedding-3-small`) and workspace-scoped namespaces (`ws_${workspaceId}`).
- **Backend:** `convex/articles.ts` (`createArticle`, `updateArticle`, `deleteArticle`, `listArticles`, `getArticleBySlug`, `generateUploadUrl` for cover images) + auto-sync published articles into RAG.
- **Frontend:** `/dashboard/knowledge-base` shell + **Articles Tab** (CRUD, markdown editor + live preview, cover image upload, `popular` & `published` toggles).

### Phase 2B: Document Upload (`.md` / `.txt` / `.pdf`) & Retrieval Playground
- **Backend:** `convex/documents.ts` + `convex/documentsNode.ts` (`"use node"`) to upload files via Convex storage, extract text (`unpdf` for PDFs), chunk, and ingest into `@convex-dev/rag` with status tracking (`processing` | `ready` | `failed`) in `kbSources`.
- **Backend:** `testRetrieval` admin action in `convex/rag.ts` returning matched chunks + similarity scores.
- **Frontend:** **Documents Tab** (drag-and-drop `.md`/`.txt`/`.pdf` uploader + live status badges) + inline **Test Retrieval Playground** to query the workspace KB.

### Phase 2C: SSRF-Guarded Website Crawler
- **Backend:** `convex/crawler.ts` + `convex/crawlerNode.ts` (`"use node"`):
  - `validateCrawlUrl` SSRF guard blocking loopback (`127.0.0.0/8`, `::1`), private (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), link-local/metadata (`169.254.0.0/16`), and non-HTTP(S) URLs.
  - `@convex-dev/workpool` bounded-concurrency crawl queue with page cap, depth limit, HTML-to-markdown extraction, RAG ingestion, and live progress on `kbSources` / `crawlPages`.
- **Tests:** `convex/__tests__/kb.test.ts` testing article CRUD, tenant isolation, and SSRF rejection.
- **Frontend:** **Website Crawler Tab** (URL input, max-pages cap, live progress bar `crawled / total`, crawled pages drawer, re-crawl/delete).
- **PR Gate:** Test articles, PDF upload, public crawl, SSRF block, and retrieval playground -> open PR `feat/knowledge-base-crawler` -> stop for approval.

---

## Phase 3: AI Agent, Embeddable Iframe Chat Widget & Built-in Help Center

**Branch / PR:** `feat/embeddable-chat-widget`  
**Goal:** Deliver the one-line embeddable iframe chat widget with token-by-token streaming AI answers (OpenRouter + `@convex-dev/agent` + RAG citations), lead capture gate, proactive dwell messages, and built-in Help Center.

### Phase 3A: Convex Agent + OpenRouter Streaming & RAG Citations
- **Backend:** `convex/agent.ts` defining Resolvd support `Agent(components.agent, ...)` with `@openrouter/ai-sdk-provider`, workspace instructions, RAG context injection, and structured source citations (`article` / `document` / `url`).
- **Backend:** `convex/widget.ts` (`getPublicWidgetConfig`, `startOrResumeVisitorSession`, `sendVisitorMessage` triggering `streamText` / `DeltaStreamer`, `listWidgetMessages` compatible with `useUIMessages`, `searchPublicArticles`, `getPublicArticle`).

### Phase 3B: Isolated Iframe Widget UI (`/embed/[workspaceId]`)
- **Frontend:** `app/embed/[workspaceId]/page.tsx` (zero dashboard chrome) with 3 views:
  - **Home:** Branded header, proactive welcome card, quick FAQ chips, "Start a conversation" CTA.
  - **Chat:** Optional Lead Capture Gate (name/email/phone), real-time streaming via `useUIMessages(..., { stream: true })` + `useSmoothText`, and clickable source citation pills.
  - **Help:** Searchable published articles list + clean markdown reader.

### Phase 3C: One-Line Vanilla JS Loader (`public/widget.js`) & Demo Host
- **Frontend:** `public/widget.js` (~3KB zero-dependency script) reading `data-workspace-id`, rendering themed launcher button, handling dwell-delay proactive message bubble + optional sound, and mounting the isolated `<iframe>`.
- **Frontend:** `app/demo-host/page.tsx` internal sandbox page embedding `<script src="/widget.js" data-workspace-id="..." />`.
- **PR Gate:** Test full widget flow on `/demo-host` -> open PR `feat/embeddable-chat-widget` -> stop for approval.

---

## Phase 4: Shared Team Inbox, Live Presence & One-Click Human Takeover

**Branch / PR:** `feat/shared-team-inbox`  
**Goal:** Build the real-time two-pane shared team inbox with live presence, typing indicators, assignment, status management, and one-click AI-to-human takeover.

### Phase 4A: Inbox Queries, Aggregates, Assignment & Human Takeover
- **Backend:** `convex/inbox.ts` with `@convex-dev/aggregate` live filter counts (`all`, `unread`, `unassigned`, `mine`, new leads), `listConversations`, `getConversationDetail`, `markAsRead`, `assignConversation`, `updateConversationStatus` (`open` | `closed`), `toggleAiTakeover` (`ai` | `human`), and `sendAgentReply` (writes directly into `@convex-dev/agent` thread).

### Phase 4B: Live Presence & Typing Indicators
- **Backend:** `convex/presence.ts` wrapping `@convex-dev/presence` for conversation room viewing ("who's viewing") and bidirectional typing indicators (agent & visitor).
- **Frontend:** Wire typing heartbeat into `/embed/[workspaceId]` plus "Agent is typing…" and "Connected with [Agent]" banner during human takeover.

### Phase 4C: Two-Pane Real-Time Inbox UI
- **Frontend:** `app/dashboard/inbox/page.tsx`:
  - **Left Pane:** Filter tabs with live `@convex-dev/aggregate` count badges, real-time conversation list with unread dots and `AI`/`Human` mode badges.
  - **Right Pane:** Thread header (live presence avatars, Assignee dropdown, Open/Closed toggle, **Take Over / Hand Back to AI** button), real-time message thread, typing indicator, and composer (`Cmd+Enter` to send).
- **PR Gate:** Side-by-side test with `/demo-host` and `/dashboard/inbox` -> open PR `feat/shared-team-inbox` -> stop for approval.

---

## Phase 5: Lead Management Pipeline & Widget Customizer

**Branch / PR:** `feat/leads-and-customizer`  
**Goal:** Complete the CRM lead pipeline (sortable/filterable/paginated table + CSV export) and the live-preview Widget Customizer.

### Phase 5A: Lead Management Pipeline & CSV Export
- **Backend:** `convex/leads.ts` (`createOrUpdateLead`, `listLeads` with `status`/`source`/search filters + `paginationOptsValidator`, `updateLeadStatus` for `new` -> `contacted` -> `closed`, `exportLeadsCsv`).
- **Frontend:** `app/dashboard/leads/page.tsx` sortable data table, status/source/search filters, inline status updates, link to conversation, pagination controls, and **Export CSV** button.

### Phase 5B: Widget Customizer & Live Preview Iframe
- **Backend:** `convex/widgetConfig.ts` (`getWidgetConfig`, `updateWidgetConfig` gated to `org:admin`) for Appearance (colors, radius, margins, title, subtitle, logo upload, position, sound) and Behaviour (proactive toggle + dwell delay, lead capture gate fields, quick FAQs).
- **Frontend:** `app/dashboard/customizer/page.tsx` (`org:admin` gated) split-screen editor with Appearance & Behaviour controls on the left, live preview `<iframe>` on the right, and copy-paste `<script>` snippet.
- **PR Gate:** Test lead lifecycle + CSV export and live widget customization -> open PR `feat/leads-and-customizer` -> stop for approval.

---

## Phase 6: Clerk Billing, Quotas, Rate Limiting & Usage Metering

**Branch / PR:** `feat/billing-and-quotas`  
**Goal:** Enforce `Free` / `Pro` / `Scale` SaaS tiers using Clerk Organization Billing, webhook synchronization, `@convex-dev/rate-limiter`, and `@convex-dev/aggregate` usage metering.

### Tier Matrix (Default)
| Quota / Feature | Free | Pro | Scale |
|---|---|---|---|
| AI Messages / month | 100 | 2,500 | 25,000 |
| Team Seats | 2 | 10 | Unlimited |
| KB Documents & Articles | 10 | 100 | 1,000 |
| Website Crawl Pages / job | 10 | 100 | 1,000 |
| Remove Resolvd Branding / Custom CSS | No | Yes | Yes |

### Phase 6A: Billing Webhooks, Plan Sync & Quota Enforcement
- **Backend:** `convex/billing.ts` (plan definitions, `getUsageAndPlan` query, `assertQuotaAvailable` helper) + Clerk billing webhooks (`subscription.created`, `subscription.updated`, `subscription.active`, `subscription.pastDue`) in `convex/http.ts`.
- **Backend:** Wire `@convex-dev/rate-limiter` + `assertQuotaAvailable` into `agent.ts`, `documents.ts`, `articles.ts`, `crawler.ts`, and `workspaces.ts`.
- **Tests:** `convex/__tests__/billing.test.ts` verifying quota caps reject excess usage.

### Phase 6B: Billing Dashboard, Pricing Table & Upgrade Prompts
- **Frontend:** `app/dashboard/billing/page.tsx` (`org:admin` gated) with current plan badge, animated quota progress bars (`AI Messages`, `Seats`, `KB Documents`, `Crawl Pages`), and Clerk `<PricingTable for="organization" />` checkout drawer.
- **Frontend:** Graceful upgrade banners/modals in KB, Crawler, and Widget when hitting plan limits.
- **PR Gate:** Verify quota enforcement + `<PricingTable for="organization" />` + `vitest run` -> open PR `feat/billing-and-quotas` -> stop for approval.

---

## Phase 7: Marketing Landing Page, Pricing Page, Install Guide & Polish

**Branch / PR:** `feat/marketing-and-polish`  
**Goal:** Build the portfolio-grade public marketing experience, pricing comparison, install/setup guide, and perform a full Impeccable visual & QA pass.

### Phase 7A: Demo Workspace Seeder & Install Guide
- **Backend:** `convex/seed.ts` idempotent demo workspace seeder (sample articles, widget config, conversations/leads) for the public landing page's live widget.
- **Frontend:** `app/dashboard/install/page.tsx` with framework-specific copy-paste snippets (Plain HTML, Next.js `next/script`, React) and a "Verify Installation" ping check.

### Phase 7B: Animated Marketing Landing Page & Public Pricing Page
- **Frontend:** `app/page.tsx` animated landing page (`motion.dev`, `shadcn/ui`, Kokonut UI / BKLit UI) with interactive hero preview, feature bento, and live embedded Resolvd widget in the corner.
- **Frontend:** `app/pricing/page.tsx` public pricing page with `Free` / `Pro` / `Scale` comparison matrix, Clerk `<PricingTable />`, and animated FAQ accordion.

### Phase 7C: Impeccable Design Audit & Final QA
- Run `impeccable` UI/UX, responsive, and accessibility audit across all public and dashboard routes.
- Run final `pnpm lint`, `pnpm build`, `vitest run`, and end-to-end verification.
- **PR Gate:** Open PR `feat/marketing-and-polish` -> stop for final approval.
