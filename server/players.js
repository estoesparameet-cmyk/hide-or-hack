export class Players {
  constructor(maxPlayers) {
    this.maxPlayers = maxPlayers;
    this.byId = new Map();
  }

  count() {
    return this.byId.size;
  }

  has(id) {
    return this.byId.has(id);
  }

  get(id) {
    return this.byId.get(id) ?? null;
  }

  list() {
    return [...this.byId.values()];
  }

  add(player) {
    if (this.byId.size >= this.maxPlayers) return false;
    this.byId.set(player.id, player);
    return true;
  }

  remove(id) {
    const player = this.byId.get(id) ?? null;
    this.byId.delete(id);
    return player;
  }
}

export function createPlayer({ id }) {
  return {
    id,
    name: `Player-${id.slice(0, 4)}`,
    role: "agent",
    connectedAtMs: Date.now(),
    transform: {
      x: 0,
      y: 1.6,
      z: 0,
      yaw: 0,
      pitch: 0
    },
    sprinting: false,
    flashlightOn: true,
    possessingObjectId: null,
    revealed: false
  };
}

