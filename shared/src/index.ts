// ut-mm wire protocol. See ../../AGENTS.md and ../AGENTS.md before changing.
// Rule: ZERO runtime dependencies. Types and constants only — this file must
// import cleanly into both Node and the browser. Bump PROTOCOL_VERSION on any
// breaking change (renames, removals, type changes). New optional message
// variants do not require a bump.

// Shared protocol types between client and server.
// Keep this file free of runtime dependencies so it works in both
// Node and the browser without any bundling concerns.

export const PROTOCOL_VERSION = 2;

/** Player state snapshot. */
export interface PlayerSnapshot {
  playerId: string;
  nick: string;
  pos: [number, number, number];
  rot: [number, number, number]; // euler angles (yaw, pitch, roll)
}

/** Messages the server sends to the client. */
export type ServerMessage =
  | { type: "welcome"; protocol: number; playerId: string; message: string }
  | { type: "pong"; t: number }
  | { type: "playerList"; players: PlayerSnapshot[] }
  | { type: "playerJoined"; player: PlayerSnapshot }
  | { type: "playerMoved"; playerId: string; pos: [number, number, number]; rot: [number, number, number] }
  | { type: "playerLeft"; playerId: string };

/** Messages the client sends to the server. */
export type ClientMessage =
  | { type: "hello"; nick?: string }
  | { type: "ping"; t: number }
  | { type: "playerMove"; pos: [number, number, number]; rot: [number, number, number] };
