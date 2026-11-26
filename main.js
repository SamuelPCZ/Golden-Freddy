import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { buildFuntimeHinges, buildFuntimePrototype, noseTravel, poseFuntime } from "./funtime.js";
import { sampleShowtime } from "./showtime.js";

const canvas = document.querySelector("#scene");
const stage = document.querySelector("#viewer");
const statusPanel = document.querySelector("#viewer-status");
const statusText = statusPanel.querySelector("span:last-child");
const readoutState = document.querySelector("#readout-state");
const inspectionToggle = document.querySelector("#inspection-toggle");
const clearSelectionButton = document.querySelector("#clear-selection");
const centerViewButton = document.querySelector("#center-view");
const viewerInstructions = document.querySelector("#viewer-instructions");
const hatToggle = document.querySelector("#hat-toggle");
const hatStatus = document.querySelector("#hat-status");
const microphoneToggle = document.querySelector("#microphone-toggle");
const microphoneStatus = document.querySelector("#microphone-status");
const leftArmToggle = document.querySelector("#left-arm-toggle");
const leftArmStatus = document.querySelector("#left-arm-status");
const leftArmSaluteToggle = document.querySelector("#left-arm-salute-toggle");
const leftArmSaluteStatus = document.querySelector("#left-arm-salute-status");
const jawToggle = document.querySelector("#jaw-toggle");
const jawStatus = document.querySelector("#jaw-status");
const lateralAxis = new THREE.Vector3(1, 0, 0);
const armFoldAxis = new THREE.Vector3(1, 0, 0);
const armForearmRollAxis = new THREE.Vector3(0, 0, 1);
const armWristAxis = new THREE.Vector3(0, 1, 0);
const armWaveAxis = new THREE.Vector3(0, 0, 1);
const armFoldRotation = new THREE.Quaternion();
const armForearmRollRotation = new THREE.Quaternion();
const armWristRotation = new THREE.Quaternion();
const jawOpenAngle = THREE.MathUtils.degToRad(15);
const shellOpening = document.querySelector("#shell-opening");
const shellValue = document.querySelector("#shell-value");
const shellStatus = document.querySelector("#shell-status");
const shellMaxAngle = THREE.MathUtils.degToRad(45);
const shellControls = document.querySelector("#shell-controls");
const maintenanceMode = document.querySelector("#maintenance-mode");
const exteriorOption = maintenanceMode.querySelector('[value="exterior"]');
const funtimeEnabled = true;
const funtimeOption = maintenanceMode.querySelector('[value="funtime"]');
const startShowtime = document.querySelector("#start-showtime");
const stopShowtime = document.querySelector("#stop-showtime");
const showtimeSpeed = document.querySelector("#showtime-speed");
const showtimeSpeedValue = document.querySelector("#showtime-speed-value");
const showtimeIntensity = document.querySelector("#showtime-intensity");
const showtimeIntensityValue = document.querySelector("#showtime-intensity-value");
const showtimeHead = document.querySelector("#showtime-head");
const showtimeArms = document.querySelector("#showtime-arms");
const showtimeStatus = document.querySelector("#showtime-status");
const funtimeControls = [
  ["forehead", "forehead", 38], ["cheeks", "cheek", 54],
  ["nose", "nose", 0], ["muzzle", "muzzle", 38]
].map(([key, id, degrees]) => ({
  key,
  input: document.querySelector(`#${id}-opening`),
  output: document.querySelector(`#${id}-value`),
  maxAngle: THREE.MathUtils.degToRad(degrees)
}));
const funtimePanel = document.querySelector("#funtime-controls");
const faceOpening = document.querySelector("#face-opening");
const faceValue = document.querySelector("#face-value");
const runFace = document.querySelector("#run-face");
const closeFace = document.querySelector("#close-face");
const facePhases = [
  ["forehead", 0, .21], ["cheeks", .21, .81], ["nose", .21, .81],
  ["muzzle", .21, .81], ["jaw", .81, 1]
];
const exteriorControls = document.querySelector("#exterior-controls");
const restoreExterior = document.querySelector("#restore-exterior");
const maintenanceStatus = document.querySelector("#maintenance-status");

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x090a0d);

const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 1000);
camera.position.set(0, 0, 5);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance"
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;

scene.add(new THREE.HemisphereLight(0xd7d9de, 0x292116, 1.65));
scene.add(new THREE.AmbientLight(0xffffff, .35));

const keyLight = new THREE.DirectionalLight(0xffe4ad, 2.4);
keyLight.position.set(-4, 6, 5);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x9ab0c2, 1.05);
fillLight.position.set(4, 2, 4);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xc08a3c, 1.8);
rimLight.position.set(-2, 3, -5);
scene.add(rimLight);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = .07;
controls.enablePan = true;
controls.enableZoom = true;
controls.zoomSpeed = .8;
controls.zoomToCursor = true;
controls.screenSpacePanning = true;

const loader = new GLTFLoader();
const modelRoot = new THREE.Group();
scene.add(modelRoot);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

let modelBounds = null;
let modelScene = null;
let meshObjects = [];
const sourceMeshNames = new WeakMap();
let modelMeshCount = 0;
let modelNodeCount = 0;
let selectedMesh = null;
let selectedOriginalMaterial = null;
let inspectionMode = false;
let animationFrame = 0;
let hat = null;
let hatDrag = null;
let microphone = null;
let leftArm = null;
let jaw = null;
let shell = null;
let exterior = null;
let funtime = null;
let showtime = null;
let lastFrameTime = null;

function findBodyMesh() {
  return meshObjects.find(object => object.isSkinnedMesh &&
    sourceMeshNames.get(object) === "Mod_Freddy.Body_Char_Mat_Freddy_Body_0");
}

function prepareJaw() {
  const mesh = findBodyMesh();
  const bone = mesh?.skeleton.bones[16];
  if (bone?.name !== "Jaw_jnt_012" || bone.parent?.name !== "Head_jnt_011") {
    jawStatus.textContent = "No se encontró el hueso esperado de la mandíbula.";
    return;
  }

  // In this rig, local +X rotates the front teeth down from the loaded pose.
  const closedQuaternion = bone.quaternion.clone();
  jaw = {
    mesh,
    bone,
    closedPosition: bone.position.clone(),
    closedQuaternion,
    closedScale: bone.scale.clone(),
    openQuaternion: closedQuaternion.clone().multiply(
      new THREE.Quaternion().setFromAxisAngle(lateralAxis, jawOpenAngle)
    ),
    open: false,
    amount: 0,
    transition: null
  };
  jawToggle.disabled = false;
  jawStatus.textContent = "Mandíbula cerrada.";
}

jawToggle.addEventListener("click", () => {
  if (!jaw || jaw.transition || isExteriorRemoved() || showtime?.phase) return;
  if (funtime?.opening != null) stopFaceMotion();
  jaw.transition = { started: performance.now(), from: jaw.amount, opening: !jaw.open };
  updateMaintenanceControls();
  jawToggle.setAttribute("aria-busy", "true");
  jawStatus.textContent = jaw.open ? "Cerrando mandíbula…" : "Abriendo mandíbula…";
});

function setJawAmount(amount) {
  if (jaw.amount === amount) return;
  jaw.amount = amount;
  jaw.open = amount > 0;
  const { bone, closedQuaternion, openQuaternion } = jaw;
  if (amount === 0 || amount === 1) {
    bone.quaternion.copy(amount ? openQuaternion : closedQuaternion);
    bone.position.copy(jaw.closedPosition);
    bone.scale.copy(jaw.closedScale);
  } else {
    bone.quaternion.slerpQuaternions(closedQuaternion, openQuaternion, amount);
  }
  jaw.mesh.boundingSphere = null;
  jaw.mesh.boundingBox = null;
  if (!jaw.transition) {
    jawToggle.textContent = jaw.open ? "Cerrar mandíbula" : "Abrir mandíbula";
    jawStatus.textContent = jaw.open ? "Mandíbula abierta." : "Mandíbula cerrada.";
  }
}

