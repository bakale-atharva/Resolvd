# Graph Report - Resolvd  (2026-11-27)

## Corpus Check
- 45 files · ~15,541 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .ico 1, .css 1)

## Summary
- 337 nodes · 466 edges · 17 communities (13 shown, 4 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.95)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `bb9900a1`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Resolvd — Phased Implementation Plan
- devDependencies
- workspaces.ts
- components.json
- DashboardShell.tsx
- compilerOptions
- server.d.ts
- package.json
- compilerOptions
- dashboard/page.tsx
- Product
- README.md
- allowBuilds
- AGENTS.md
- convex/README.md
- Design System — Resolvd

## God Nodes (most connected - your core abstractions)
1. `convex` - 18 edges
2. `compilerOptions` - 16 edges
3. `Convex guidelines` - 15 edges
4. `compilerOptions` - 13 edges
5. `Resolvd — Phased Implementation Plan` - 11 edges
6. `@clerk/nextjs` - 10 edges
7. `requireIdentity()` - 8 edges
8. `requireWorkspaceMember()` - 8 edges
9. `Product` - 8 edges
10. `next` - 8 edges

## Surprising Connections (you probably didn't know these)
- `Phase 1A: Tenant Auth Helpers, Workspace Provisioning & Authz Tests` --references--> `requireIdentity()`  [INFERRED]
  .claude/plans/PLAN.md → convex/lib/auth.ts
- `Phase 1A: Tenant Auth Helpers, Workspace Provisioning & Authz Tests` --references--> `requireWorkspaceAdmin()`  [INFERRED]
  .claude/plans/PLAN.md → convex/lib/auth.ts
- `Phase 1A: Tenant Auth Helpers, Workspace Provisioning & Authz Tests` --references--> `requireWorkspaceMember()`  [INFERRED]
  .claude/plans/PLAN.md → convex/lib/auth.ts
- `TypeScript guidelines` --references--> `ActionCtx`  [INFERRED]
  convex/_generated/ai/guidelines.md → convex/_generated/server.d.ts
- `TypeScript guidelines` --references--> `MutationCtx`  [INFERRED]
  convex/_generated/ai/guidelines.md → convex/_generated/server.d.ts

## Import Cycles
- None detected.

## Communities (17 total, 4 thin omitted)

### Community 1 - "Resolvd — Phased Implementation Plan"
Cohesion: 0.07
Nodes (27): Architecture Overview, Global Constraints, Phase 0: Baseline Commit, Impeccable Skill & Foundation Setup, Phase 2: Knowledge Base, Helpdesk Articles, Doc Ingestion & Website Crawler, Phase 2A: RAG Setup & Helpdesk Articles CRUD, Phase 2B: Document Upload (`.md` / `.txt` / `.pdf`) & Retrieval Playground, Phase 2C: SSRF-Guarded Website Crawler, Phase 3: AI Agent, Embeddable Iframe Chat Widget & Built-in Help Center (+19 more)

### Community 2 - "devDependencies"
Cohesion: 0.07
Nodes (27): eslintConfig, devDependencies, @edge-runtime/vm@^5.0.0, eslint@^9, eslint-config-next@16.4.6, tailwindcss@4.3.3, @tailwindcss/turbopack@4.3.3, @types/node@^20 (+19 more)

### Community 3 - "workspaces.ts"
Cohesion: 0.06
Nodes (40): Phase 1: Multi-Tenancy, Clerk Organizations, Onboarding & RBAC, Phase 1A: Tenant Auth Helpers, Workspace Provisioning & Authz Tests, Phase 1B: Clerk Webhooks & Membership Sync, Phase 1C: Impeccable Design Setup, Dashboard Shell, Onboarding & Team Management UI, DataModel, Doc, TableNames, action (+32 more)

### Community 4 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 5 - "DashboardShell.tsx"
Cohesion: 0.07
Nodes (20): convex, ConvexClientProvider(), DashboardLayout(), geistMono, geistSans, metadata, RootLayout(), ADMIN_NAV (+12 more)

### Community 6 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 7 - "server.d.ts"
Cohesion: 0.07
Nodes (30): Action guidelines, Authentication guidelines, Component guidelines, Convex guidelines, Cron guidelines, File storage guidelines, Full text search guidelines, Function calling (+22 more)

### Community 8 - "package.json"
Cohesion: 0.07
Nodes (42): app, dependencies, ai@^7.0.181, @base-ui/react@^1.9.0, class-variance-authority@^0.7.1, @clerk/nextjs@^7.10.9, clsx@^2.1.1, @convex-dev/agent@^0.7.11 (+34 more)

### Community 9 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, allowJs, allowSyntheticDefaultImports, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module (+7 more)

### Community 10 - "dashboard/page.tsx"
Cohesion: 0.12
Nodes (18): DashboardPage(), MODEL_OPTIONS, WorkspaceSettingsForm(), TeamPage(), Button(), buttonVariants, api, components (+10 more)

### Community 12 - "Product"
Cohesion: 0.22
Nodes (8): Capabilities and Constraints, Operating Context, Platform, Positioning, Product, Product Principles, Product Purpose, Users

### Community 13 - "README.md"
Cohesion: 0.50
Nodes (3): Deploy on Vercel, Getting Started, Learn More

### Community 18 - "Design System — Resolvd"
Cohesion: 0.33
Nodes (5): Color Tokens, Design System — Resolvd, Surface Rules (`Operate` Mode), Typography, Visual World

## Knowledge Gaps
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `convex` connect `workspaces.ts` to `package.json`, `dashboard/page.tsx`, `DashboardShell.tsx`, `server.d.ts`?**
  _High betweenness centrality (0.323) - this node is a cross-community bridge._
- **Should `Resolvd — Phased Implementation Plan` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._
- **Why does `Phase 1: Multi-Tenancy, Clerk Organizations, Onboarding & RBAC` connect `workspaces.ts` to `Resolvd — Phased Implementation Plan`?**
  _High betweenness centrality (0.119) - this node is a cross-community bridge._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._
- **Should `workspaces.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06168831168831169 - nodes in this community are weakly interconnected._
- **Should `components.json` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._
- **Should `DashboardShell.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._