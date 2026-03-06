import * as THREE from "three";

function makeMaterial(color) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.95,
    metalness: 0.02
  });
}

export function createMap(scene) {
  const group = new THREE.Group();

  const floor = new THREE.Mesh(new THREE.BoxGeometry(40, 0.2, 40), makeMaterial(0x1c2633));
  floor.position.y = -0.1;
  floor.receiveShadow = true;
  group.add(floor);

  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(40, 0.18, 40), makeMaterial(0x121923));
  ceiling.position.y = 3.95;
  ceiling.receiveShadow = true;
  group.add(ceiling);

  const wallMat = makeMaterial(0x2c3a4a);
  const wallThickness = 0.6;
  const wallHeight = 4;
  const wallLen = 40;

  const north = new THREE.Mesh(new THREE.BoxGeometry(wallLen, wallHeight, wallThickness), wallMat);
  north.position.set(0, wallHeight / 2 - 0.1, -20);
  north.receiveShadow = true;
  group.add(north);

  const south = new THREE.Mesh(new THREE.BoxGeometry(wallLen, wallHeight, wallThickness), wallMat);
  south.position.set(0, wallHeight / 2 - 0.1, 20);
  south.receiveShadow = true;
  group.add(south);

  const west = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, wallLen), wallMat);
  west.position.set(-20, wallHeight / 2 - 0.1, 0);
  west.receiveShadow = true;
  group.add(west);

  const east = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, wallLen), wallMat);
  east.position.set(20, wallHeight / 2 - 0.1, 0);
  east.receiveShadow = true;
  group.add(east);

  const glassMat = makeMaterial(0x3d596f);
  glassMat.transparent = true;
  glassMat.opacity = 0.55;

  const roomWall1 = new THREE.Mesh(new THREE.BoxGeometry(18, wallHeight, wallThickness), wallMat);
  roomWall1.position.set(0, wallHeight / 2 - 0.1, -6);
  group.add(roomWall1);

  const roomWall2 = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, wallHeight, 16), wallMat);
  roomWall2.position.set(-6, wallHeight / 2 - 0.1, 6);
  group.add(roomWall2);

  const glass1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.4, 10), glassMat);
  glass1.position.set(6.5, 1.2, 6);
  group.add(glass1);

  const deskArea = new THREE.Mesh(new THREE.BoxGeometry(14, 0.12, 10), makeMaterial(0x161c24));
  deskArea.position.set(0, 0.06, -12);
  deskArea.receiveShadow = true;
  group.add(deskArea);

  const deskTopMat = makeMaterial(0x2b313a);
  const deskLegMat = makeMaterial(0x151b22);
  function addDesk(x, z, w = 2.4, d = 1.1) {
    const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), deskTopMat);
    top.position.set(x, 0.78, z);
    top.castShadow = true;
    top.receiveShadow = true;
    group.add(top);

    const legGeo = new THREE.BoxGeometry(0.12, 0.78, 0.12);
    const ox = w / 2 - 0.16;
    const oz = d / 2 - 0.16;
    for (const [lx, lz] of [
      [-ox, -oz],
      [ox, -oz],
      [-ox, oz],
      [ox, oz]
    ]) {
      const leg = new THREE.Mesh(legGeo, deskLegMat);
      leg.position.set(x + lx, 0.39, z + lz);
      leg.castShadow = true;
      leg.receiveShadow = true;
      group.add(leg);
    }
  }

  addDesk(-5, -12);
  addDesk(0, -12);
  addDesk(5, -12);
  addDesk(-5, -9.6);
  addDesk(0, -9.6);
  addDesk(5, -9.6);

  const trimMat = makeMaterial(0x202a36);
  const trimN = new THREE.Mesh(new THREE.BoxGeometry(wallLen, 0.18, 0.35), trimMat);
  trimN.position.set(0, 0.09, -19.85);
  group.add(trimN);
  const trimS = new THREE.Mesh(new THREE.BoxGeometry(wallLen, 0.18, 0.35), trimMat);
  trimS.position.set(0, 0.09, 19.85);
  group.add(trimS);
  const trimW = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, wallLen), trimMat);
  trimW.position.set(-19.85, 0.09, 0);
  group.add(trimW);
  const trimE = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, wallLen), trimMat);
  trimE.position.set(19.85, 0.09, 0);
  group.add(trimE);

  const pillarMat = makeMaterial(0x243242);
  const pillarGeo = new THREE.BoxGeometry(0.9, 4.1, 0.9);
  const pillarPos = [
    [-14, 1.95, -14],
    [14, 1.95, -14],
    [-14, 1.95, 14],
    [14, 1.95, 14]
  ];
  for (const [x, y, z] of pillarPos) {
    const p = new THREE.Mesh(pillarGeo, pillarMat);
    p.position.set(x, y, z);
    p.castShadow = true;
    p.receiveShadow = true;
    group.add(p);
  }

  const panelMat = new THREE.MeshStandardMaterial({
    color: 0xdfe8f3,
    roughness: 0.6,
    metalness: 0,
    emissive: new THREE.Color(0xa8cfff),
    emissiveIntensity: 0.9
  });
  const panelGeo = new THREE.BoxGeometry(4.2, 0.08, 1.3);
  const panelPos = [
    [-10, 3.78, -10],
    [10, 3.78, -10],
    [-10, 3.78, 10],
    [10, 3.78, 10],
    [0, 3.78, 0]
  ];
  for (const [x, y, z] of panelPos) {
    const panel = new THREE.Mesh(panelGeo, panelMat);
    panel.position.set(x, y, z);
    panel.castShadow = false;
    group.add(panel);
  }

  scene.add(group);

  const ambient = new THREE.AmbientLight(0xb6c4d6, 0.35);
  scene.add(ambient);

  const overhead = new THREE.DirectionalLight(0xffffff, 0.65);
  overhead.position.set(12, 18, 6);
  overhead.castShadow = true;
  overhead.shadow.mapSize.set(1024, 1024);
  overhead.shadow.camera.near = 1;
  overhead.shadow.camera.far = 60;
  overhead.shadow.camera.left = -24;
  overhead.shadow.camera.right = 24;
  overhead.shadow.camera.top = 24;
  overhead.shadow.camera.bottom = -24;
  scene.add(overhead);

  const pointA = new THREE.PointLight(0xaed7ff, 0.95, 24, 2);
  pointA.position.set(-10, 3.2, 10);
  scene.add(pointA);

  const pointB = new THREE.PointLight(0xffe6b0, 0.85, 24, 2);
  pointB.position.set(10, 3.2, -10);
  scene.add(pointB);

  return {
    group,
    lights: { ambient, overhead, pointA, pointB }
  };
}
