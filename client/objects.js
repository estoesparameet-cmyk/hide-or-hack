import * as THREE from "three";

export function getPossessableDefs() {
  return [
    { id: "chair-1", kind: "chair", x: -6, y: 0, z: -4 },
    { id: "chair-2", kind: "chair", x: -3, y: 0, z: -4 },
    { id: "chair-3", kind: "chair", x: 6, y: 0, z: -4 },
    { id: "chair-4", kind: "chair", x: 3, y: 0, z: -4 },
    { id: "box-1", kind: "box", x: -10, y: 0, z: 8 },
    { id: "box-2", kind: "box", x: -11.2, y: 0, z: 7.6 },
    { id: "plant-1", kind: "plant", x: 12, y: 0, z: 10 },
    { id: "plant-2", kind: "plant", x: 12, y: 0, z: -10 },
    { id: "computer-1", kind: "computer", x: -5, y: 0, z: -8 },
    { id: "computer-2", kind: "computer", x: 5, y: 0, z: -8 },
    { id: "lamp-1", kind: "lamp", x: 0, y: 0, z: 12 },
    { id: "lamp-2", kind: "lamp", x: 0, y: 0, z: -12 }
  ];
}

function makeMaterial(color) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.9,
    metalness: 0.05
  });
}

function createChair() {
  const group = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.14, 0.9), makeMaterial(0x6c5b4a));
  seat.position.y = 0.55;
  group.add(seat);

  const back = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.14), makeMaterial(0x5a4b3e));
  back.position.set(0, 1.0, -0.38);
  group.add(back);

  const legGeo = new THREE.BoxGeometry(0.12, 0.6, 0.12);
  const legMat = makeMaterial(0x2c2c2c);
  const legOffsets = [
    [-0.36, 0.25, -0.36],
    [0.36, 0.25, -0.36],
    [-0.36, 0.25, 0.36],
    [0.36, 0.25, 0.36]
  ];
  for (const [x, y, z] of legOffsets) {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(x, y, z);
    group.add(leg);
  }
  return group;
}

function createBox() {
  const group = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), makeMaterial(0x8a6b4f));
  box.castShadow = true;
  box.receiveShadow = true;
  group.add(box);

  const strapMat = makeMaterial(0x2a2a2a);
  const strapA = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.06, 0.14), strapMat);
  strapA.position.y = 0.16;
  group.add(strapA);
  const strapB = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 1.22), strapMat);
  strapB.position.y = -0.22;
  group.add(strapB);

  group.position.y = 0.6;
  return group;
}

function createPlant() {
  const group = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.45, 8), makeMaterial(0x7b3f2c));
  pot.position.y = 0.22;
  group.add(pot);
  const leaves = new THREE.Mesh(new THREE.ConeGeometry(0.75, 1.3, 8), makeMaterial(0x2f7d47));
  leaves.position.y = 1.1;
  group.add(leaves);
  return group;
}

function createComputer() {
  const group = new THREE.Group();
  const desk = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.9), makeMaterial(0x3f444d));
  desk.position.y = 0.75;
  group.add(desk);
  const monitor = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.54, 0.08), makeMaterial(0x1d232c));
  monitor.position.set(0, 1.12, -0.25);
  group.add(monitor);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.78, 0.44),
    new THREE.MeshStandardMaterial({
      color: 0x0b1420,
      emissive: new THREE.Color(0x1f6bff),
      emissiveIntensity: 0.35,
      roughness: 0.7,
      metalness: 0
    })
  );
  screen.position.set(0, 1.12, -0.21);
  group.add(screen);
  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.25, 0.12), makeMaterial(0x2a303a));
  stand.position.set(0, 0.92, -0.25);
  group.add(stand);

  const keyboard = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.05, 0.24), makeMaterial(0x2a303a));
  keyboard.position.set(0, 0.82, 0.08);
  group.add(keyboard);

  group.position.y = 0;
  return group;
}

function createLamp() {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.32, 0.1, 10), makeMaterial(0x38414f));
  base.position.y = 0.05;
  group.add(base);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.2, 10), makeMaterial(0x2b2f38));
  pole.position.y = 0.65;
  group.add(pole);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.42, 10), makeMaterial(0xe7ddc2));
  shade.position.y = 1.35;
  shade.rotation.x = Math.PI;
  group.add(shade);
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 10, 10),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: new THREE.Color(0xfff3c7),
      emissiveIntensity: 0.8,
      roughness: 0.4,
      metalness: 0
    })
  );
  bulb.position.set(0, 1.18, 0);
  group.add(bulb);
  return group;
}

function createModel(kind) {
  if (kind === "chair") return createChair();
  if (kind === "box") return createBox();
  if (kind === "plant") return createPlant();
  if (kind === "computer") return createComputer();
  if (kind === "lamp") return createLamp();
  return createBox();
}

export function createPossessables(scene) {
  const meshesById = new Map();
  const interactables = [];

  for (const def of getPossessableDefs()) {
    const model = createModel(def.kind);
    model.position.set(def.x, def.y, def.z);
    model.userData.objectId = def.id;
    model.userData.kind = def.kind;
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.userData.objectId = def.id;
        child.userData.kind = def.kind;
      }
    });
    scene.add(model);
    meshesById.set(def.id, model);
    interactables.push(model);
  }

  return { meshesById, interactables };
}
