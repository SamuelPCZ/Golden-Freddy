import { BufferAttribute, DynamicDrawUsage, Matrix3, Matrix4, Vector3 } from "three";

export const noseTravel = 13;

// Partition the supplied Freddy asset along existing triangle edges.
export function buildFuntimePrototype(mesh, shellFaces, jawFaces) {
  const source = mesh.geometry;
  const index = source.index;
  const positions = source.attributes.position;
  if (!index || shellFaces?.size !== 3166 || jawFaces?.size !== 486 ||
      source.groups.length || Array.isArray(mesh.material)) return null;

  const toHead = mesh.skeleton.boneInverses[15].clone().multiply(mesh.bindMatrix);
  const vertexKeys = new Map();
  const point = new Vector3();
  function vertexKey(vertex) {
    if (!vertexKeys.has(vertex)) {
      point.fromBufferAttribute(positions, vertex);
      // Geometric adjacency crosses exported normal and UV seams.
      vertexKeys.set(vertex, point.toArray().map(n => Math.round(n * 10000)).join(","));
    }
    return vertexKeys.get(vertex);
  }
  const facesByVertex = new Map();
  for (const face of shellFaces) {
    for (let i = 0; i < 3; i++) {
      const key = vertexKey(index.getX(face * 3 + i));
      if (!facesByVertex.has(key)) facesByVertex.set(key, []);
      facesByVertex.get(key).push(face);
    }
  }
  const unvisited = new Set(shellFaces);
  const islands = [];
  while (unvisited.size) {
    const queue = [unvisited.values().next().value];
    unvisited.delete(queue[0]);
    for (let i = 0; i < queue.length; i++) {
      for (let corner = 0; corner < 3; corner++) {
        const key = vertexKey(index.getX(queue[i] * 3 + corner));
        for (const neighbor of facesByVertex.get(key)) {
          if (unvisited.delete(neighbor)) queue.push(neighbor);
        }
      }
    }
    islands.push(queue);
  }
  islands.sort((a, b) => b.length - a.length);
  if (islands.length !== 2 || islands[0].length !== 3014 || islands[1].length !== 152) return null;

  const [skullFaces, noseFaces] = islands;
  const parts = {
    fixed: [], rear: [], foreheadLeft: [], foreheadRight: [],
    cheekLeft: [], cheekRight: [], muzzleLeft: [], muzzleRight: [],
    nose: noseFaces, jaw: [...jawFaces]
  };
  const centroid = new Vector3();
  // Thresholds measured in this rig's head bind space. They classify whole
  // triangles, so neither vertex attributes nor cut intersections are needed.
  for (const face of skullFaces) {
    centroid.set(0, 0, 0);
    let minX = Infinity;
    let maxX = -Infinity;
    for (let corner = 0; corner < 3; corner++) {
      point.fromBufferAttribute(positions, index.getX(face * 3 + corner)).applyMatrix4(toHead);
      centroid.add(point);
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
    }
    centroid.multiplyScalar(1 / 3);
    const { x, y, z } = centroid;
    const side = x >= 0 ? "Left" : "Right";
    const isMuzzle = z > 21 && y < 14;
    // The sagittal seam already follows edges. Ignore export-scale rounding,
    // but refuse to assign a triangle that genuinely crosses the seam.
    if (isMuzzle && minX < -.0001 && maxX > .0001) return null;
    const region = isMuzzle ? "muzzle" + side
      : z < 5 ? "rear" : (y >= 21 ? "forehead" : "cheek") + side;
    parts[region].push(face);
  }

  const names = Object.keys(parts);
  if (parts.muzzleLeft.length !== 265 || parts.muzzleRight.length !== 265 ||
      names.slice(1).some(name => !parts[name].length)) return null;
  const regionByFace = new Uint8Array(index.count / 3);
  names.forEach((name, region) => {
    for (const face of parts[name]) regionByFace[face] = region;
  });

  // Groups address each plate independently while preserving triangle order
  // for picking. The single original material draws them all as a closed face.
  const geometry = source.clone();
  for (let start = 0; start < regionByFace.length;) {
    const region = regionByFace[start];
    let end = start + 1;
    while (end < regionByFace.length && regionByFace[end] === region) end++;
    geometry.addGroup(start * 3, (end - start) * 3, region);
    if (region === 0) for (let face = start; face < end; face++) parts.fixed.push(face);
    start = end;
  }
  return { geometry, parts };
}