function updateJaw(now) {
  if (!jaw?.transition) return;
  const { started, from, opening } = jaw.transition;
  const progress = THREE.MathUtils.clamp((now - started) / 420, 0, 1);
  const eased = progress * progress * (3 - 2 * progress);
  setJawAmount(THREE.MathUtils.lerp(from, Number(opening), eased));
  if (funtime?.opening != null) {
    funtime.values.jaw = jaw.amount;
    rememberManualPose();
    refreshFaceProgress();
  }
  if (progress < 1) return;

  jaw.transition = null;
  jawToggle.textContent = opening ? "Cerrar mandíbula" : "Abrir mandíbula";
  updateMaintenanceControls();
  jawToggle.removeAttribute("aria-busy");
  jawStatus.textContent = opening ? "Mandíbula abierta." : "Mandíbula cerrada.";
}

// Classify original vertex indices; never edit geometry or create a proxy mesh.
function findRigidTriangles(roots, candidateMeshes = meshObjects) {
  const bones = new Set();
  for (const root of roots) root.traverse(node => { if (node.isBone) bones.add(node); });
  const triangles = new Map();
  for (const mesh of candidateMeshes) {
    if (!mesh.isSkinnedMesh) continue;
    const { skinIndex, skinWeight, position } = mesh.geometry.attributes;
    if (!skinIndex || !skinWeight) continue;
    const vertices = new Uint8Array(position.count);
    for (let v = 0; v < position.count; v++) {
      let weight = 0;
      for (let slot = 0; slot < skinIndex.itemSize; slot++) {
        if (bones.has(mesh.skeleton.bones[skinIndex.getComponent(v, slot)])) {
          weight += skinWeight.getComponent(v, slot);
        }
      }
      // Mixed weights would deform a boundary: refuse free manipulation.
      if (weight > 1e-6 && weight < 1 - 1e-5) return null;
      vertices[v] = weight >= 1 - 1e-5 ? 1 : 0;
    }
    const index = mesh.geometry.index;
    const faces = new Set();
    for (let i = 0; i < (index?.count ?? position.count); i += 3) {
      const a = index ? index.getX(i) : i;
      const b = index ? index.getX(i + 1) : i + 1;
      const c = index ? index.getX(i + 2) : i + 2;
      if (vertices[a] && vertices[b] && vertices[c]) faces.add(i / 3);
      else if (vertices[a] || vertices[b] || vertices[c]) return null;
    }
    if (faces.size) triangles.set(mesh, faces);
  }
  return triangles.size ? triangles : null;
}

function findShellPivot(mesh, head, triangles) {
  scene.updateMatrixWorld(true);
  const worldToHead = head.matrixWorld.clone().invert();
  const index = mesh.geometry.index;
  const vertexIndices = new Set();
  for (const triangle of triangles) {
    for (let corner = 0; corner < 3; corner++) {
      const offset = triangle * 3 + corner;
      vertexIndices.add(index ? index.getX(offset) : offset);
    }
  }
  if (vertexIndices.size !== 2133) return null;

  const points = Array.from(vertexIndices, vertex =>
    mesh.getVertexPosition(vertex, new THREE.Vector3())
      .applyMatrix4(mesh.matrixWorld).applyMatrix4(worldToHead));
  const bounds = new THREE.Box3().setFromPoints(points);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  // In head-local space, +Z faces forward and X runs left to right.
  // Locate the hinge on the rear cap, around the skull's midline.
  const rearCap = points.filter(point =>
    Math.abs(point.x - center.x) < size.x * .10 &&
    point.z <= bounds.min.z + size.z * .05);
  if (!rearCap.length) return null;
  const pivot = new THREE.Box3().setFromPoints(rearCap).getCenter(new THREE.Vector3());
  pivot.x = center.x;
  return pivot;
}

function prepareShell() {
  const mesh = findBodyMesh();
  const bones = mesh?.skeleton.bones;
  const head = bones?.[15];
  const parts = [
    [45, "Jiggle_Head_jnt_027"],
    [20, "L_Brow_jnt_013"], [26, "R_Brow_jnt_016"],
    [22, "L_Ear_jnt_014"], [28, "R_Ear_jnt_017"]
  ];
  if (head?.name !== "Head_jnt_011" ||
      parts.some(([index, name]) => bones[index]?.name !== name || bones[index].parent !== head) ||
      hat?.bone.parent !== head) {
    shellStatus.textContent = "No se encontró el conjunto esperado de huesos.";
    return;
  }
  const rigidTriangles = findRigidTriangles([bones[45]]);
  const triangles = rigidTriangles?.get(mesh);
  const pivot = rigidTriangles?.size === 1 && triangles?.size === 3166
    ? findShellPivot(mesh, head, triangles)
    : null;
  if (!pivot) {
    shellStatus.textContent = "No se pudo verificar la geometría de la carcasa.";
    return;
  }

  // The viewer does not play the embedded clips. Apply offsets only to the
  // cover and its fittings, leaving the head, neck and inner mechanisms alone.
  shell = {
    mesh,
    pivot,
    rotation: new THREE.Quaternion(),
    open: false,
    parts: parts.map(([index]) => {
      const bone = bones[index];
      return { bone, originalPosition: bone.position.clone(),
        originalQuaternion: bone.quaternion.clone(), originalScale: bone.scale.clone() };
    })
  };
  shellOpening.value = "0";
  shellOpening.disabled = false;
  shellStatus.textContent = "Carcasa cerrada.";
}

function getCoverPose(part, position, quaternion) {
  position.copy(part.originalPosition);
  quaternion.copy(part.originalQuaternion);
  if (shell?.open) {
    position.sub(shell.pivot).applyQuaternion(shell.rotation).add(shell.pivot);
    quaternion.premultiply(shell.rotation);
  }
}

function setShellOpening(amount) {
  shellOpening.value = String(amount);
  if (!shell) return;
  shell.open = amount > 0;
  // Negative X raises the front (+Z) from this rear hinge.
  shell.rotation.setFromAxisAngle(lateralAxis, -shellMaxAngle * amount / 100);
  for (const part of shell.parts) {
    getCoverPose(part, part.bone.position, part.bone.quaternion);
    part.bone.scale.copy(part.originalScale);
  }
  if (!hat.removed && !hat.transition) {
    getCoverPose(hat, hat.bone.position, hat.bone.quaternion);
  }
  shell.mesh.boundingSphere = null;
  shell.mesh.boundingBox = null;
  const percentage = `${amount} %`;
  shellValue.value = percentage;
  shellOpening.setAttribute("aria-valuetext", percentage);
  const status = shell.open ? "Carcasa abierta." : "Carcasa cerrada.";
  if (shellStatus.textContent !== status) shellStatus.textContent = status;
}

shellOpening.addEventListener("input", () => {
  if (!shellOpening.disabled) setShellOpening(shellOpening.valueAsNumber);
});

function prepareExterior() {
  const mesh = findBodyMesh();
  const geometry = mesh?.geometry;
  if (shell && jaw?.mesh === mesh && hat?.triangles?.has(mesh) &&
      geometry?.index && geometry.groups.length === 0 && !Array.isArray(mesh.material) &&
      geometry.drawRange.start === 0 && geometry.drawRange.count === Infinity) {
    const bones = [...shell.parts.map(part => part.bone), jaw.bone, hat.bone];
    const rigidTriangles = findRigidTriangles(bones);
    const triangles = rigidTriangles?.get(mesh);
    if (rigidTriangles?.size === 1 && triangles?.size === 5444) {
      exterior = { mesh, triangles, originalGeometry: geometry, hiddenGeometry: null, previousOpening: null };
    }
  }
  if (!exterior) maintenanceStatus.textContent = "No se pudo verificar la cubierta exterior.";
  updateMaintenanceControls();
}

