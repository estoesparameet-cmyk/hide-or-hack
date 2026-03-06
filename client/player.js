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
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.3, 1.0, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0x5aaaff, roughness: 0.85, metalness: 0.05 })
  );
  body.position.y = 1.1;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0x9cc7ff, roughness: 0.9, metalness: 0.02 })
  );
  head.position.y = 1.75;
  head.castShadow = true;
  group.add(head);

  group.userData.bodyMesh = body;
  group.userData.headMesh = head;
  group.userData.revealed = false;
  return group;
}

export function setAvatarRevealed(avatar, revealed) {
  const isRevealed = Boolean(revealed);
  avatar.userData.revealed = isRevealed;
  const body = avatar.userData.bodyMesh;
  const head = avatar.userData.headMesh;
  const bodyMat = body.material;
  const headMat = head.material;

  if (isRevealed) {
    bodyMat.color.setHex(0xff5a5a);
    headMat.color.setHex(0xffb3b3);
  } else {
    bodyMat.color.setHex(0x5aaaff);
    headMat.color.setHex(0x9cc7ff);
  }
}

