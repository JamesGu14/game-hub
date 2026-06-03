import * as THREE from 'three';

export function checkAABB(position, radius, height, boxes) {
  const corrected = position.clone();

  for (const box of boxes) {
    if (corrected.y >= box.max.y - 0.01) continue;
    if (corrected.y + height <= box.min.y + 0.01) continue;

    const minX = box.min.x - radius;
    const maxX = box.max.x + radius;
    const minZ = box.min.z - radius;
    const maxZ = box.max.z + radius;

    if (
      corrected.x < minX || corrected.x > maxX ||
      corrected.z < minZ || corrected.z > maxZ
    ) {
      continue;
    }

    const overlapPosX = maxX - corrected.x;
    const overlapNegX = corrected.x - minX;
    const overlapPosZ = maxZ - corrected.z;
    const overlapNegZ = corrected.z - minZ;

    const minOverlapX = Math.min(overlapPosX, overlapNegX);
    const minOverlapZ = Math.min(overlapPosZ, overlapNegZ);

    if (minOverlapX <= minOverlapZ) {
      if (overlapNegX < overlapPosX) corrected.x = minX;
      else corrected.x = maxX;
    } else {
      if (overlapNegZ < overlapPosZ) corrected.z = minZ;
      else corrected.z = maxZ;
    }
  }

  return corrected;
}

export function getGroundY(position, radius, oldY, boxes) {
  let groundY = 0;
  for (const box of boxes) {
    const minX = box.min.x - radius;
    const maxX = box.max.x + radius;
    const minZ = box.min.z - radius;
    const maxZ = box.max.z + radius;

    if (position.x >= minX && position.x <= maxX && position.z >= minZ && position.z <= maxZ) {
      if (oldY >= box.max.y - 0.05 && position.y <= box.max.y + 0.05) {
        if (box.max.y > groundY) groundY = box.max.y;
      }
    }
  }
  return groundY;
}

export function getCeilingY(position, radius, height, oldY, boxes) {
  let ceilY = Infinity;
  for (const box of boxes) {
    const minX = box.min.x - radius;
    const maxX = box.max.x + radius;
    const minZ = box.min.z - radius;
    const maxZ = box.max.z + radius;

    if (position.x >= minX && position.x <= maxX && position.z >= minZ && position.z <= maxZ) {
      if (oldY + height <= box.min.y + 0.05 && position.y + height >= box.min.y - 0.05) {
        if (box.min.y < ceilY) ceilY = box.min.y;
      }
    }
  }
  return ceilY;
}
