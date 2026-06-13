# ut-mm

A browser-based multiplayer PVE FPS. Early scaffolding.

## Inspiration

Spiritual successor to **Unreal Tournament 2004's Invasion** mode and the community-modded **Monster Mash** variant:

- A small team of players defends against escalating **waves of AI monsters**.
- Survive the wave → short breather → next wave is harder / more numerous / more varied.
- Death matters within a wave (respawn rules TBD — instant respawn, end-of-wave respawn, or limited lives are all on the table).
- Pickups (weapons, ammo, health, armor) are scattered around the arena; positioning and map knowledge are part of the skill expression.
- It's **co-op**, not competitive. Players win or lose together.

This shapes a lot of design choices: server-side enemy AI and spawning are first-class, hitreg has to feel fair, and the rendering budget gets spent on *many* moving entities rather than photorealistic environments.

## Stack

- **Client**: Vite + TypeScript + [Three.js](https://threejs.org/) (rendering, FPS controls)
- **Server**: Node + TypeScript + [`ws`](https://github.com/websockets/ws) (WebSocket game server)
- **Shared**: TypeScript package with message types shared between client and server
- **Tooling**: npm workspaces

## Layout

```
ut-mm/
├── client/   # browser game (Vite dev server, port 5173)
├── server/   # WebSocket game server (port 8082)
└── shared/   # shared message types & protocol
```

## Getting started

```bash
npm install
npm run dev
```

Then open <http://localhost:5173>. You should see a 3D scene, be able to look with the mouse (click to lock pointer) and move with **WASD**. Open the browser console to see the welcome message echoed back from the WebSocket server.

## Scripts

- `npm run dev` – runs server + client in parallel
- `npm run build` – type-checks/builds shared, server, and client
- `npm run start` – runs the built server
- `npm run clean` – removes all `dist/` and `node_modules/` directories (requires a Unix-like shell: bash, zsh, Git Bash on Windows)

## Copying to another machine

Before zipping / copying / pushing, run:

```bash
npm run clean
```

That strips `dist/` and every `node_modules/`. `package-lock.json` is kept so the other machine installs the exact same dependency versions. On the other machine:

```bash
npm install
npm run dev
```

## Roadmap (next iterations)

1. Networked player presence (other players visible as capsules)
2. Authoritative server tick + client prediction
3. Shooting / hitscan
4. PVE enemies + spawning
5. Match/lobby management

## Working with AI agents

This repo is set up to be friendly to AI coding agents. The conventions, invariants, and "where to add things" guidance live in [AGENTS.md](AGENTS.md) (root + one per package), which most modern agents (Copilot, Cursor, Codex, Claude Code, Aider, …) pick up automatically.

If you're a human and want to know **how to drive an agent productively in this repo** — especially when using smaller / cheaper models with limited context — read [docs/ai-development.md](docs/ai-development.md).
