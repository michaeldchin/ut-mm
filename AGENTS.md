# AGENTS.md

Guidance for AI coding agents (and humans) working in this repo. **Read this first.** If you're an agent working on a specific package, also read that package's `AGENTS.md` (`shared/AGENTS.md`, `server/AGENTS.md`, `client/AGENTS.md`).

---

## 0. Quick reference (if you only read one section)

- **Project:** browser multiplayer PVE FPS, inspired by UT2004 Invasion / Monster Mash. Co-op vs. waves of escalating AI monsters.
- **State:** iteration 0 — single-player Three.js scene that connects to a WebSocket server and gets a welcome message.
- **Stack:** TypeScript everywhere. npm workspaces. Vite + Three.js client, Node + `ws` server, pure-types `shared` package.
- **Packages:** `shared/` (protocol types), `server/` (authoritative game server), `client/` (browser renderer).
- **Build order:** `shared` → `server` → `client`. The root `npm run build` enforces this.
- **Dev:** `npm run dev` (server on `:8080`, client on `:5173`).
- **Hard rules:** `shared` has zero runtime deps · all messages typed via `shared` · server is authoritative · TS `strict` stays on.
- **Where to add things:** see §5. Common tasks have recipes in §11.
- **If you hit something non-obvious:** add it to §9.

---

## 1. What this project is

**ut-mm** is a browser-based **multiplayer PVE FPS**.

### Inspiration

Spiritual successor to **Unreal Tournament 2004's Invasion** mode and the community-modded **Monster Mash** variant. The core loop:

- A small team of players defends against **escalating waves** of AI monsters.
- Survive the wave → short breather → next wave is harder / more numerous / more varied.
- Pickups (weapons, ammo, health, armor) are placed around the arena.
- It's **co-op**, not competitive. Players win or lose together.

Why this matters for design:
- **Many AI entities** moving and being networked at once — bias toward simple, efficient enemy representations over photorealism.
- **Server-side AI and spawning are first-class systems**, not afterthoughts. Plan for them.
- **Hitreg has to feel fair** because the whole game is shooting things — server-authoritative hitscan with lag compensation is the eventual target.
- **Arena-style maps**, not open worlds. Small, hand-authored, with verticality and chokepoints.

### Design north star

**Authoritative server, thin client.** The client renders and predicts; the server owns truth. We're not there yet — but every new feature should be designed so it can move in that direction without a rewrite.

---

## 2. Repo map

npm workspaces monorepo. Three packages, one job each:

```
ut-mm/
├── shared/   # @ut-mm/shared — protocol types only, zero runtime deps
├── server/   # @ut-mm/server — Node + ws WebSocket game server (port 8080)
└── client/   # @ut-mm/client — Vite + Three.js browser client (port 5173)
```

| Package  | Runtime    | Entry                  | Purpose |
|----------|------------|------------------------|---------|
| `shared` | both       | `shared/src/index.ts`  | Wire protocol: `ClientMessage`, `ServerMessage`, `PROTOCOL_VERSION`. Pure types + constants. |
| `server` | Node 20+   | `server/src/index.ts`  | Accepts WebSocket connections, assigns player ids, will hold authoritative game state + AI. |
| `client` | Browser    | `client/src/main.ts`   | Three.js scene, FPS controls (PointerLock), WebSocket client, rendering loop. |

Build order matters: `shared` → `server` → `client` (both consumers import the built `dist/` of `shared`). The root `build` script enforces this.

---

## 3. Commands

Always run from the repo root unless noted.

```bash
npm install            # install all workspaces
npm run dev            # server + client in parallel (ws://localhost:8080, http://localhost:5173)
npm run build          # typecheck/build shared, then server, then client
npm run start          # run the built server (after npm run build)
```

Workspace-scoped:
```bash
npm --workspace server run dev    # just the server (tsx watch)
npm --workspace client run dev    # just Vite
npm --workspace shared run build  # rebuild shared types (others depend on dist/)
```

---

