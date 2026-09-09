import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATALOG,
  HOMES,
  floorsFor,
  initialDesign,
  wallsFor,
  wallSegments,
  validateDesign,
} from '../lib/world';
import { canPlaceItem, overlaps } from '../lib/placement';
import { inspectGLB } from '../lib/storage';

void test('three homes keep their designed area and unique room IDs', () => {
  for (const home of HOMES)
    for (const f of floorsFor(home.id)) {
      assert.equal(new Set(f.rooms.map((r) => r.id)).size, f.rooms.length);
      assert.ok(
        Math.abs(f.rooms.reduce((n, r) => n + r.w * r.h, 0) - f.w * f.h) <
          0.001,
      );
      assert.equal(
        f.w * f.h,
        home.id === 'home100' ? 100 : home.id === 'home200' ? 200 : 500,
      );
    }
});
void test('all catalog assets and default layouts validate', () => {
  assert.equal(CATALOG.length, 72);
  assert.equal(new Set(CATALOG.map((a) => a.id)).size, 72);
  for (const home of HOMES) {
    const d = initialDesign(home.id);
    assert.equal(validateDesign(d), d);
    assert.ok(d.items.length > 20);
    const walls = floorsFor(home.id).flatMap((f, floor) =>
      wallsFor(f).flatMap((w) =>
        wallSegments(w, 3.2)
          .filter((p) => p.bottom < 0.1)
          .map((p) => ({
            x: w.axis === 'h' ? (p.from + p.to) / 2 : w.at,
            z: w.axis === 'h' ? w.at : (p.from + p.to) / 2,
            w: w.axis === 'h' ? p.to - p.from : w.outer ? 0.2 : 0.13,
            d: w.axis === 'h' ? (w.outer ? 0.2 : 0.13) : p.to - p.from,
            floor,
          })),
      ),
    );
    for (const i of d.items)
      assert.ok(
        canPlaceItem(d, i, [], walls),
        `${home.id}: ${i.assetId} at ${i.x},${i.z}`,
      );
  }
});
void test('door openings remain unobstructed by wall segments', () => {
  for (const home of HOMES)
    for (const f of floorsFor(home.id))
      for (const door of f.doors) {
        const at = door.axis === 'h' ? door.y : door.x,
          t = door.axis === 'h' ? door.x : door.y;
        const wall = wallsFor(f).find(
          (w) =>
            w.axis === door.axis &&
            Math.abs(w.at - at) < 0.001 &&
            t >= w.from &&
            t <= w.to,
        );
        assert.ok(wall);
        assert.ok(
          !wallSegments(wall, 3).some(
            (p) => p.bottom < 1 && t > p.from + 0.001 && t < p.to - 0.001,
          ),
        );
      }
});
void test('rotated rectangles use their actual footprint, not the enclosing box', () => {
  const a = { x: 0, z: 0, w: 4, d: 0.4, rotation: Math.PI / 4 };
  assert.equal(overlaps(a, { ...a, x: 0, z: 1 }), false);
  assert.equal(overlaps(a, { ...a, x: 0.1, z: 0.1 }), true);
});
void test('invalid floor, asset, colors, IDs and non-finite positions are rejected', () => {
  const d = initialDesign('home100');
  for (const bad of [
    { ...d, floor: 1 },
    { ...d, items: [{ ...d.items[0], floor: 1 }] },
    { ...d, items: [{ ...d.items[0], assetId: 'missing' }] },
    { ...d, wallColor: 'red' },
    { ...d, items: [d.items[0], d.items[0]] },
    { ...d, items: [{ ...d.items[0], x: NaN }] },
  ])
    assert.throws(() => validateDesign(bad));
});
void test('placement rejects below-floor objects and pool placement', () => {
  const d = initialDesign('estate', true),
    item = {
      id: 'test',
      assetId: 'plant',
      x: 12.5,
      z: 30.5,
      y: 0,
      rotation: 0,
      scale: 1,
      floor: 0,
    };
  assert.equal(canPlaceItem(d, item, [], []), false);
  assert.equal(
    canPlaceItem(d, { ...item, x: 22, z: 24, y: -1 }, [], []),
    false,
  );
  assert.equal(canPlaceItem(d, { ...item, x: 22, z: 24 }, [], []), true);
});
function glb(json: unknown) {
  const raw = new TextEncoder().encode(JSON.stringify(json)),
    n = Math.ceil(raw.length / 4) * 4,
    b = new ArrayBuffer(28 + n),
    v = new DataView(b);
  v.setUint32(0, 0x46546c67, true);
  v.setUint32(4, 2, true);
  v.setUint32(8, b.byteLength, true);
  v.setUint32(12, n, true);
  v.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(b, 20, n).fill(32);
  new Uint8Array(b, 20, raw.length).set(raw);
  v.setUint32(24 + n, 0x004e4942, true);
  return new Blob([b]);
}
void test('GLB inspection accepts a self-contained mesh and rejects external resources', async () => {
  const valid = {
    asset: { version: '2.0' },
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    accessors: [{ count: 3 }],
  };
  assert.equal((await inspectGLB(glb(valid))).triangles, 1);
  await assert.rejects(() =>
    inspectGLB(
      glb({ ...valid, buffers: [{ uri: 'https://example.com/private.bin' }] }),
    ),
  );
  await assert.rejects(() =>
    inspectGLB(glb({ ...valid, accessors: [{ count: 900000 }] })),
  );
  await assert.rejects(() => inspectGLB(new Blob(['invalid'])));
});

