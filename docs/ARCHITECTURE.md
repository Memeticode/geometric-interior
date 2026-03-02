# Geometric Interior — Architecture

> WebGL generative art engine: crystalline planes with custom GLSL shaders, deterministic seeded generation, and postprocessing effects.

**Package:** `@memeticode/geometric-interior` v2.0.0 (ES module)
**Deployed:** Cloudflare Pages at geometric-interior.org

---

## Quick Start

```bash
npm install          # install dependencies
npm run dev          # Vite dev server → http://localhost:5173
npm run build        # build the web app → vite-app/dist/
npm run build:lib    # build the npm library → geometric-interior/dist/
```

## Project Layout

The repo has two packages in one monorepo:

- **`geometric-interior/`** — publishable TypeScript library (renderer, params, scene building, math)
- **`vite-app/`** — JavaScript web application (gallery, editors, generation UI)

The app imports from the library via a `@geometric-interior` Vite alias. Both packages share the root `node_modules/` and `package.json`.

```
geometric-interior/          # repo root
├── geometric-interior/      # library package
│   ├── src/                 # TypeScript source (strict)
│   ├── __tests__/           # pure (Node) + browser (Playwright) tests
│   ├── dist/                # build output (gitignored)
│   └── vite.lib.config.ts   # library build config
│
├── vite-app/                # web application
│   ├── src/                 # JavaScript source
│   ├── __tests__/           # E2E tests (Playwright)
│   ├── css/                 # stylesheets
│   ├── public/              # static assets
│   ├── functions/           # Cloudflare Pages functions
│   ├── index.html           # gallery / home
│   ├── image.html           # image editor
│   ├── animation.html       # animation editor
│   └── vite.config.js       # app build config (alias + fs.allow)
│
├── scripts/                 # batch generation utilities (Playwright + ffmpeg)
├── docs/                    # documentation
├── package.json             # shared dependencies & npm scripts
└── wrangler.toml            # Cloudflare Pages config
```

## npm Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Build web app → `vite-app/dist/` |
| `npm run build:lib` | Build library → `geometric-interior/dist/` |
| `npm run typecheck` | TypeScript strict check on library |
| `npm run test:lib:pure` | Pure Node.js library tests (fast) |
| `npm run test:lib:browser` | Browser library tests via Playwright |
| `npm run test:lib` | All library tests |
| `npm run test:all` | Full test suite (lib + app) |

## Dependencies

**Runtime:** three, postprocessing, simplex-noise, tweakpane
**Dev:** vite, typescript, vite-plugin-dts, playwright, pngjs
