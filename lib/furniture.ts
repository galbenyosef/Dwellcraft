import * as B from '@babylonjs/core';
import { Asset, DesignStyle, STYLES } from './world';

export function roundedBox(
  name: string,
  w: number,
  h: number,
  d: number,
  r: number,
  scene: B.Scene,
): B.Mesh {
  const mesh = new B.Mesh(name, scene),
    positions: number[] = [],
    indices: number[] = [],
    uvs: number[] = [];
  r = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
  if (r <= 0)
    return B.MeshBuilder.CreateBox(
      name,
      { width: w, height: h, depth: d },
      scene,
    );
  const half = [w / 2, h / 2, d / 2];
  const faces = [
    [
      [0, 0, 1],
      [1, 0, 0],
      [0, 1, 0],
    ],
    [
      [0, 0, -1],
      [-1, 0, 0],
      [0, 1, 0],
    ],
    [
      [1, 0, 0],
      [0, 0, -1],
      [0, 1, 0],
    ],
    [
      [-1, 0, 0],
      [0, 0, 1],
      [0, 1, 0],
    ],
    [
      [0, 1, 0],
      [1, 0, 0],
      [0, 0, -1],
    ],
    [
      [0, -1, 0],
      [1, 0, 0],
      [0, 0, 1],
    ],
  ];
  for (const [n, u, v] of faces) {
    const start = positions.length / 3,
      ui = u.findIndex((x) => x !== 0),
      vi = v.findIndex((x) => x !== 0);
    const steps = (extent: number) => [
      -extent,
      -extent + r * 0.25,
      -extent + r * 0.65,
      -extent + r,
      extent - r,
      extent - r * 0.65,
      extent - r * 0.25,
      extent,
    ];
    const us = steps(half[ui]),
      vs = steps(half[vi]);
    for (let j = 0; j < 8; j++)
      for (let i = 0; i < 8; i++) {
        const p = n.map((k, a) => k * half[a] + u[a] * us[i] + v[a] * vs[j]),
          q = p.map((x, a) => Math.max(-half[a] + r, Math.min(half[a] - r, x))),
          delta = p.map((x, a) => x - q[a]),
          len = Math.hypot(...delta);
        positions.push(...q.map((x, a) => x + (delta[a] / len) * r));
        uvs.push(i / 7, j / 7);
      }
    for (let j = 0; j < 7; j++)
      for (let i = 0; i < 7; i++) {
        const a = start + j * 8 + i;
        indices.push(a, a + 9, a + 1, a, a + 8, a + 9);
      }
  }
  const normals: number[] = [];
  B.VertexData.ComputeNormals(positions, indices, normals);
  const vd = new B.VertexData();
  vd.positions = positions;
  vd.indices = indices;
  vd.normals = normals;
  vd.uvs = uvs;
  vd.applyToMesh(mesh);
  return mesh;
}