function prepareLeftArm() {
  const mesh = findBodyMesh();
  const bones = mesh?.skeleton.bones;
  const shoulder = bones?.[47];
  const elbow = bones?.[48];
  const wrist = bones?.[49];
  const shoulderPad = bones?.[68];
  const geometry = mesh?.geometry;
  if (shoulder?.name !== "L_Shoulder_jnt_028" || shoulder.parent?.name !== "Spine_jnt_09" ||
      elbow?.name !== "L_Elbow_jnt_029" || elbow.parent !== shoulder ||
      wrist?.name !== "L_Wrist_jnt_030" || wrist.parent !== elbow ||
      shoulderPad?.name !== "L_ShoulderPad_jnt_042" || shoulderPad.parent !== shoulder.parent ||
      !geometry?.index || geometry.groups.length || Array.isArray(mesh.material) ||
      geometry.drawRange.start !== 0 || geometry.drawRange.count !== Infinity) {
    leftArmStatus.textContent = "No se pudo verificar la cubierta del brazo izquierdo.";
    return;
  }
  const rigidTriangles = findRigidTriangles([shoulder, shoulderPad], [mesh]);
  const triangles = rigidTriangles?.get(mesh);
  if (rigidTriangles?.size !== 1 || triangles?.size !== 2506) {
    leftArmStatus.textContent = "No se pudo aislar con seguridad la cubierta del brazo izquierdo.";
    return;
  }
  leftArm = {
    mesh, triangles, originalGeometry: geometry, hiddenGeometry: null, removed: false,
    bones: [shoulder, elbow, wrist],
    restPose: [shoulder, elbow, wrist].map(bone => bone.quaternion.clone()),
    salute: null
  };
  leftArmToggle.disabled = false;
  leftArmSaluteToggle.disabled = false;
  leftArmStatus.textContent = "Cubierta del brazo izquierdo colocada.";
  leftArmSaluteStatus.textContent = "Brazo listo para saludar.";
}

function isExteriorRemoved() {
  return exterior?.previousOpening != null;
}

function prepareShowtime() {
  if (!jaw) return;
  const bones = jaw.mesh.skeleton.bones;
  const [spine, neck, head] = [bones[13], bones[14], bones[15]];
  if (spine?.name !== "Spine_jnt_09" || neck?.name !== "Neck_jnt_010" ||
      head?.name !== "Head_jnt_011" || neck.parent !== spine || head.parent !== neck ||
      jaw.bone.parent !== head) {
    showtimeStatus.textContent = "No se verificó la jerarquía de Showtime.";
    return;
  }
  const [shoulder, elbow, wrist, prop] = [bones[74], bones[75], bones[76], bones[89]];
  const micArm = shoulder?.name === "R_Shoulder_jnt_045" && shoulder.parent === spine &&
    elbow?.name === "R_Elbow_jnt_046" && elbow.parent === shoulder &&
    wrist?.name === "R_Wrist_jnt_047" && wrist.parent === elbow &&
    prop?.name === "R_Prop_jnt_056" && prop.parent === wrist ? elbow : null;
  const [freeShoulder, freeElbow, freeWrist] = [bones[47], bones[48], bones[49]];
  const wavingArm = freeShoulder?.name === "L_Shoulder_jnt_028" && freeShoulder.parent === spine &&
    freeElbow?.name === "L_Elbow_jnt_029" && freeElbow.parent === freeShoulder &&
    freeWrist?.name === "L_Wrist_jnt_030" && freeWrist.parent === freeElbow;
  const [eyeRoot, rightSocket, rightEye, leftSocket, leftEye] =
    [bones[30], bones[31], bones[32], bones[38], bones[39]];
  const hasGaze = eyeRoot?.name === "EyeStuffALL_jnt_018" && eyeRoot.parent === head &&
    rightSocket?.name === "R_EyeStuffALL_jnt_019" && rightSocket.parent === eyeRoot &&
    leftSocket?.name === "L_EyeStuffALL_jnt_023" && leftSocket.parent === eyeRoot &&
    rightEye?.name === "R_Eye_jnt_020" && rightEye.parent === rightSocket &&
    leftEye?.name === "L_Eye_jnt_024" && leftEye.parent === leftSocket;
  showtime = {
    bones: { head, neck, spine, micArm,
      ...(hasGaze ? { rightEye, leftEye } : {}),
      ...(wavingArm ? { freeShoulder, freeElbow, freeWrist } : {}) },
    phase: null, elapsed: 0, headMix: 0, armsMix: 0, intensity: 1,
    rotation: new THREE.Quaternion(),
    euler: new THREE.Euler(0, 0, 0, "YXZ")
  };
  showtimeSpeed.disabled = false;
  showtimeIntensity.disabled = false;
  showtimeHead.disabled = false;
  showtimeArms.disabled = !micArm && !wavingArm;
  updateMaintenanceControls();
}

function showtimeBlocker() {
  if (!hat || !shell) return "Los controles de mantenimiento todavía no están disponibles.";
  if (leftArm?.salute) return "Espera a que termine el saludo.";
  if (hat.transition || jaw.transition || funtime?.motion) return "Espera a que termine el movimiento de mantenimiento.";
  if (isExteriorRemoved()) return "Restaura la cabeza exterior antes de iniciar.";
  if (hat.removed) return "Coloca el sombrero antes de iniciar.";
  if (shell.open) return "Cierra la carcasa al 0 % antes de iniciar.";
  if (jaw.open) return "Cierra la mandíbula antes de iniciar.";
  if (funtime?.opening != null) return "Sal del modo Funtime antes de iniciar.";
  return "";
}

startShowtime.addEventListener("click", () => {
  if (!showtime || showtime.phase) return;
  const blocker = showtimeBlocker();
  if (blocker) {
    showtimeStatus.textContent = blocker;
    return;
  }
  showtime.reference = Object.fromEntries(Object.entries(showtime.bones)
    .filter(([, bone]) => bone)
    .map(([role, bone]) => [role, {
      bone, position: bone.position.clone(), quaternion: bone.quaternion.clone(), scale: bone.scale.clone()
    }]));
  const armRestPose = ["freeShoulder", "freeElbow", "freeWrist"]
    .map(role => showtime.reference[role]?.quaternion);
  showtime.armSalute = armRestPose.every(Boolean) ? createLeftArmSalute(armRestPose) : null;
  showtime.elapsed = 0;
  showtime.headMix = Number(showtimeHead.checked);
  showtime.armsMix = Number(showtimeArms.checked);
  showtime.intensity = showtimeIntensity.valueAsNumber / 100;
  showtime.phase = "playing";
  showtimeStatus.textContent = "Espectáculo en curso.";
  updateMaintenanceControls();
});

stopShowtime.addEventListener("click", () => {
  if (showtime?.phase !== "playing") return;
  showtime.stopJaw = jaw.amount;
  for (const pose of Object.values(showtime.reference)) pose.stopRotation = pose.bone.quaternion.clone();
  showtime.elapsed = 0;
  showtime.phase = "stopping";
  showtimeStatus.textContent = "Restaurando pose…";
  updateMaintenanceControls();
});

showtimeSpeed.addEventListener("input", () => {
  showtimeSpeedValue.value = `${showtimeSpeed.valueAsNumber.toLocaleString("es")}×`;
});

showtimeIntensity.addEventListener("input", () => {
  const label = `${showtimeIntensity.valueAsNumber} %`;
  showtimeIntensityValue.value = label;
  showtimeIntensity.setAttribute("aria-valuetext", label);
});

function refreshShowtimeBounds() {
  for (const mesh of meshObjects) {
    if (!mesh.isSkinnedMesh) continue;
    mesh.boundingBox = null;
    mesh.boundingSphere = null;
  }
}

function rotateShowtimeBone(pose, pitch, yaw, roll) {
  pose.bone.quaternion.copy(pose.quaternion);
  if (!pitch && !yaw && !roll) return;
  const { rotation, euler } = showtime;
  const rad = THREE.MathUtils.DEG2RAD;
  rotation.setFromEuler(euler.set(pitch * rad, yaw * rad, roll * rad));
  pose.bone.quaternion.premultiply(rotation);
}

