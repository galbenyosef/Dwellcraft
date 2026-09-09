import blueprint from './scene-design.json';
export type HomeId = 'home100' | 'home200' | 'estate';
export type DesignStyle = 'cream' | 'fresh' | 'luxe';
export type ViewMode = 'orbit' | 'top' | 'walk';
export type TimeOfDay = 'day' | 'sunset' | 'night';
export interface Room {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: string;
  furniture?: string | null;
  area: number;
}
export interface Door {
  a: string;
  b: string;
  x: number;
  y: number;
  axis: string;
  width: number;
}
export interface Floor {
  id: string;
  title: string;
  w: number;
  h: number;
  rooms: Room[];
  doors: Door[];
  start: string;
}
export interface Asset {
  id: string;
  name: string;
  kind: string;
  style: DesignStyle;
  tier: number;
  w: number;
  d: number;
  h: number;
  category: string;
  custom?: boolean;
}
export interface Item {
  id: string;
  assetId: string;
  x: number;
  y: number;
  z: number;
  rotation: number;
  scale: number;
  floor: number;
  color?: string;
}
export interface Design {
  version: 1;
  home: HomeId;
  style: DesignStyle;
  items: Item[];
  time: TimeOfDay;
  floor: number;
  wallColor: string;
  floorColor: string;
  updated: number;
}
export const HOMES = [
  {
    id: 'home100' as HomeId,
    name: '日光小家',
    tag: 'THE WARM RETREAT',
    area: '100',
    rooms: '三室两厅 · 奶油风',
    image: 'home-100.png',
    desc: '把温暖，放进每一个日常。',
    style: 'cream' as DesignStyle,
  },
  {
    id: 'home200' as HomeId,
    name: '林景大平层',
    tag: 'THE OPEN RESIDENCE',
    area: '200',
    rooms: '四室两厅 · 小清新',
    image: 'home-200.png',
    desc: '让自然与生活，自由相连。',
    style: 'fresh' as DesignStyle,
  },
  {
    id: 'estate' as HomeId,
    name: '湖畔庄园',
    tag: 'THE LAKESIDE ESTATE',
    area: '4000',
    rooms: '两层别墅 · 奢华风',
    image: 'estate-4000.png',
    desc: '在更广阔的空间，安放想象。',
    style: 'luxe' as DesignStyle,
  },
];
export const STYLES = {
  cream: {
    name: '奶油风',
    fabric: '#e7ddc9',
    wood: '#b58b5e',
    accent: '#9a9f7c',
    wall: '#f3eee3',
    floor: '#ecdbbb',
  },
  fresh: {
    name: '小清新',
    fabric: '#b9c6aa',
    wood: '#bd9b6e',
    accent: '#6f8865',
    wall: '#edf1e8',
    floor: '#e3d3ac',
  },
  luxe: {
    name: '奢华风',
    fabric: '#b5a38c',
    wood: '#5d4436',
    accent: '#a48750',
    wall: '#e8e0d0',
    floor: '#d5c7ae',
  },
};
export const TIERS = ['基础', '精品', '典藏'];
const BASE = [
  ['sofa', '沙发', 2.4, 0.96, 0.85, '客厅'],
  ['table', '餐桌', 1.4, 0.82, 0.76, '餐厅'],
  ['chair', '餐椅', 0.52, 0.56, 0.88, '餐厅'],
  ['bed', '双人床', 1.8, 2.05, 0.98, '卧室'],
  ['cabinet', '收纳柜', 1.5, 0.46, 0.82, '收纳'],
  ['lamp', '落地灯', 0.43, 0.43, 1.65, '灯饰'],
] as const;
export const CATALOG: Asset[] = Object.entries(STYLES).flatMap(([s]) =>
  [0, 1, 2].flatMap((t) =>
    BASE.map(([kind, name, w, d, h, category]) => ({
      id: `${kind}-${s}-${t}`,
      name: `${['素', '逸', '臻'][t]}·${name}`,
      kind,
      style: s as DesignStyle,
      tier: t,
      w: w * (kind === 'sofa' ? 1 + t * 0.12 : 1 + t * 0.06),
      d,
      h,
      category,
    })),
  ),
);
const EXTRA = [
  ['coffee', '圆木茶几', 1, 0.72, 0.36, '客厅'],
  ['rug', '织纹地毯', 2.8, 1.8, 0.018, '软装'],
  ['plant', '室内绿植', 0.48, 0.48, 1.25, '软装'],
  ['art', '几何挂画', 0.8, 0.07, 1, '软装'],
  ['pouf', '圆形脚凳', 0.58, 0.58, 0.4, '客厅'],
  ['desk', '原木书桌', 1.2, 0.6, 0.76, '书房'],
  ['bookshelf', '开放书架', 1.1, 0.35, 1.8, '收纳'],
  ['vase', '陶器花瓶', 0.18, 0.18, 0.32, '软装'],
  ['mirror', '落地镜', 0.65, 0.1, 1.7, '软装'],
  ['curtain', '亚麻窗帘', 1.8, 0.16, 2.4, '软装'],
  ['counter', '厨房岛台', 1.8, 0.78, 0.9, '厨卫'],
  ['stool', '高脚凳', 0.4, 0.4, 0.72, '餐厅'],
  ['bench', '户外长凳', 1.6, 0.55, 0.8, '庭院'],
  ['sunbed', '泳池躺椅', 0.72, 1.95, 0.5, '庭院'],
  ['parasol', '庭院遮阳伞', 2.5, 2.5, 2.5, '庭院'],
  ['bath', '独立浴缸', 1.6, 0.76, 0.6, '厨卫'],
  ['sink', '洗手台', 0.8, 0.5, 0.82, '厨卫'],
  ['heritage', '复古长沙发', 2.4, 0.815, 0.985, '客厅'],
] as const;
EXTRA.forEach(([kind, name, w, d, h, category], i) =>
  CATALOG.push({
    id: kind,
    name,
    kind,
    w,
    d,
    h,
    category,
    style: (['cream', 'fresh', 'luxe'] as const)[i % 3],
    tier: 1,
  }),
);
export const CATEGORIES = [
  '全部',
  '客厅',
  '卧室',
  '餐厅',
  '收纳',
  '灯饰',
  '软装',
  '书房',
  '厨卫',
  '庭院',
  '我的模型',
];
export function floorsFor(home: HomeId): Floor[] {
  return (blueprint.floors as Floor[]).filter((f) =>
    home === 'estate' ? f.id.startsWith('villa') : f.id === home,
  );
}
export function assetFor(id: string, custom: Asset[] = []) {
  return CATALOG.find((a) => a.id === id) || custom.find((a) => a.id === id);
}
export function uid() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `item-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
export function roomAt(f: Floor, x: number, z: number) {
  return f.rooms.find(
    (r) => x >= r.x && x <= r.x + r.w && z >= r.y && z <= r.y + r.h,
  );
}
export function initialDesign(home: HomeId, empty = false): Design {
  const style = HOMES.find((h) => h.id === home)!.style,
    items: Item[] = [];
  const put = (
    assetId: string,
    x: number,
    z: number,
    floor: number,
    rotation = 0,
    y = 0,
    scale = 1,
  ) => items.push({ id: uid(), assetId, x, z, y, rotation, scale, floor });
  if (!empty)
    floorsFor(home).forEach((f, fi) =>
      f.rooms.forEach((r) => {
        const cx = r.x + r.w / 2,
          cz = r.y + r.h / 2;
        if (r.furniture === 'bed') {
          put(`bed-${style}-0`, cx, r.y + Math.min(r.h * 0.48, 2.5), fi);
          put('plant', r.x + 0.42, r.y + 0.42, fi, 0, 0, 0.75);
          if (r.w > 5)
            put(`cabinet-${style}-1`, r.x + r.w - 1.05, r.y + 0.48, fi);
        } else if (r.furniture === 'sofa') {
          const z = r.y + r.h * 0.32;
          put(`sofa-${style}-${home === 'estate' ? 2 : 0}`, cx, z, fi);
          put('rug', cx, z + 1.05, fi, 0, 0, home === 'estate' ? 1.35 : 1);
          put('coffee', cx, z + 1.2, fi, 0, 0, home === 'estate' ? 1.3 : 1);
          put(`cabinet-${style}-0`, cx, r.y + r.h - 0.4, fi, Math.PI);
          put('plant', r.x + 0.45, r.y + r.h - 0.52, fi);
          put(`lamp-${style}-0`, r.x + r.w - 0.55, r.y + 0.65, fi);
          if (r.w > 6) {
            put(`chair-${style}-1`, cx + 2.5, z + 1.2, fi, -Math.PI / 2);
            put('pouf', cx - 2.4, z + 1.1, fi);
          }
        } else if (r.furniture === 'table') {
          put(`table-${style}-${home === 'estate' ? 2 : 0}`, cx, cz, fi);
          for (const sign of [-1, 1])
            for (const x of [-0.43, 0.43])
              put(
                `chair-${style}-0`,
                cx + x,
                cz + sign * 0.86,
                fi,
                sign === -1 ? 0 : Math.PI,
              );
          if (r.w > 4)
            for (const sign of [-1, 1])
              put(
                `chair-${style}-0`,
                cx + sign * 1.13,
                cz,
                fi,
                sign === 1 ? -Math.PI / 2 : Math.PI / 2,
              );
          put('vase', cx, cz, fi, 0, 0.78);
        } else if (r.furniture === 'desk') {
          put('desk', cx, r.y + 0.5, fi);
          put(`chair-${style}-0`, cx, r.y + 1.35, fi, Math.PI);
          put('bookshelf', r.x + r.w - 0.65, r.y + r.h / 2, fi, Math.PI / 2);
          if (r.id === 'flex')
            put(`bed-${style}-0`, cx, r.y + r.h - 1.18, fi, 0, 0, 0.65);
        } else if (r.furniture === 'kitchen') {
          const count = Math.max(1, Math.floor((r.w - 0.4) / 1.8));
          for (let i = 0; i < count; i++)
            put('counter', r.x + 1.06 + i * 1.8, r.y + 0.55, fi);
          put('sink', r.x + 0.43, r.y + 1.5, fi, Math.PI / 2);
          if (r.w > 4) put('counter', cx, cz + 0.6, fi);
        } else if (r.furniture === 'bath') {
          put('sink', r.x + 0.6, r.y + 0.42, fi);
          if (r.h > 2 && r.w > 2) put('bath', cx, r.y + r.h - 0.48, fi);
        } else if (r.furniture === 'cinema') {
          for (let n = 0; n < 3; n++)
            put(`sofa-${style}-0`, cx, r.y + 1.3 + n * 1.6, fi);
          put('art', cx, r.y + r.h - 0.15, fi, 0, 1, 3);
        } else if (r.furniture === 'gym') {
          put('rug', cx, cz, fi);
          put('bench', cx, cz, fi);
          put('mirror', r.x + 0.2, cz, fi, Math.PI / 2);
        }
      }),
    );
  if (home === 'estate' && !empty) {
    for (let i = 0; i < 3; i++) put('sunbed', 6.5 + i * 1.15, 26.1, 0);
    put('parasol', 22, 24, 0);
    put('table-luxe-1', 19, 23, 0);
  }
  return {
    version: 1,
    home,
    style,
    items,
    time: 'day',
    floor: 0,
    wallColor: STYLES[style].wall,
    floorColor: STYLES[style].floor,
    updated: Date.now(),
  };
}
export interface Wall {
  axis: 'h' | 'v';
  at: number;
  from: number;
  to: number;
  outer: boolean;
  holes: {
    from: number;
    to: number;
    bottom: number;
    top: number;
    type: 'door' | 'window';
  }[];
}
export function wallsFor(f: Floor): Wall[] {
  const groups = new Map<
    string,
    { axis: 'h' | 'v'; at: number; ranges: number[][] }
  >();
  function edge(axis: 'h' | 'v', at: number, from: number, to: number) {
    const key = axis + at.toFixed(3);
    if (!groups.has(key)) groups.set(key, { axis, at, ranges: [] });
    groups.get(key)!.ranges.push([from, to]);
  }
  for (const r of f.rooms) {
    edge('h', r.y, r.x, r.x + r.w);
    edge('h', r.y + r.h, r.x, r.x + r.w);
    edge('v', r.x, r.y, r.y + r.h);
    edge('v', r.x + r.w, r.y, r.y + r.h);
  }
  const walls: Wall[] = [];
  for (const g of groups.values()) {
    const ranges = g.ranges.sort((a, b) => a[0] - b[0]),
      merged: number[][] = [];
    for (const a of ranges) {
      const last = merged.at(-1);
      if (last && a[0] <= last[1] + 0.001) last[1] = Math.max(a[1], last[1]);
      else merged.push([...a]);
    }
    for (const range of merged) {
      const outer =
        Math.abs(g.at) < 0.001 ||
        Math.abs(g.at - (g.axis === 'h' ? f.h : f.w)) < 0.001;
      const holes: Wall['holes'] = f.doors
        .filter(
          (d) =>
            d.axis === g.axis &&
            Math.abs((g.axis === 'h' ? d.y : d.x) - g.at) < 0.001,
        )
        .map((d) => ({
          from: (g.axis === 'h' ? d.x : d.y) - d.width / 2,
          to: (g.axis === 'h' ? d.x : d.y) + d.width / 2,
          bottom: 0,
          top: 2.15,
          type: 'door',
        }));
      if (outer)
        for (const r of f.rooms) {
          if (!['sleep', 'social', 'outside'].includes(r.kind)) continue;
          const adjacent =
            g.axis === 'h'
              ? Math.abs(r.y - g.at) < 0.001 ||
                Math.abs(r.y + r.h - g.at) < 0.001
              : Math.abs(r.x - g.at) < 0.001 ||
                Math.abs(r.x + r.w - g.at) < 0.001;
          if (!adjacent) continue;
          const a = g.axis === 'h' ? r.x : r.y,
            len = g.axis === 'h' ? r.w : r.h;
          if (len > 2.1)
            holes.push({
              from: a + len * 0.23,
              to: a + len * 0.77,
              bottom: r.kind === 'outside' ? 0.12 : 0.86,
              top: 2.4,
              type: 'window',
            });
        }
      walls.push({
        axis: g.axis,
        at: g.at,
        from: range[0],
        to: range[1],
        outer,
        holes: holes.filter(
          (h) => h.from >= range[0] - 0.001 && h.to <= range[1] + 0.001,
        ),
      });
    }
  }
  return walls;
}
export function wallSegments(w: Wall, height: number) {
  const xs = [
    ...new Set([w.from, w.to, ...w.holes.flatMap((h) => [h.from, h.to])]),
  ].sort((a, b) => a - b);
  const result: { from: number; to: number; bottom: number; top: number }[] =
    [];
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i],
      b = xs[i + 1],
      mid = (a + b) / 2;
    if (b - a < 0.01) continue;
    const holes = w.holes.filter(
      (h) => mid > h.from - 0.001 && mid < h.to + 0.001,
    );
    const ys = [
      ...new Set([
        0,
        height,
        ...holes.flatMap((h) => [
          Math.min(height, h.bottom),
          Math.min(height, h.top),
        ]),
      ]),
    ].sort((a, b) => a - b);
    for (let j = 0; j < ys.length - 1; j++) {
      const lo = ys[j],
        hi = ys[j + 1],
        y = (lo + hi) / 2;
      if (
        hi - lo > 0.01 &&
        !holes.some((h) => y > h.bottom - 0.001 && y < h.top + 0.001)
      )
        result.push({ from: a, to: b, bottom: lo, top: hi });
    }
  }
  return result;
}
export function validateDesign(value: unknown): Design {
  const d = value as Design;
  if (
    !d ||
    d.version !== 1 ||
    !HOMES.some((h) => h.id === d.home) ||
    !Array.isArray(d.items) ||
    d.items.length > 1000 ||
    !Object.hasOwn(STYLES, d.style)
  )
    throw new Error('这不是受支持的 Dwellcraft 作品。');
  const ids = new Set();
  for (const i of d.items) {
    if (
      !i ||
      typeof i.id !== 'string' ||
      ids.has(i.id) ||
      typeof i.assetId !== 'string' ||
      ![i.x, i.y, i.z, i.rotation, i.scale, i.floor].every(Number.isFinite) ||
      Math.abs(i.x) > 200 ||
      Math.abs(i.z) > 200 ||
      i.y < 0 ||
      i.y > 10 ||
      i.scale <= 0 ||
      i.scale > 10 ||
      !Number.isInteger(i.floor) ||
      i.floor < 0 ||
      i.floor >= floorsFor(d.home).length ||
      (!assetFor(i.assetId) && !/^custom-[a-f0-9]{64}$/.test(i.assetId)) ||
      (i.color !== undefined && !/^#[0-9a-f]{6}$/i.test(i.color))
    )
      throw new Error('作品中的家具数据无效。');
    ids.add(i.id);
  }
  if (
    !['day', 'sunset', 'night'].includes(d.time) ||
    !Number.isInteger(d.floor) ||
    d.floor < 0 ||
    d.floor >= floorsFor(d.home).length ||
    typeof d.wallColor !== 'string' ||
    typeof d.floorColor !== 'string' ||
    !/^#[0-9a-f]{6}$/i.test(d.wallColor) ||
    !/^#[0-9a-f]{6}$/i.test(d.floorColor)
  )
    throw new Error('作品设置无效。');
  return d;
}