export class Furnisher {
  materials = new Map<string, B.PBRMaterial>();
  constructor(public scene: B.Scene) {}
  mat(
    name: string,
    color: string,
    roughness = 0.7,
    metallic = 0,
    fabric = false,
  ) {
    const key = [name, color, roughness, metallic, fabric].join(':');
    if (this.materials.has(key)) return this.materials.get(key)!;
    const m = new B.PBRMaterial(name, this.scene);
    m.albedoColor = B.Color3.FromHexString(color);
    m.roughness = roughness;
    m.metallic = metallic;
    m.environmentIntensity = 0.72;
    if (fabric) {
      m.bumpTexture = new B.Texture(
        '/assets/fabric_pattern_07_nor_gl.jpg',
        this.scene,
      );
      (m.bumpTexture as B.Texture).uScale = 3;
      (m.bumpTexture as B.Texture).vScale = 3;
      m.bumpTexture.level = 0.12;
    }
    this.materials.set(key, m);
    return m;
  }
  create(
    a: Asset,
    parent: B.TransformNode,
    style: DesignStyle,
    color?: string,
  ) {
    const sc = this.scene,
      p = STYLES[style],
      w = a.w,
      d = a.d,
      h = a.h,
      t = a.tier;
    const cloth = this.mat('linen', color || p.fabric, 0.9, 0, true),
      wood = this.mat('wood', p.wood, 0.55),
      metal = this.mat(
        'metal',
        style === 'luxe' ? '#a38753' : '#3d4339',
        0.28,
        0.72,
      ),
      cream = this.mat('ceramic', '#eee9dc', 0.32),
      accent = this.mat('accent', p.accent, 0.9, 0, true),
      leaf = this.mat('leaves', '#637653', 0.85),
      soil = this.mat('soil', '#4d3c2b', 1);
    const parts: B.Mesh[] = [];
    const attach = (
      m: B.Mesh,
      mat: B.Material,
      x: number,
      y: number,
      z: number,
    ) => {
      m.parent = parent;
      m.position.set(x, y, z);
      m.material = mat;
      m.receiveShadows = true;
      parts.push(m);
      return m;
    };
    const box = (
      n: string,
      ww: number,
      hh: number,
      dd: number,
      x: number,
      y: number,
      z: number,
      mat: B.Material,
      round = 0,
    ) =>
      attach(
        round
          ? roundedBox(n, ww, hh, dd, round, sc)
          : B.MeshBuilder.CreateBox(
              n,
              { width: ww, height: hh, depth: dd },
              sc,
            ),
        mat,
        x,
        y,
        z,
      );
    const cyl = (
      n: string,
      diam: number,
      hh: number,
      x: number,
      y: number,
      z: number,
      mat: B.Material,
      top?: number,
    ) =>
      attach(
        B.MeshBuilder.CreateCylinder(
          n,
          {
            height: hh,
            diameterTop: top ?? diam,
            diameterBottom: diam,
            tessellation: 24,
          },
          sc,
        ),
        mat,
        x,
        y,
        z,
      );
    const sphere = (
      n: string,
      ww: number,
      hh: number,
      dd: number,
      x: number,
      y: number,
      z: number,
      mat: B.Material,
    ) =>
      attach(
        B.MeshBuilder.CreateSphere(
          n,
          { diameterX: ww, diameterY: hh, diameterZ: dd, segments: 12 },
          sc,
        ),
        mat,
        x,
        y,
        z,
      );
    const legs = (
      ww: number,
      dd: number,
      height: number,
      mat = wood,
      rad = 0.045,
    ) => {
      for (const x of [-1, 1])
        for (const z of [-1, 1])
          cyl(
            'leg',
            rad * 2,
            height,
            x * (ww / 2 - 0.09),
            height / 2,
            z * (dd / 2 - 0.09),
            mat,
          );
    };
    switch (a.kind) {
      case 'sofa': {
        legs(w, d, 0.16, style === 'luxe' ? metal : wood, 0.035);
        box('frame', w, 0.2, d, 0, 0.24, 0, wood, 0.065);
        const arm = style === 'cream' ? 0.22 : 0.14;
        box('back', w, 0.48, 0.22, 0, 0.61, -d / 2 + 0.11, cloth, 0.1);
        box(
          'arm',
          arm,
          0.45,
          d - 0.06,
          -w / 2 + arm / 2,
          0.52,
          0,
          cloth,
          0.075,
        );
        box('arm', arm, 0.45, d - 0.06, w / 2 - arm / 2, 0.52, 0, cloth, 0.075);
        const seats = t === 2 ? 3 : 2,
          sw = (w - arm * 2 - 0.04) / seats;
        for (let i = 0; i < seats; i++) {
          const x = -w / 2 + arm + sw * (i + 0.5);
          box('seat', sw - 0.025, 0.18, d - 0.3, x, 0.43, 0.09, cloth, 0.06);
          box(
            'back-cushion',
            sw - 0.05,
            0.4,
            0.15,
            x,
            0.69,
            -d / 2 + 0.26,
            cloth,
            0.06,
          ).rotation.x = -0.12;
        }
        for (const s of [-1, 1]) {
          const pillow = box(
            'pillow',
            0.35,
            0.32,
            0.15,
            s * (w / 2 - 0.42),
            0.68,
            -0.08,
            s === -1 ? accent : cloth,
            0.075,
          );
          pillow.rotation.z = s * 0.18;
          pillow.rotation.x = -0.2;
        }
        if (t === 2) {
          box(
            'chaise',
            0.7,
            0.23,
            0.6,
            w / 2 - 0.5,
            0.38,
            d / 2 + 0.15,
            cloth,
            0.09,
          );
        }
        break;
      }
      case 'table':
      case 'desk': {
        legs(w, d, h - 0.06, wood, 0.045);
        box(
          'tabletop',
          w,
          0.075,
          d,
          0,
          h - 0.04,
          0,
          style === 'luxe' ? cream : wood,
          t > 0 ? 0.1 : 0.04,
        );
        if (t === 2) {
          box(
            'center-support',
            0.14,
            h - 0.12,
            d * 0.8,
            0,
            (h - 0.12) / 2,
            0,
            metal,
            0.02,
          );
        }
        if (a.kind === 'desk') {
          box(
            'drawer',
            w * 0.43,
            0.14,
            d - 0.1,
            w * 0.2,
            h - 0.16,
            0,
            wood,
            0.02,
          );
          box(
            'drawer-pull',
            0.25,
            0.025,
            0.025,
            w * 0.2,
            h - 0.15,
            d / 2,
            metal,
            0.008,
          );
        }
        break;
      }
      case 'chair': {
        legs(w, d, 0.44, style === 'luxe' ? metal : wood, 0.023);
        box('chair-seat', w, 0.105, d, 0, 0.46, 0, cloth, 0.055);
        box(
          'chair-back',
          w,
          0.35,
          0.085,
          0,
          0.72,
          -d / 2 + 0.04,
          style === 'fresh' ? wood : cloth,
          0.045,
        ).rotation.x = -0.08;
        if (t > 0)
          for (const x of [-1, 1]) {
            box(
              'chair-arm',
              0.04,
              0.04,
              d * 0.75,
              x * (w / 2 - 0.025),
              0.63,
              0,
              wood,
              0.017,
            );
            cyl('support', 0.025, 0.2, x * (w / 2 - 0.025), 0.54, 0.12, metal);
          }
        break;
      }
      case 'bed': {
        legs(w, d, 0.12);
        box('bed-frame', w + 0.06, 0.25, d, 0, 0.2, 0, wood, 0.045);
        box('mattress', w, 0.22, d - 0.08, 0, 0.43, 0, cream, 0.065);
        box('duvet', w + 0.035, 0.12, d * 0.7, 0, 0.59, 0.23, cloth, 0.075);
        box(
          'headboard',
          w + 0.13,
          h,
          0.14,
          0,
          h / 2,
          -d / 2 - 0.02,
          cloth,
          0.065,
        );
        for (const s of [-1, 1])
          box(
            'bed-pillow',
            w * 0.4,
            0.14,
            0.43,
            s * w * 0.235,
            0.65,
            -d * 0.32,
            cream,
            0.065,
          );
        box('throw', w + 0.045, 0.035, 0.42, 0, 0.67, d * 0.22, accent, 0.016);
        if (t === 2)
          for (let n = 0; n < 7; n++)
            box(
              'headboard-flute',
              0.035,
              h - 0.05,
              0.025,
              -w / 2 + (n * w) / 6,
              h / 2,
              -d / 2 + 0.06,
              metal,
              0.01,
            );
        break;
      }
      case 'cabinet': {
        legs(w, d, 0.16, metal, 0.023);
        box('cabinet', w, h - 0.16, d, 0, (h + 0.16) / 2, 0, wood, 0.025);
        for (let i = 0; i < 3; i++) {
          box(
            'door-panel',
            w / 3 - 0.025,
            h - 0.21,
            0.018,
            -w / 2 + ((i + 0.5) * w) / 3,
            (h + 0.16) / 2,
            d / 2 + 0.013,
            style === 'cream' ? cloth : wood,
            0.008,
          );
          box(
            'handle',
            0.025,
            0.12,
            0.025,
            -w / 2 + ((i + 0.84) * w) / 3,
            h * 0.65,
            d / 2 + 0.04,
            metal,
            0.009,
          );
        }
        box(
          'top',
          w + 0.025,
          0.035,
          d + 0.025,
          0,
          h + 0.01,
          0,
          style === 'luxe' ? cream : wood,
          0.012,
        );
        break;
      }
      case 'lamp': {
        cyl('base', 0.32, 0.045, 0, 0.023, 0, metal);
        cyl('stem', 0.025, h - 0.32, 0, (h - 0.32) / 2, 0, metal);
        cyl('shade', w, 0.35, 0, h - 0.175, 0, cloth, w * 0.66);
        const glow = this.mat('lamp-glow', '#fff4d2', 0.8);
        glow.emissiveColor = B.Color3.FromHexString('#ffce82').scale(0.42);
        cyl('bulb', 0.14, 0.06, 0, h - 0.27, 0, glow);
        break;
      }
      case 'coffee': {
        cyl(
          'table-base',
          w * 0.56,
          h - 0.08,
          0,
          (h - 0.08) / 2,
          0,
          wood,
          w * 0.45,
        );
        const top = cyl(
          'coffee-top',
          w,
          0.09,
          0,
          h - 0.045,
          0,
          style === 'luxe' ? cream : wood,
        );
        top.scaling.z = d / w;
        break;
      }
      case 'rug':
        box('rug', w, 0.018, d, 0, 0.012, 0, cloth, 0.007);
        for (const z of [-1, 1])
          box(
            'rug-border',
            w - 0.05,
            0.001,
            0.028,
            0,
            0.022,
            z * (d / 2 - 0.09),
            accent,
          );
        break;
      case 'pouf':
        cyl('pouf', w, h, 0, h / 2, 0, cloth, w * 0.96);
        break;
      case 'plant': {
        cyl('pot', 0.29, 0.31, 0, 0.16, 0, cream, 0.39);
        cyl('earth', 0.35, 0.015, 0, 0.305, 0, soil);
        cyl('trunk', 0.028, h * 0.63, 0, 0.5, 0, wood);
        for (let i = 0; i < 9; i++) {
          const ang = i * 2.399,
            y = 0.55 + i * 0.075,
            rad = 0.12 + (i % 3) * 0.055;
          const l = sphere(
            'leaf',
            0.25,
            0.09,
            0.14,
            Math.cos(ang) * rad,
            y,
            Math.sin(ang) * rad,
            leaf,
          );
          l.rotation.set(0.4 * Math.sin(ang), ang, 0.3 * Math.cos(ang));
        }
        break;
      }
      case 'art': {
        box('frame', w, h, 0.05, 0, h / 2, 0, wood, 0.015);
        box('paper', w - 0.05, h - 0.05, 0.015, 0, h / 2, 0.037, cream);
        const circle = cyl(
          'art-disc',
          w * 0.5,
          0.008,
          0,
          h * 0.55,
          0.05,
          accent,
        );
        circle.rotation.x = Math.PI / 2;
        box(
          'art-block',
          w * 0.45,
          h * 0.16,
          0.008,
          -w * 0.12,
          h * 0.28,
          0.052,
          wood,
        );
        break;
      }
      case 'bookshelf': {
        for (const x of [-1, 1])
          box('side', 0.045, h, d, x * (w / 2 - 0.023), h / 2, 0, wood);
        for (let row = 0; row < 5; row++) {
          const y = 0.12 + (row * (h - 0.2)) / 4;
          box('shelf', w, 0.04, d, 0, y, 0, wood);
          if (row < 4)
            for (let j = 0; j < 5; j++)
              box(
                'book',
                0.09,
                0.21 + ((j + row) % 3) * 0.04,
                d * 0.7,
                -w * 0.35 + j * 0.11,
                y + 0.15,
                0,
                j % 2 ? accent : cream,
                0.006,
              );
        }
        break;
      }
      case 'vase':
        cyl('vase', w, h * 0.75, 0, h * 0.375, 0, cream, w * 0.5);
        cyl('neck', w * 0.45, h * 0.3, 0, h * 0.82, 0, cream);
        break;
      case 'mirror': {
        box('frame', w, h, 0.065, 0, h / 2, 0, wood, 0.04);
        const mirror = this.mat('mirror', '#abb8af', 0.07, 0.85);
        box(
          'mirror',
          w - 0.055,
          h - 0.07,
          0.018,
          0,
          h / 2,
          0.038,
          mirror,
          0.02,
        );
        break;
      }
      case 'curtain':
        for (let i = 0; i < 18; i++)
          cyl(
            'curtain-fold',
            w / 15,
            h,
            ((i - 8.5) * w) / 18,
            h / 2,
            Math.sin(i) * 0.025,
            cloth,
          );
        break;
      case 'counter':
        box(
          'kitchen-base',
          w,
          h - 0.07,
          d,
          0,
          (h - 0.07) / 2,
          0,
          style === 'luxe' ? wood : cloth,
          0.016,
        );
        box(
          'stone-top',
          w + 0.04,
          0.065,
          d + 0.06,
          0,
          h - 0.033,
          0,
          cream,
          0.02,
        );
        for (let i = 0; i < 3; i++)
          box(
            'handle',
            0.3,
            0.018,
            0.025,
            ((i - 1) * w) / 3,
            h * 0.78,
            d / 2 + 0.03,
            metal,
            0.006,
          );
        break;
      case 'stool':
        legs(w, d, h - 0.08, metal, 0.021);
        cyl('stool-seat', w, 0.08, 0, h - 0.04, 0, wood);
        break;
      case 'bench':
        legs(w, d, 0.45);
        box('bench-seat', w, 0.08, d, 0, 0.45, 0, wood, 0.03);
        for (let i = 0; i < 3; i++)
          box(
            'bench-back',
            w,
            0.055,
            0.06,
            0,
            0.62 + i * 0.075,
            -d / 2,
            wood,
            0.014,
          );
        break;
      case 'sunbed':
        legs(w, d, 0.23);
        box('frame', w, 0.08, d, 0, 0.24, 0, wood, 0.035);
        box('cushion', w - 0.06, 0.12, d * 0.68, 0, 0.34, 0.27, cloth, 0.045);
        box(
          'back',
          w - 0.06,
          0.13,
          d * 0.34,
          0,
          0.49,
          -d * 0.32,
          cloth,
          0.045,
        ).rotation.x = -0.35;
        break;
      case 'parasol':
        cyl('base', 0.5, 0.08, 0, 0.04, 0, cream);
        cyl('pole', 0.04, h - 0.3, 0, (h - 0.3) / 2, 0, wood);
        cyl('umbrella', w, 0.38, 0, h - 0.19, 0, cloth, 0.08);
        break;
      case 'bath': {
        box('bath-base', w, h * 0.55, d, 0, h * 0.29, 0, cream, 0.12);
        for (const s of [-1, 1]) {
          box(
            'rim-side',
            w,
            h * 0.4,
            0.13,
            0,
            h * 0.75,
            s * (d / 2 - 0.065),
            cream,
            0.06,
          );
          box(
            'rim-end',
            0.13,
            h * 0.4,
            d - 0.1,
            s * (w / 2 - 0.065),
            h * 0.75,
            0,
            cream,
            0.055,
          );
        }
        box(
          'water',
          w - 0.26,
          0.015,
          d - 0.25,
          0,
          h * 0.66,
          0,
          this.mat('bath-water', '#a8c4bd', 0.15),
        );
        break;
      }
      case 'sink':
        box('vanity', w, h - 0.12, d, 0, (h - 0.12) / 2, 0, wood, 0.025);
        box('basin', w + 0.03, 0.1, d + 0.03, 0, h - 0.07, 0, cream, 0.035);
        cyl('tap', 0.025, 0.18, 0, h + 0.06, -d * 0.33, metal);
        box('tap-neck', 0.025, 0.025, 0.14, 0, h + 0.14, -d * 0.23, metal);
        break;
      default:
        box('placeholder', w, h, d, 0, h / 2, 0, cloth, 0.1);
    }
    // Merge each furniture material group, keeping the item as one logical editable object.
    const groups = new Map<B.Material, B.Mesh[]>();
    for (const m of parts) {
      const mat = m.material!;
      if (!groups.has(mat)) groups.set(mat, []);
      groups.get(mat)!.push(m);
      m.computeWorldMatrix(true);
    }
    for (const meshes of groups.values())
      if (meshes.length > 1) {
        const merged = B.Mesh.MergeMeshes(
          meshes,
          true,
          true,
          undefined,
          false,
          false,
        );
        if (merged) {
          merged.parent = parent;
          merged.receiveShadows = true;
        }
      }
    for (const m of parent.getChildMeshes())
      m.metadata = { itemId: parent.name };
  }
}
