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
npm run verify   # next build + scripts/check-build.ts
```

## Structure

| Path | Purpose |
|---|---|
| `app/(site)/`, `app/(tool)/` | Two root layouts (route groups). `(site)` is the plain body, `(tool)` sets `body.tool-page` — the tool/game CSS depends on it |
| `app/(<group>)/<route>/page.tsx` | One directory per route. The page only exports metadata and renders the route component |
| `app/(<group>)/<route>/style.css` | Route-private stylesheet, imported by that route's `page.tsx` |
| `components/` | Shared UI: `SiteHeader`, `SiteFooter`, `ThemeToggle`, `JsonLd`, `Pagination`, plus one folder per interactive page |
| `lib/` | Pure logic, no DOM or React: `site.ts` (SEO copy), `theme.ts`, `list.ts`, `college.ts`, `weather.ts`, `dcf.ts`, `sport.ts`, `photo/`, `mahjong/`, `mir2/` |
| `types/` | Ambient declarations (echarts and jsdom ship no types) |
| `public/` | Published as-is: `assets/` (site CSS + data JSON), `images/`, `favicon.svg`, `robots.txt`, `sitemap.xml` |
| `public/mahjong/`, `public/mir2/` | Static assets for the two games (`style.css`, `svg/`, `data/`, `vendor/driver.js`); their logic lives in `lib/` and their UI in `components/` |
| `scripts/check-build.ts` | Build-output self-check (routes, SEO tags, analytics, static assets, game CSS order) |
| `test/` | Unit tests for `lib/`, plus the two games' logic and jsdom UI smoke tests |

- Routes: `/` `/college/` `/tourism/` `/comfort/` `/photo/` (group `(site)`),
  `/dcf/` `/sport/` `/mahjong/` `/mir2/` (group `(tool)`).
- `trailingSlash: true` keeps old URLs (`/college/` → `out/college/index.html`).
- User site served from the root, so `basePath` stays empty.

## Testing

Site logic, game logic, UI smoke tests and build output:

```bash
npm test          # node --test via tsx: lib/, mahjong rules + AI, jsdom UI tests
npm run verify    # build then assert titles, canonical, analytics, assets, CSS order
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

- ESLint extends `@antfu`; Prettier `semi: false`
- No semicolons in JS
- `console` allowed (no-console off)
- TypeScript, `strict: true`; only erasable syntax (`enum`/`namespace` are off,
  see `erasableSyntaxOnly` in `tsconfig.json`) so `node` can run `lib/` and `test/`
- Client components start with `"use client"`; keep components server-side when
  they need no state, so less JS ships

## Conventions

- SEO copy lives in `lib/site.ts`; every route exports
  `export const metadata = metadataFor('<route>')`
- `components/RootShell.tsx` renders the SEO-independent chrome: header, footer,
  theme first-paint script, Baidu analytics, `site.css`; the two root layouts
  (`app/(site)/layout.tsx`, `app/(tool)/layout.tsx`) only differ by body class
- Theme contract: `localStorage['theme']`, `html.dark` class, and the
  `themechange` event. `lib/theme.ts` is the single implementation;
  `components/RootShell.tsx` inlines the first-paint script that applies it
  before paint
- Styles: `public/assets/css/site.css` is linked from the layout with a `?v=N`
  cache-bust; route-private CSS is imported in `app/(<group>)/<route>/page.tsx`
- The two games are the exception: their stylesheets are hand-written
  `<link rel="stylesheet">` tags in their `page.tsx`, so they stay AFTER
  `site.css` in the output (imported route CSS would be emitted before it and
  flip which `:root`/`body` rule wins). `scripts/check-build.ts` asserts the
  order — don't "tidy" those links into imports
- The games keep the engine imperative and the UI in React; the engine notifies
  the UI through a `setUI({...})` hook object. Element ids/classes in the game
  components mirror the old pages because `public/mahjong|mir2/style.css`
  depends on them
- HTML lang is `zh-CN`; all user-facing text is Chinese
- In-page links are plain `<a>`, never `next/link`

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