function blendShowtimeControl(current, target, blend) {
  const value = THREE.MathUtils.lerp(current, target, blend);
  return Math.abs(value - target) < .0001 ? target : value;
}

function updateShowtime(deltaTime) {
  if (!showtime?.phase) return;
  if (showtime.phase === "playing") {
    showtime.elapsed += deltaTime * showtimeSpeed.valueAsNumber;
    const blend = 1 - Math.exp(-deltaTime * 12);
    showtime.headMix = blendShowtimeControl(showtime.headMix, Number(showtimeHead.checked), blend);
    showtime.armsMix = blendShowtimeControl(showtime.armsMix, Number(showtimeArms.checked), blend);
    showtime.intensity = blendShowtimeControl(showtime.intensity, showtimeIntensity.valueAsNumber / 100, blend);
    const intensity = showtime.intensity;
    const headAmount = intensity * showtime.headMix;
    const armAmount = intensity * showtime.armsMix;
    const { jaw: opening, pitch, yaw, roll, saluteTime, spineYaw, spineRoll, micPitch, eyeYaw, eyePitch } =
      sampleShowtime(showtime.elapsed);
    const { spine, head, neck, rightEye, leftEye, micArm, freeShoulder, freeElbow, freeWrist } =
      showtime.reference;
    setJawAmount(opening * intensity);
    rotateShowtimeBone(spine, 0, spineYaw * intensity, spineRoll * intensity);
    rotateShowtimeBone(head, pitch * headAmount, yaw * headAmount, roll * headAmount);
    rotateShowtimeBone(neck, pitch * headAmount * .30, yaw * headAmount * .20, 0);
    if (rightEye && leftEye) {
      rotateShowtimeBone(rightEye, eyePitch * headAmount, eyeYaw * headAmount, 0);
      rotateShowtimeBone(leftEye, eyePitch * headAmount, eyeYaw * headAmount, 0);
    }
    if (micArm) rotateShowtimeBone(micArm, micPitch * armAmount, 0, 0);
    if (freeShoulder && showtime.armSalute) {
      const bones = [freeShoulder, freeElbow, freeWrist];
      const { rest: restPose } = showtime.armSalute;
      const salutePose = saluteTime == null ? null : sampleLeftArmSalute(saluteTime, showtime.armSalute);
      bones.forEach((pose, index) => {
        const bone = pose.bone;
        if (salutePose) {
          bone.quaternion.slerpQuaternions(restPose[index], salutePose[index], armAmount);
        } else {
          bone.quaternion.copy(restPose[index]);
        }
      });
    }
  } else {
    showtime.elapsed += deltaTime;
    const progress = smoothStep(showtime.elapsed / .42);
    setJawAmount(showtime.stopJaw * (1 - progress));
    for (const { bone, quaternion, position, scale, stopRotation } of Object.values(showtime.reference)) {
      bone.quaternion.slerpQuaternions(stopRotation, quaternion, progress);
      if (progress === 1) {
        bone.quaternion.copy(quaternion);
        bone.position.copy(position);
        bone.scale.copy(scale);
      }
    }
    if (progress === 1) {
      showtime.phase = null;
      showtimeStatus.textContent = "Pose original restaurada.";
      updateMaintenanceControls();
    }
  }
  refreshShowtimeBounds();
}

function prepareFuntime() {
  if (!shell || !jaw) return;
  const mesh = shell.mesh;
  const cover = findRigidTriangles([shell.parts[0].bone]);
  const chin = findRigidTriangles([jaw.bone]);
  const prototype = buildFuntimePrototype(mesh, cover?.get(mesh), chin?.get(mesh));
  if (!prototype) return;
  scene.updateMatrixWorld(true);
  const browFaces = [20, 26].map(index => findRigidTriangles([mesh.skeleton.bones[index]])?.get(mesh));
  const plates = buildFuntimeHinges(mesh, prototype, browFaces);
  if (plates) funtime = {
    ...prototype, plates, mesh, originalGeometry: mesh.geometry, opening: null,
    values: {}, progress: 0, anchor: null, motion: null
  };
  else prototype.geometry.dispose();
  updateMaintenanceControls();
}

function updateMaintenanceControls() {
  const removed = isExteriorRemoved();
  const performing = Boolean(showtime?.phase);
  const armMoving = Boolean(leftArm?.salute);
  const busy = Boolean(hat?.transition || microphone?.transition || jaw?.transition || performing || armMoving);
  const armRemoved = Boolean(leftArm?.removed);
  maintenanceMode.disabled = !shell || busy || armRemoved;
  exteriorOption.disabled = !exterior || armRemoved;
  const preview = funtime?.opening != null;
  funtimeOption.disabled = !funtimeEnabled || !funtime || armRemoved;
  maintenanceMode.value = removed ? "exterior" : preview ? "funtime" : "shell";
  shellControls.hidden = removed || preview;
  funtimePanel.hidden = !preview;
  for (const { input, key } of funtimeControls) {
    input.disabled = !preview || (key === "nose" && funtime.values.muzzle > 0);
  }
  exteriorControls.hidden = !removed;
  shellOpening.disabled = !shell || removed || preview || performing || armMoving;
  jawToggle.disabled = !jaw || Boolean(jaw.transition) || removed || performing || armMoving;
  hatToggle.disabled = !hat || Boolean(hat.transition) || removed || performing || armMoving;
  microphoneToggle.disabled = !microphone || Boolean(microphone.transition) || removed || performing || armMoving;
  leftArmToggle.disabled = !leftArm || busy || removed || preview;
  leftArmSaluteToggle.disabled = !leftArm || performing || armMoving;
  startShowtime.disabled = !showtime || performing || armMoving;
  stopShowtime.disabled = showtime?.phase !== "playing";
  jawStatus.hidden = removed;
  hatStatus.hidden = removed;
  microphoneStatus.hidden = removed;
  leftArmStatus.hidden = removed;
  leftArmSaluteStatus.hidden = removed;
}

function showPercent(input, output, value) {
  const percent = Math.round(value * 100);
  input.value = String(percent);
  output.value = `${percent} %`;
  input.setAttribute("aria-valuetext", output.value);
}

function refreshFaceProgress() {
  showPercent(faceOpening, faceValue, funtime.progress);
}

function updateFuntimePose() {
  const { values, mesh, geometry, plates, motion } = funtime;
  const angles = {};
  for (const { key, input, output, maxAngle } of funtimeControls) {
    const requested = key === "muzzle" && motion?.kind === "muzzle" ? motion.target : values[key];
    showPercent(input, output, requested);
    if (key === "nose") input.disabled = funtime.opening == null || values.muzzle > 0;
    angles[key] = maxAngle * values[key];
  }
  if (values.nose > 0 || Object.values(angles).some(angle => angle > 0)) {
    poseFuntime(plates, angles, values.nose * noseTravel);
    mesh.geometry = plates.geometry;
  } else {
    mesh.geometry = geometry;
  }
  mesh.boundingBox = null;
  mesh.boundingSphere = null;
  setJawAmount(values.jaw);
  refreshFaceProgress();
}

function rememberManualPose() {
  const values = funtime.values;
  const progress = facePhases.reduce((total, [key]) => total + values[key], 0) / facePhases.length;
  funtime.progress = progress;
  funtime.anchor = progress > 0 && progress < 1 ? { progress, values: { ...values } } : null;
}

function stopFaceMotion() {
  funtime.motion = null;
  if (jaw.transition) {
    jaw.transition = null;
    jawToggle.removeAttribute("aria-busy");
    jawToggle.textContent = jaw.open ? "Cerrar mandíbula" : "Abrir mandíbula";
    jawStatus.textContent = jaw.open ? "Mandíbula abierta." : "Mandíbula cerrada.";
    updateMaintenanceControls();
  }
}