void test('walking collision settles at a 1.6m eye height and never climbs when looking up', async () => {
  const { NullEngine, Scene, MeshBuilder, Vector3 } =
    await import('@babylonjs/core');
  const { WalkCamera, WALK_EYE_HEIGHT } = await import('../lib/navigation');
  const engine = new NullEngine(),
    scene = new Scene(engine);
  scene.collisionsEnabled = true;
  scene.gravity = new Vector3(0, -0.08, 0);
  const ground = MeshBuilder.CreateGround(
    'floor',
    { width: 20, height: 20 },
    scene,
  );
  ground.checkCollisions = true;
  ground.computeWorldMatrix(true);
  const camera = new WalkCamera('test', new Vector3(0, 1.63, 0), scene);
  camera.configure();
  camera.checkCollisions = true;
  camera.applyGravity = true;
  for (let n = 0; n < 40; n++) camera._updatePosition();
  assert.ok(
    Math.abs(camera.position.y - WALK_EYE_HEIGHT) < 0.04,
    `Eye height ${camera.position.y}`,
  );
  camera.cameraDirection.set(0.03, 0.3, 0);
  for (let n = 0; n < 10; n++) camera._updatePosition();
  assert.ok(camera.position.x > 0.2);
  assert.ok(Math.abs(camera.position.y - WALK_EYE_HEIGHT) < 0.04);
  scene.dispose();
  engine.dispose();
});

void test('language preference respects a saved choice and browser fallback', async () => {
  const { resolveLocale } = await import('../lib/i18n');
  assert.equal(resolveLocale('en', ['zh-CN']), 'en');
  assert.equal(resolveLocale('zh-CN', ['en-US']), 'zh-CN');
  assert.equal(resolveLocale(null, ['en-GB']), 'en');
  assert.equal(resolveLocale('invalid', ['zh-TW']), 'zh-CN');
  assert.equal(resolveLocale(null, ['fr-FR']), 'zh-CN');
});
void test('all built-in furniture and rooms have English names without changing design data', async () => {
  const { assetLabel, matchesAsset, translate } = await import('../lib/i18n');
  const design = initialDesign('home100');
  const before = JSON.stringify(design);
  for (const asset of CATALOG) {
    assert.doesNotMatch(assetLabel('en', asset), /[\p{Script=Han}]/u);
    assert.equal(assetLabel('zh-CN', asset), asset.name);
  }
  for (const home of HOMES) {
    assert.doesNotMatch(translate('en', home.name), /[\p{Script=Han}]/u);
    for (const floor of floorsFor(home.id))
      for (const room of floor.rooms)
        assert.doesNotMatch(translate('en', room.name), /[\p{Script=Han}]/u);
  }
  assert.ok(matchesAsset(CATALOG[0], ' SOFA '));
  assert.ok(matchesAsset(CATALOG[0], '沙发'));
  const custom = { ...CATALOG[0], custom: true, name: '我的沙发 Sofa' };
  assert.equal(assetLabel('en', custom), custom.name);
  assert.equal(
    translate('en', '已放置{name}', { name: custom.name }),
    'Placed 我的沙发 Sofa',
  );
  assert.equal(
    translate('zh-CN', '已放置{name}', { name: custom.name }),
    '已放置我的沙发 Sofa',
  );
  assert.equal(JSON.stringify(design), before);
});
