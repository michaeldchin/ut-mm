# shared/AGENTS.md

The wire protocol package. **Pure types and constants. Zero runtime dependencies.**

## Rules

- **No imports from `three`, `ws`, `node:*`, or any runtime library.** This package must import cleanly into both Node and the browser.
- All cross-process messages live here. If client and server need to agree on a JSON shape, it's defined here.
- Anything exported here becomes part of the public protocol — treat additions deliberately.

## Files

- `src/index.ts` — `ClientMessage`, `ServerMessage`, `PROTOCOL_VERSION`. Single file is fine until it grows past ~200 lines, then split by domain (`messages/player.ts`, `messages/combat.ts`, etc.).

## Building

Consumers (`server`, `client`) import the compiled `dist/`. After editing, run:

```bash
npm --workspace shared run build
```

Or just `npm run build` from the root, which builds everything in order.

## Versioning

`PROTOCOL_VERSION` is in `src/index.ts`. Bump it whenever a wire change would break an older peer (renames, removals, type changes). Adding a brand-new optional message variant does **not** require a bump.

## Common task

See AGENTS.md §11 Recipe A — "Add a new message between client and server."