function smoothStep(value) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function setFaceProgress(progress) {
  const { anchor, values } = funtime;
  const fromAnchor = anchor && progress >= anchor.progress;
  const fromProgress = fromAnchor ? anchor.progress : 0;
  const toProgress = anchor && !fromAnchor ? anchor.progress : 1;
  const segment = (progress - fromProgress) / (toProgress - fromProgress);
  for (const [key, start, end] of facePhases) {
    const from = fromAnchor ? anchor.values[key] : 0;
    const to = anchor && !fromAnchor ? anchor.values[key] : 1;
    values[key] = THREE.MathUtils.lerp(from, to, smoothStep((segment - start) / (end - start)));
  }
  funtime.progress = progress;
  if (progress === 0 || progress === 1) funtime.anchor = null;
  updateFuntimePose();
}

for (const { input, key } of funtimeControls) {
  input.addEventListener("input", () => {
    if (input.disabled) return;
    const amount = input.valueAsNumber / 100;
    if (key === "muzzle" && funtime.motion?.kind === "muzzle" && amount > 0) {
      funtime.motion.target = amount;
      return;
    }
    stopFaceMotion();
    if (key === "cheeks") {
      funtime.values.nose = amount;
      funtime.values.muzzle = amount;
    }
    if (key === "muzzle" && amount > 0 && funtime.values.nose < 1) {
      funtime.motion = { kind: "muzzle", started: performance.now(), fromNose: funtime.values.nose, target: amount };
      return;
    }
    funtime.values[key] = amount;
    rememberManualPose();
    updateFuntimePose();
  });
}

faceOpening.addEventListener("input", () => {
  if (funtime?.opening == null) return;
  const progress = faceOpening.valueAsNumber / 100;
  stopFaceMotion();
  setFaceProgress(progress);
});

function animateFace(to) {
  if (funtime?.opening == null) return;
  stopFaceMotion();
  const from = funtime.progress;
  funtime.motion = { kind: "sequence", started: performance.now(), from, to };
}

runFace.addEventListener("click", () => animateFace(1));
closeFace.addEventListener("click", () => animateFace(0));

function updateFaceMotion(now) {
  const motion = funtime?.motion;
  if (!motion) return;
  const elapsed = Math.max(0, now - motion.started);
  if (motion.kind === "muzzle") {
    funtime.values.nose = THREE.MathUtils.lerp(motion.fromNose, 1, smoothStep(elapsed / 260));
    funtime.values.muzzle = motion.target * smoothStep((elapsed - 260) / 260);
    if (elapsed >= 520) funtime.motion = null;
    rememberManualPose();
    updateFuntimePose();
    return;
  }
  const percent = THREE.MathUtils.clamp(elapsed / Math.max(160, 3200 * Math.abs(motion.to - motion.from)), 0, 1);
  setFaceProgress(THREE.MathUtils.lerp(motion.from, motion.to, percent));
  if (percent === 1) funtime.motion = null;
}

function setFuntimePreview(active) {
  if (!funtime || active === (funtime.opening != null)) return;
  const { mesh, originalGeometry } = funtime;
  stopFaceMotion();
  funtime.values = { forehead: 0, cheeks: 0, nose: 0, muzzle: 0, jaw: jaw.amount };
  rememberManualPose();
  if (active) {
    funtime.opening = shellOpening.valueAsNumber;
    setShellOpening(0);
    updateFuntimePose();
  } else {
    mesh.geometry = originalGeometry;
    mesh.boundingBox = null;
    mesh.boundingSphere = null;
    setShellOpening(funtime.opening);
    funtime.opening = null;
  }
  maintenanceStatus.textContent = "";
}

function geometryWithoutExterior({ originalGeometry, triangles }) {
  const source = originalGeometry.index.array;
  const visibleIndices = new source.constructor(source.length - triangles.size * 3);
  let offset = 0;
  for (let i = 0; i < source.length; i += 3) {
    if (triangles.has(i / 3)) continue;
    visibleIndices.set(source.subarray(i, i + 3), offset);
    offset += 3;
  }
  // Keep the original skin attributes and vertex numbering in the derived geometry.
  const geometry = originalGeometry.clone();
  geometry.setIndex(new THREE.BufferAttribute(visibleIndices, 1));
  return geometry;
}

function setExteriorRemoved(remove) {
  if (!exterior || remove === isExteriorRemoved() || leftArm?.removed ||
      hat.transition || microphone?.transition || jaw.transition) {
    updateMaintenanceControls();
    return;
  }
  const { mesh, originalGeometry } = exterior;
  finishHatDrag();
  if (remove) {
    exterior.hiddenGeometry ??= geometryWithoutExterior(exterior);
    exterior.previousOpening = shellOpening.valueAsNumber;
    setShellOpening(0);
    mesh.geometry = exterior.hiddenGeometry;
  } else {
    mesh.geometry = originalGeometry;
    const previousOpening = exterior.previousOpening;
    exterior.previousOpening = null;
    setShellOpening(previousOpening);
  }
  mesh.boundingSphere = null;
  mesh.boundingBox = null;
  if (selectedMesh === mesh) clearSelection();
  maintenanceStatus.textContent = remove ? "Cabeza exterior retirada. Los controles exteriores están en pausa." : "";
  updateMaintenanceControls();
  (remove ? restoreExterior : maintenanceMode).focus({ preventScroll: true });
}

maintenanceMode.addEventListener("change", () => {
  const mode = maintenanceMode.value;
  if (leftArm?.removed || hat?.transition || microphone?.transition || jaw?.transition || showtime?.phase ||
      (mode === "funtime" && !funtimeEnabled)) {
    updateMaintenanceControls();
    return;
  }
  if (mode !== "funtime") setFuntimePreview(false);
  setExteriorRemoved(mode === "exterior");
  if (mode === "funtime") setFuntimePreview(true);
  updateMaintenanceControls();
});
restoreExterior.addEventListener("click", () => setExteriorRemoved(false));
leftArmToggle.addEventListener("click", () => {
  if (!leftArm || isExteriorRemoved() || funtime?.opening != null ||
      hat?.transition || microphone?.transition || jaw?.transition || showtime?.phase) return;
  const remove = !leftArm.removed;
  if (remove) {
    leftArm.hiddenGeometry ??= geometryWithoutExterior(leftArm);
    leftArm.mesh.geometry = leftArm.hiddenGeometry;
  } else {
    leftArm.mesh.geometry = leftArm.originalGeometry;
  }
  leftArm.removed = remove;
  leftArm.mesh.boundingSphere = null;
  leftArm.mesh.boundingBox = null;
  if (selectedMesh === leftArm.mesh) clearSelection();
  leftArmToggle.textContent = remove
    ? "Restaurar cubierta del brazo izquierdo"
    : "Retirar cubierta del brazo izquierdo";
  leftArmStatus.textContent = remove
    ? "Cubierta retirada. Endoesqueleto del brazo izquierdo visible."
    : "Cubierta del brazo izquierdo colocada.";
  updateMaintenanceControls();
});

function createLeftArmPose(restPose, elbowAngle, handDown = false, forearmRaised = false) {
  const pose = restPose.map(quaternion => quaternion.clone());
  armFoldRotation.setFromAxisAngle(armFoldAxis, THREE.MathUtils.degToRad(elbowAngle));
  pose[1].premultiply(armFoldRotation);
  if (forearmRaised) {
    armForearmRollRotation.setFromAxisAngle(armForearmRollAxis, THREE.MathUtils.degToRad(-45));
    pose[1].premultiply(armForearmRollRotation);
  }
  if (handDown) {
    armWristRotation.setFromAxisAngle(armWristAxis, THREE.MathUtils.degToRad(90));
    pose[2].multiply(armWristRotation);
  }
  return pose;
}

function createLeftArmSalute(restPose) {
  return {
    rest: restPose,
    cup: createLeftArmPose(restPose, 70),
    raised: createLeftArmPose(restPose, 170, true, true)
  };
}

function interpolateLeftArmPose(from, to, progress, smooth = false) {
  const clampedProgress = THREE.MathUtils.clamp(progress, 0, 1);
  const travelProgress = smooth ? smoothStep(clampedProgress) : clampedProgress;
  return from.map((quaternion, index) => quaternion.clone().slerp(to[index], travelProgress));
}

