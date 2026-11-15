import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const canvas = document.querySelector("#scene");
const stage = document.querySelector("#viewer");
const statusPanel = document.querySelector("#viewer-status");
const statusText = statusPanel.querySelector("span:last-child");
const readoutState = document.querySelector("#readout-state");
const inspectionToggle = document.querySelector("#inspection-toggle");
const clearSelectionButton = document.querySelector("#clear-selection");
const viewerInstructions = document.querySelector("#viewer-instructions");
const hatToggle = document.querySelector("#hat-toggle");
const hatStatus = document.querySelector("#hat-status");

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

function prepareHat() {
  const body = meshObjects.find(object => object.isSkinnedMesh &&
    sourceMeshNames.get(object) === "Mod_Freddy.Body_Char_Mat_Freddy_Body_0");
  const bone = body?.skeleton.bones.find(item => item.name === "Hat_jnt_015");
  if (!bone?.parent || body.skeleton.bones.indexOf(bone) !== 24) {
    hatStatus.textContent = "No se encontró el hueso esperado del sombrero.";
    return;
  }
  // GLTFLoader loads clips but does not play them. This viewer creates no
  // AnimationMixer, so no animation action can overwrite this bone.
  hat = {
    bone,
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

hatToggle.addEventListener("click", () => {
  if (!hat || hat.transition) return;
  const { bone } = hat;
  bone.parent.updateWorldMatrix(true, false);
  // Transform two POINTS with the full parent matrix: this handles rotated
  // ancestors and nonuniform scale without assuming any local up axis.
  const originalWorld = bone.parent.localToWorld(hat.originalPosition.clone());
  const liftedLocal = bone.parent.worldToLocal(
    originalWorld.add(new THREE.Vector3(0, hat.lift, 0))
  );
  hat.transition = {
    started: performance.now(),
    from: bone.position.clone(),
    to: hat.removed ? hat.originalPosition.clone() : liftedLocal,
    removing: !hat.removed
  };
  hatToggle.disabled = true;
  hatToggle.setAttribute("aria-busy", "true");
  hatStatus.textContent = hat.removed ? "Colocando sombrero…" : "Retirando sombrero…";
});

function updateHat(now) {
  if (!hat?.transition) return;
  const transition = hat.transition;
  const progress = THREE.MathUtils.clamp((now - transition.started) / 1000, 0, 1);
  const eased = progress * progress * (3 - 2 * progress);
  hat.bone.position.lerpVectors(transition.from, transition.to, eased);
  if (progress < 1) return;
  hat.removed = transition.removing;
  if (hat.removed) {
    hat.bone.position.copy(transition.to);
  } else {
    // Copy the saved values rather than accumulating inverse offsets.
    hat.bone.position.copy(hat.originalPosition);
    hat.bone.quaternion.copy(hat.originalQuaternion);
    hat.bone.scale.copy(hat.originalScale);
  }
  hat.transition = null;
  hatToggle.textContent = hat.removed ? "Colocar sombrero" : "Retirar sombrero";
  hatToggle.disabled = false;
  hatToggle.removeAttribute("aria-busy");
  hatStatus.textContent = hat.removed
    ? "Sombrero retirado · Puede volver a colocarse."
    : "Sombrero colocado · Transformación original restaurada.";
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

function getMaterialDescription(material) {
  const name = material.name || `Material sin nombre (${material.type})`;
  const textureSlots = Object.entries(material)
    .filter(([, value]) => value?.isTexture)
    .map(([slot, texture]) => `${slot}: ${texture.name || "textura sin nombre"}`);
  return textureSlots.length ? `${name} [${textureSlots.join(", ")}]` : name;
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

  console.groupCollapsed("[Golden Freddy] Jerarquía del GLB");
  gltf.scene.traverse(object => {
    nodeCount++;
    const type = getObjectType(object);
    typeCounts[type]++;
    let depth = 0;
    for (let parent = object.parent; parent && parent !== modelRoot; parent = parent.parent) depth++;

    for (const [label, pattern] of componentPatterns) {
      if (pattern.test(object.name || "")) {
        const matches = namedComponents.get(label);
        if (matches.length < 3) matches.push(`${getNodeName(object)} [${type}]`);
      }
    }

    let detail = "";
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
      detail = ` — malla${object.isSkinnedMesh ? " esquelética" : ""}; recurso: ${sourceMeshNames.get(object) || "(sin nombre)"}`;
      for (const material of objectMaterials) {
        if (!material) continue;
        materials.add(material);
        detail += `; material: ${getMaterialDescription(material)}`;
        for (const value of Object.values(material)) {
          if (value?.isTexture) textures.add(value);
        }
      }
    }

    console.info(`${"  ".repeat(depth)}${getNodeName(object)} [${type}]${detail}`);
  });

  const meshCount = typeCounts.Mesh + typeCounts.SkinnedMesh;
  modelMeshCount = meshCount;
  modelNodeCount = nodeCount;
  const componentSummary = [...namedComponents.entries()]
    .map(([label, names]) => `${label}: ${names.length ? names.join(", ") : "sin nodo con nombre asociado"}`)
    .join("\n");

  console.info("Resumen:", {
    nodes: nodeCount,
    meshes: meshCount,
    types: typeCounts,
    namedComponents: Object.fromEntries(namedComponents),
    materials: materials.size,
    textures: textures.size,
    bounds: bounds.getSize(new THREE.Vector3()).toArray(),
    animations: gltf.animations.length,
    animationNames: gltf.animations.map(animation => animation.name || "(sin nombre)"),
    assetMetadata: gltf.parser.json.asset?.extras || {}
  });
  console.groupEnd();

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
  const intersections = raycaster.intersectObjects(meshObjects, false);
  const hit = intersections.find(intersection => intersection.object.isMesh);
  if (hit) selectMesh(hit.object);
  else clearSelection();
}

inspectionToggle.addEventListener("click", () => setInspectionMode(!inspectionMode));
clearSelectionButton.addEventListener("click", clearSelection);
canvas.addEventListener("click", handleModelClick);

function frameModel() {
  if (!modelBounds || stage.clientWidth === 0 || stage.clientHeight === 0) return;

  const center = modelBounds.getCenter(new THREE.Vector3());
  const sphere = modelBounds.getBoundingSphere(new THREE.Sphere());
  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
  const limitingFov = Math.min(verticalFov, horizontalFov);
  const distance = sphere.radius / Math.sin(limitingFov / 2) * 1.14;

  controls.target.set(0, 0, 0);
  camera.position.set(0, 0, distance);
  camera.near = Math.max(sphere.radius / 1000, distance / 10000, .001);
  camera.far = Math.max(distance + sphere.radius * 8, 100);
  camera.updateProjectionMatrix();
  controls.minDistance = Math.max(sphere.radius * .15, .01);
  controls.maxDistance = Math.max(distance * 8, controls.minDistance * 10);
  controls.update();
}

function resizeViewer() {
  const width = stage.clientWidth;
  const height = stage.clientHeight;
  if (width <= 0 || height <= 0) return;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  frameModel();
}

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
      frameModel();
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
  updateHat(now);
  controls.update();
  renderer.render(scene, camera);
}
render();

window.addEventListener("beforeunload", () => {
  cancelAnimationFrame(animationFrame);
  controls.dispose();
  renderer.dispose();
});
