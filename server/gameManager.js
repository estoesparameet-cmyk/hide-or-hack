import { Players, createPlayer } from "./players.js";

const GAME_SECONDS = 5 * 60;
const MAX_PLAYERS = 7;
const MAP_BOUNDS = { minX: -18, maxX: 18, minZ: -18, maxZ: 18 };

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function distSq(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

function distSqXZ(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz;
}

function nowMs() {
  return Date.now();
}

function createObjects() {
  const objects = [
    { id: "chair-1", kind: "chair", x: -6, y: 0, z: -4, r: 0.6 },
    { id: "chair-2", kind: "chair", x: -3, y: 0, z: -4, r: 0.6 },
    { id: "chair-3", kind: "chair", x: 6, y: 0, z: -4, r: 0.6 },
    { id: "chair-4", kind: "chair", x: 3, y: 0, z: -4, r: 0.6 },
    { id: "box-1", kind: "box", x: -10, y: 0, z: 8, r: 0.7 },
    { id: "box-2", kind: "box", x: -11.2, y: 0, z: 7.6, r: 0.7 },
    { id: "plant-1", kind: "plant", x: 12, y: 0, z: 10, r: 0.7 },
    { id: "plant-2", kind: "plant", x: 12, y: 0, z: -10, r: 0.7 },
    { id: "computer-1", kind: "computer", x: -5, y: 0, z: -8, r: 0.7 },
    { id: "computer-2", kind: "computer", x: 5, y: 0, z: -8, r: 0.7 },
    { id: "lamp-1", kind: "lamp", x: 0, y: 0, z: 12, r: 0.7 },
    { id: "lamp-2", kind: "lamp", x: 0, y: 0, z: -12, r: 0.7 }
  ];

  return new Map(objects.map((o) => [o.id, { ...o, possessedBy: null }]));
}

function serializeObject(o) {
  return {
    id: o.id,
    kind: o.kind,
    x: o.x,
    y: o.y,
    z: o.z,
    possessedBy: o.possessedBy
  };
}

export class GameManager {
  constructor(io) {
    this.io = io;
    this.players = new Players(MAX_PLAYERS);
    this.objects = createObjects();

    this.state = "lobby";
    this.startedAtMs = null;
    this.endsAtMs = null;
    this.hackerId = null;
    this._ticker = null;
    this._pendingStart = null;
  }

  attachSocket(socket) {
    const player = createPlayer({ id: socket.id });
    if (!this.players.add(player)) {
      socket.emit("lobbyFull");
      socket.disconnect(true);
      return;
    }

    socket.emit("welcome", {
      id: player.id,
      state: this.state,
      players: this.players.list().map((p) => this._publicPlayer(p)),
      objects: [...this.objects.values()].map(serializeObject),
      timeLeftSeconds: this._timeLeftSeconds(),
      maxPlayers: MAX_PLAYERS
    });

    socket.broadcast.emit("playerJoined", this._publicPlayer(player));

    socket.on("disconnect", () => {
      const removed = this.players.remove(socket.id);
      if (!removed) return;

      this._releasePossessionByPlayer(removed.id);
      this.io.emit("playerLeft", { id: removed.id });

      if (this.state === "running" && removed.id === this.hackerId) {
        this._endGame({ winner: "agents", reason: "hackerDisconnected" });
      } else if (this.state === "running" && this.players.count() < 2) {
        this._endGame({ winner: "none", reason: "notEnoughPlayers" });
      }

      this._maybeAutoStart();
    });

    socket.on("move", (payload) => {
      const p = this.players.get(socket.id);
      if (!p || this.state !== "running") return;
      if (!payload || typeof payload !== "object") return;

      const x = clamp(Number(payload.x ?? p.transform.x), MAP_BOUNDS.minX, MAP_BOUNDS.maxX);
      const y = clamp(Number(payload.y ?? p.transform.y), 0, 3);
      const z = clamp(Number(payload.z ?? p.transform.z), MAP_BOUNDS.minZ, MAP_BOUNDS.maxZ);
      const yaw = Number(payload.yaw ?? p.transform.yaw);
      const pitch = Number(payload.pitch ?? p.transform.pitch);
      const sprinting = Boolean(payload.sprinting);
      const flashlightOn = Boolean(payload.flashlightOn);

      p.transform = { x, y, z, yaw, pitch };
      p.sprinting = sprinting;
      p.flashlightOn = flashlightOn;

      if (p.role === "hacker" && p.possessingObjectId) {
        const o = this.objects.get(p.possessingObjectId);
        if (o) {
          p.transform.x = o.x;
          p.transform.z = o.z;
          p.transform.y = 1.6;
        }
      }

      socket.broadcast.emit("playerMoved", {
        id: p.id,
        transform: p.transform,
        sprinting: p.sprinting,
        flashlightOn: p.flashlightOn,
        revealed: p.revealed
      });
    });

    socket.on("scan", () => {
      const p = this.players.get(socket.id);
      if (!p || this.state !== "running") return;
      if (p.role !== "agent") return;

      const hacker = this.players.get(this.hackerId);
      if (!hacker) return;
      const hackerPos = this._hackerWorldPosition(hacker);

      const within = distSqXZ(p.transform, hackerPos) <= 6 * 6;
      socket.emit("scanResult", { detected: within });
    });

    socket.on("possess", (payload) => {
      const p = this.players.get(socket.id);
      if (!p || this.state !== "running") return;
      if (p.role !== "hacker") return;

      const objectId = String(payload?.objectId ?? "");
      if (!this.objects.has(objectId)) return;

      const o = this.objects.get(objectId);
      if (!o) return;
      if (o.possessedBy && o.possessedBy !== p.id) return;

      const canReach = distSqXZ(p.transform, o) <= 3.5 * 3.5;
      if (!canReach) return;

      this._releasePossessionByPlayer(p.id);
      o.possessedBy = p.id;
      p.possessingObjectId = o.id;

      this.io.emit("objectUpdated", serializeObject(o));
      this.io.emit("playerState", { id: p.id, possessingObjectId: p.possessingObjectId });
    });

    socket.on("release", () => {
      const p = this.players.get(socket.id);
      if (!p || this.state !== "running") return;
      if (p.role !== "hacker") return;

      this._releasePossessionByPlayer(p.id);
    });

    socket.on("nudgeObject", (payload) => {
      const p = this.players.get(socket.id);
      if (!p || this.state !== "running") return;
      if (p.role !== "hacker") return;
      if (!p.possessingObjectId) return;

      const o = this.objects.get(p.possessingObjectId);
      if (!o || o.possessedBy !== p.id) return;

      const dx = clamp(Number(payload?.dx ?? 0), -0.25, 0.25);
      const dz = clamp(Number(payload?.dz ?? 0), -0.25, 0.25);

      o.x = clamp(o.x + dx, MAP_BOUNDS.minX + 1, MAP_BOUNDS.maxX - 1);
      o.z = clamp(o.z + dz, MAP_BOUNDS.minZ + 1, MAP_BOUNDS.maxZ - 1);

      this.io.emit("objectUpdated", serializeObject(o));
    });

    socket.on("shoot", (payload) => {
      const p = this.players.get(socket.id);
      if (!p || this.state !== "running") return;
      if (p.role !== "agent") return;

      const objectId = String(payload?.hitObjectId ?? "");
      if (!objectId) return;
      const o = this.objects.get(objectId);
      if (!o) return;

      const shooterPos = p.transform;
      const withinRange = distSqXZ(shooterPos, o) <= 20 * 20;
      if (!withinRange) return;

      this.io.emit("shotFired", { by: p.id, hitObjectId: objectId });

      if (o.possessedBy && this.state === "running") {
        const hacker = this.players.get(o.possessedBy);
        if (hacker) hacker.revealed = true;
        this.io.emit("hackerRevealed", { objectId, hackerId: o.possessedBy });
        this._endGame({ winner: "agents", reason: "hackerRevealed" });
      }
    });

    socket.on("triggerEvent", (payload) => {
      const p = this.players.get(socket.id);
      if (!p || this.state !== "running") return;
      if (p.role !== "hacker") return;

      const kind = String(payload?.kind ?? "");
      if (kind !== "lightsFlicker") return;

      this.io.emit("mapEvent", { kind: "lightsFlicker", atMs: nowMs() });
    });

    this._maybeAutoStart();
  }

  _publicPlayer(p) {
    return {
      id: p.id,
      name: p.name,
      transform: p.transform,
      sprinting: p.sprinting,
      flashlightOn: p.flashlightOn,
      revealed: p.revealed
    };
  }

  _timeLeftSeconds() {
    if (!this.endsAtMs) return null;
    return Math.max(0, Math.ceil((this.endsAtMs - nowMs()) / 1000));
  }

  _hackerWorldPosition(hacker) {
    if (hacker.possessingObjectId) {
      const o = this.objects.get(hacker.possessingObjectId);
      if (o) return { x: o.x, y: 1.6, z: o.z };
    }
    return hacker.transform;
  }

  _maybeAutoStart() {
    if (this.state !== "lobby") return;
    if (this.players.count() < 2) return;
    if (this._pendingStart) return;

    this._pendingStart = setTimeout(() => {
      this._pendingStart = null;
      if (this.state !== "lobby") return;
      if (this.players.count() < 2) return;
      this._startGame();
    }, 1500);
  }

  _startGame() {
    this.state = "running";
    this.startedAtMs = nowMs();
    this.endsAtMs = this.startedAtMs + GAME_SECONDS * 1000;

    const playerIds = this.players.list().map((p) => p.id);
    this.hackerId = playerIds[Math.floor(Math.random() * playerIds.length)] ?? null;

    for (const p of this.players.list()) {
      p.role = p.id === this.hackerId ? "hacker" : "agent";
      p.possessingObjectId = null;
      p.revealed = false;
    }
    for (const o of this.objects.values()) o.possessedBy = null;

    this.io.emit("gameState", {
      state: this.state,
      startedAtMs: this.startedAtMs,
      endsAtMs: this.endsAtMs,
      players: this.players.list().map((p) => this._publicPlayer(p)),
      objects: [...this.objects.values()].map(serializeObject)
    });

    for (const p of this.players.list()) {
      this.io.to(p.id).emit("role", { role: p.role });
    }

    if (this._ticker) clearInterval(this._ticker);
    this._ticker = setInterval(() => {
      if (this.state !== "running") return;
      const left = this._timeLeftSeconds();
      this.io.emit("timer", { timeLeftSeconds: left });
      if (left <= 0) this._endGame({ winner: "hacker", reason: "timer" });
    }, 1000);
  }

  _endGame({ winner, reason }) {
    if (this.state !== "running") return;
    this.state = "ended";

    if (this._ticker) {
      clearInterval(this._ticker);
      this._ticker = null;
    }

    this.io.emit("gameEnded", { winner, reason });

    setTimeout(() => {
      if (this.players.count() < 2) {
        this.state = "lobby";
        this.startedAtMs = null;
        this.endsAtMs = null;
        this.hackerId = null;
        this.io.emit("gameState", {
          state: this.state,
          startedAtMs: null,
          endsAtMs: null,
          players: this.players.list().map((p) => this._publicPlayer(p)),
          objects: [...this.objects.values()].map(serializeObject)
        });
        return;
      }

      this.state = "lobby";
      this.startedAtMs = null;
      this.endsAtMs = null;
      this.hackerId = null;
      this.io.emit("gameState", {
        state: this.state,
        startedAtMs: null,
        endsAtMs: null,
        players: this.players.list().map((p) => this._publicPlayer(p)),
        objects: [...this.objects.values()].map(serializeObject)
      });
      this._maybeAutoStart();
    }, 8000);
  }

  _releasePossessionByPlayer(playerId) {
    const p = this.players.get(playerId);
    if (!p) return;
    const objectId = p.possessingObjectId;
    if (!objectId) return;

    const o = this.objects.get(objectId);
    if (o && o.possessedBy === playerId) {
      o.possessedBy = null;
      this.io.emit("objectUpdated", serializeObject(o));
    }
    p.possessingObjectId = null;
    this.io.emit("playerState", { id: p.id, possessingObjectId: null });
  }
}
