# server/AGENTS.md

Authoritative game server. Node 20+, TypeScript, `ws` for WebSockets. Port `8082` by default.

## Rules

- **This is the source of truth.** Player positions, hits, damage, pickups, enemy state — all decided here.
- Never trust client-supplied derived values. Trust client *inputs* (pressed keys, look angle, fire intent).
- All outbound messages must be typed as a `ServerMessage` from `@ut-mm/shared`. No raw JSON.
- The message handler uses a `switch (msg.type)` with an exhaustive `((_x: never) => _x)(msg)` default. Keep it that way — it catches missed cases when the protocol grows.
- Log with the existing prefixes: `[+]` connect, `[-]` disconnect, `[=]` info, `[!]` warning. Keep it greppable.

## Files

- `src/index.ts` — entry: starts `WebSocketServer`, handles connections, dispatches messages. Will get a tick loop next.

## Dev

```bash
npm --workspace server run dev     # tsx watch — auto-reloads on save
npm --workspace server run build   # tsc → dist/
npm --workspace server run start   # node dist/index.js (after build)
```

## What's coming (don't pre-build, but design with it in mind)

- A **fixed tick loop** (start ~20–30 Hz) that runs the world simulation and broadcasts snapshots.
- A **room/session abstraction** (one game = one room).
- **AI/spawner systems** — likely separate files (`spawner.ts`, `ai.ts`, `combat.ts`) wired from `index.ts`.

When you add anything more than a trivial handler, put it in its own file (see AGENTS.md §11 Recipe B) rather than letting `index.ts` balloon.

## Gotchas

See repo-root AGENTS.md §9.
