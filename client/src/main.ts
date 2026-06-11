// ut-mm client entry. See ../../AGENTS.md and ../AGENTS.md before making changes.
// This file is the iteration-0 catch-all. Split into modules (net.ts, input.ts,
// renderer.ts, …) once it grows past ~300 lines — see AGENTS.md §11 Recipe C.

import * as THREE from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls.js";
import {
  PROTOCOL_VERSION,
  type ClientMessage,
  type ServerMessage,
} from "@ut-mm/shared";

// ---------- DOM ----------
const appEl = document.getElementById("app")!;
const overlayEl = document.getElementById("overlay")!;
const statusEl = document.getElementById("hud-status")!;

// ---------- Renderer / Scene / Camera ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
appEl.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1020);
scene.fog = new THREE.Fog(0x0b1020, 20, 80);

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  500,
);
camera.position.set(0, 1.7, 4); // eye height ~1.7m

// ---------- Lights ----------
scene.add(new THREE.HemisphereLight(0x8899ff, 0x202020, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.0);
sun.position.set(10, 20, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
scene.add(sun);

// ---------- World ----------
const floorMat = new THREE.MeshStandardMaterial({ color: 0x2a2f3a });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// Grid for spatial reference
const grid = new THREE.GridHelper(100, 50, 0x444444, 0x222222);
(grid.material as THREE.Material).transparent = true;
(grid.material as THREE.Material).opacity = 0.6;
scene.add(grid);

// A "target dummy" cube — our PVE hello-world enemy stand-in
const dummy = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ color: 0xff5577 }),
);
dummy.position.set(0, 0.5, -6);
dummy.castShadow = true;
dummy.receiveShadow = true;
scene.add(dummy);

// A few pillars for parallax
for (let i = 0; i < 12; i++) {
  const h = 1 + Math.random() * 3;
  const pillar = new THREE.Mesh(
    new THREE.BoxGeometry(1, h, 1),
    new THREE.MeshStandardMaterial({ color: 0x556677 }),
  );
  const angle = (i / 12) * Math.PI * 2;
  const r = 12 + Math.random() * 8;
  pillar.position.set(Math.cos(angle) * r, h / 2, Math.sin(angle) * r);
  pillar.castShadow = true;
  pillar.receiveShadow = true;
  scene.add(pillar);
}

// ---------- Controls (FPS) ----------
const controls = new PointerLockControls(camera, renderer.domElement);
scene.add(controls.object);

overlayEl.addEventListener("click", () => controls.lock());
controls.addEventListener("lock", () => overlayEl.classList.add("hidden"));
controls.addEventListener("unlock", () => overlayEl.classList.remove("hidden"));

const keys = new Set<string>();
window.addEventListener("keydown", (e) => keys.add(e.code));
window.addEventListener("keyup", (e) => keys.delete(e.code));

const MOVE_SPEED = 5; // m/s

// ---------- Jump / Gravity ----------
const GRAVITY = 25; // m/s²
const JUMP_FORCE = 8; // m/s
const GROUND_LEVEL = 1.7; // eye height when grounded
const GROUND_TOLERANCE = 0.1; // snap to ground if within this distance

let velocityY = 0; // vertical velocity
let jumpsRemaining = 2; // double jump
let lastYPos = GROUND_LEVEL;
let spaceWasPressed = false;

// ---------- Resize ----------
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Networking ----------
const WS_URL =
  (import.meta.env.VITE_WS_URL as string | undefined) ?? "ws://localhost:8080";

// Remote players: map of playerId -> { mesh, nick, pos, rot }
interface RemotePlayer {
  mesh: THREE.Mesh;
  nick: string;
  pos: [number, number, number];
  rot: [number, number, number];
}

const remotePlayers = new Map<string, RemotePlayer>();

function createPlayerCapsule(): THREE.Mesh {
  // Simple capsule representation: a cylinder with two spheres on top and bottom
  const group = new THREE.Group();
  
  // Body (cylinder)
  const cylinderMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 1.4, 8),
    new THREE.MeshStandardMaterial({ color: 0x4488ff })
  );
  cylinderMesh.position.y = 0.7;
  cylinderMesh.castShadow = true;
  cylinderMesh.receiveShadow = true;
  group.add(cylinderMesh);
  
  // Head (top sphere)
  const headMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x88bbff })
  );
  headMesh.position.y = 1.7;
  headMesh.castShadow = true;
  headMesh.receiveShadow = true;
  group.add(headMesh);
  
  scene.add(group);
  return group as any as THREE.Mesh; // Cast group as mesh for simplicity
}

function removePlayerCapsule(playerId: string) {
  const player = remotePlayers.get(playerId);
  if (player) {
    scene.remove(player.mesh);
    remotePlayers.delete(playerId);
  }
}

function send(ws: WebSocket, msg: ClientMessage) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

let localPlayerId: string | null = null;
let lastMoveTime = 0;
const MOVE_BROADCAST_RATE = 50; // ms between playerMove broadcasts
let ws: WebSocket | null = null;

