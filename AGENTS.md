# AGENTS.md

## What is this

Static site (GitHub Pages), no server code. Next.js App Router with
`output: 'export'`: each route is prerendered to its own `index.html`.
TypeScript (strict) + React components.

## Local dev

```bash
npm run dev      # next dev on http://localhost:3000/
npm run build    # static export to out/
npm run preview  # python3 -m http.server 4173 -d out
npm test         # unit + UI smoke tests (node --test via tsx)
npm run data:cars # 月度销量更新后，把月文件合并成按年文件
npm run data:map  # 地图原始数据更新后，重新生成精简的 china-cities.json
npm run verify   # next build + scripts/check-build.ts
```

## Structure

| Path | Purpose |
|---|---|
| `app/(site)/`, `app/(tool)/` | Two root layouts (route groups). `(site)` is the plain body, `(tool)` sets `body.tool-page` — the tool/game CSS depends on it |
| `app/(<group>)/<route>/page.tsx` | One directory per route. The page only exports metadata and renders the route component |
| `app/(<group>)/<route>/style.css` | Route-private stylesheet, imported by that route's `page.tsx` |
| `components/` | Shared UI: `SiteHeader`, `SiteFooter`, `ThemeToggle`, `JsonLd`, `Pagination`, plus one folder per interactive page |
| `components/layout/` | Route layout primitives: `Page` (the only page container) and `PageHeader` (title + one-line description + actions) |
| `components/ui/` | shadcn components (source copied into the repo, not a runtime dependency). `Card` / `Badge` are server components and ship no JS |
| `lib/` | 引擎与算法层，不 import React：`site.ts` (SEO copy), `list.ts`, `college.ts`, `car-sales.ts`, `dcf.ts`, `sport.ts`, `guess.ts`, `five-cards.ts`, `calendar.ts`, `china-map.ts`, `mahjong/` (`game.ts` flow, `ai.ts` decisions, `state.ts` shared `G`, `tile.ts` hand/tile math), `mir2/`, `photo/`. 浏览器适配也在这一层，会直接用 DOM/localStorage/fetch：`theme.ts`、`weather.ts`、`photo/`、`mahjong/game.ts` 的存档、`mir2/` |
| `types/` | Ambient declarations (jsdom ships no types; echarts has its own) |
| `public/` | Published as-is: `data/` (`college/`, `tourism/`, `car-sales/` JSON, `china-cities.json`), `images/`, `favicon.svg`, `robots.txt` |
| `public/mahjong/`, `public/mir2/` | Static assets for the two games (`svg/`, `data/`, `vendor/driver.js`); the CSS lives next to each route's `page.tsx`, their logic in `lib/`, their UI in `components/` |
| `assets/cards/`, `public/cards/webp/` | Card SVG sources + licenses (not deployed) and the generated WebP thumbnails the five-card page actually loads |
| `app/sitemap.ts` | Sitemap generated from `PAGES` (`lastMod` / `priority` live in `lib/site.ts`; cars' date follows the latest sales month) |
| `scripts/check-build.ts` | Build-output self-check (routes + sitemap, SEO tags, analytics, data shape, static assets, game CSS order) |
| `test/` | Unit tests for `lib/`, plus the two games' logic and jsdom UI smoke tests |

- Routes: `/` `/college/` `/tourism/` `/cars/` `/comfort/` `/photo/` (group `(site)`),
  `/dcf/` `/sport/` `/mahjong/` `/mir2/` `/guess/` `/five-cards/` `/calendar/` (group `(tool)`).
- `trailingSlash: true` keeps old URLs (`/college/` → `out/college/index.html`).
- User site served from the root, so `basePath` stays empty.

## Testing

Site logic, game logic, UI smoke tests and build output:

```bash
npm test          # node --test via tsx: lib/, mahjong rules + AI, jsdom UI tests
npm run verify    # build then assert titles, canonical, sitemap, data, assets, CSS order
```

Node runs `.ts` tests directly (type stripping), so relative imports to `lib/`
must carry the real extension (`../lib/dcf.ts`) — inside `lib/` too. Imports to
`lib/`/`components/` from `app/` and `components/` stay extensionless
(Next resolves them). Tests importing `.tsx` (the UI smoke tests) go through
`tsx`, which is what `npm test` uses.

mahjong has four test files: `rules` and `ai` (fast), `ui` (jsdom smoke test),
all in `npm test`, and `ai-sim` (slow full-table sim, manual only; deliberately
not named `*.test.ts` so `npm test` skips it):

```bash
node --import tsx --test test/mahjong/rules.test.ts
node --import tsx --test test/mahjong/ai.test.ts     # AI changes only
node --import tsx --test test/mahjong/ui.test.tsx    # UI/DOM changes
AI_TABLES=10 AI_THREADS=10 node --import tsx test/mahjong/ai-sim.ts  # manual

# 日历拼图全量组合验证（慢，约 15 秒，手动跑）
node --import tsx test/calendar/coverage.ts
```

When AI strategy changes: default to a 10-thread × 10-table smoke run
(`AI_TABLES=10 AI_THREADS=10 node --import tsx test/mahjong/ai-sim.ts`); only run
the full 100 tables after the user confirms. Tunables: `AI_FOCUS`, `AI_BASE`,
`AI_TABLES`, `AI_THREADS`, `AI_CIRCLES`.

Each `ai-sim` run appends one row to `test/mahjong/ai-sim-log.csv` for trend
tracking. After every run, fill in the `note` column in this format:
`<YYYY-MM-DD HH:mm> <plain-language change> (<exact params>)`.
Example: `2026-09-19 12:08 增加对领先玩家的防守权重(dangerOf按分差加权领先1.5x落后0.75x)`.

## Code style

- No lint toolchain in the repo: formatting is by hand / the editor's Prettier
  extension (`.prettierrc`, `semi: false`)
- No semicolons in JS
- `console` allowed (no-console off)
- TypeScript, `strict: true`; only erasable syntax (`enum`/`namespace` are off,
  see `erasableSyntaxOnly` in `tsconfig.json`) so `node` can run `lib/` and `test/`
- Client components start with `"use client"`; keep components server-side when
  they need no state, so less JS ships

## Conventions

- Data pages (college / tourism / cars) inline their data at build time: the
  route's `page.tsx` imports the JSON and passes it as props, so the first paint
  has rows and crawlers see them. Only college's non-default years fetch.
- SEO copy lives in `lib/site.ts`; every route exports
  `export const metadata = metadataFor('<route>')`. `scripts/check-build.ts`
  derives its route assertions from `PAGES`, so titles/canonical are never
  copied into the script
- Car sales data: `index.json` + one file per month are the source of truth;
  `npm run data:cars` merges them into `<year>.json`, which is what the page
  fetches (2 requests instead of 23). `check-build` fails if the year files are
  out of sync with the monthly files
- China map data: `assets/china-cities.source.json` is echarts' UTF8Encoding
  compressed geometry (not deployed); `npm run data:map` decodes it, simplifies
  rings (Douglas-Peucker, `eps=0.02°`), re-encodes and writes
  `public/data/china-cities.json`. `check-build` fails if it grows past 300KB
- `components/RootShell.tsx` renders the SEO-independent chrome: header, footer,
  theme first-paint script, Baidu analytics; the two root layouts
  (`app/(site)/layout.tsx`, `app/(tool)/layout.tsx`) import `globals.css` +
  `site.css` and only differ by body class. Third-party scripts must be rendered
  by React (`<script async src>`) — never inject nodes into `<head>` from an
  inline script, or hydration breaks
- Theme contract: `localStorage['theme']`, `html.dark` class, and the
  `themechange` event. `lib/theme.ts` is the single implementation;
  `components/RootShell.tsx` inlines the first-paint script that applies it
  before paint
- Styles: `app/site.css` is imported by both root layouts after
  `app/globals.css`; Next hashes the chunk, so there is no `?v=N` cache-bust any
  more. Route-private CSS is still imported in
  `app/(<group>)/<route>/page.tsx` and is emitted after `globals.css` + `site.css`
- Tailwind v4 (`@tailwindcss/postcss`, `app/globals.css`) — no preflight (site
  and games rely on browser defaults), `dark:` follows `html.dark`, site.css vars
  mapped to `bg-surface` / `text-fg-muted` / `border-line`. site.css is
  unlayered, so its rules beat utilities on its own class names; `@layer base`
  is the upgrade path. Never put a class on an element that site.css already
  defines unless you want its rules — this bit the homepage cards, where
  `.block` (site.css section) beat Tailwind's `block`; the section is now
  `.home-block`. Because route CSS now comes after site.css, keep route
  selectors scoped (no bare `table` / `body` / `th` rules)
- UI components first: check `components/ui/`; if missing, run
  `npx shadcn@latest add <name>`; only write it yourself when shadcn has no such
  component, and say why in the reply. Prefer presentational components
  (`Card` / `Badge` / `Separator`); Radix-based ones (`Dialog` / `Select` /
  `DropdownMenu` / `Tabs`) bring client JS, so justify them per page
- shadcn rules: `components.json` + `@/` alias (`tsconfig.json` `paths`; Next 16
  rejects `baseUrl`). Never run `shadcn init` and never `@import "tailwindcss"`
  — it adds preflight. Every token lives in `app/globals.css` and maps to the
  `site.css` variables; `[data-slot] { border-color }` in `@layer base` is the
  only preflight substitute. After `add`, check the generated imports: the CLI
  is known to write `from "cn"` instead of `@/lib/utils` and to install the
  `cn` / `radix-ui` packages as a side effect. Local tweaks to generated files
  are deliberate: `ui/table.tsx` drops shadcn's `text-sm` / `h-10` / `border-b`
  and accepts `containerClassName`, so `.data-page` keeps owning the data-table
  look; `ui/button.tsx` has no `asChild` (links use `<a class="button">`)
- Layout: every page except the homepage renders `<Page>` from
  `components/layout/Page` as its only `<main>`, and starts with `<PageHeader
  title=… description=…>` (actions go in the `actions` slot). Width, padding and
  breakpoints live in `.site-page` / `.page-header` in `site.css` and are written
  in `px` — don't re-declare `max-w-*` or page padding per route. Mahjong is the
  only exception: its game chrome (`body.playing`) owns the fullscreen layout
- Footer: one markup (`SiteFooter` via `RootShell`) and one size. There is no
  compact/fullscreen variant and no `data-fullscreen` attribute. Don't add
  `.site-footer` padding/size rules to route CSS; mahjong may only hide it while
  a game is running. `check-build` asserts every page's footer markup is
  identical and that no page brings `data-fullscreen` back
- The two games import their CSS from `page.tsx` like every other route
  (`./style.css`, plus `./driver.css` for mahjong). Those files carry
  `:root`/`body` rules that must win over site.css, so `scripts/check-build.ts`
  locates the chunks by content (`.site-page`, `body.playing`,
  `.driver-popover`, `.mir2-bag`) and asserts the order — don't move the game
  CSS back into `public/` or drop the assertion
- The games keep the engine imperative and the UI in React; the engine notifies
  the UI through a `setUI({...})` hook object. Element ids/classes in the game
  components mirror the old pages because the route's `style.css` depends on them
- HTML lang is `zh-CN`; all user-facing text is Chinese
- In-page links are plain `<a>`, never `next/link`

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
