import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";

const BASE_SPEED = 5.3;
const SPRINT_MULT = 1.6;
const NUDGE_SPEED = 1.3;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export class LocalPlayer {
  constructor({ camera, domElement, scene }) {
    this.camera = camera;
    this.controls = new PointerLockControls(camera, domElement);
    this.scene = scene;
    this.scene.add(this.controls.getObject());

    this.role = "agent";
    this.isLocked = false;
    this.possessingObjectId = null;
    this.flashlightOn = true;

    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      sprint: false
    };

    this.actions = {
      onShoot: null,
      onScan: null,
      onPossess: null,
      onRelease: null,
      onNudge: null,
      onTriggerEvent: null
    };

    this.flashlight = new THREE.SpotLight(0xffffff, 1.2, 20, Math.PI / 7, 0.35, 1.2);
    this.flashlight.castShadow = false;
    this.flashlight.position.set(0, 1.55, 0);
    this.flashlight.target.position.set(0, 1.5, -1);
    this.controls.getObject().add(this.flashlight);
    this.controls.getObject().add(this.flashlight.target);

    this._raycaster = new THREE.Raycaster();
    this._tmp = new THREE.Vector3();

    this._bindEvents(domElement);
  }

  _bindEvents(domElement) {
    this.controls.addEventListener("lock", () => {
      this.isLocked = true;
    });
    this.controls.addEventListener("unlock", () => {
      this.isLocked = false;
    });

    domElement.addEventListener("click", () => {
      if (!this.controls.isLocked) this.controls.lock();
    });

    window.addEventListener("keydown", (e) => {
      if (e.code === "KeyW") this.keys.forward = true;
      if (e.code === "KeyS") this.keys.backward = true;
      if (e.code === "KeyA") this.keys.left = true;
      if (e.code === "KeyD") this.keys.right = true;
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") this.keys.sprint = true;

      if (e.code === "KeyF") this.setFlashlightOn(!this.flashlightOn);
      if (e.code === "KeyE" && this.actions.onScan) this.actions.onScan();

      if (e.code === "KeyQ" && this.role === "hacker" && this.actions.onPossess) {
        this.actions.onPossess();
      }
      if (e.code === "KeyR" && this.role === "hacker" && this.actions.onRelease) {
        this.actions.onRelease();
      }

      if (e.code === "KeyX" && this.role === "hacker" && this.actions.onTriggerEvent) {
        this.actions.onTriggerEvent("lightsFlicker");
      }
    });

    window.addEventListener("keyup", (e) => {
      if (e.code === "KeyW") this.keys.forward = false;
      if (e.code === "KeyS") this.keys.backward = false;
      if (e.code === "KeyA") this.keys.left = false;
      if (e.code === "KeyD") this.keys.right = false;
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") this.keys.sprint = false;
    });

    window.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      if (!this.controls.isLocked) return;
      if (this.actions.onShoot) this.actions.onShoot();
    });
  }

  setRole(role) {
    this.role = role;
  }

  setFlashlightOn(on) {
    this.flashlightOn = Boolean(on);
    this.flashlight.visible = this.flashlightOn;
  }

  setPosition(x, y, z) {
    this.controls.getObject().position.set(x, y, z);
  }

  setYawPitch({ yaw, pitch }) {
    const obj = this.controls.getObject();
    obj.rotation.y = yaw;
    this.camera.rotation.x = pitch;
  }

  setPossessingObjectId(objectId) {
    this.possessingObjectId = objectId;
  }

  getTransform() {
    const obj = this.controls.getObject();
    return {
      x: obj.position.x,
      y: obj.position.y,
      z: obj.position.z,
      yaw: obj.rotation.y,
      pitch: this.camera.rotation.x
    };
  }

  update(dtSeconds, { bounds, isPossessing, canMove }) {
    if (!this.controls.isLocked) return;
    if (!canMove) return;

    if (isPossessing) {
      this._updatePossessing(dtSeconds, bounds);
      return;
    }

    this._updateWalking(dtSeconds, bounds);
  }

  _updateWalking(dtSeconds, bounds) {
    const speed = BASE_SPEED * (this.keys.sprint ? SPRINT_MULT : 1);
    const obj = this.controls.getObject();

    this.direction.set(0, 0, 0);
    if (this.keys.forward) this.direction.z -= 1;
    if (this.keys.backward) this.direction.z += 1;
    if (this.keys.left) this.direction.x -= 1;
    if (this.keys.right) this.direction.x += 1;
    this.direction.normalize();

    if (this.direction.lengthSq() > 0) {
      this._tmp.copy(this.direction).applyEuler(obj.rotation);
      obj.position.x += this._tmp.x * speed * dtSeconds;
      obj.position.z += this._tmp.z * speed * dtSeconds;
    }

    obj.position.x = clamp(obj.position.x, bounds.minX, bounds.maxX);
    obj.position.z = clamp(obj.position.z, bounds.minZ, bounds.maxZ);
    obj.position.y = 1.6;
  }

  _updatePossessing(dtSeconds) {
    if (!this.actions.onNudge) return;

    const dx = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
    const dz = (this.keys.backward ? 1 : 0) - (this.keys.forward ? 1 : 0);
    if (dx === 0 && dz === 0) return;

    const nudge = new THREE.Vector3(dx, 0, dz).normalize().multiplyScalar(NUDGE_SPEED * dtSeconds);
    const yaw = this.controls.getObject().rotation.y;
    nudge.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);

    this.actions.onNudge({ dx: nudge.x, dz: nudge.z });
  }

  rayFromCamera() {
    const origin = this.controls.getObject().position.clone();
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
    return { origin, direction };
  }
}