function connect(): WebSocket {
  statusEl.textContent = `connecting to ${WS_URL}…`;
  const newWs = new WebSocket(WS_URL);
  ws = newWs;

  newWs.addEventListener("open", () => {
    statusEl.textContent = "connected";
    send(newWs, { type: "hello", nick: "player" });
  });

  newWs.addEventListener("message", (ev) => {
    let msg: ServerMessage;
    try {
      msg = JSON.parse(ev.data) as ServerMessage;
    } catch {
      console.warn("non-JSON message from server:", ev.data);
      return;
    }
    switch (msg.type) {
      case "welcome":
        console.log(
          `[server] ${msg.message} (you are ${msg.playerId}, protocol ${msg.protocol})`,
        );
        if (msg.protocol !== PROTOCOL_VERSION) {
          console.warn(
            `protocol mismatch: client=${PROTOCOL_VERSION} server=${msg.protocol}`,
          );
        }
        localPlayerId = msg.playerId;
        statusEl.textContent = `connected · id ${msg.playerId.slice(0, 8)}`;
        break;
      case "pong":
        console.log(`[server] pong rtt=${Date.now() - msg.t}ms`);
        break;
      case "playerList":
        // Add existing players
        for (const player of msg.players) {
          const mesh = createPlayerCapsule();
          mesh.position.set(player.pos[0], player.pos[1], player.pos[2]);
          mesh.rotation.order = "YXZ";
          mesh.rotation.y = player.rot[0];
          mesh.rotation.x = player.rot[1];
          mesh.rotation.z = player.rot[2];
          remotePlayers.set(player.playerId, {
            mesh,
            nick: player.nick,
            pos: [...player.pos],
            rot: [...player.rot],
          });
          console.log(`[=] remote player ${player.nick} (${player.playerId.slice(0, 8)})`);
        }
        break;
      case "playerJoined":
        const newMesh = createPlayerCapsule();
        newMesh.position.set(msg.player.pos[0], msg.player.pos[1], msg.player.pos[2]);
        newMesh.rotation.order = "YXZ";
        newMesh.rotation.y = msg.player.rot[0];
        newMesh.rotation.x = msg.player.rot[1];
        newMesh.rotation.z = msg.player.rot[2];
        remotePlayers.set(msg.player.playerId, {
          mesh: newMesh,
          nick: msg.player.nick,
          pos: [...msg.player.pos],
          rot: [...msg.player.rot],
        });
        console.log(`[+] ${msg.player.nick} joined`);
        break;
      case "playerMoved":
        const remote = remotePlayers.get(msg.playerId);
        if (remote) {
          remote.pos = [...msg.pos];
          remote.rot = [...msg.rot];
          remote.mesh.position.set(msg.pos[0], msg.pos[1], msg.pos[2]);
          remote.mesh.rotation.y = msg.rot[0];
          remote.mesh.rotation.x = msg.rot[1];
          remote.mesh.rotation.z = msg.rot[2];
        }
        break;
      case "playerLeft":
        removePlayerCapsule(msg.playerId);
        console.log(`[-] player ${msg.playerId.slice(0, 8)} left`);
        break;
    }
  });

  newWs.addEventListener("close", () => {
    statusEl.textContent = "disconnected — retrying in 2s";
    setTimeout(connect, 2000);
  });

  newWs.addEventListener("error", () => {
    // close handler will trigger reconnect
    statusEl.textContent = "connection error";
  });

  return newWs;
}

connect();

// ---------- Main loop ----------
const clock = new THREE.Clock();

function tick() {
  const dt = Math.min(clock.getDelta(), 0.1);

  // Movement (only while locked, otherwise feels glitchy)
  if (controls.isLocked) {
    const forward = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0);
    const strafe = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
    const len = Math.hypot(forward, strafe) || 1;
    const step = MOVE_SPEED * dt;
    controls.moveForward((forward / len) * step);
    controls.moveRight((strafe / len) * step);
  }

  // Gravity & jumping
  const currentYPos = controls.object.position.y;
  const isGrounded = currentYPos <= GROUND_LEVEL + GROUND_TOLERANCE && velocityY <= 0;

  if (isGrounded) {
    // Reset jump count when grounded
    if (jumpsRemaining < 2) {
      jumpsRemaining = 2;
    }
    // Snap to ground
    controls.object.position.y = GROUND_LEVEL;
    velocityY = 0;
  } else {
    // Apply gravity in air
    velocityY -= GRAVITY * dt;
  }

  // Jump input (Space key, detect press not hold)
  const spaceIsPressed = keys.has("Space");
  if (spaceIsPressed && !spaceWasPressed && jumpsRemaining > 0) {
    velocityY = JUMP_FORCE;
    jumpsRemaining--;
  }
  spaceWasPressed = spaceIsPressed;

  // Apply vertical velocity
  controls.object.position.y += velocityY * dt;

  // Broadcast player movement periodically
  if (ws && ws.readyState === WebSocket.OPEN && localPlayerId) {
    const now = Date.now();
    if (now - lastMoveTime > MOVE_BROADCAST_RATE) {
      lastMoveTime = now;
      const pos = controls.object.position;
      const rot = controls.object.rotation;
      send(ws, {
        type: "playerMove",
        pos: [pos.x, pos.y, pos.z],
        rot: [rot.y, rot.x, rot.z], // yaw, pitch, roll
      });
    }
  }

  // Spin the PVE dummy so it's obvious things are alive
  dummy.rotation.y += dt * 1.2;

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
