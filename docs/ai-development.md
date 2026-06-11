# Working with AI agents on this repo

A practical guide for **humans** (you, future you, future collaborators) on how to drive AI coding agents productively in this repo, and how the AI-facing docs (`AGENTS.md` files, header breadcrumbs) are meant to be used.

If you're an AI agent reading this: you don't need to. Read [AGENTS.md](AGENTS.md) instead.

---

## TL;DR

- The `AGENTS.md` files are the agent's "onboarding doc." Keep them current. They're the single biggest lever you have on output quality.
- For most tasks, point the agent at: **root `AGENTS.md` §0/§4/§5/§11 + the relevant `<package>/AGENTS.md` + the file being changed.** That's it.
- When something non-obvious bites you, add a one-liner to `AGENTS.md` §9. This file compounds — every entry saves time the next session.
- Don't paste the whole repo into a prompt. Don't ask the agent to "look around." Tell it where to look.

---

## Why these docs exist

AI coding agents work much better when they don't have to *discover* a project's structure and conventions from scratch each session. Without guidance, they spend tokens (and your patience) doing exploratory reads, then guess at conventions and often guess wrong. With a short, accurate set of docs, they jump straight to the right file and follow your patterns.

The docs in this repo are designed around three observations:

1. **Smaller / cheaper models have small context windows.** A 200KB repo dump won't fit. A 2KB summary will.
2. **All models guess less when they have rules.** Even Claude Opus benefits from being told "the server is authoritative" rather than inferring it.
3. **Lessons learned are the highest-value content.** "We tried X, it broke" is information the agent literally cannot derive from the code.

---

## The doc layout

```
AGENTS.md                 # repo-wide: overview, invariants, recipes, gotchas
shared/AGENTS.md          # the shared package's rules (~30 lines)
server/AGENTS.md          # the server's rules (~30 lines)
client/AGENTS.md          # the client's rules (~30 lines)
docs/ai-development.md    # ← you are here (for humans)
README.md                 # project overview (for humans)
```

Plus short header comments at the top of the three entry files (`client/src/main.ts`, `server/src/index.ts`, `shared/src/index.ts`) that point at the relevant `AGENTS.md` sections.

### Why `AGENTS.md` instead of `.cursorrules` / `copilot-instructions.md` / `CLAUDE.md`?

`AGENTS.md` is the emerging cross-tool convention. Copilot, Cursor, Codex, Claude Code, Aider, and others either read it directly or surface it on a directory listing. Using one platform-agnostic file means you can switch agents without redoing the docs. If you ever want platform-specific extras, add them in addition to (not instead of) `AGENTS.md`.

---

## How to prompt agents in this repo

### For a small task (rename, bug fix, single function change)

Just point at the file. Modern agents will load `AGENTS.md` on their own.

> Fix the off-by-one in `server/src/spawner.ts` in the wave-counter logic.

### For a normal task (add a feature, new module, protocol change)

Be explicit about which docs to load. This is especially important for smaller models.

> Read `AGENTS.md` §0, §4, §5, §11, and `server/AGENTS.md`. Then add a `respawn` message: client sends `{ type: "respawn" }`, server resets that player's position to a spawn point and broadcasts a snapshot. Follow Recipe A.

### For a larger task (whole subsystem, refactor)

Break it into the smallest pieces that each individually leave the repo working. Use the roadmap in `AGENTS.md` §7 — each numbered step is sized to be one PR.

> Read `AGENTS.md` in full and `server/AGENTS.md`. We're starting roadmap step 2 (server tick + input messages). First sub-step: add a fixed 20 Hz tick loop on the server that does nothing yet except log the tick number. We'll add input handling in the next change.

---

## Working with smaller models

When you're running on a small / cheap model (smaller context window, weaker reasoning), the docs in this repo are explicitly designed to help — but you have to use them deliberately.

### What's already done for you

- **`AGENTS.md` §0 "Quick reference"** — ~12 bullets at the top. Fits anywhere.
- **`AGENTS.md` §10 "minimum useful context"** — tells the agent exactly which sections to load.
- **`AGENTS.md` §11 "Task recipes"** — copy-pasteable patterns for common changes. Small models follow recipes well; they invent badly.
- **Per-package `AGENTS.md`** — ~30–50 lines each. Loadable with the file being edited.
- **Header breadcrumbs** at the top of entry files — the agent sees the relevant doc pointer the moment it opens the file.
- **Invariant #9 in `AGENTS.md` §4: keep files under ~300 lines.** Means most files fit in a single `read_file` call.

### What you should do

1. **Tell the agent exactly which sections to read.** Don't say "look at the docs"; say "read `AGENTS.md` §0, §4, §11, and `client/AGENTS.md`."
2. **Reference recipes by letter.** "Follow Recipe A" is shorter and more reliable than re-explaining the steps.
3. **Verify with `npm run build` after every meaningful change.** Smaller models miss things; the typechecker catches them.
4. **Keep the scope of each prompt small.** One protocol message, one module, one bugfix per turn. Easier to verify, easier to revert.
5. **If the agent invents a pattern, push back and ask it to follow §5 or §11.** Don't let it set new precedents silently.

### Red flags that mean "switch back to a bigger model"

- It's editing 5+ files at once.
- It's proposing architectural changes (new packages, new abstractions, dep swaps).
- It's confused about which side is authoritative.
- It's "fixing" the exhaustive-switch default or removing types it doesn't understand.

---

## Maintaining the docs

The docs only stay useful if they stay accurate. Five small habits keep them healthy:

1. **When you (or the agent) hit something non-obvious, add a one-liner to `AGENTS.md` §9.** Three.js API drift, npm quirks, weird Vite behavior — all of it. This is the highest-leverage file in the repo.
2. **When a new common task emerges, add a recipe to `AGENTS.md` §11.** "Add a new enemy type" will probably want one once we have enemies.
3. **When you add a new top-level package, update `AGENTS.md` §2 and root `package.json` `workspaces`.** Invariant #8 already says this; just don't forget.
4. **When a roadmap step ships, update `AGENTS.md` §7.** Cross it off, note any decisions made along the way that affect future steps.
5. **Trim aggressively.** If a section is outdated, delete or fix it. An outdated doc is worse than no doc — it actively misleads.

### What *not* to put in the agent docs

- Anything that just restates what the code says. The agent can read code.
- Long prose. Bullets and tables read better.
- Hopes/intentions without concrete rules. "We probably want to use ECS eventually" doesn't help. "All entities are plain objects keyed by id" does.
- Inline tutorials for tools the agent already knows (TypeScript, Vite, npm).
- Your full design philosophy. Section 1 of `AGENTS.md` is enough.

---

## A note on trust

AI agents are powerful but not infallible. Treat their output the way you'd treat a junior contributor's PR: read the diff, run the build, and push back when something feels off. The docs in this repo are designed to **reduce** the rate of bad output, not eliminate it. Skimming an agent's changes before accepting them is still the cheapest bug-prevention tool you have.

When an agent's change introduces a subtle bug or convention violation that the docs didn't prevent, that's a signal to **add a rule to `AGENTS.md`** — not just fix the immediate problem.