export function createRemoteAvatar() {
  const group = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xcaa67a, roughness: 0.9, metalness: 0.02 });
  const suitMat = new THREE.MeshStandardMaterial({ color: 0x3b5878, roughness: 0.85, metalness: 0.06 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a2230, roughness: 0.95, metalness: 0.02 });

  const hips = new THREE.Group();
  hips.position.y = 0;
  group.add(hips);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.28), suitMat);
  torso.position.y = 1.2;
  torso.castShadow = true;
  hips.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.32), skinMat);
  head.position.y = 1.72;
  head.castShadow = true;
  hips.add(head);

  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.18), skinMat);
  neck.position.y = 1.52;
  neck.castShadow = true;
  hips.add(neck);

  const armGeo = new THREE.BoxGeometry(0.14, 0.55, 0.14);
  const foreGeo = new THREE.BoxGeometry(0.13, 0.5, 0.13);
  const legGeo = new THREE.BoxGeometry(0.18, 0.62, 0.18);

  const leftArm = new THREE.Group();
  leftArm.position.set(-0.36, 1.42, 0);
  hips.add(leftArm);
  const leftUpper = new THREE.Mesh(armGeo, suitMat);
  leftUpper.position.y = -0.22;
  leftUpper.castShadow = true;
  leftArm.add(leftUpper);
  const leftFore = new THREE.Mesh(foreGeo, darkMat);
  leftFore.position.y = -0.73;
  leftFore.castShadow = true;
  leftArm.add(leftFore);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.36, 1.42, 0);
  hips.add(rightArm);
  const rightUpper = new THREE.Mesh(armGeo, suitMat);
  rightUpper.position.y = -0.22;
  rightUpper.castShadow = true;
  rightArm.add(rightUpper);
  const rightFore = new THREE.Mesh(foreGeo, darkMat);
  rightFore.position.y = -0.73;
  rightFore.castShadow = true;
  rightArm.add(rightFore);

  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.16, 0.92, 0);
  hips.add(leftLeg);
  const leftThigh = new THREE.Mesh(legGeo, darkMat);
  leftThigh.position.y = -0.3;
  leftThigh.castShadow = true;
  leftLeg.add(leftThigh);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.16, 0.92, 0);
  hips.add(rightLeg);
  const rightThigh = new THREE.Mesh(legGeo, darkMat);
  rightThigh.position.y = -0.3;
  rightThigh.castShadow = true;
  rightLeg.add(rightThigh);

  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.44, 0.18), darkMat);
  backpack.position.set(0, 1.22, 0.22);
  backpack.castShadow = true;
  hips.add(backpack);

  const shadowBlob = new THREE.Mesh(
    new THREE.CircleGeometry(0.38, 16),
    new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 1, metalness: 0, transparent: true, opacity: 0.35 })
  );
  shadowBlob.rotation.x = -Math.PI / 2;
  shadowBlob.position.y = 0.02;
  shadowBlob.receiveShadow = false;
  group.add(shadowBlob);

  group.userData.parts = { torso, head, leftArm, rightArm, leftLeg, rightLeg, hips };
  group.userData.materials = { skinMat, suitMat, darkMat };
  group.userData.revealed = false;
  group.userData.moveSpeed = 0;
  group.userData._lastPos = new THREE.Vector3();
  group.userData._lastAt = 0;
  return group;
}

export function setAvatarRevealed(avatar, revealed) {
  const isRevealed = Boolean(revealed);
  avatar.userData.revealed = isRevealed;
  const mats = avatar.userData.materials;
  if (!mats) return;

  if (isRevealed) {
    mats.suitMat.color.setHex(0x8a2a2a);
    mats.darkMat.color.setHex(0x3b0f0f);
    mats.skinMat.color.setHex(0xffc7a8);
  } else {
    mats.suitMat.color.setHex(0x3b5878);
    mats.darkMat.color.setHex(0x1a2230);
    mats.skinMat.color.setHex(0xcaa67a);
  }
}

export function updateAvatarAnimation(avatar, timeSeconds) {
  const parts = avatar.userData.parts;
  if (!parts) return;

  const speed = Number(avatar.userData.moveSpeed ?? 0);
  const walk = Math.min(1, speed / 4.2);
  const t = timeSeconds;

  const sway = Math.sin(t * 2.2) * 0.03;
  parts.hips.position.y = sway * (0.55 + walk * 0.7);

  const swing = Math.sin(t * (5.5 + walk * 3.2)) * (0.55 * walk);
  const swing2 = Math.sin(t * (5.5 + walk * 3.2) + Math.PI) * (0.55 * walk);

  parts.leftLeg.rotation.x = swing;
  parts.rightLeg.rotation.x = swing2;
  parts.leftArm.rotation.x = swing2 * 0.9;
  parts.rightArm.rotation.x = swing * 0.9;

  parts.torso.rotation.z = Math.sin(t * 2.2) * 0.04 * (0.6 + walk);
  parts.head.rotation.y = Math.sin(t * 1.6) * 0.06;
  parts.head.rotation.x = Math.sin(t * 2.0) * 0.04;
}
