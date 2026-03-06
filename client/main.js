import * as THREE from "three";
import { createMap } from "./map.js";
import { createPossessables } from "./objects.js";
import { LocalPlayer, createRemoteAvatar, setAvatarRevealed } from "./player.js";
import { UI } from "./ui.js";

const MAP_BOUNDS = { minX: -18, maxX: 18, minZ: -18, maxZ: 18 };

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function randomSpawn() {
  return {
    x: (Math.random() * 18 - 9) * 1.4,
    y: 1.6,
    z: (Math.random() * 18 - 9) * 1.4
  };
}

function setPossessedVisual(mesh, possessedBy) {
  const isPossessed = Boolean(possessedBy);
  mesh.traverse((child) => {
    if (!child.isMesh) return;
    const mat = child.material;
    if (!mat || !("emissive" in mat)) return;
    mat.emissive = mat.emissive ?? new THREE.Color(0x000000);
    mat.emissive.setHex(isPossessed ? 0x2b6cff : 0x000000);
    mat.emissiveIntensity = isPossessed ? 0.7 : 0;
  });
}

const ui = new UI();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0f14);
scene.fog = new THREE.Fog(0x0b0f14, 8, 55);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 120);
camera.rotation.order = "YXZ";

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const { lights } = createMap(scene);
const { meshesById: objectMeshesById, interactables } = createPossessables(scene);

const localPlayer = new LocalPlayer({ camera, domElement: renderer.domElement, scene });
localPlayer.setPosition(0, 1.6, 12);
localPlayer.setYawPitch({ yaw: Math.PI, pitch: 0 });

let flickerUntilMs = 0;

const state = {
  id: null,
  role: null,
  gameState: "lobby",
  timeLeftSeconds: null,
  possessingObjectId: null,
  revealedHackerId: null
};

const remoteAvatars = new Map();

function ensureRemoteAvatar(playerId) {
  if (remoteAvatars.has(playerId)) return remoteAvatars.get(playerId);
  const avatar = createRemoteAvatar();
  scene.add(avatar);
  remoteAvatars.set(playerId, avatar);
  return avatar;
}

function removeRemoteAvatar(playerId) {
  const a = remoteAvatars.get(playerId);
  if (!a) return;
  scene.remove(a);
  remoteAvatars.delete(playerId);
}

function setGameMessage() {
  if (state.gameState === "lobby") {
    ui.setMessage("Waiting in lobby. Game starts automatically with 2+ players.");
    return;
  }
  if (state.gameState === "ended") {
    ui.setMessage("Round ended. Returning to lobby soon.");
    return;
  }

  if (state.role === "hacker") {
    ui.setMessage("Hacker: Q possess · R release · WASD nudge while possessing · X lights flicker");
  } else {
    ui.setMessage("Agent: Find the hacker. LMB shoot objects · E scanner detects nearby hacker.");
  }
}

localPlayer.actions.onShoot = () => {
  if (!socket || state.gameState !== "running") return;
  if (state.role !== "agent") return;

  const ray = localPlayer.rayFromCamera();
  const raycaster = new THREE.Raycaster(ray.origin, ray.direction, 0, 22);
  const hits = raycaster.intersectObjects(interactables, true);
  const hit = hits.find((h) => h.object?.userData?.objectId);
  const hitObjectId = hit?.object?.userData?.objectId ?? null;
  if (hitObjectId) socket.emit("shoot", { hitObjectId });
};

localPlayer.actions.onScan = () => {
  if (!socket || state.gameState !== "running") return;
  socket.emit("scan");
};

localPlayer.actions.onPossess = () => {
  if (!socket || state.gameState !== "running") return;

  const playerPos = localPlayer.controls.getObject().position;
  let best = null;
  let bestDistSq = Infinity;
  for (const obj of interactables) {
    const id = obj.userData.objectId;
    const mesh = objectMeshesById.get(id);
    if (!mesh) continue;
    const d2 = playerPos.distanceToSquared(mesh.position);
    if (d2 < bestDistSq) {
      bestDistSq = d2;
      best = id;
    }
  }
  if (!best || bestDistSq > 3.5 * 3.5) return;
  socket.emit("possess", { objectId: best });
};

localPlayer.actions.onRelease = () => {
  if (!socket || state.gameState !== "running") return;
  socket.emit("release");
};

localPlayer.actions.onNudge = ({ dx, dz }) => {
  if (!socket || state.gameState !== "running") return;
  socket.emit("nudgeObject", { dx, dz });
};

localPlayer.actions.onTriggerEvent = (kind) => {
  if (!socket || state.gameState !== "running") return;
  socket.emit("triggerEvent", { kind });
};

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

localPlayer.controls.addEventListener("lock", () => ui.setCenterVisible(false));
localPlayer.controls.addEventListener("unlock", () => ui.setCenterVisible(true));

let socket = null;
if (window.io) socket = window.io();

function applySnapshot({ players, objects }) {
  const ids = new Set(players.map((p) => p.id));
  for (const id of remoteAvatars.keys()) {
    if (!ids.has(id)) removeRemoteAvatar(id);
  }
  for (const p of players) {
    if (p.id === state.id) continue;
    const avatar = ensureRemoteAvatar(p.id);
    avatar.position.set(p.transform.x, 0, p.transform.z);
    avatar.rotation.y = p.transform.yaw;
    setAvatarRevealed(avatar, p.revealed);
  }

  for (const o of objects) {
    const mesh = objectMeshesById.get(o.id);
    if (!mesh) continue;
    mesh.position.set(o.x, o.y, o.z);
    setPossessedVisual(mesh, o.possessedBy);
  }
}

