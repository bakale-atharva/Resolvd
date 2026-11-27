# Design System — Resolvd

## Visual World

Resolvd uses a **crisp editorial B2B** visual world: warm alabaster surfaces, hairline borders, deep forest-emerald accents for primary actions and active states, and restrained typography. Elevation is declared once via `1px` borders rather than heavy drop shadows.

## Color Tokens

- **Ground (`--background`):** `#fafaf9` (light) / `#0c0f0d` (dark)
- **Surface (`--card`):** `#ffffff` (light) / `#141916` (dark)
- **Sidebar (`--sidebar`):** `#f5f5f4` (light) / `#111512` (dark)
- **Primary Accent (`--primary`):** Forest Emerald `#14532d` (`oklch(0.36 0.08 152)`) with `#ffffff` foreground
- **Muted / Secondary:** Warm Stone `#f4f4f2` surface, `#57534e` secondary text
- **Borders (`--border`):** `#e7e5e4` (light) / `oklch(1 0 0 / 10%)` (dark)
- **Destructive:** `#dc2626`

## Typography

- **Sans (`--font-sans`):** `Geist` — clean, legible UI and editorial copy; `tabular-nums` for metrics, counts, and timestamps.
- **Mono (`--font-mono`):** `Geist Mono` — reserved strictly for workspace slugs, IDs, API keys, and code snippets.
- **Scale & Rhythm:** Headings use tight tracking (`-0.02em`), clear weight contrast (`600`), and more vertical space above than below.

## Surface Rules (`Operate` Mode)

- Persistent `240px` left sidebar on desktop (`lg+`) with mobile drawer/sheet toggle on smaller viewports.
- `56px` top bar with Clerk `<OrganizationSwitcher />`, active role badge (`Admin` / `Member`), and `<UserButton />`.
- Role-gated navigation: `org:admin` items (`Team`, `Knowledge Base`, `Customizer`, `Billing`) are clearly badged or hidden for `org:member` users, with server-side enforcement always backing the UI.
- Radii: `8px–12px` for cards and panels, `6px` for inputs and nav items, full pill (`9999px`) only for compact status badges.
