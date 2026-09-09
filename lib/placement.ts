import { assetFor, floorsFor, Asset, Design, Item } from './world';
export interface Collider {
  x: number;
  z: number;
  w: number;
  d: number;
  floor: number;
}
export interface Footprint {
  x: number;
  z: number;
  w: number;
  d: number;
  rotation: number;
}
// Separating-axis test preserves the usable space around rotated furniture.
export function overlaps(a: Footprint, b: Footprint, gap = 0.025) {
  const basis = (r: number) => [
    [Math.cos(r), -Math.sin(r)],
    [Math.sin(r), Math.cos(r)],
  ];
  const aa = basis(a.rotation),
    bb = basis(b.rotation),
    dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1];
  const delta = [b.x - a.x, b.z - a.z];
  return [...aa, ...bb].every(
    (axis) =>
      Math.abs(dot(delta, axis)) <
      (Math.abs(dot(aa[0], axis)) * a.w) / 2 +
        (Math.abs(dot(aa[1], axis)) * a.d) / 2 +
        (Math.abs(dot(bb[0], axis)) * b.w) / 2 +
        (Math.abs(dot(bb[1], axis)) * b.d) / 2 -
        gap,
  );
}
export function canPlaceItem(
  design: Design,
  item: Item,
  custom: Asset[],
  walls: Collider[],
) {
  const a = assetFor(item.assetId, custom),
    f = floorsFor(design.home)[item.floor];
  if (
    !a ||
    !f ||
    ![item.x, item.z, item.y, item.scale, item.rotation].every(
      Number.isFinite,
    ) ||
    item.y < 0 ||
    item.y > 10 ||
    item.scale < 0.1 ||
    item.scale > 10
  )
    return false;
  const box = {
    x: item.x,
    z: item.z,
    w: a.w * item.scale,
    d: a.d * item.scale,
    rotation: item.rotation,
  };
  const c = Math.abs(Math.cos(item.rotation)),
    s = Math.abs(Math.sin(item.rotation)),
    w = box.w * c + box.d * s,
    d = box.d * c + box.w * s;
  if (design.home === 'estate' && item.floor === 0) {
    if (
      item.x - w / 2 < -27.5 ||
      item.x + w / 2 > 52.5 ||
      item.z - d / 2 < -8 ||
      item.z + d / 2 > 42
    )
      return false;
    if (overlaps(box, { x: 12.5, z: 30.5, w: 12.6, d: 5.6, rotation: 0 }, 0))
      return false;
  } else if (
    item.x - w / 2 < 0.1 ||
    item.x + w / 2 > f.w - 0.1 ||
    item.z - d / 2 < 0.1 ||
    item.z + d / 2 > f.h - 0.1
  )
    return false;
  if (!['art', 'curtain', 'mirror'].includes(a.kind))
    for (const wall of walls)
      if (wall.floor === item.floor && overlaps(box, { ...wall, rotation: 0 }))
        return false;
  if (a.kind === 'rug') return true;
  for (const other of design.items) {
    if (other.id === item.id || other.floor !== item.floor) continue;
    const b = assetFor(other.assetId, custom);
    if (
      !b ||
      b.kind === 'rug' ||
      item.y + a.h * item.scale <= other.y + 0.02 ||
      other.y + b.h * other.scale <= item.y + 0.02
    )
      continue;
    if (
      (a.kind === 'table' && b.kind === 'chair') ||
      (a.kind === 'chair' && b.kind === 'table')
    )
      continue;
    if (
      overlaps(
        box,
        {
          x: other.x,
          z: other.z,
          w: b.w * other.scale,
          d: b.d * other.scale,
          rotation: other.rotation,
        },
        0.045,
      )
    )
      return false;
  }
  return true;
}
