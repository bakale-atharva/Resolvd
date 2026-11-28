# Resolvd

**Multi-tenant AI customer support platform** with a one-line embeddable chat widget, RAG-powered knowledge base, built-in help center, shared team inbox, and one-click human takeover.

---

## What Resolvd Does

Resolvd gives SaaS teams an end-to-end support stack where every Clerk Organization maps 1:1 to an isolated Convex workspace:

- **Multi-Tenant Workspaces & RBAC:** Clerk Organizations (`org:admin` and `org:member`) sync to isolated Convex workspaces via Svix-verified webhooks (`convex/http.ts`), with server-side tenant isolation on every query and mutation.
- **RAG Knowledge Base & Website Crawler:**
  - **Helpdesk Articles:** Markdown editor with live preview, cover image uploads (Convex File Storage), `popular` / `published` toggles, and automatic RAG indexing.
  - **Document Ingestion:** Upload `.md`, `.txt`, and `.pdf` files (`unpdf` text extraction) into workspace-scoped `@convex-dev/rag` namespaces, plus an inline **Retrieval Playground** to inspect matched chunks and similarity scores.
  - **SSRF-Guarded Website Crawler:** Bounded-concurrency crawling via `@convex-dev/workpool` with private/loopback/link-local IP blocking, HTML-to-markdown extraction, and live crawl progress tracking.
- **One-Line Embeddable Chat Widget & Help Center:**
  - **Zero-dependency loader (`public/widget.js`):** Mounts an isolated `/embed/[workspaceId]` iframe, syncs workspace theme/position/margins over `postMessage`, and triggers dwell-delay proactive messages with an optional Web Audio chime.
  - **Real-time Streaming AI & Citations:** Powered by `@convex-dev/agent` and OpenRouter (`@openrouter/ai-sdk-provider`), streaming token-by-token via `useUIMessages` + `useSmoothText` with clickable source citation pills linking directly to Help Center articles or crawled URLs.
  - **Lead Capture Gate & Built-in Help Center:** Optional pre-chat lead capture form, expandable quick FAQs, and searchable published articles.

---

## Tech Stack

- **Framework:** Next.js 16.4 (App Router, `proxy.ts`), React 19, TypeScript, Tailwind CSS v4
- **Backend & Real-Time:** Convex (`@convex-dev/agent`, `@convex-dev/rag`, `@convex-dev/presence`, `@convex-dev/rate-limiter`, `@convex-dev/workpool`, `@convex-dev/aggregate`)
- **AI & Embeddings:** OpenRouter (`@openrouter/ai-sdk-provider`) + Vercel `ai` SDK (`openrouter/free` default chat model, `nvidia/nemotron-3.5-embed-1b:free` for 2048-dim RAG embeddings)
- **Auth & Billing:** Clerk (`@clerk/nextjs`) Organizations, RBAC, and Svix webhook verification
- **UI & Motion:** `shadcn/ui`, `motion`, `lucide-react`
- **Testing:** Vitest, `convex-test`, `@edge-runtime/vm`

---

## Project Structure

```text
app/
  dashboard/
    page.tsx                  # Workspace overview & onboarding
    knowledge-base/page.tsx   # Articles, document ingestion & website crawler
    team/page.tsx             # Clerk OrganizationProfile & synced members
  embed/[workspaceId]/page.tsx # Isolated iframe widget (Home, Chat, Help)
  demo-host/page.tsx          # Sandbox host page for testing /widget.js
components/
  dashboard/                  # App shell, navigation, workspace cards
  knowledge-base/             # ArticlesTab, DocumentsTab, CrawlerTab, MarkdownPreview
  widget/                     # EmbedWidget, WidgetHomeView, WidgetChatView, WidgetHelpView
convex/
  schema.ts                   # Workspaces, memberships, widgetConfigs, conversations, leads, articles, kbSources, crawlPages, messageCitations, usageMeters
  agent.ts                    # @convex-dev/agent + OpenRouter streaming & RAG citations
  widget.ts                   # Public widget & help center queries/mutations
  rag.ts, articles.ts         # RAG namespace management & helpdesk articles
  documents.ts, crawler.ts    # File ingestion & SSRF-guarded workpool crawler
  workspaces.ts, http.ts      # Multi-tenant provisioning & Clerk webhooks
public/
  widget.js                   # One-line embeddable launcher & iframe bridge
```

---

## Getting Started

1. **Install dependencies:**

   ```bash
   pnpm install
   ```

2. **Configure environment variables:**
   - Set Clerk and Convex keys in `.env.local` (`NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`).
   - Set `OPENROUTER_API_KEY` (and `CLERK_WEBHOOK_SECRET` for webhooks) in your Convex deployment environment.

3. **Run the backend and frontend dev servers:**

   ```bash
   pnpm backend   # starts convex dev
   pnpm frontend  # starts next dev
   ```

4. **Preview the embeddable widget:**
   - Sign in at `http://localhost:3000/dashboard` to provision your workspace.
   - Open `http://localhost:3000/demo-host` to test the floating launcher, streaming AI chat, citations, lead gate, and Help Center.

### Embed Snippet

```html
<script src="https://your-domain.com/widget.js" data-workspace-id="YOUR_WORKSPACE_ID" defer></script>
```

---

## Scripts

```bash
pnpm test      # Run Vitest + convex-test suite
pnpm lint      # Run ESLint
pnpm build     # Run production Next.js build + TypeScript check
```

---

## Roadmap

- **Phase 0–3 (Implemented):** Foundation, Multi-Tenancy & Clerk Organizations, RAG Knowledge Base & Website Crawler, AI Agent, Embeddable Iframe Widget & Built-in Help Center.
- **Phase 4:** Shared Team Inbox, `@convex-dev/presence` live viewing/typing indicators, and one-click AI-to-human takeover.
- **Phase 5:** Lead Management Pipeline (filterable table + CSV export) & live-preview Widget Customizer.
- **Phase 6:** Clerk Organization Billing (`Free` / `Pro` / `Scale`), `@convex-dev/rate-limiter`, and `@convex-dev/aggregate` usage metering.
- **Phase 7:** Animated marketing landing page, public pricing page, install guide, and final QA.