leftArmSaluteToggle.addEventListener("click", () => {
  if (!leftArm || leftArm.salute || showtime?.phase) return;
  leftArm.salute = {
    started: performance.now(),
    ...createLeftArmSalute(leftArm.restPose)
  };
  leftArmSaluteToggle.setAttribute("aria-busy", "true");
  leftArmSaluteStatus.textContent = "Saludo en curso.";
  updateMaintenanceControls();
});

function sampleLeftArmSalute(elapsed, salute) {
  const foldEnd = .55;
  const raiseEnd = 1.7;
  const waveEnd = 3;
  const saluteEnd = 3.65;

  if (elapsed < foldEnd) {
    return interpolateLeftArmPose(salute.rest, salute.cup, elapsed / foldEnd);
  } else if (elapsed < raiseEnd) {
    return interpolateLeftArmPose(salute.cup, salute.raised, (elapsed - foldEnd) / (raiseEnd - foldEnd));
  } else if (elapsed < waveEnd) {
    const pose = salute.raised.map(quaternion => quaternion.clone());
    const progress = (elapsed - raiseEnd) / (waveEnd - raiseEnd);
    const waveEnvelope = Math.sin(progress * Math.PI);
    const angle = -THREE.MathUtils.degToRad(12) * waveEnvelope * Math.sin(progress * Math.PI * 4);
    armWristRotation.setFromAxisAngle(armWaveAxis, angle);
    pose[2].multiply(armWristRotation);
    return pose;
  } else if (elapsed < saluteEnd) {
    return interpolateLeftArmPose(salute.raised, salute.rest,
      (elapsed - waveEnd) / (saluteEnd - waveEnd), true);
  }
  return null;
}

function updateLeftArmSalute(now) {
  if (!leftArm?.salute) return;
  const elapsed = Math.max(0, (now - leftArm.salute.started) / 1000);
  const pose = sampleLeftArmSalute(elapsed, leftArm.salute);
  if (!pose) {
    leftArm.salute = null;
    leftArmSaluteToggle.removeAttribute("aria-busy");
    leftArmSaluteStatus.textContent = "Saludo terminado. Pose original restaurada.";
    updateMaintenanceControls();
  } else {
    leftArm.bones.forEach((bone, index) => bone.quaternion.copy(pose[index]));
  }
  refreshShowtimeBounds();
}

function refreshHatBounds() {
  scene.updateMatrixWorld(true);
  for (const mesh of hat?.triangles?.keys() ?? []) {
    // SkinnedMesh raycasting and frustum culling cache bounds, not the pose.
    mesh.computeBoundingSphere();
    if (mesh.boundingBox) mesh.computeBoundingBox();
  }
}

function setPointerRay(event) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return false;
  pointer.set((event.clientX - rect.left) / rect.width * 2 - 1,
    -(event.clientY - rect.top) / rect.height * 2 + 1);
  camera.updateMatrixWorld();
  raycaster.setFromCamera(pointer, camera);
  return true;
}

function finishHatDrag(event) {
  if (!hatDrag || (event?.pointerId !== undefined && event.pointerId !== hatDrag.pointerId)) return;
  const drag = hatDrag;
  hatDrag = null;
  controls.enabled = inspectionMode ? false : drag.controlsEnabled;
  canvas.style.cursor = drag.cursor;
  if (canvas.hasPointerCapture(drag.pointerId)) canvas.releasePointerCapture(drag.pointerId);
  hatStatus.textContent = "Sombrero retirado · Arrastra su geometría para moverlo.";
}

function startHatDrag(event) {
  if (event.button !== 0 || !event.isPrimary || inspectionMode || isExteriorRemoved() || showtime?.phase || !hat?.removed ||
      hat.transition || !hat.triangles || hatDrag) return;
  refreshHatBounds();
  if (!setPointerRay(event)) return;
  // Only the nearest visible surface may be selected, including body occlusion.
  const hit = raycaster.intersectObjects(meshObjects.filter(mesh => mesh.visible), false)[0];
  if (!hit || !hat.triangles.get(hit.object)?.has(hit.faceIndex)) return;
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
    camera.getWorldDirection(new THREE.Vector3()), hit.point);
  hatDrag = {
    pointerId: event.pointerId,
    plane,
    // Preserve the clicked offset instead of snapping the bone to the pointer.
    offset: hat.bone.getWorldPosition(new THREE.Vector3()).sub(hit.point),
    controlsEnabled: controls.enabled,
    cursor: canvas.style.cursor
  };
  controls.enabled = false;
  canvas.style.cursor = "grabbing";
  canvas.setPointerCapture(event.pointerId);
  event.preventDefault();
  event.stopImmediatePropagation();
  hatStatus.textContent = "Moviendo sombrero · Suelta para terminar.";
}

function moveHatDrag(event) {
  if (!hatDrag || event.pointerId !== hatDrag.pointerId) return;
  if (!setPointerRay(event)) return;
  const point = raycaster.ray.intersectPlane(hatDrag.plane, new THREE.Vector3());
  if (!point) return;
  hat.bone.parent.updateWorldMatrix(true, false);
  // Bone.position is in its PARENT's local space, not the bone's own space.
  hat.bone.position.copy(hat.bone.parent.worldToLocal(point.add(hatDrag.offset)));
  refreshHatBounds();
  event.preventDefault();
  event.stopImmediatePropagation();
}

// Capture runs before OrbitControls' pointerdown listener.
canvas.addEventListener("pointerdown", startHatDrag, { capture: true });
canvas.addEventListener("pointermove", moveHatDrag, { capture: true });
canvas.addEventListener("pointerup", finishHatDrag, { capture: true });
canvas.addEventListener("pointercancel", finishHatDrag, { capture: true });
canvas.addEventListener("lostpointercapture", finishHatDrag);
window.addEventListener("blur", () => finishHatDrag());

function prepareHat() {
  const body = findBodyMesh();
  const bone = body?.skeleton.bones.find(item => item.name === "Hat_jnt_015");
  if (!bone?.parent || body.skeleton.bones.indexOf(bone) !== 24) {
    hatStatus.textContent = "No se encontró el hueso esperado del sombrero.";
    return;
  }
  // GLTFLoader loads clips but does not play them. This viewer creates no
  // AnimationMixer, so no animation action can overwrite this bone.
  hat = {
    bone,
    triangles: findRigidTriangles([bone]),
    originalPosition: bone.position.clone(),
    originalQuaternion: bone.quaternion.clone(),
    originalScale: bone.scale.clone(),
    lift: modelBounds.getSize(new THREE.Vector3()).y * .14,
    removed: false,
    transition: null
  };
  hatToggle.disabled = false;
  hatStatus.textContent = "Prueba experimental · Sombrero colocado.";
}

function prepareMicrophone() {
  const body = findBodyMesh();
  const bones = body?.skeleton.bones;
  const bone = bones?.[89];
  if (bone?.name !== "R_Prop_jnt_056" || bone.parent !== bones[76] ||
      bones[76]?.name !== "R_Wrist_jnt_047") {
    microphoneStatus.textContent = "No se encontró el hueso esperado del micrófono.";
    return;
  }
  microphone = {
    mesh: body,
    bone,
    originalPosition: bone.position.clone(),
    removalOffset: new THREE.Vector3(
      modelBounds.getSize(new THREE.Vector3()).x * .85,
      modelBounds.getSize(new THREE.Vector3()).y * .05,
      0
    ),
    removed: false,
    transition: null
  };
  microphoneToggle.disabled = false;
  microphoneStatus.textContent = "Micrófono colocado.";
}

