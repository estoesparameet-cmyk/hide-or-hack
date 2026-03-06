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

  const pointA = new THREE.PointLight(0xaed7ff, 0.7, 20, 2);
  pointA.position.set(-10, 3.2, 10);
  scene.add(pointA);

  const pointB = new THREE.PointLight(0xffe6b0, 0.65, 20, 2);
  pointB.position.set(10, 3.2, -10);
  scene.add(pointB);

  return {
    group,
    lights: { ambient, overhead, pointA, pointB }
  };
}