export function buildFuntimeHinges(mesh, prototype, browFaces) {
  const { geometry: source, parts } = prototype;
  const attributes = Object.entries(source.attributes);
  if (Object.keys(source.morphAttributes).length ||
      attributes.some(([, attribute]) => attribute.isInterleavedBufferAttribute) ||
      browFaces.some(faces => faces?.size !== 204)) return null;

  const geometry = source.clone();
  const position = source.attributes.position;
  const point = new Vector3();
  const head = mesh.skeleton.bones[15];
  const worldToHead = head.matrixWorld.clone().invert();
  const skinToHead = boneIndex => worldToHead.clone()
    .multiply(mesh.skeleton.bones[boneIndex].matrixWorld)
    .multiply(mesh.skeleton.boneInverses[boneIndex])
    .multiply(mesh.bindMatrix);
  const coverToHead = skinToHead(45);
  const keyFor = vertex => point.fromBufferAttribute(position, vertex).toArray()
    .map(value => Math.round(value * 10000)).join(",");
  function keysFor(faces) {
    const keys = new Set();
    for (const face of faces) {
      for (let i = 0; i < 3; i++) keys.add(keyFor(source.index.getX(face * 3 + i)));
    }
    return keys;
  }
  const rearKeys = keysFor(parts.rear);

  // Keep static and moving regions independently addressable at their seams.
  // Triangle order, materials and picking indices remain the same.
  const duplicates = [];
  function duplicateRegion(faces, toHead) {
    const vertices = new Map();
    for (const face of faces) {
      for (let i = face * 3; i < face * 3 + 3; i++) {
        const original = source.index.getX(i);
        if (!vertices.has(original)) {
          vertices.set(original, position.count + duplicates.length);
          duplicates.push(original);
        }
        geometry.index.setX(i, vertices.get(original));
      }
    }
    return { vertices, toHead, fromHead: toHead.clone().invert() };
  }
  const hinges = [];
  const candidates = [
    { control: "forehead", key: "foreheadLeft", anchor: [12.35, 37.38, 6.67], axis: [-1, .44, 0], brow: 0 },
    { control: "forehead", key: "foreheadRight", anchor: [-12.35, 37.38, 6.67], axis: [-1, -.44, 0], brow: 1 },
    { control: "cheeks", key: "cheekLeft", anchor: [19.77, 2.19, 5.41], axis: [-.18, 1, -.36] },
    { control: "cheeks", key: "cheekRight", anchor: [-19.77, 2.19, 5.41], axis: [-.18, -1, .36] },
    { control: "muzzle", key: "muzzleLeft", neighbor: "cheekLeft", anchor: [20.41, 5.63, 21.35], axis: [0, 1, 0] },
    { control: "muzzle", key: "muzzleRight", neighbor: "cheekRight", anchor: [-20.41, 5.63, 21.35], axis: [0, -1, 0] }
  ];
  for (const { control, key, neighbor, anchor, axis, brow } of candidates) {
    const boundary = neighbor ? keysFor(parts[neighbor]) : rearKeys;
    // Snap to the measured seam with the adjacent plate or rear shell.
    const reference = new Vector3(...anchor);
    const pivot = new Vector3();
    let nearest = Infinity;
    for (const face of parts[key]) {
      for (let i = 0; i < 3; i++) {
        const vertex = source.index.getX(face * 3 + i);
        if (!boundary.has(keyFor(vertex))) continue;
        point.fromBufferAttribute(position, vertex).applyMatrix4(coverToHead);
        const distance = point.distanceToSquared(reference);
        if (distance < nearest) {
          nearest = distance;
          pivot.copy(point);
        }
      }
    }
    if (!Number.isFinite(nearest)) {
      geometry.dispose();
      return null;
    }
    const regions = [duplicateRegion(parts[key], coverToHead)];
    if (brow !== undefined) regions.push(duplicateRegion(browFaces[brow], skinToHead(brow === 0 ? 20 : 26)));
    hinges.push({ control, pivot, axis: new Vector3(...axis).normalize(), regions });
  }
  const nose = duplicateRegion(parts.nose, coverToHead);
  for (const [name, attribute] of attributes) {
    const size = attribute.itemSize;
    const sourceArray = attribute.array;
    const array = new sourceArray.constructor(sourceArray.length + duplicates.length * size);
    array.set(sourceArray);
    duplicates.forEach((vertex, index) => {
      array.set(sourceArray.subarray(vertex * size, (vertex + 1) * size), sourceArray.length + index * size);
    });
    const expanded = new BufferAttribute(array, size, attribute.normalized);
    if (name === "position" || name === "normal" || name === "tangent") expanded.setUsage(DynamicDrawUsage);
    geometry.setAttribute(name, expanded);
  }
  return { source, geometry, hinges, nose };
}

export function poseFuntime({ source, geometry, hinges, nose }, angles, noseDistance) {
  const point = new Vector3();
  const rotation = new Matrix4();
  const transform = new Matrix4();
  const normalMatrix = new Matrix3();
  for (const { control, pivot, axis, regions } of hinges) {
    const angle = angles[control];
    rotation.makeRotationAxis(axis, angle);
    rotation.setPosition(point.copy(pivot).applyMatrix4(rotation).negate().add(pivot));
    for (const { vertices, toHead, fromHead } of regions) {
      transform.copy(fromHead).multiply(rotation).multiply(toHead);
      normalMatrix.getNormalMatrix(transform);
      for (const [original, target] of vertices) {
        point.fromBufferAttribute(source.attributes.position, original);
        if (angle) point.applyMatrix4(transform);
        geometry.attributes.position.setXYZ(target, point.x, point.y, point.z);
        point.fromBufferAttribute(source.attributes.normal, original);
        if (angle) point.applyNormalMatrix(normalMatrix);
        geometry.attributes.normal.setXYZ(target, point.x, point.y, point.z);
        if (geometry.attributes.tangent) {
          point.fromBufferAttribute(source.attributes.tangent, original);
          if (angle) point.transformDirection(transform);
          geometry.attributes.tangent.setXYZ(target, point.x, point.y, point.z);
        }
      }
    }
  }
  const noseOffset = point.set(0, 0, noseDistance).applyMatrix3(normalMatrix.setFromMatrix4(nose.fromHead));
  for (const [original, target] of nose.vertices) {
    const { position } = source.attributes;
    geometry.attributes.position.setXYZ(target, position.getX(original) + noseOffset.x,
      position.getY(original) + noseOffset.y, position.getZ(original) + noseOffset.z);
  }
  geometry.attributes.position.needsUpdate = true;
  geometry.attributes.normal.needsUpdate = true;
  if (geometry.attributes.tangent) geometry.attributes.tangent.needsUpdate = true;
}