hatToggle.addEventListener("click", () => {
  if (!hat || hat.transition || isExteriorRemoved() || showtime?.phase) return;
  finishHatDrag();
  const { bone } = hat;
  bone.parent.updateWorldMatrix(true, false);
  // Transform two POINTS with the full parent matrix: this handles rotated
  // ancestors and nonuniform scale without assuming any local up axis.
  const originalWorld = bone.parent.localToWorld(bone.position.clone());
  const liftedLocal = bone.parent.worldToLocal(
    originalWorld.add(new THREE.Vector3(0, hat.lift, 0))
  );
  hat.transition = {
    started: performance.now(),
    from: bone.position.clone(),
    fromQuaternion: bone.quaternion.clone(),
    to: liftedLocal,
    toQuaternion: bone.quaternion.clone(),
    removing: !hat.removed
  };
  updateMaintenanceControls();
  hatToggle.setAttribute("aria-busy", "true");
  hatStatus.textContent = hat.removed ? "Colocando sombrero…" : "Retirando sombrero…";
});

function updateHat(now) {
  if (!hat?.transition) return;
  const transition = hat.transition;
  const progress = THREE.MathUtils.clamp((now - transition.started) / 1000, 0, 1);
  const eased = progress * progress * (3 - 2 * progress);
  if (!transition.removing) getCoverPose(hat, transition.to, transition.toQuaternion);
  hat.bone.position.lerpVectors(transition.from, transition.to, eased);
  hat.bone.quaternion.slerpQuaternions(transition.fromQuaternion, transition.toQuaternion, eased);
  refreshHatBounds();
  if (progress < 1) return;
  hat.removed = transition.removing;
  hat.bone.position.copy(transition.to);
  hat.bone.quaternion.copy(transition.toQuaternion);
  hat.bone.scale.copy(hat.originalScale);
  hat.transition = null;
  hatToggle.textContent = hat.removed ? "Colocar sombrero" : "Retirar sombrero";
  updateMaintenanceControls();
  hatToggle.removeAttribute("aria-busy");
  hatStatus.textContent = hat.removed
    ? (hat.triangles
      ? "Sombrero retirado · Arrastra su geometría para moverlo."
      : "Sombrero retirado · Arrastre desactivado: pesos o triángulos ambiguos.")
    : "Sombrero colocado sobre la carcasa.";
}

  microphoneToggle.addEventListener("click", () => {
    if (!microphone || microphone.transition || isExteriorRemoved() || showtime?.phase) return;
    const { bone } = microphone;
    bone.parent.updateWorldMatrix(true, false);
    const originalWorld = bone.parent.localToWorld(bone.position.clone());
    const removedLocal = bone.parent.worldToLocal(
      originalWorld.add(microphone.removalOffset)
    );
    const removing = !microphone.removed;
    microphone.transition = {
      started: performance.now(),
      from: bone.position.clone(),
      to: removing ? removedLocal : microphone.originalPosition.clone(),
      removing
    };
    updateMaintenanceControls();
    microphoneToggle.setAttribute("aria-busy", "true");
    microphoneStatus.textContent = microphone.removed ? "Colocando micrófono…" : "Retirando micrófono…";
  });

  function updateMicrophone(now) {
    if (!microphone?.transition) return;
    const transition = microphone.transition;
    const progress = THREE.MathUtils.clamp((now - transition.started) / 1000, 0, 1);
    const eased = progress * progress * (3 - 2 * progress);
    microphone.bone.position.lerpVectors(transition.from, transition.to, eased);
    microphone.mesh.boundingSphere = null;
    microphone.mesh.boundingBox = null;
    if (progress < 1) return;
    microphone.removed = transition.removing;
    microphone.bone.position.copy(transition.to);
    microphone.transition = null;
    updateMaintenanceControls();
    microphoneToggle.removeAttribute("aria-busy");
    microphoneToggle.textContent = microphone.removed ? "Colocar micrófono" : "Retirar micrófono";
    microphoneStatus.textContent = microphone.removed
      ? "Micrófono retirado."
      : "Micrófono colocado en la mano.";
  }

function setLoadingMessage(message) {
  statusPanel.classList.remove("is-error");
  statusText.textContent = message;
  statusPanel.hidden = false;
}

function showLoadError(error) {
  console.error("[Golden Freddy] No se pudo cargar assets/models/golden_freddy.glb.", error);
  statusPanel.classList.add("is-error");
  statusText.textContent = "No se pudo cargar el GLB. Revisa la ruta del modelo y sirve el proyecto por HTTP.";
  statusPanel.hidden = false;
  readoutState.textContent = "Error al cargar assets/models/golden_freddy.glb.";
}

function getObjectType(object) {
  if (object.isSkinnedMesh) return "SkinnedMesh";
  if (object.isMesh) return "Mesh";
  if (object.isBone) return "Bone";
  if (object.isGroup) return "Group";
  return "Object3D";
}

function getNodeName(object) {
  return object.name || "(sin nombre)";
}

const componentPatterns = [
  ["Cabeza", /head/i],
  ["Sombrero", /hat/i],
  ["Mandíbula", /jaw/i],
  ["Torso", /torso|body|spine/i],
  ["Brazos", /arm|shoulder|elbow|wrist|hand|thumb|index|middle|pinky/i],
  ["Piernas", /leg|knee|ankle|hip|foot/i]
];

function inspectModel(gltf, bounds) {
  let nodeCount = 0;
  const typeCounts = { Mesh: 0, SkinnedMesh: 0, Bone: 0, Group: 0, Object3D: 0 };
  meshObjects = [];
  const materials = new Set();
  const textures = new Set();
  const namedComponents = new Map(componentPatterns.map(([label]) => [label, []]));

  gltf.scene.traverse(object => {
    nodeCount++;
    const type = getObjectType(object);
    typeCounts[type]++;

    for (const [label, pattern] of componentPatterns) {
      if (pattern.test(object.name || "")) {
        const matches = namedComponents.get(label);
        if (matches.length < 3) matches.push(`${getNodeName(object)} [${type}]`);
      }
    }

    if (object.isMesh) {
      meshObjects.push(object);
      const association = gltf.parser.associations.get(object);
      const nodeIndex = association?.nodes;
      const meshIndex = association?.meshes ?? (
        nodeIndex === undefined ? undefined : gltf.parser.json.nodes[nodeIndex]?.mesh
      );
      const sourceMeshName = meshIndex === undefined
        ? ""
        : gltf.parser.json.meshes[meshIndex]?.name || "";
      sourceMeshNames.set(object, sourceMeshName || object.geometry.name || object.name);
      const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of objectMaterials) {
        if (!material) continue;
        materials.add(material);
        for (const value of Object.values(material)) {
          if (value?.isTexture) textures.add(value);
        }
      }
    }
  });

  const meshCount = typeCounts.Mesh + typeCounts.SkinnedMesh;
  modelMeshCount = meshCount;
  modelNodeCount = nodeCount;
  const componentSummary = [...namedComponents.entries()]
    .map(([label, names]) => `${label}: ${names.length ? names.join(", ") : "sin nodo con nombre asociado"}`)
    .join("\n");

  document.querySelector("#mesh-count").textContent = String(meshCount);
  document.querySelector("#node-count").textContent = String(nodeCount);
  document.querySelector("#material-count").textContent = String(materials.size);
  document.querySelector("#texture-count").textContent = String(textures.size);
  document.querySelector("#type-summary").textContent = Object.entries(typeCounts)
    .map(([type, count]) => `${type} ${count}`)
    .join(" · ");
  document.querySelector("#rig-summary").textContent = componentSummary;
  readoutState.textContent = `${meshCount} mallas en ${nodeCount} nodos. Las mallas no se han modificado.`;
  inspectionToggle.disabled = meshObjects.length === 0;
}

function formatMaterialNames(material) {
  const materials = Array.isArray(material) ? material : [material];
  return materials
    .filter(Boolean)
    .map(item => item.name || `Sin nombre (${item.type})`)
    .join(", ") || "Sin material asignado";
}

