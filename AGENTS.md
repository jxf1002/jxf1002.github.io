# AGENTS.md

## What is this

Static site (GitHub Pages), no build step. Vanilla HTML + CSS + JS, no framework.

## Local dev

```bash
python3 -m http.server 3000
# or
npm run dev
```

Visit `http://localhost:3000/`. Pages load data from `assets/data/*.json`.

## Structure

| Path | Purpose |
|---|---|
| `/` | Home page |
| `/tourism/` | 5A tourist sites |
| `/college/` | University rankings (supports `?year=2023..2026`, default 2026) |
| `/mahjong/` | Mahjong game (has own `package.json` and tests) |
| `/mir2/` | Mir2 idle game (has own `package.json` and tests) |
| `/dcf/` | DCF valuation calculator |
| `/sport/` | Sports section |
| `/photo/` | Photo section |
| `assets/js/common.js` | Shared site logic (theme toggle, nav) |
| `assets/data/*.json` | College & tourism data files |

## Testing

mahjong and mir2 have tests:

```bash
node test/rules.test.mjs
# or
npm test  # from mahjong/ or mir2/
```

mahjong has three test files: `rules` (fast, always run), `ai` (fast unit tests,
run when AI logic changed) and `ai-sim` (slow full-table sim, manual only):

```bash
node test/rules.test.mjs
node test/ai.test.mjs      # from mahjong/, AI changes only
node test/ai-sim.mjs       # from mahjong/, slow, manual only (AI_TABLES/AI_THREADS/AI_CIRCLES tunable)
```

## Code style

- ESLint extends `@antfu`; Prettier `semi: false`
- No semicolons in JS
- `console` allowed (no-console off)
- No TypeScript; plain browser JS

## Conventions

- CSS cache-bust via `?v=N` query param on `<link>`/`<script>` tags
- College data lives in `assets/data/colleges{year}.json`
- Each sub-app is a self-contained folder with its own `index.html`
- HTML lang is `zh-CN`; all user-facing text is Chinese
