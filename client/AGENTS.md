# client/AGENTS.md

Browser client. Vite + TypeScript + Three.js. Dev server on `:5173`.

## Rules

- **Thin client.** The client renders and (eventually) predicts. The server owns truth. Don't put authoritative game logic here.
- All inbound messages typed as `ServerMessage`, all outbound as `ClientMessage`, both from `@ut-mm/shared`.
- When networking grows past trivial inline code, extract a `net.ts` module. Same for input (`input.ts`) and rendering systems (`renderer.ts`, etc.).
- **Bundle size matters** for a game in the browser. Don't add heavy deps casually.
- Three.js API moves between minor versions — when something doesn't typecheck, check the installed version against the docs (`npm ls three`), don't guess from old tutorials. Note any breaking surprises in the repo-root AGENTS.md §9.

## Files

- `index.html` — single page, mounts `<div id="app">` and shows the click-to-lock overlay.
- `src/main.ts` — entry: Three.js scene, FPS controls, WebSocket client, render loop. Iteration-0 catch-all; split as it grows past ~300 lines.
- `vite.config.ts` — pins dev server to port 5173.

## Dev

```bash
npm --workspace client run dev     # vite dev server with HMR
npm --workspace client run build   # tsc + vite build → dist/
```

## Networking

Currently inline in `main.ts`. Reconnects on close with a 2s backoff. Reads `VITE_WS_URL` env if set, otherwise `ws://localhost:8082`.

When you add anything more than a trivial message handler, extract networking into `src/net.ts` (see AGENTS.md §11 Recipe C).

## Three.js notes

- `PointerLockControls` from `three/examples/jsm/controls/PointerLockControls.js`. In 0.184 it exposes `.object` (not `.getObject()`).
- `@types/three` major must match `three` major.
- Use `controls.isLocked` to gate input — handling movement while unlocked feels broken.

## Gotchas

See repo-root AGENTS.md §9.
