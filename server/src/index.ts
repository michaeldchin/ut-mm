// ut-mm server entry. See ../../AGENTS.md and ../AGENTS.md before making changes.
// This is the authoritative game server. All wire messages must use the
// ClientMessage / ServerMessage types from @ut-mm/shared. Keep the exhaustive
// switch default — it catches missed cases when the protocol grows.

import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "node:crypto";
import {
  PROTOCOL_VERSION,
  type ClientMessage,
  type ServerMessage,
  type PlayerSnapshot,
} from "@ut-mm/shared";

const PORT = Number(process.env.PORT ?? 8080);

interface ConnectedPlayer {
  ws: WebSocket;
  playerId: string;
  nick: string;
  pos: [number, number, number];
  rot: [number, number, number];
}

const wss = new WebSocketServer({ port: PORT });
const players = new Map<string, ConnectedPlayer>();

function send(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcast(msg: ServerMessage) {
  for (const player of players.values()) {
    send(player.ws, msg);
  }
}

function toSnapshot(player: ConnectedPlayer): PlayerSnapshot {
  return {
    playerId: player.playerId,
    nick: player.nick,
    pos: player.pos,
    rot: player.rot,
  };
}

wss.on("connection", (ws) => {
  const playerId = randomUUID();
  const newPlayer: ConnectedPlayer = {
    ws,
    playerId,
    nick: `player-${playerId.slice(0, 8)}`,
    pos: [0, 1.7, 0],
    rot: [0, 0, 0],
  };

  players.set(playerId, newPlayer);
  console.log(`[+] player connected ${playerId} (${players.size} online)`);

  // Send welcome + existing player list
  send(ws, {
    type: "welcome",
    protocol: PROTOCOL_VERSION,
    playerId,
    message: "Hello, world — welcome to ut-mm.",
  });

  const existingPlayers = Array.from(players.values())
    .filter((p) => p.playerId !== playerId)
    .map(toSnapshot);

  send(ws, { type: "playerList", players: existingPlayers });

  // Notify others of the new player
  broadcast({
    type: "playerJoined",
    player: toSnapshot(newPlayer),
  });

  ws.on("message", (data) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(data.toString()) as ClientMessage;
    } catch {
      console.warn(`[!] ${playerId} sent non-JSON payload, ignoring`);
      return;
    }

    const player = players.get(playerId);
    if (!player) return;

    switch (msg.type) {
      case "hello":
        player.nick = msg.nick ?? player.nick;
        console.log(`[=] ${playerId} says hello as "${player.nick}"`);
        break;
      case "ping":
        send(ws, { type: "pong", t: msg.t });
        break;
      case "playerMove":
        player.pos = msg.pos;
        player.rot = msg.rot;
        broadcast({
          type: "playerMoved",
          playerId,
          pos: msg.pos,
          rot: msg.rot,
        });
        break;
      default:
        // exhaustive check
        ((_x: never) => _x)(msg);
    }
  });

  ws.on("close", () => {
    players.delete(playerId);
    console.log(`[-] player disconnected ${playerId} (${players.size} online)`);
    broadcast({ type: "playerLeft", playerId });
  });
});

console.log(`ut-mm server listening on ws://localhost:${PORT}`);