if (socket) {
  socket.on("welcome", (payload) => {
    state.id = payload?.id ?? null;
    state.gameState = payload?.state ?? "lobby";
    state.timeLeftSeconds = payload?.timeLeftSeconds ?? null;
    ui.setTimeLeftSeconds(state.timeLeftSeconds);
    setGameMessage();

    const spawn = randomSpawn();
    localPlayer.setPosition(spawn.x, spawn.y, spawn.z);

    if (payload?.players && payload?.objects) {
      applySnapshot({ players: payload.players, objects: payload.objects });
    }
  });

  socket.on("role", (payload) => {
    state.role = payload?.role ?? null;
    localPlayer.setRole(state.role ?? "agent");
    ui.setRole(state.role);
    setGameMessage();
  });

  socket.on("gameState", (payload) => {
    state.gameState = payload?.state ?? "lobby";
    state.timeLeftSeconds = payload?.endsAtMs ? Math.ceil((payload.endsAtMs - Date.now()) / 1000) : null;
    ui.setTimeLeftSeconds(state.timeLeftSeconds);
    state.possessingObjectId = null;
    localPlayer.setPossessingObjectId(null);
    state.revealedHackerId = null;

    if (payload?.players && payload?.objects) {
      applySnapshot({ players: payload.players, objects: payload.objects });
    }
    setGameMessage();
  });

  socket.on("timer", (payload) => {
    state.timeLeftSeconds = payload?.timeLeftSeconds ?? null;
    ui.setTimeLeftSeconds(state.timeLeftSeconds);
  });

  socket.on("playerJoined", (p) => {
    if (!p || p.id === state.id) return;
    const avatar = ensureRemoteAvatar(p.id);
    avatar.position.set(p.transform.x, 0, p.transform.z);
    avatar.rotation.y = p.transform.yaw;
  });

  socket.on("playerLeft", (payload) => {
    if (!payload?.id) return;
    removeRemoteAvatar(payload.id);
  });

  socket.on("playerMoved", (payload) => {
    const id = payload?.id;
    if (!id || id === state.id) return;
    const avatar = ensureRemoteAvatar(id);
    const t = payload?.transform;
    if (!t) return;
    avatar.position.set(t.x, 0, t.z);
    avatar.rotation.y = t.yaw ?? 0;
    setAvatarRevealed(avatar, Boolean(payload?.revealed));
  });

  socket.on("playerState", (payload) => {
    if (!payload || payload.id !== state.id) return;
    state.possessingObjectId = payload.possessingObjectId ?? null;
    localPlayer.setPossessingObjectId(state.possessingObjectId);
  });

  socket.on("objectUpdated", (o) => {
    const mesh = objectMeshesById.get(o?.id);
    if (!mesh) return;
    mesh.position.set(o.x, o.y, o.z);
    setPossessedVisual(mesh, o.possessedBy);
  });

  socket.on("scanResult", (payload) => {
    if (state.role !== "agent") return;
    if (payload?.detected) ui.setMessage("Scanner: Signal detected nearby.");
    else ui.setMessage("Scanner: No signal.");
    setTimeout(() => setGameMessage(), 1200);
  });

  socket.on("mapEvent", (payload) => {
    if (payload?.kind !== "lightsFlicker") return;
    flickerUntilMs = Date.now() + 900;
  });

  socket.on("hackerRevealed", (payload) => {
    state.revealedHackerId = payload?.hackerId ?? null;
    if (state.revealedHackerId) {
      const avatar = remoteAvatars.get(state.revealedHackerId);
      if (avatar) setAvatarRevealed(avatar, true);
    }
    ui.setMessage("Hacker revealed! Agents win.");
  });

  socket.on("gameEnded", (payload) => {
    state.gameState = "ended";
    const winner = payload?.winner ?? "none";
    if (winner === "hacker") ui.setMessage("Hacker survived. Hacker wins.");
    else if (winner === "agents") ui.setMessage("Agents win.");
    else ui.setMessage("Round ended.");
    setTimeout(() => setGameMessage(), 2500);
  });
}

let lastMoveSentAt = 0;
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());

  const isPossessing = state.role === "hacker" && Boolean(state.possessingObjectId);
  if (isPossessing) {
    const mesh = objectMeshesById.get(state.possessingObjectId);
    if (mesh) {
      localPlayer.setPosition(mesh.position.x, 1.6, mesh.position.z);
    }
  }

  const canMove = state.gameState === "running";
  localPlayer.update(dt, { bounds: MAP_BOUNDS, isPossessing, canMove });

  const obj = localPlayer.controls.getObject();
  obj.position.x = clamp(obj.position.x, MAP_BOUNDS.minX, MAP_BOUNDS.maxX);
  obj.position.z = clamp(obj.position.z, MAP_BOUNDS.minZ, MAP_BOUNDS.maxZ);

  if (socket && state.gameState === "running" && localPlayer.controls.isLocked) {
    const now = performance.now();
    if (now - lastMoveSentAt > 50) {
      lastMoveSentAt = now;
      const t = localPlayer.getTransform();
      socket.emit("move", {
        x: t.x,
        y: t.y,
        z: t.z,
        yaw: t.yaw,
        pitch: t.pitch,
        sprinting: localPlayer.keys.sprint,
        flashlightOn: localPlayer.flashlightOn
      });
    }
  }

  if (Date.now() < flickerUntilMs) {
    const phase = (Date.now() % 110) / 110;
    const mod = phase < 0.55 ? 0.22 : 0.75;
    lights.ambient.intensity = 0.35 * mod;
    lights.pointA.intensity = 0.7 * mod;
    lights.pointB.intensity = 0.65 * mod;
  } else {
    lights.ambient.intensity = 0.35;
    lights.pointA.intensity = 0.7;
    lights.pointB.intensity = 0.65;
  }

  renderer.render(scene, camera);
}

animate();