function clearSelection() {
  if (selectedMesh && selectedOriginalMaterial) {
    selectedMesh.material = selectedOriginalMaterial;
  }
  selectedMesh = null;
  selectedOriginalMaterial = null;

  document.querySelector("#selection-empty").hidden = false;
  document.querySelector("#selection-details").hidden = true;
  document.querySelector("#selection-mesh-note").hidden = true;
  document.querySelector("#hierarchy-block").hidden = true;
  document.querySelector("#selection-type-badge").textContent = "—";
  document.querySelector("#selection-hierarchy").replaceChildren();
  clearSelectionButton.disabled = true;

  if (inspectionMode) {
    readoutState.textContent = "Modo inspección activo. Haz clic sobre una malla del modelo.";
  } else if (modelScene) {
    readoutState.textContent = `${modelMeshCount} mallas en ${modelNodeCount} nodos. Las mallas no se han modificado.`;
  }
}

function makeHighlightMaterial(material) {
  const highlighted = material.clone();
  if (highlighted.emissive) {
    highlighted.emissive.set(0x66440c);
    highlighted.emissiveIntensity = .24;
  } else if (highlighted.color) {
    highlighted.color.multiplyScalar(1.1);
  }
  return highlighted;
}

function selectMesh(object) {
  if (selectedMesh === object) return;
  clearSelection();
  selectedMesh = object;
  selectedOriginalMaterial = object.material;
  object.material = Array.isArray(selectedOriginalMaterial)
    ? selectedOriginalMaterial.map(material => material ? makeHighlightMaterial(material) : material)
    : makeHighlightMaterial(selectedOriginalMaterial);

  const meshName = sourceMeshNames.get(object) || object.geometry.name || object.name || "(malla sin nombre)";
  const parentName = object.parent ? `${getNodeName(object.parent)} [${getObjectType(object.parent)}]` : "Sin nodo padre";
  const hierarchy = [];
  for (let node = object; node; node = node.parent) {
    hierarchy.push(node);
    if (node === modelScene) break;
  }
  hierarchy.reverse();

  document.querySelector("#selection-empty").hidden = true;
  document.querySelector("#selection-details").hidden = false;
  document.querySelector("#selection-mesh-note").hidden = !object.isSkinnedMesh;
  document.querySelector("#selected-mesh-name").textContent = meshName;
  document.querySelector("#selected-object-type").textContent = `${getNodeName(object)} [${getObjectType(object)}]`;
  document.querySelector("#selected-material").textContent = formatMaterialNames(selectedOriginalMaterial);
  document.querySelector("#selected-parent").textContent = parentName;
  document.querySelector("#selection-type-badge").textContent = getObjectType(object);
  document.querySelector("#selection-mesh-note").textContent =
    "Esta SkinnedMesh es una malla esquelética combinada. La selección identifica la malla completa, no una parte anatómica independiente.";

  const hierarchyList = document.querySelector("#selection-hierarchy");
  hierarchyList.replaceChildren(...hierarchy.map(node => {
    const item = document.createElement("li");
    item.textContent = `${getNodeName(node)} [${getObjectType(node)}]`;
    return item;
  }));
  document.querySelector("#hierarchy-block").hidden = false;
  clearSelectionButton.disabled = false;
  readoutState.textContent = `Seleccionada: ${meshName}. Es una malla completa del rig, no una pieza independiente.`;
}

function setInspectionMode(active) {
  finishHatDrag();
  inspectionMode = active;
  controls.enabled = !active;
  inspectionToggle.setAttribute("aria-pressed", String(active));
  stage.classList.toggle("is-inspecting", active);
  canvas.classList.toggle("inspect-mode", active);
  document.querySelector(".workspace").classList.toggle("is-inspecting", active);
  document.querySelector("#viewer-mode-label").textContent = active ? "INSPECCIÓN" : "CÁMARA";
  viewerInstructions.textContent = active
    ? "Haz clic en el modelo para inspeccionar su malla, material y jerarquía."
    : "Visor local Three.js. Arrastra para orbitar y usa la rueda para acercar la unidad.";
  clearSelection();
}

function handleModelClick(event) {
  if (!inspectionMode || !modelScene) return;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  pointer.set(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  );
  raycaster.setFromCamera(pointer, camera);
  refreshHatBounds();
  const intersections = raycaster.intersectObjects(meshObjects, false);
  const hit = intersections.find(intersection => intersection.object.isMesh);
  if (hit) selectMesh(hit.object);
  else clearSelection();
}

inspectionToggle.addEventListener("click", () => setInspectionMode(!inspectionMode));
clearSelectionButton.addEventListener("click", clearSelection);
canvas.addEventListener("click", handleModelClick);

function frameModel(preserveOrbit = false) {
  if (!modelBounds || stage.clientWidth === 0 || stage.clientHeight === 0) return;

  const sphere = modelBounds.getBoundingSphere(new THREE.Sphere());
  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
  const limitingFov = Math.min(verticalFov, horizontalFov);
  const distance = sphere.radius / Math.sin(limitingFov / 2) * 1.14;

  if (!preserveOrbit) {
    controls.target.set(0, 0, 0);
    camera.position.set(0, 0, distance);
  }
  camera.near = Math.max(sphere.radius / 1000, distance / 10000, .001);
  camera.far = Math.max(distance + sphere.radius * 8, 100);
  camera.updateProjectionMatrix();
  controls.minDistance = Math.max(sphere.radius * .15, .01);
  controls.maxDistance = Math.max(distance * 8, controls.minDistance * 10);
  if (!preserveOrbit) controls.update();
}

function resizeViewer() {
  const width = stage.clientWidth;
  const height = stage.clientHeight;
  if (width <= 0 || height <= 0) return;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  frameModel(true);
}

centerViewButton.addEventListener("click", () => {
  // Drain the pending drag inertia before applying the initial framing.
  const damping = controls.enableDamping;
  controls.enableDamping = false;
  controls.update();
  frameModel();
  controls.enableDamping = damping;
});

new ResizeObserver(resizeViewer).observe(stage);
window.addEventListener("resize", resizeViewer);
resizeViewer();

setLoadingMessage("Cargando modelo local…");
loader.load(
  "./assets/models/golden_freddy.glb",
  gltf => {
    try {
      modelRoot.add(gltf.scene);
      modelScene = gltf.scene;
      const sourceBounds = new THREE.Box3().setFromObject(gltf.scene);
      if (sourceBounds.isEmpty()) {
        throw new Error("El archivo GLB no contiene geometría visible.");
      }

      const sourceCenter = sourceBounds.getCenter(new THREE.Vector3());
      gltf.scene.position.sub(sourceCenter);
      modelBounds = new THREE.Box3().setFromObject(modelRoot);

      inspectModel(gltf, modelBounds);
      prepareHat();
      prepareMicrophone();
      prepareJaw();
      prepareShell();
      prepareExterior();
      prepareLeftArm();
      if (funtimeEnabled) prepareFuntime();
      prepareShowtime();
      frameModel();
      centerViewButton.disabled = false;
      statusPanel.hidden = true;
    } catch (error) {
      showLoadError(error);
    }
  },
  event => {
    if (event.lengthComputable) {
      const progress = Math.round(event.loaded / event.total * 100);
      setLoadingMessage(`Cargando modelo local… ${progress}%`);
    }
  },
  showLoadError
);

function render(now = performance.now()) {
  animationFrame = requestAnimationFrame(render);
  const deltaTime = lastFrameTime === null ? 0 : Math.max(0, (now - lastFrameTime) / 1000);
  lastFrameTime = now;
  updateJaw(now);
  updateFaceMotion(now);
  updateShowtime(deltaTime);
  updateLeftArmSalute(now);
  updateHat(now);
  updateMicrophone(now);
  if (controls.enabled) controls.update();
  renderer.render(scene, camera);
}
render();

window.addEventListener("beforeunload", () => {
  cancelAnimationFrame(animationFrame);
  controls.dispose();
  exterior?.hiddenGeometry?.dispose();
  leftArm?.hiddenGeometry?.dispose();
  funtime?.geometry.dispose();
  funtime?.plates.geometry.dispose();
  renderer.dispose();
});
