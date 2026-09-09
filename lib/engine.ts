import { translate, type Locale } from './i18n';
import { WalkCamera, WALK_EYE_HEIGHT, WALK_RADIUS } from './navigation';
import { canPlaceItem } from './placement';
import * as B from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import { Furnisher } from './furniture';
import {
  Asset,
  Design,
  Item,
  ViewMode,
  assetFor,
  floorsFor,
  STYLES,
  wallSegments,
  wallsFor,
  uid,
} from './world';

type Hooks = {
  select: (id: string | null) => void;
  move: (id: string, x: number, z: number) => void;
  notify: (s: string) => void;
  fps: (n: number) => void;
  ready: () => void;
  loadModel: (id: string) => Promise<Blob | undefined>;
  vrAction: (action: string) => void;
  view: (v: ViewMode) => void;
};
type WallPart = {
  mesh: B.Mesh;
  bottom: number;
  top: number;
  base: number;
  floor: number;
};
export class DwellEngine {
  engine: B.Engine;
  scene: B.Scene;
  orbit: B.ArcRotateCamera;
  walk: B.UniversalCamera;
  sun: B.DirectionalLight;
  ambient: B.HemisphericLight;
  shadow: B.ShadowGenerator;
  furnisher: Furnisher;
  design: Design;
  custom: Asset[] = [];
  mode: ViewMode = 'orbit';
  selected: string | null = null;
  snap = true;
  showLabels = false;
  disposed = false;
  xrActive = false;
  roots = new Map<string, B.TransformNode>();
  signatures = new Map<string, string>();
  floors: B.Mesh[] = [];
  wallParts: WallPart[] = [];
  extras: { node: B.Node; floor: number; role: string }[] = [];
  colliders: { x: number; z: number; w: number; d: number; floor: number }[] =
    [];
  selection: B.LinesMesh | null = null;
  xr: B.WebXRDefaultExperience | null = null;
  locale: Locale = 'zh-CN';
  roomLabels: { texture: B.DynamicTexture; name: string }[] = [];
  vrTranslations: (() => void)[] = [];
  setLocale(locale: Locale) {
    this.locale = locale;
    this.roomLabels.forEach((label) => this.drawRoomLabel(label));
    this.vrTranslations.forEach((update) => update());
  }
  drawRoomLabel({
    texture,
    name,
  }: {
    texture: B.DynamicTexture;
    name: string;
  }) {
    const text = translate(this.locale, name);
    const context = texture.getContext();
    context.font = '34px Arial';
    const size = Math.min(
      34,
      (34 * 480) / Math.max(context.measureText(text).width, 1),
    );
    context.clearRect(0, 0, 512, 96);
    texture.drawText(
      text,
      null,
      64,
      `${size}px Arial`,
      '#566354',
      'transparent',
      true,
    );
  }
  sceneKey = '';
  lastFps = 0;
  floorMaterials: B.Material[] = [];
  interiorLights: {
    light: B.PointLight;
    floor: number;
    x: number;
    z: number;
    w: number;
    d: number;
  }[] = [];
  ao: B.SSAO2RenderingPipeline | null = null;
  drag: null | {
    id: string;
    startX: number;
    startY: number;
    offsetX: number;
    offsetZ: number;
    originX: number;
    originZ: number;
    moved: boolean;
    valid: boolean;
  } = null;
  resizeObserver: ResizeObserver;
  pointerObserver: B.Nullable<B.Observer<B.PointerInfo>>;
  hooks: Hooks;
  constructor(
    public canvas: HTMLCanvasElement,
    design: Design,
    hooks: Hooks,
  ) {
    this.design = design;
    this.hooks = hooks;
    this.engine = new B.Engine(
      canvas,
      true,
      { preserveDrawingBuffer: true, stencil: true },
      true,
    );
    this.engine.setHardwareScalingLevel(
      Math.max(1, window.devicePixelRatio / 1.5),
    );
    this.scene = new B.Scene(this.engine);
    this.scene.clearColor = B.Color4.FromHexString('#eff0e9ff');
    this.scene.collisionsEnabled = true;
    this.scene.gravity = new B.Vector3(0, -0.08, 0);
    this.scene.imageProcessingConfiguration.toneMappingEnabled = true;
    this.scene.imageProcessingConfiguration.toneMappingType =
      B.ImageProcessingConfiguration.TONEMAPPING_ACES;
    this.scene.imageProcessingConfiguration.exposure = 1.25;
    this.scene.imageProcessingConfiguration.contrast = 1.1;
    this.scene.environmentTexture = new B.HDRCubeTexture(
      '/assets/studio.hdr',
      this.scene,
      128,
      false,
      true,
      false,
      true,
    );
    this.scene.environmentIntensity = 0.7;
    this.orbit = new B.ArcRotateCamera(
      'overview',
      1.15,
      0.7,
      19,
      new B.Vector3(5, 0, 5),
      this.scene,
    );
    this.orbit.lowerRadiusLimit = 3;
    this.orbit.upperRadiusLimit = 125;
    this.orbit.lowerBetaLimit = 0.06;
    this.orbit.upperBetaLimit = 1.49;
    this.orbit.wheelPrecision = 45;
    this.orbit.panningSensibility = 80;
    this.orbit.minZ = 0.05;
    this.orbit.inertia = 0.75;
    this.orbit.attachControl(canvas, true);
    this.walk = new WalkCamera(
      'walk',
      new B.Vector3(5, WALK_EYE_HEIGHT + 0.03, 5),
      this.scene,
    );
    this.walk.minZ = 0.07;
    (this.walk as WalkCamera).configure();
    this.walk.angularSensibility = 2300;
    this.walk.keysUp = [87, 38];
    this.walk.keysDown = [83, 40];
    this.walk.keysLeft = [65, 37];
    this.walk.keysRight = [68, 39];
    this.walk.checkCollisions = true;
    this.walk.applyGravity = true;

    this.sun = new B.DirectionalLight(
      'sun',
      new B.Vector3(-0.55, -1, 0.35),
      this.scene,
    );
    this.sun.position = new B.Vector3(16, 24, -12);
    this.sun.intensity = 2.2;
    this.ambient = new B.HemisphericLight(
      'sky',
      new B.Vector3(0, 1, 0),
      this.scene,
    );
    this.ambient.intensity = 0.85;
    this.ambient.groundColor = B.Color3.FromHexString('#969478');
    this.shadow = new B.ShadowGenerator(2048, this.sun);
    this.shadow.useBlurExponentialShadowMap = true;
    this.shadow.blurKernel = 24;
    this.shadow.bias = 0.0008;
    this.shadow.normalBias = 0.025;
    this.shadow.darkness = 0.23;
    if (B.SSAO2RenderingPipeline.IsSupported) {
      this.ao = new B.SSAO2RenderingPipeline(
        'interior-contact',
        this.scene,
        { ssaoRatio: 0.5, blurRatio: 0.5 },
        [this.orbit, this.walk],
      );
      this.ao.radius = 0.35;
      this.ao.totalStrength = 0.8;
      this.ao.base = 0.1;
      this.ao.samples = 8;
      this.ao.expensiveBlur = false;
    }
    const pipeline = new B.DefaultRenderingPipeline(
      'finish',
      true,
      this.scene,
      [this.orbit, this.walk],
    );
    pipeline.fxaaEnabled = true;
    pipeline.samples = 2;
    this.furnisher = new Furnisher(this.scene);
    this.pointerObserver = this.scene.onPointerObservable.add((pi) =>
      this.pointer(pi),
    );
    this.resizeObserver = new ResizeObserver(() => {
      this.engine.resize();
      this.updateOrtho();
    });
    this.resizeObserver.observe(canvas);
    this.engine.runRenderLoop(() => {
      if (this.disposed) return;
      this.scene.render();
      const now = performance.now();
      if (now - this.lastFps > 1500) {
        this.lastFps = now;
        this.hooks.fps(Math.round(this.engine.getFps()));
      }
    });
    this.setDesign(design);
    this.scene.executeWhenReady(() => {
      if (!this.disposed) hooks.ready();
    });
  }
  base(fi: number) {
    return fi === 0 ? 0 : 3.85;
  }
  mat(name: string, color: string, rough = 0.8, metal = 0) {
    return this.furnisher.mat(name, color, rough, metal);
  }
  box(
    name: string,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: B.Material,
    collision = false,
  ) {
    const m = B.MeshBuilder.CreateBox(
      name,
      { width: w, height: h, depth: d },
      this.scene,
    );
    m.position.set(x, y, z);
    m.material = mat;
    m.receiveShadows = true;
    m.checkCollisions = collision;
    return m;
  }
  setDesign(design: Design, custom: Asset[] = this.custom) {
    if (this.disposed) return;
    this.design = design;
    this.custom = custom;
    const key = [
      design.home,
      design.style,
      design.wallColor,
      design.floorColor,
    ].join('|');
    if (key !== this.sceneKey) {
      if (this.xr && !this.xrActive) {
        this.xr.dispose();
        this.xr = null;
      }
      this.sceneKey = key;
      this.buildArchitecture();
      this.resetCamera();
      for (const r of this.roots.values()) r.dispose();
      this.roots.clear();
      this.signatures.clear();
    }
    const ids = new Set(design.items.map((i) => i.id));
    for (const [id, r] of this.roots)
      if (!ids.has(id)) {
        r.dispose();
        this.roots.delete(id);
        this.signatures.delete(id);
      }
    for (const i of design.items) {
      const a = assetFor(i.assetId, custom);
      if (!a) continue;
      const signature = JSON.stringify([i.assetId, i.color, design.style]);
      let root = this.roots.get(i.id);
      if (!root || this.signatures.get(i.id) !== signature) {
        root?.dispose();
        root = new B.TransformNode(i.id, this.scene);
        this.roots.set(i.id, root);
        this.signatures.set(i.id, signature);
        if (a.custom || a.kind === 'heritage') void this.loadImported(a, root);
        else
          this.furnisher.create(
            a,
            root,
            a.id.includes('-') ? a.style : design.style,
            i.color,
          );
        for (const m of root.getChildMeshes())
          this.shadow.addShadowCaster(m, false);
      }
      root.position.set(i.x, this.base(i.floor) + i.y, i.z);
      root.rotation.y = i.rotation;
      root.scaling.setAll(i.scale);
    }
    this.assignInteriorLights();
    this.setTime(design.time);
    this.updateVisibility();
    this.select(this.selected, false);
  }
  assignInteriorLights() {
    for (const { light, floor, x, z, w, d } of this.interiorLights) {
      light.includedOnlyMeshes = this.scene.meshes.filter((m) => {
        if (!m.material || m.name.startsWith('drop-')) return false;
        m.computeWorldMatrix(true);
        const p = m.getBoundingInfo().boundingBox.centerWorld;
        return (
          p.y >= this.base(floor) - 0.05 &&
          p.y < this.base(floor) + 3.6 &&
          p.x >= x - 0.13 &&
          p.x <= x + w + 0.13 &&
          p.z >= z - 0.13 &&
          p.z <= z + d + 0.13
        );
      });
    }
  }
  buildArchitecture() {
    this.roomLabels = [];
    for (const { light } of this.interiorLights) light.dispose();
    this.interiorLights = [];
    this.wallParts = [];
    this.colliders = [];
    this.floors = [];
    for (const m of this.floorMaterials) {
      // PBR materials share the scene's BRDF lookup texture. Never dispose it
      // while rebuilding a floor; only release textures owned by that floor.
      if (m instanceof B.PBRMaterial) {
        m.albedoTexture?.dispose();
        m.bumpTexture?.dispose();
      } else if (m instanceof B.StandardMaterial) m.diffuseTexture?.dispose();
      m.dispose(false, false);
    }
    this.floorMaterials = [];
    this.shadow.getShadowMap()!.renderList = [];
    for (const e of this.extras) e.node.dispose();
    this.extras = [];
    // Dispose previous architecture as a group; item nodes are managed separately.
    this.scene.getTransformNodeByName('architecture')?.dispose();
    const parent = new B.TransformNode('architecture', this.scene);
    const mark = (node: B.Mesh, fi: number, role: string) => {
      node.parent = parent;
      this.extras.push({ node, floor: fi, role });
      return node;
    };
    const wallMat = this.mat('plaster', this.design.wallColor),
      trim = this.mat('trim', '#e0d6c3'),
      wood = this.mat('frame', STYLES[this.design.style].wood, 0.55),
      foundation = this.mat('foundation', '#c6cbb9');
    const featureWood = this.mat(
      'feature-oak',
      this.design.style === 'luxe'
        ? '#85684e'
        : this.design.style === 'fresh'
          ? '#b7c6a5'
          : '#e0c6a0',
      0.64,
    );
    const featureStone = this.mat('feature-stone', '#e2d4bd', 0.5);
    const ceilingMat = this.mat('ceiling', '#e9dfca', 0.88);
    ceilingMat.backFaceCulling = false;
    const warmGlow = this.mat('light-diffuser', '#fff2dc', 0.5);
    warmGlow.emissiveColor = B.Color3.FromHexString('#ffd99b').scale(0.75);
    const curtainMat = this.furnisher.mat('curtain', '#dbcfb6', 0.94, 0, true);
    const frames = this.mat(
        'window-frame',
        this.design.style === 'luxe' ? '#5c5547' : '#aca997',
        0.4,
        0.25,
      ),
      glass = this.mat('glass', '#bad0c9', 0.06, 0.25);
    glass.alpha = 0.09;
    glass.metallic = 0;
    glass.environmentIntensity = 0.2;
    glass.transparencyMode = B.PBRMaterial.PBRMATERIAL_ALPHABLEND;
    for (const [fi, f] of floorsFor(this.design.home).entries()) {
      const base = this.base(fi),
        height =
          this.design.home === 'estate'
            ? fi === 0
              ? 3.6
              : 3.2
            : this.design.home === 'home100'
              ? 2.8
              : 3;
      if (fi === 0)
        mark(
          this.box(
            'foundation',
            f.w + 0.16,
            0.2,
            f.h + 0.16,
            f.w / 2,
            base - 0.13,
            f.h / 2,
            foundation,
          ),
          fi,
          'foundation',
        );
      else {
        for (const z of [0, f.h])
          mark(
            this.box(
              'floor-edge',
              f.w,
              0.2,
              0.16,
              f.w / 2,
              base - 0.1,
              z,
              foundation,
            ),
            fi,
            'foundation',
          );
        for (const x of [0, f.w])
          mark(
            this.box(
              'floor-edge',
              0.16,
              0.2,
              f.h,
              x,
              base - 0.1,
              f.h / 2,
              foundation,
            ),
            fi,
            'foundation',
          );
      }
      for (const r of f.rooms) {
        const wet = r.kind === 'service',
          out = r.kind === 'outside';
        const floorMat = new B.PBRMaterial('floor-' + r.id, this.scene);
        this.floorMaterials.push(floorMat);
        floorMat.albedoColor = B.Color3.FromHexString(
          wet ? '#ddd9cb' : out ? '#b7b39d' : this.design.floorColor,
        );
        floorMat.metallic = 0;
        floorMat.roughness = wet ? 0.42 : 0.7;
        floorMat.environmentIntensity = 0.6;
        if (wet) {
          floorMat.albedoTexture = new B.Texture(
            '/assets/materials/marble_01-color.jpg',
            this.scene,
          );
          (floorMat.albedoTexture as B.Texture).uScale = r.w / 3;
          (floorMat.albedoTexture as B.Texture).vScale = r.h / 3;
        }
        if (!wet && !out) {
          const tex = new B.Texture(
            '/assets/wood_floor_Diffuse.jpg',
            this.scene,
          );
          tex.uScale = r.w / 2;
          tex.vScale = r.h / 2;
          floorMat.albedoTexture = tex;
          const normal = new B.Texture(
            '/assets/wood_floor_nor_gl.jpg',
            this.scene,
          );
          normal.uScale = r.w / 2;
          normal.vScale = r.h / 2;
          normal.level = 0.18;
          floorMat.bumpTexture = normal;
        }
        const plane = (x: number, z: number, w: number, d: number) => {
          const m = B.MeshBuilder.CreateGround(
            'floor-' + fi + '-' + r.id,
            { width: w, height: d },
            this.scene,
          );
          m.position.set(x, base + 0.004, z);
          m.material = floorMat;
          m.receiveShadows = true;
          m.checkCollisions = true;
          m.metadata = { floor: fi, room: r.id, ground: true };
          this.floors.push(m);
          mark(m, fi, 'floor');
        };
        if (r.id === 'stairs' && fi === 1) {
          plane(r.x + 0.7, r.y + r.h / 2, 1.4, r.h);
          plane(r.x + r.w - 0.8, r.y + r.h / 2, 1.6, r.h);
          plane(r.x + 3.4, r.y + 0.1, 4, 0.2);
          plane(r.x + 3.4, r.y + r.h - 0.15, 4, 0.3);
        } else plane(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h);
        if (r.id !== 'stairs') {
          const ceiling = B.MeshBuilder.CreateGround(
            'ceiling',
            { width: r.w, height: r.h },
            this.scene,
          );
          ceiling.position.set(r.x + r.w / 2, base + height, r.y + r.h / 2);
          ceiling.rotation.z = Math.PI;
          ceiling.material = ceilingMat;
          ceiling.checkCollisions = true;
          mark(ceiling, fi, 'ceiling');
          this.shadow.addShadowCaster(ceiling);
          if (r.kind !== 'outside') {
            const cx = r.x + r.w / 2,
              cz = r.y + r.h / 2;
            const light = new B.PointLight(
              'room-light-' + fi + '-' + r.id,
              new B.Vector3(cx, base + height - 0.35, cz),
              this.scene,
            );
            light.diffuse = B.Color3.FromHexString('#ffdda6');
            light.intensity = 0.85;
            light.range = Math.max(r.w, r.h) * 1.4;
            light.falloffType = B.Light.FALLOFF_STANDARD;
            this.interiorLights.push({
              light,
              floor: fi,
              x: r.x,
              z: r.y,
              w: r.w,
              d: r.h,
            });
            for (const xx of [-1, 1]) {
              const lamp = B.MeshBuilder.CreateCylinder(
                'ceiling-lamp',
                { diameter: 0.16, height: 0.035, tessellation: 16 },
                this.scene,
              );
              lamp.position.set(
                cx + xx * Math.min(1.1, r.w * 0.23),
                base + height - 0.045,
                cz,
              );
              lamp.material = warmGlow;
              mark(lamp, fi, 'ceiling');
            }
          }
        }
        if (r.kind !== 'circulation' && r.w > 2.2 && r.h > 1.6) {
          const tex = new B.DynamicTexture(
            'label',
            { width: 512, height: 96 },
            this.scene,
            false,
          );
          tex.hasAlpha = true;
          const roomLabel = { texture: tex, name: r.name };
          this.roomLabels.push(roomLabel);
          this.drawRoomLabel(roomLabel);
          const mat = new B.StandardMaterial('label', this.scene);
          this.floorMaterials.push(mat);
          mat.diffuseTexture = tex;
          mat.emissiveColor = B.Color3.White();
          mat.disableLighting = true;
          mat.backFaceCulling = false;
          const label = B.MeshBuilder.CreatePlane(
            'room-label',
            { width: Math.min(r.w * 0.65, 2.5), height: 0.37 },
            this.scene,
          );
          label.material = mat;
          label.position.set(r.x + r.w / 2, base + 0.2, r.y + 0.45);
          label.rotation.x = Math.PI / 2;
          label.isPickable = false;
          mark(label, fi, 'label');
        }
      }
      for (const w of wallsFor(f)) {
        const thick = w.outer ? 0.2 : 0.13;
        for (const seg of wallSegments(w, height)) {
          const len = seg.to - seg.from,
            mid = (seg.to + seg.from) / 2,
            h = seg.top - seg.bottom;
          const x = w.axis === 'h' ? mid : w.at,
            z = w.axis === 'h' ? w.at : mid;
          const m = mark(
            this.box(
              'wall',
              w.axis === 'h' ? len : thick,
              h,
              w.axis === 'h' ? thick : len,
              x,
              base + seg.bottom + h / 2,
              z,
              (() => {
                const feature = f.rooms.find(
                  (r) =>
                    ['sofa', 'bed'].includes(r.furniture || '') &&
                    w.axis === 'h' &&
                    Math.abs(r.y - w.at) < 0.001 &&
                    mid > r.x &&
                    mid < r.x + r.w,
                );
                return feature
                  ? this.design.style === 'luxe'
                    ? featureStone
                    : featureWood
                  : wallMat;
              })(),
              true,
            ),
            fi,
            'wall',
          );
          this.wallParts.push({
            mesh: m,
            bottom: seg.bottom,
            top: seg.top,
            base,
            floor: fi,
          });
          this.shadow.addShadowCaster(m);
          if (seg.bottom < 0.1) {
            this.colliders.push({
              x,
              z,
              w: w.axis === 'h' ? len : thick,
              d: w.axis === 'h' ? thick : len,
              floor: fi,
            });
            const skirting = mark(
              this.box(
                'skirting',
                w.axis === 'h' ? len : thick + 0.025,
                0.09,
                w.axis === 'h' ? thick + 0.025 : len,
                x,
                base + 0.046,
                z,
                trim,
              ),
              fi,
              'trim',
            );
            skirting.isPickable = false;
          }
        }
        for (const door of w.holes.filter((h) => h.type === 'door')) {
          const mid = (door.from + door.to) / 2,
            len = door.to - door.from;
          for (const t of [door.from - 0.025, door.to + 0.025])
            mark(
              this.box(
                'door-frame',
                w.axis === 'h' ? 0.055 : 0.19,
                door.top,
                w.axis === 'h' ? 0.19 : 0.055,
                w.axis === 'h' ? t : w.at,
                base + door.top / 2,
                w.axis === 'h' ? w.at : t,
                wood,
              ),
              fi,
              'window',
            );
          mark(
            this.box(
              'door-lintel',
              w.axis === 'h' ? len + 0.1 : 0.19,
              0.055,
              w.axis === 'h' ? 0.19 : len + 0.1,
              w.axis === 'h' ? mid : w.at,
              base + door.top + 0.025,
              w.axis === 'h' ? w.at : mid,
              wood,
            ),
            fi,
            'window',
          );
        }
        for (const hole of w.holes.filter((h) => h.type === 'window')) {
          const middle = (hole.from + hole.to) / 2,
            len = hole.to - hole.from,
            h = hole.top - hole.bottom,
            x = w.axis === 'h' ? middle : w.at,
            z = w.axis === 'h' ? w.at : middle;
          mark(
            this.box(
              'glass',
              w.axis === 'h' ? len : 0.025,
              h,
              w.axis === 'h' ? 0.025 : len,
              x,
              base + hole.bottom + h / 2,
              z,
              glass,
              true,
            ),
            fi,
            'window',
          );
          if (len > 1.2) {
            const inward = (w.at === 0 ? 1 : -1) * 0.15;
            for (const edge of [hole.from + 0.12, hole.to - 0.12]) {
              const pieces: B.Mesh[] = [];
              for (let k = 0; k < 7; k++) {
                const t = edge + (k - 3) * 0.045;
                const drape = this.box(
                  'curtain-fold',
                  w.axis === 'h' ? 0.055 : 0.055,
                  2.36,
                  w.axis === 'h' ? 0.055 : 0.055,
                  w.axis === 'h' ? t : x + inward + Math.sin(k * 2) * 0.025,
                  base + 1.22,
                  w.axis === 'h' ? z + inward + Math.sin(k * 2) * 0.025 : t,
                  curtainMat,
                );
                pieces.push(drape);
              }
              const merged = B.Mesh.MergeMeshes(pieces, true, true)!;
              mark(merged, fi, 'window');
            }
          }
          for (const yy of [hole.bottom, hole.top])
            mark(
              this.box(
                'window-rail',
                w.axis === 'h' ? len + 0.05 : 0.055,
                0.045,
                w.axis === 'h' ? 0.055 : len + 0.05,
                x,
                base + yy,
                z,
                frames,
              ),
              fi,
              'window',
            );
          for (const t of [hole.from, middle, hole.to])
            mark(
              this.box(
                'window-post',
                0.045,
                h,
                0.045,
                w.axis === 'h' ? t : x,
                base + hole.bottom + h / 2,
                w.axis === 'h' ? z : t,
                frames,
              ),
              fi,
              'window',
            );
        }
      }
    }
    if (this.design.home === 'estate') {
      this.makeStairs(parent, mark, wood);
      const grass = this.mat('grass', '#abbf95'),
        stone = this.mat('terrace', '#d9ccb6', 0.85),
        water = this.mat('pool', '#65a9ad', 0.12, 0.28);
      const land = mark(
        this.box('estate-ground', 80, 0.22, 50, 12.5, -0.35, 17, grass, true),
        0,
        'land',
      );
      land.metadata = { ground: true, floor: 0 };
      this.floors.push(land);
      const terrace = mark(
        this.box('terrace', 30, 0.16, 6, 12.5, -0.035, 23, stone, true),
        0,
        'land',
      );
      terrace.metadata = { ground: true, floor: 0 };
      this.floors.push(terrace);
      // The pool is a solid non-teleportable volume; VR floors deliberately exclude water.
      mark(
        this.box('pool-bed', 12.45, 0.17, 5.45, 12.5, -0.08, 30.5, stone, true),
        0,
        'land',
      );
      mark(
        this.box('pool-water', 12, 0.025, 5, 12.5, 0.02, 30.5, water, true),
        0,
        'land',
      );
      for (const x of [6.3, 18.7])
        mark(
          this.box('pool-rim', 0.22, 0.14, 5.7, x, 0.025, 30.5, stone, true),
          0,
          'land',
        );
      for (const z of [27.8, 33.2])
        mark(
          this.box('pool-rim', 12.6, 0.14, 0.22, 12.5, 0.025, z, stone, true),
          0,
          'land',
        );
      mark(
        this.box(
          'driveway',
          30,
          0.04,
          8,
          12.5,
          -0.21,
          -4,
          this.mat('driveway', '#b4b7ac'),
        ),
        0,
        'land',
      );
      for (let i = 0; i < 22; i++) {
        const side = i % 2 === 0 ? -1 : 1,
          x = 12.5 + side * (20 + (i % 4) * 3),
          z = -4 + ((i * 7) % 44);
        this.tree(x, z, 2.8 + (i % 3) * 0.7, parent);
      }
    } else {
      const f = floorsFor(this.design.home)[0];
      const stage = mark(
        this.box(
          'display-ground',
          180,
          0.1,
          180,
          f.w / 2,
          -0.34,
          f.h / 2,
          this.mat('backdrop', '#e3e6dc'),
        ),
        0,
        'stage',
      );
      stage.isPickable = false;
      for (let i = 0; i < 14; i++) {
        const x = i % 2 === 0 ? -8 : f.w + 8,
          z = -10 + ((i * 4) % 36);
        this.tree(x, z, 3 + (i % 3), parent);
      }
    }
    const sky = B.MeshBuilder.CreateSphere(
      'sky',
      { diameter: 380, segments: 24, sideOrientation: B.Mesh.BACKSIDE },
      this.scene,
    );
    const skyMat = new B.StandardMaterial('sky', this.scene),
      skyTex = new B.DynamicTexture(
        'sky-gradient',
        { width: 8, height: 256 },
        this.scene,
        false,
      );
    const ctx = skyTex.getContext(),
      gradient = ctx.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, '#a9cad4');
    gradient.addColorStop(0.5, '#e5e9e0');
    gradient.addColorStop(1, '#b9c5ad');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 8, 256);
    skyTex.update();
    skyMat.diffuseTexture = skyTex;
    skyMat.disableLighting = true;
    skyMat.emissiveColor = B.Color3.White();
    skyMat.backFaceCulling = false;
    skyMat.disableDepthWrite = true;
    this.floorMaterials.push(skyMat);
    sky.material = skyMat;
    sky.infiniteDistance = true;
    sky.isPickable = false;
    sky.renderingGroupId = 0;
    mark(sky, 0, 'sky');
    this.updateVisibility();
  }
  tree(x: number, z: number, h: number, parent: B.TransformNode) {
    const bark = this.mat('bark', '#9a8664'),
      foliage = this.mat('tree', '#82956e');
    const trunk = this.box(
      'tree-trunk',
      0.14,
      h * 0.65,
      0.14,
      x,
      h * 0.32,
      z,
      bark,
    );
    trunk.parent = parent;
    this.extras.push({ node: trunk, floor: 0, role: 'tree' });
    const parts: B.Mesh[] = [];
    for (let i = 0; i < 5; i++) {
      const m = B.MeshBuilder.CreateSphere(
        'foliage',
        { diameter: h * 0.52, segments: 12 },
        this.scene,
      );
      m.position.set(
        x + Math.sin(i * 2.4) * h * 0.15,
        h * 0.68 + (i % 2) * h * 0.13,
        z + Math.cos(i * 2.4) * h * 0.15,
      );
      m.scaling.y = 1.15;
      m.material = foliage;
      parts.push(m);
    }
    const tree = B.Mesh.MergeMeshes(parts, true, true)!;
    tree.parent = parent;
    this.extras.push({ node: tree, floor: 0, role: 'tree' });
    this.shadow.addShadowCaster(tree);
  }
  makeStairs(
    parent: B.TransformNode,
    mark: (m: B.Mesh, f: number, r: string) => B.Mesh,
    mat: B.Material,
  ) {
    const half = 3.85 / 2,
      steps = 11,
      depth = 3.15 / steps;
    for (let i = 0; i < steps; i++) {
      const top = ((i + 1) * half) / steps;
      mark(
        this.box(
          'stair-1',
          1.45,
          top,
          depth,
          14.5,
          top / 2,
          5.1 + (i + 0.5) * depth,
          mat,
        ),
        0,
        'stairs',
      );
      const top2 = half + ((i + 1) * half) / steps;
      mark(
        this.box(
          'stair-2',
          1.45,
          top2,
          depth,
          16.4,
          top2 / 2,
          8.25 - (i + 0.5) * depth,
          mat,
        ),
        0,
        'stairs',
      );
    }
    mark(
      this.box(
        'landing',
        3.35,
        0.16,
        0.65,
        15.45,
        half - 0.08,
        8.15,
        mat,
        true,
      ),
      0,
      'stairs',
    );
    // Invisible sloping collision surfaces let the walking camera climb without hitting each riser.
    const ramp = (x: number, z: number, start: number, end: number) => {
      const m = new B.Mesh('stair-ramp', this.scene);
      const vd = new B.VertexData();
      vd.positions = [
        x - 0.725,
        start,
        z,
        x + 0.725,
        start,
        z,
        x - 0.725,
        end,
        z + 3.15,
        x + 0.725,
        end,
        z + 3.15,
      ];
      vd.indices = [0, 2, 1, 1, 2, 3];
      vd.applyToMesh(m);
      m.isVisible = false;
      m.checkCollisions = true;
      m.parent = parent;
      this.floors.push(m);
      this.extras.push({ node: m, floor: 0, role: 'stairs' });
    };
    ramp(14.5, 5.1, 0, half);
    ramp(16.4, 5.1, 3.85, half);
  }
  async loadImported(a: Asset, root: B.TransformNode) {
    let url = '';
    try {
      const blob = a.custom ? await this.hooks.loadModel(a.id) : undefined;
      if (a.custom && !blob)
        throw new Error('模型文件不在此浏览器中，请重新导入作品包。');
      url = blob ? URL.createObjectURL(blob) : '/assets/sofa-heritage.glb';
      const result = await B.ImportMeshAsync(url, this.scene, {
        pluginExtension: '.glb',
      });
      if (this.disposed || root.isDisposed()) {
        result.meshes.forEach((m) => m.dispose());
        return;
      }
      const norm = new B.TransformNode('model-normalization', this.scene);
      for (const m of result.meshes) if (!m.parent) m.parent = norm;
      norm.computeWorldMatrix(true);
      const bounds = norm.getHierarchyBoundingVectors(true),
        size = bounds.max.subtract(bounds.min),
        scale = a.w / Math.max(0.001, size.x);
      norm.scaling.setAll(scale);
      norm.position.set(
        (-(bounds.min.x + bounds.max.x) / 2) * scale,
        -bounds.min.y * scale,
        (-(bounds.min.z + bounds.max.z) / 2) * scale,
      );
      norm.parent = root;
      for (const m of result.meshes) {
        m.metadata = { itemId: root.name };
        m.receiveShadows = true;
        this.shadow.addShadowCaster(m, false);
      }
      this.updateVisibility();
    } catch (err) {
      if (!this.disposed && !root.isDisposed()) {
        const m = this.box(
          'missing-model',
          a.w,
          0.1,
          a.d,
          0,
          0.05,
          0,
          this.mat('missing', '#d8a89b'),
        );
        m.parent = root;
        m.metadata = { itemId: root.name };
        this.hooks.notify(err instanceof Error ? err.message : '模型加载失败');
      }
    } finally {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    }
  }
  updateVisibility() {
    const all = this.mode === 'walk' || this.xrActive;
    const fi = this.design.floor;
    for (const { light, floor } of this.interiorLights)
      light.setEnabled(all || floor === fi);
    for (const e of this.extras) {
      let visible = all || e.floor === fi;
      if (e.role === 'ceiling' || e.role === 'sky') visible = all;
      if (e.role === 'label')
        visible = !all && this.showLabels && e.floor === fi;
      if (e.role === 'window') visible = visible && all;
      if (e.role === 'tree') visible = this.design.home === 'estate' || all;
      if (e.role === 'land' || e.role === 'stage') visible = true;
      if (e.role === 'stairs') visible = all || fi === 1;
      e.node.setEnabled(visible);
    }
    for (const p of this.wallParts) {
      const height = all ? p.top : Math.min(p.top, 0.85);
      const visible = height > p.bottom + 0.01 && (all || p.floor === fi);
      p.mesh.setEnabled(visible);
      if (visible) {
        p.mesh.scaling.y = (height - p.bottom) / (p.top - p.bottom);
        p.mesh.position.y = p.base + p.bottom + (height - p.bottom) / 2;
      }
    }
    for (const i of this.design.items) {
      const root = this.roots.get(i.id);
      root?.setEnabled(all || i.floor === fi);
      for (const m of root?.getChildMeshes() || [])
        m.checkCollisions =
          all &&
          !['rug', 'art', 'vase', 'curtain'].includes(
            assetFor(i.assetId, this.custom)?.kind || '',
          );
    }
    if (this.selection) this.selection.setEnabled(!all && !!this.selected);
  }
  resetCamera() {
    const f =
      floorsFor(this.design.home)[this.design.floor] ||
      floorsFor(this.design.home)[0];
    const estate = this.design.home === 'estate';
    this.orbit.target.set(
      f.w / 2,
      this.base(this.design.floor) + 0.4,
      estate ? f.h * 0.6 : f.h / 2,
    );
    const aspect =
      this.engine.getRenderWidth() / Math.max(1, this.engine.getRenderHeight());
    const halfFov = Math.atan(
      Math.tan(this.orbit.fov / 2) * Math.min(1, aspect),
    );
    this.orbit.radius =
      (Math.hypot(f.w, estate ? f.h + 8 : f.h) * 0.57) / Math.sin(halfFov);
    this.orbit.alpha = 1.1;
    this.orbit.beta = this.mode === 'top' ? 0.04 : 0.68;
    this.orbit.mode =
      this.mode === 'top'
        ? B.Camera.ORTHOGRAPHIC_CAMERA
        : B.Camera.PERSPECTIVE_CAMERA;
    this.updateOrtho();
  }
  updateOrtho() {
    const r = this.orbit.radius * 0.52,
      aspect =
        this.engine.getRenderWidth() /
        Math.max(1, this.engine.getRenderHeight());
    this.orbit.orthoLeft = -r * aspect;
    this.orbit.orthoRight = r * aspect;
    this.orbit.orthoTop = r;
    this.orbit.orthoBottom = -r;
  }
  setMode(mode: ViewMode) {
    this.mode = mode;
    this.orbit.detachControl();
    this.walk.detachControl();
    if (mode === 'walk') {
      this.spawnWalk();
      this.scene.activeCamera = this.walk;
      this.walk.attachControl(this.canvas, true);
      this.canvas.focus({ preventScroll: true });
      this.select(null);
    } else {
      if (document.pointerLockElement === this.canvas)
        document.exitPointerLock();
      this.scene.activeCamera = this.orbit;
      this.orbit.attachControl(this.canvas, true);
      this.resetCamera();
    }
    this.updateVisibility();
  }
  spawnWalk(roomId?: string) {
    const f = floorsFor(this.design.home)[this.design.floor];
    const r =
      f.rooms.find((r) => r.id === roomId) ||
      f.rooms.find((r) => r.furniture === 'sofa') ||
      f.rooms.find((r) => r.id === f.start) ||
      f.rooms[0];
    const walker: Asset = {
      id: 'walk-probe',
      name: 'walk',
      kind: 'walker',
      w: WALK_RADIUS * 2 + 0.05,
      d: WALK_RADIUS * 2 + 0.05,
      h: WALK_EYE_HEIGHT,
      style: 'cream',
      tier: 0,
      category: '',
    };
    const candidates: { x: number; z: number }[] = [];
    for (let z = r.y + 0.35; z < r.y + r.h - 0.3; z += 0.25)
      for (let x = r.x + 0.35; x < r.x + r.w - 0.3; x += 0.25)
        candidates.push({ x, z });
    const goal = { x: r.x + r.w - 0.7, z: r.y + r.h - 0.85 };
    candidates.sort(
      (a, b) =>
        Math.hypot(a.x - goal.x, a.z - goal.z) -
        Math.hypot(b.x - goal.x, b.z - goal.z),
    );
    const p = candidates.find((p) =>
      canPlaceItem(
        this.design,
        {
          ...p,
          y: 0,
          rotation: 0,
          scale: 1,
          floor: this.design.floor,
          id: 'walk-probe',
          assetId: walker.id,
        },
        [...this.custom, walker],
        this.colliders,
      ),
    ) || { x: r.x + r.w / 2, z: r.y + r.h / 2 };
    this.walk.cameraDirection.setAll(0);
    this.walk.cameraRotation.setAll(0);
    this.walk.position.set(
      p.x,
      this.base(this.design.floor) + WALK_EYE_HEIGHT + 0.03,
      p.z,
    );
    this.walk.setTarget(
      new B.Vector3(
        r.x + r.w / 2,
        this.base(this.design.floor) + 1.2,
        r.y + r.h * 0.4,
      ),
    );
  }
  focusRoom(id: string) {
    const f = floorsFor(this.design.home)[this.design.floor],
      r = f.rooms.find((r) => r.id === id);
    if (!r) return;
    if (this.mode === 'walk') this.spawnWalk(id);
    else {
      this.orbit.setTarget(
        new B.Vector3(
          r.x + r.w / 2,
          this.base(this.design.floor) + 0.3,
          r.y + r.h / 2,
        ),
      );
      this.orbit.radius = Math.max(r.w, r.h) * 2;
      this.updateOrtho();
    }
  }
  setTime(time: string) {
    const night = time === 'night',
      sunset = time === 'sunset';
    this.sun.intensity = night ? 0.17 : sunset ? 1.3 : 1.65;
    this.sun.diffuse = B.Color3.FromHexString(
      night ? '#91aed5' : sunset ? '#ffca82' : '#fff0d7',
    );
    this.sun.direction = new B.Vector3(-0.55, sunset ? -0.3 : -1, 0.35);
    this.ambient.intensity = night ? 0.18 : 0.38;
    for (const { light } of this.interiorLights)
      light.intensity = night ? 1.05 : sunset ? 0.8 : 0.52;
    this.scene.environmentIntensity = night ? 0.22 : 0.55;
    const sky = this.scene.getMaterialByName(
      'sky',
    ) as B.StandardMaterial | null;
    if (sky)
      sky.emissiveColor = B.Color3.FromHexString(
        night ? '#253950' : sunset ? '#ffd7ac' : '#ffffff',
      );
    this.scene.clearColor = B.Color4.FromHexString(
      night ? '#263a44ff' : sunset ? '#e9dcc6ff' : '#eff0e9ff',
    );
    this.scene.imageProcessingConfiguration.exposure = night ? 1.1 : 0.95;
  }
  select(id: string | null, notify = true) {
    if (id && !this.roots.has(id)) id = null;
    this.selected = id;
    this.selection?.dispose();
    this.selection = null;
    if (id) {
      const item = this.design.items.find((i) => i.id === id),
        a = item && assetFor(item.assetId, this.custom);
      if (item && a) {
        const w = (a.w * item.scale) / 2 + 0.09,
          d = (a.d * item.scale) / 2 + 0.09;
        const pts = [
          new B.Vector3(-w, 0.025, -d),
          new B.Vector3(w, 0.025, -d),
          new B.Vector3(w, 0.025, d),
          new B.Vector3(-w, 0.025, d),
          new B.Vector3(-w, 0.025, -d),
        ];
        this.selection = B.MeshBuilder.CreateLines(
          'selection',
          { points: pts },
          this.scene,
        );
        this.selection.color = B.Color3.FromHexString('#6e9767');
        this.selection.position.set(
          item.x,
          this.base(item.floor) + item.y + 0.02,
          item.z,
        );
        this.selection.rotation.y = item.rotation;
        this.selection.isPickable = false;
        this.selection.renderingGroupId = 1;
      }
    }
    if (notify) this.hooks.select(id);
  }
  dropPreview: B.Mesh | null = null;
  libraryDrop(a: Asset, clientX: number, clientY: number, preview = true) {
    if (this.mode === 'walk' || this.xrActive) return null;
    const rect = this.canvas.getBoundingClientRect();
    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      this.clearDropPreview();
      return null;
    }
    const point = this.groundPoint(
      this.base(this.design.floor),
      clientX - rect.left,
      clientY - rect.top,
    );
    if (!point) {
      this.clearDropPreview();
      return null;
    }
    const item: Item = {
      id: uid(),
      assetId: a.id,
      x: this.snap ? Math.round(point.x * 10) / 10 : point.x,
      z: this.snap ? Math.round(point.z * 10) / 10 : point.z,
      y: 0,
      rotation: 0,
      scale: 1,
      floor: this.design.floor,
    };
    const valid = this.canPlace(item);
    if (preview) {
      if (!this.dropPreview) {
        this.dropPreview = B.MeshBuilder.CreateBox(
          'drop-preview',
          { size: 1 },
          this.scene,
        );
        const m = new B.StandardMaterial('drop-preview', this.scene);
        m.alpha = 0.24;
        m.disableLighting = true;
        this.dropPreview.material = m;
        this.dropPreview.isPickable = false;
        this.dropPreview.renderingGroupId = 1;
        this.dropPreview.enableEdgesRendering();
        this.dropPreview.edgesWidth = 2;
      }
      this.dropPreview.scaling.set(a.w, Math.max(a.h, 0.06), a.d);
      this.dropPreview.position.set(
        item.x,
        this.base(item.floor) + Math.max(a.h, 0.06) / 2 + 0.03,
        item.z,
      );
      const m = this.dropPreview.material as B.StandardMaterial;
      m.emissiveColor = B.Color3.FromHexString(valid ? '#4b9568' : '#d4604e');
      this.dropPreview.edgesColor = B.Color4.FromColor3(m.emissiveColor, 1);
    }
    return valid ? item : null;
  }
  clearDropPreview() {
    this.dropPreview?.material?.dispose();
    this.dropPreview?.dispose();
    this.dropPreview = null;
  }
  groundPoint(
    y: number,
    screenX = this.scene.pointerX,
    screenY = this.scene.pointerY,
  ) {
    const ray = this.scene.createPickingRay(
      screenX,
      screenY,
      B.Matrix.Identity(),
      this.scene.activeCamera,
    );
    const t = ray.intersectsPlane(new B.Plane(0, 1, 0, -y));
    return t !== null && t > 0 ? ray.origin.add(ray.direction.scale(t)) : null;
  }
  pointer(pi: B.PointerInfo) {
    if (this.xrActive) {
      if (pi.type === B.PointerEventTypes.POINTERDOWN) {
        const md = pi.pickInfo?.pickedMesh?.metadata;
        if (md?.itemId) {
          this.select(md.itemId);
          this.hooks.notify('已选中：指向地面再次按扳机放置。');
        } else if (md?.ground && this.selected && pi.pickInfo?.pickedPoint) {
          const p = pi.pickInfo.pickedPoint,
            item = this.design.items.find((i) => i.id === this.selected);
          if (item && this.canPlace({ ...item, x: p.x, z: p.z })) {
            this.hooks.move(item.id, p.x, p.z);
            this.select(null);
          }
        }
      }
      return;
    }
    if (this.mode === 'walk') {
      if (
        pi.type === B.PointerEventTypes.POINTERDOWN &&
        pi.event.button === 0 &&
        !document.pointerLockElement
      )
        void this.canvas.requestPointerLock?.();
      return;
    }
    if (pi.type === B.PointerEventTypes.POINTERDOWN && pi.event.button === 0) {
      const id = pi.pickInfo?.pickedMesh?.metadata?.itemId;
      if (id) {
        this.select(id);
        const item = this.design.items.find((i) => i.id === id)!,
          p = this.groundPoint(this.base(item.floor) + item.y);
        if (p) {
          this.drag = {
            id,
            startX: pi.event.clientX,
            startY: pi.event.clientY,
            offsetX: item.x - p.x,
            offsetZ: item.z - p.z,
            originX: item.x,
            originZ: item.z,
            moved: false,
            valid: true,
          };
          this.orbit.detachControl();
        }
      } else this.select(null);
    }
    if (pi.type === B.PointerEventTypes.POINTERMOVE && this.drag) {
      const dr = this.drag,
        item = this.design.items.find((i) => i.id === dr.id);
      if (!item) return;
      if (
        Math.hypot(pi.event.clientX - dr.startX, pi.event.clientY - dr.startY) <
          5 &&
        !dr.moved
      )
        return;
      const p = this.groundPoint(this.base(item.floor) + item.y);
      if (!p) return;
      dr.moved = true;
      let x = p.x + dr.offsetX,
        z = p.z + dr.offsetZ;
      if (this.snap) {
        x = Math.round(x * 10) / 10;
        z = Math.round(z * 10) / 10;
      }
      dr.valid = this.canPlace({ ...item, x, z });
      const root = this.roots.get(dr.id);
      if (root) {
        root.position.x = x;
        root.position.z = z;
      }
      if (this.selection) {
        this.selection.position.x = x;
        this.selection.position.z = z;
        this.selection.color = B.Color3.FromHexString(
          dr.valid ? '#639561' : '#d26950',
        );
      }
    }
    if (pi.type === B.PointerEventTypes.POINTERUP && this.drag) {
      const dr = this.drag,
        root = this.roots.get(dr.id);
      this.drag = null;
      this.orbit.attachControl(this.canvas, true);
      if (root && dr.moved) {
        if (dr.valid) this.hooks.move(dr.id, root.position.x, root.position.z);
        else {
          root.position.x = dr.originX;
          root.position.z = dr.originZ;
          this.select(dr.id, false);
          this.hooks.notify('这里与墙体或家具重叠，请换个位置。');
        }
      }
    }
  }
  canPlace(item: Item) {
    return canPlaceItem(this.design, item, this.custom, this.colliders);
  }
  findPlacement(a: Asset, template: Partial<Item> = {}) {
    const f = floorsFor(this.design.home)[this.design.floor],
      center = this.orbit.target;
    const item: Item = {
      assetId: a.id,
      x: center.x,
      y: 0,
      z: center.z,
      rotation: 0,
      scale: 1,
      floor: this.design.floor,
      ...template,
      id: uid(),
    };
    for (let ring = 0; ring < 30; ring++)
      for (let n = 0; n < Math.max(1, ring * 8); n++) {
        const angle = (n / Math.max(1, ring * 8)) * Math.PI * 2;
        item.x = center.x + Math.cos(angle) * ring * 0.25;
        item.z = center.z + Math.sin(angle) * ring * 0.25;
        if (this.canPlace(item)) return { ...item };
      }
    for (const r of f.rooms) {
      item.x = r.x + r.w / 2;
      item.z = r.y + r.h / 2;
      if (this.canPlace(item)) return { ...item };
    }
    return null;
  }
  focusItem(item: Item) {
    const a = assetFor(item.assetId, this.custom);
    this.orbit.target.set(item.x, this.base(item.floor) + item.y, item.z);
    this.orbit.inertialPanningX = this.orbit.inertialPanningY = 0;
    this.orbit.inertialAlphaOffset = this.orbit.inertialBetaOffset = 0;
    this.orbit.inertialRadiusOffset = 0;
    this.orbit.radius = Math.max(
      8,
      Math.max(a?.w || 1, a?.d || 1) * item.scale * 4,
    );
    this.updateOrtho();
  }
  zoom(delta: number) {
    this.orbit.radius = Math.max(3, Math.min(125, this.orbit.radius + delta));
    this.updateOrtho();
  }
  projectedItems() {
    const r = this.canvas.getBoundingClientRect(),
      v = this.scene.activeCamera!.viewport.toGlobal(
        this.engine.getRenderWidth(),
        this.engine.getRenderHeight(),
      );
    return this.design.items
      .filter((i) => i.floor === this.design.floor)
      .map((i) => {
        const a = assetFor(i.assetId, this.custom),
          p = B.Vector3.Project(
            new B.Vector3(
              i.x,
              this.base(i.floor) + i.y + (a?.h || 0.5) * i.scale * 0.4,
              i.z,
            ),
            B.Matrix.Identity(),
            this.scene.getTransformMatrix(),
            v,
          );
        return {
          id: i.id,
          x: r.left + (p.x / this.engine.getRenderWidth()) * r.width,
          y: r.top + (p.y / this.engine.getRenderHeight()) * r.height,
        };
      });
  }
  screenshot() {
    const old = this.selection?.isEnabled();
    this.selection?.setEnabled(false);
    this.scene.render();
    const url = this.canvas.toDataURL('image/png');
    if (old) this.selection?.setEnabled(true);
    return url;
  }
  async measureModel(blob: Blob) {
    const url = URL.createObjectURL(blob);
    let container: B.AssetContainer | undefined;
    try {
      container = await B.LoadAssetContainerAsync(url, this.scene, {
        pluginExtension: '.glb',
      });
      const meshes = container.meshes.filter((m) => m.getTotalVertices() > 0);
      for (const m of meshes) m.computeWorldMatrix(true);
      const bounds = B.Mesh.MinMax(meshes),
        size = bounds.max.subtract(bounds.min);
      if (
        ![size.x, size.y, size.z].every((n) => Number.isFinite(n) && n > 0.0001)
      )
        throw new Error('模型尺寸无效。');
      return { w: size.x, h: size.y, d: size.z };
    } finally {
      container?.dispose();
      URL.revokeObjectURL(url);
    }
  }

  setQuality(q: string) {
    if (this.ao) {
      const manager = this.scene.postProcessRenderPipelineManager;
      if (q === 'low')
        manager.detachCamerasFromRenderPipeline(this.ao.name, [
          this.orbit,
          this.walk,
        ]);
      else
        manager.attachCamerasToRenderPipeline(
          this.ao.name,
          [this.orbit, this.walk],
          true,
        );
    }

    this.engine.setHardwareScalingLevel(
      q === 'low'
        ? 2.2
        : q === 'high'
          ? 1
          : Math.max(1, window.devicePixelRatio / 1.5),
    );
    this.shadow
      .getShadowMap()
      ?.resize(q === 'low' ? 512 : q === 'high' ? 2048 : 1024);
  }
  async enterVR() {
    try {
      if (
        !navigator.xr ||
        !(await navigator.xr.isSessionSupported('immersive-vr'))
      )
        throw new Error(
          '此设备暂不支持沉浸式VR，请使用 Quest 3 / 3S 的浏览器打开。',
        );
      this.setMode('walk');
      this.hooks.view('walk');
      this.xrActive = true;
      this.updateVisibility();
      if (!this.xr) {
        this.xr = await this.scene.createDefaultXRExperienceAsync({
          floorMeshes: this.floors.filter(
            (m) => m.isEnabled() && m.name !== 'estate-ground',
          ),
          disableDefaultUI: true,
          optionalFeatures: true,
        });
        this.xr.baseExperience.onStateChangedObservable.add((state) => {
          if (state === B.WebXRState.NOT_IN_XR) {
            this.xrActive = false;
            this.setMode('orbit');
            this.hooks.view('orbit');
          }
        });
      }
      await this.xr.baseExperience.enterXRAsync('immersive-vr', 'local-floor');
      await this.vrMenu();
    } catch (e) {
      this.xrActive = false;
      this.setMode('orbit');
      this.hooks.view('orbit');
      this.hooks.notify(e instanceof Error ? e.message : '暂时无法进入VR。');
    }
  }
  async vrMenu() {
    if (!this.xr) return;
    const G = await import('@babylonjs/gui');
    const plane = B.MeshBuilder.CreatePlane(
      'vr-menu',
      { width: 0.8, height: 0.62 },
      this.scene,
    );
    const camera = this.xr.baseExperience.camera;
    const forward = camera.getForwardRay().direction;
    plane.position.copyFrom(camera.position.add(forward.scale(1.3)));
    plane.position.y -= 0.25;
    plane.billboardMode = B.Mesh.BILLBOARDMODE_ALL;
    const ui = G.AdvancedDynamicTexture.CreateForMesh(plane, 768, 600);
    const panel = new G.StackPanel();
    panel.background = '#f7f5eb';
    ui.addControl(panel);
    const title = new G.TextBlock();
    title.text = 'Dwellcraft';
    title.height = '80px';
    title.fontSize = 38;
    title.color = '#294a35';
    panel.addControl(title);
    for (const [text, action] of [
      ['旋转家具', 'rotate'],
      ['复制家具', 'duplicate'],
      ['删除家具', 'delete'],
      ['添加座椅', 'add-chair'],
      ['退出 VR', 'exit'],
    ]) {
      const button = G.Button.CreateSimpleButton(
        action,
        translate(this.locale, text),
      );
      this.vrTranslations.push(() => {
        if (button.textBlock)
          button.textBlock.text = translate(this.locale, text);
      });
      button.height = '84px';
      button.width = '90%';
      button.color = '#ffffff';
      button.background = '#365b42';
      button.fontSize = 28;
      button.paddingBottom = '8px';
      button.onPointerClickObservable.add(() => {
        if (action === 'exit') void this.xr?.baseExperience.exitXRAsync();
        else this.hooks.vrAction(action);
      });
      panel.addControl(button);
    }
    this.xr.baseExperience.onStateChangedObservable.addOnce(() => {
      this.vrTranslations = [];
      plane.dispose();
      ui.dispose();
    });
  }
  dispose() {
    this.disposed = true;
    this.resizeObserver.disconnect();
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.scene.dispose();
    this.engine.dispose();
  }
}