## 4. Invariants — do not violate

These are the rules that keep the architecture coherent. Breaking them creates pain later.

1. **`shared` has zero runtime dependencies.** Types and constants only. It must be safe to import from both Node and the browser with no bundler magic. No `three`, no `ws`, no `node:*` imports.
2. **All cross-process messages are typed via `shared`.** If the client sends or receives JSON, the shape lives in `ClientMessage` / `ServerMessage`. No ad-hoc payloads.
3. **`PROTOCOL_VERSION` bumps on any breaking wire change.** Adding a new optional message: no bump. Changing/removing/renaming a field: bump. The server's welcome message includes it; the client checks it.
4. **Server is authoritative.** When in doubt, the server decides. Client may predict for responsiveness but never assumes its prediction is canonical. Especially true for hits, damage, pickups, and enemy state.
5. **No game logic in `client/src/main.ts` long-term.** It's the bootstrap. Real systems (input, networking, rendering, prediction) belong in their own modules as they appear.
6. **Use the message-type discriminator pattern with an exhaustive default.** See §11 recipe. Keep the `((_x: never) => _x)(msg)` line — it's the compiler's way of catching missed message types when the protocol grows.
7. **TypeScript `strict` stays on** in every package.
8. **No new top-level packages without updating this file** and the root `package.json` `workspaces` array.
9. **Keep files small.** Aim for <300 lines per file. When a file grows past that, split it. (This also helps smaller AI models — they can load the whole file in one read.)

---

## 5. Where to add things

| Change                                  | Goes in |
|-----------------------------------------|---------|
| New message between client ↔ server     | `shared/src/index.ts` first, then handlers on both sides |
| New server-side system (e.g., spawner, AI, hit resolver) | `server/src/<system>.ts`, wired from `index.ts` |
| New client rendering/input/net module   | `client/src/<module>.ts`, wired from `main.ts` |
| Shared math / constants used by both    | `shared/src/` (only if pure — see invariant 1) |
| Dev/build tooling                       | Root `package.json` scripts |

When in doubt: **does this run on both sides?** If yes and it's pure → `shared`. If no → the side that uses it.

---

## 6. Networking model (current + intended)

**Current:** request/response style. Client opens a socket, server sends `welcome`, client can send `ping`/`hello`. No game state synced yet.

**Intended:**
- Fixed server tick (start at 20–30 Hz).
- Clients send **inputs** (intent: move dir, look angle, fire), not positions.
- Server simulates (player movement + enemy AI), then broadcasts **snapshots** (entity states) to all clients.
- Client interpolates remote entities, predicts the local player, reconciles on snapshot.

When adding networked features, prefer this shape even before the tick loop exists — e.g., a "fire" message should be an *input event*, not "I shot and hit X."

---

## 7. Roadmap (informs design choices)

In rough order. Each step should leave the previous step working.

1. **Networked presence** — server tracks connected players, broadcasts a player list, client renders remote players as capsules. Introduces snapshots.
2. **Server tick + input messages** — fixed timestep on server, client sends inputs, server returns authoritative positions.
3. **Client prediction + reconciliation** — local player feels instant, snaps to server on divergence.
4. **Hitscan shooting** — client sends fire input, server resolves, broadcasts hit events.
5. **PVE enemies — first wave** — server spawns dumb melee monsters, simple chase-the-nearest-player AI, clients render them. The first taste of the "Invasion" loop.
6. **Wave system** — round structure, escalation, between-wave breather, win/loss conditions.
7. **Pickups + multiple weapons** — weapon swap, ammo, health/armor pickups.
8. **More enemy variety + ranged enemies** — closer to the UT2004 Invasion roster feel.
9. **Match/lobby flow** — rooms, join/leave, matchmaking later.

Don't skip ahead. Each step exposes design questions the next one needs answered.

---

## 8. Conventions

