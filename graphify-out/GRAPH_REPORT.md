# Graph Report - Resolvd  (2026-11-27)

## Corpus Check
- 45 files · ~15,430 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: (none) 2, .ico 1, .css 1)

## Summary
- 337 nodes · 463 edges · 25 communities (16 shown, 9 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.95)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `eb49f798`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- convex.config.ts
- Resolvd — Phased Implementation Plan
- devDependencies
- workspaces.ts
- components.json
- DashboardShell.tsx
- compilerOptions
- server.d.ts
- dependencies
- compilerOptions
- dashboard/page.tsx
- scripts
- Product
- README.md
- allowBuilds
- AGENTS.md
- convex/README.md
- Design System — Resolvd
- eslint.config.mjs
- cn
- @base-ui/react
- @openrouter/ai-sdk-provider@^3.1.0
- react-dom@19.3.0
- tailwind-merge@^3.7.1

## God Nodes (most connected - your core abstractions)
1. `convex` - 18 edges
2. `compilerOptions` - 16 edges
3. `Convex guidelines` - 15 edges
4. `compilerOptions` - 13 edges
5. `Resolvd — Phased Implementation Plan` - 11 edges
6. `@clerk/nextjs` - 10 edges
7. `Product` - 8 edges
8. `next` - 8 edges
9. `react` - 8 edges
10. `Button()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `TypeScript guidelines` --references--> `ActionCtx`  [INFERRED]
  convex/_generated/ai/guidelines.md → convex/_generated/server.d.ts
- `TypeScript guidelines` --references--> `MutationCtx`  [INFERRED]
  convex/_generated/ai/guidelines.md → convex/_generated/server.d.ts
- `TypeScript guidelines` --references--> `QueryCtx`  [INFERRED]
  convex/_generated/ai/guidelines.md → convex/_generated/server.d.ts
- `TypeScript guidelines` --references--> `Id`  [INFERRED]
  convex/_generated/ai/guidelines.md → convex/_generated/dataModel.d.ts
- `Validators` --references--> `Id`  [INFERRED]
  convex/_generated/ai/guidelines.md → convex/_generated/dataModel.d.ts

## Import Cycles
- None detected.

## Communities (25 total, 9 thin omitted)

### Community 0 - "convex.config.ts"
Cohesion: 0.14
Nodes (13): app, @convex-dev/agent@^0.7.11, @convex-dev/aggregate@^0.3.5, @convex-dev/presence@^0.4.1, @convex-dev/rag@^0.7.9, @convex-dev/rate-limiter@^0.4.3, @convex-dev/workpool@^0.5.0, @convex-dev/agent (+5 more)

### Community 1 - "Resolvd — Phased Implementation Plan"
Cohesion: 0.06
Nodes (31): Architecture Overview, Global Constraints, Phase 0: Baseline Commit, Impeccable Skill & Foundation Setup, Phase 1: Multi-Tenancy, Clerk Organizations, Onboarding & RBAC, Phase 1A: Tenant Auth Helpers, Workspace Provisioning & Authz Tests, Phase 1B: Clerk Webhooks & Membership Sync, Phase 1C: Impeccable Design Setup, Dashboard Shell, Onboarding & Team Management UI, Phase 2: Knowledge Base, Helpdesk Articles, Doc Ingestion & Website Crawler (+23 more)

### Community 2 - "devDependencies"
Cohesion: 0.15
Nodes (18): devDependencies, @edge-runtime/vm@^5.0.0, tailwindcss@4.3.3, @tailwindcss/turbopack@4.3.3, @types/node@^20, @types/react@^19, @types/react-dom@^19, typescript@^5 (+10 more)

### Community 3 - "workspaces.ts"
Cohesion: 0.07
Nodes (36): DataModel, Doc, TableNames, action, env, httpAction, internalAction, internalMutation (+28 more)

### Community 4 - "components.json"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 5 - "DashboardShell.tsx"
Cohesion: 0.08
Nodes (19): convex, ConvexClientProvider(), DashboardLayout(), geistMono, geistSans, metadata, RootLayout(), ADMIN_NAV (+11 more)

### Community 6 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 7 - "server.d.ts"
Cohesion: 0.07
Nodes (30): Action guidelines, Authentication guidelines, Component guidelines, Convex guidelines, Cron guidelines, File storage guidelines, Full text search guidelines, Function calling (+22 more)

### Community 8 - "dependencies"
Cohesion: 0.11
Nodes (18): dependencies, ai@^7.0.181, class-variance-authority@^0.7.1, @clerk/nextjs@^7.10.9, clsx@^2.1.1, motion@^14.14.0, shadcn@^4.23.0, svix@^2.11.1 (+10 more)

### Community 9 - "compilerOptions"
Cohesion: 0.12
Nodes (15): compilerOptions, allowJs, allowSyntheticDefaultImports, forceConsistentCasingInFileNames, isolatedModules, jsx, lib, module (+7 more)

### Community 10 - "dashboard/page.tsx"
Cohesion: 0.12
Nodes (18): DashboardPage(), MODEL_OPTIONS, WorkspaceSettingsForm(), TeamPage(), Button(), buttonVariants, api, components (+10 more)

### Community 11 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, backend, build, frontend, lint, start, test

### Community 12 - "Product"
Cohesion: 0.22
Nodes (8): Capabilities and Constraints, Operating Context, Platform, Positioning, Product, Product Principles, Product Purpose, Users

### Community 13 - "README.md"
Cohesion: 0.50
Nodes (3): Deploy on Vercel, Getting Started, Learn More

### Community 18 - "Design System — Resolvd"
Cohesion: 0.33
Nodes (5): Color Tokens, Design System — Resolvd, Surface Rules (`Operate` Mode), Typography, Visual World

### Community 19 - "eslint.config.mjs"
Cohesion: 0.33
Nodes (5): eslintConfig, eslint@^9, eslint-config-next@16.4.6, eslint, eslint-config-next

## Knowledge Gaps
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `convex` connect `workspaces.ts` to `convex.config.ts`, `devDependencies`, `DashboardShell.tsx`, `server.d.ts`, `dashboard/page.tsx`?**
  _High betweenness centrality (0.229) - this node is a cross-community bridge._
- **Should `convex.config.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Should `Resolvd — Phased Implementation Plan` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.14619883040935672 - nodes in this community are weakly interconnected._
- **Should `workspaces.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06711915535444947 - nodes in this community are weakly interconnected._
- **Should `components.json` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._
- **Should `DashboardShell.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07954545454545454 - nodes in this community are weakly interconnected._