- **Language:** TypeScript everywhere, ES2022, `"type": "module"`.
- **Imports:** Use the package name (`@ut-mm/shared`), not relative paths across packages.
- **Files:** kebab-case filenames, PascalCase for classes/types, camelCase for values.
- **Logging:** Server uses `console.log` with a short tag prefix (`[+]` connect, `[-]` disconnect, `[=]` info, `[!]` warning). Keep it greppable.
- **No comments restating code.** Comment intent, invariants, and non-obvious "why."
- **Don't add dependencies casually.** Especially in `shared` (see invariant 1) and `client` (bundle size matters for a game).
- **Don't reformat unrelated code** in a change. Small diffs only.

---

## 9. Things that have already bitten us

Keep this list short and real. Add to it when something non-obvious wastes time.

- **Three.js `PointerLockControls` API:** in 0.184 it's `controls.object`, **not** `controls.getObject()`. Older tutorials are wrong.
- **`@types/three` version must track `three`** (e.g., `three@0.184` → `@types/three@^0.183`). Mismatched majors don't exist on npm.
- **`shared` must be built before `server`/`client` typecheck** — they consume `dist/`. The root `build` script handles ordering; if you run package builds individually, do `shared` first.

---

## 10. For the agent: working style in this repo

- **Read this file first.** Then jump directly to the relevant package's `src/` and that package's `AGENTS.md`.
- **Don't restructure speculatively.** The repo is small on purpose; premature abstraction will hurt.
- **Prefer editing existing files** over creating new ones, especially in iteration-0 territory.
- **Verify with `npm run build`** after non-trivial changes — it typechecks all three packages.
- **If you change the wire protocol, update both sides in the same change** and bump `PROTOCOL_VERSION` if breaking.
- **If you learn something non-obvious, add it to section 9.**
- **For smaller / lower-context models:** you do not need to load every file. The minimum useful context for most tasks is: this file's §0, §4, §5, §9, plus the target package's `AGENTS.md`, plus the file you're editing. That's it.

---

## 11. Task recipes

Concrete patterns for the most common changes. Copy these — don't reinvent.

### Recipe A — Add a new message between client and server

1. In `shared/src/index.ts`, add the variant to the right union:
   ```ts
   export type ClientMessage =
     | { type: "hello"; nick?: string }
     | { type: "ping"; t: number }
     | { type: "fire"; dir: [number, number, number] }; // NEW
   ```
2. Decide: does this break existing clients/servers? If renaming/removing/retyping any existing field, **bump `PROTOCOL_VERSION`**. Adding a new optional message does not.
3. In `server/src/index.ts`, add a case in the message `switch`. Keep the exhaustive default:
   ```ts
   switch (msg.type) {
     case "hello": /* … */ break;
     case "ping":  /* … */ break;
     case "fire":  /* handle */ break;
     default: ((_x: never) => _x)(msg); // compile error if a case is missed
   }
   ```
4. In `client/src/main.ts` (or the appropriate client module), send/handle the new message.
5. `npm run build` to confirm both sides typecheck against the updated `shared`.

### Recipe B — Add a new server-side system (spawner, AI, hit resolver…)

1. New file: `server/src/<system>.ts`. Export a class or factory function. Keep it self-contained — take dependencies as constructor args, don't reach into module globals.
2. Wire it from `server/src/index.ts` (instantiate at startup, hook into the message switch or the tick loop).
3. If the system produces network output, that goes via a `ServerMessage` defined in `shared`.

### Recipe C — Add a new client module (renderer, input handler, network adapter…)

1. New file: `client/src/<module>.ts`. Export a small API; avoid module-level side effects beyond what's necessary.
2. Wire it from `client/src/main.ts`.
3. If it sends/receives network messages, route them through whatever networking module exists (today that's still inline in `main.ts` — extract when it grows).

### Recipe D — Bump a Three.js or other dep version

1. `npm view three version` and `npm view @types/three version` — confirm compatible majors exist.
2. Update both `client/package.json` entries together.
3. `npm install` then `npm --workspace client run build`.
4. If the API changed, fix the call sites. Note the breaking API change in §9.
