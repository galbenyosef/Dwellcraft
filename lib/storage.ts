import { createStore, get, set, keys } from 'idb-keyval';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { Asset, Design, HomeId, validateDesign } from './world';
interface GLTFData {
  asset?: { version?: string };
  nodes?: { mesh?: number }[];
  meshes?: {
    primitives?: {
      mode?: number;
      indices?: number;
      attributes?: { POSITION?: number };
    }[];
  }[];
  accessors?: { count: number }[];
  materials?: unknown[];
  images?: { uri?: string; mimeType: string; bufferView: number }[];
  buffers?: { uri?: string }[];
  bufferViews?: { buffer: number; byteLength: number; byteOffset?: number }[];
  extensionsRequired?: string[];
}
interface ProjectManifest {
  format: string;
  version: number;
  design: unknown;
  assets: Asset[];
}
const database = () => createStore('dwellcraft-v1', 'workspace');
export const loadDesign = (home: HomeId) =>
  get<Design>('design:' + home, database());
export const saveDesign = (d: Design) =>
  set('design:' + d.home, { ...d, updated: Date.now() }, database());
export const modelBlob = (id: string) => get<Blob>('model:' + id, database());
export const saveModel = async (asset: Asset, blob: Blob) => {
  await set('model:' + asset.id, blob, database());
  await set('asset:' + asset.id, asset, database());
};
export async function customAssets() {
  const store = database(),
    ks = await keys(store);
  const out: Asset[] = [];
  for (const k of ks)
    if (typeof k === 'string' && k.startsWith('asset:')) {
      const a = await get<Asset>(k, store);
      if (a) out.push(a);
    }
  return out;
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
export interface GLBInfo {
  triangles: number;
  nodes: number;
  bytes: number;
}
export async function inspectGLB(file: Blob): Promise<GLBInfo> {
  if (file.size > 50 * 1024 * 1024)
    throw new Error('模型超过50MB，请先压缩后再导入。');
  const buffer = await file.arrayBuffer(),
    v = new DataView(buffer);
  if (
    buffer.byteLength < 20 ||
    v.getUint32(0, true) !== 0x46546c67 ||
    v.getUint32(4, true) !== 2 ||
    v.getUint32(8, true) !== buffer.byteLength ||
    v.getUint32(16, true) !== 0x4e4f534a
  )
    throw new Error('请选择有效的 GLB 2.0 单文件模型。');
  const jsonLength = v.getUint32(12, true);
  if (jsonLength > 5 * 1024 * 1024 || 20 + jsonLength > buffer.byteLength)
    throw new Error('模型结构信息无效或过大。');
  let data: GLTFData;
  try {
    data = JSON.parse(
      new TextDecoder().decode(buffer.slice(20, 20 + jsonLength)),
    );
  } catch {
    throw new Error('模型结构信息无法读取。');
  }
  if (
    data.asset?.version !== '2.0' ||
    (data.nodes?.length || 0) > 2000 ||
    (data.materials?.length || 0) > 64 ||
    (data.images?.length || 0) > 32
  )
    throw new Error('模型结构过于复杂，请简化节点、材质与贴图。');
  if (
    (data.buffers || []).some((b) => b.uri) ||
    (data.images || []).some((i) => i.uri)
  )
    throw new Error('请把模型与贴图全部嵌入GLB，不能引用外部文件。');
  const supported = [
    'KHR_materials_unlit',
    'KHR_materials_clearcoat',
    'KHR_materials_ior',
    'KHR_materials_sheen',
    'KHR_materials_specular',
    'KHR_materials_transmission',
    'KHR_materials_volume',
    'KHR_materials_emissive_strength',
    'KHR_texture_transform',
    'KHR_mesh_quantization',
  ];
  if (
    (data.extensionsRequired || []).some((e: string) => !supported.includes(e))
  )
    throw new Error('此模型需要尚未支持的压缩或扩展，请导出普通GLB后再试。');
  let triangles = 0;
  for (const node of data.nodes || []) {
    if (node.mesh === undefined) continue;
    const mesh = data.meshes?.[node.mesh];
    if (!mesh) throw new Error('模型节点引用无效。');
    for (const p of mesh.primitives || []) {
      if (p.mode !== undefined && p.mode !== 4)
        throw new Error('模型必须使用三角形网格。');
      const accessor =
        data.accessors?.[p.indices ?? p.attributes?.POSITION ?? -1];
      const count = accessor?.count ?? NaN;
      if (!Number.isFinite(count) || count < 0)
        throw new Error('模型网格无效。');
      triangles += count / 3;
    }
  }
  if (!triangles || triangles > 200000)
    throw new Error('模型需包含网格，且总三角面不能超过20万。');
  const binaryOffset = 20 + jsonLength + 8;
  if (
    binaryOffset > buffer.byteLength ||
    v.getUint32(20 + jsonLength + 4, true) !== 0x004e4942
  )
    throw new Error('模型缺少内嵌二进制数据。');
  for (const image of data.images || []) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(image.mimeType))
      throw new Error('当前支持内嵌 PNG、JPEG 或 WebP 贴图。');
    const view = data.bufferViews?.[image.bufferView];
    if (!view || view.buffer !== 0 || view.byteLength > 20 * 1024 * 1024)
      throw new Error('模型贴图资源无效。');
    const start = binaryOffset + (view.byteOffset || 0),
      end = start + view.byteLength;
    if (end > buffer.byteLength) throw new Error('模型贴图数据不完整。');
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(
        new Blob([buffer.slice(start, end)], { type: image.mimeType }),
      );
    } catch {
      throw new Error('模型内的贴图无法解码。');
    }
    const over = bitmap.width > 4096 || bitmap.height > 4096;
    bitmap.close();
    if (over) throw new Error('单张贴图不能超过4096 × 4096。');
  }
  return {
    triangles: Math.round(triangles),
    nodes: data.nodes?.length || 0,
    bytes: file.size,
  };
}
export async function exportProject(design: Design, assets: Asset[]) {
  const referenced = assets.filter((a) =>
    design.items.some((i) => i.assetId === a.id),
  );
  const files: Record<string, Uint8Array> = {};
  let total = 0;
  for (const a of referenced) {
    const blob = await modelBlob(a.id);
    if (!blob) throw new Error('有自定义模型丢失，请重新导入该模型后再导出。');
    total += blob.size;
    if (total > 150 * 1024 * 1024)
      throw new Error('作品模型合计超过150MB，请减少模型后导出。');
    files['models/' + a.id + '.glb'] = new Uint8Array(await blob.arrayBuffer());
  }
  files['manifest.json'] = strToU8(
    JSON.stringify(
      { format: 'dwellcraft', version: 1, design, assets: referenced },
      null,
      2,
    ),
  );
  const zip = zipSync(files, { level: 1 });
  return new Blob([zip.buffer as ArrayBuffer], { type: 'application/zip' });
}
export async function importProject(
  file: File,
  expectedHome?: HomeId,
): Promise<{ design: Design; assets: Asset[] }> {
  if (file.size > 160 * 1024 * 1024) throw new Error('作品包超过160MB。');
  let count = 0,
    total = 0,
    rejected = false;
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()), {
    filter(entry) {
      count++;
      total += entry.originalSize;
      const okay =
        count <= 150 &&
        total <= 180 * 1024 * 1024 &&
        entry.originalSize < 60 * 1024 * 1024 &&
        (entry.name === 'manifest.json' ||
          /^models\/[a-zA-Z0-9_-]+\.glb$/.test(entry.name)) &&
        entry.originalSize / Math.max(1, entry.size) < 250;
      if (!okay) rejected = true;
      return okay;
    },
  });
  if (rejected || !files['manifest.json'])
    throw new Error('作品包资源过大或文件结构不受支持。');
  let manifest: ProjectManifest;
  try {
    manifest = JSON.parse(strFromU8(files['manifest.json']));
  } catch {
    throw new Error('作品清单无法读取。');
  }
  if (
    manifest.format !== 'dwellcraft' ||
    manifest.version !== 1 ||
    !Array.isArray(manifest.assets) ||
    manifest.assets.length > 100
  )
    throw new Error('作品包版本不受支持。');
  const design = validateDesign(manifest.design),
    assets: Asset[] = manifest.assets;
  if (expectedHome && design.home !== expectedHome)
    throw new Error('请先进入作品对应的住宅，再导入此作品。');
  const prepared: { a: Asset; b: Blob }[] = [];
  for (const a of assets) {
    if (
      !a.custom ||
      typeof a.id !== 'string' ||
      !/^custom-[a-f0-9]{32,64}$/.test(a.id) ||
      typeof a.name !== 'string' ||
      a.name.length > 80 ||
      !['cream', 'fresh', 'luxe'].includes(a.style) ||
      a.kind !== 'custom' ||
      a.category !== '我的模型' ||
      ![0, 1, 2].includes(a.tier) ||
      ![a.w, a.d, a.h].every((n) => Number.isFinite(n) && n > 0.005 && n < 30)
    )
      throw new Error('自定义模型信息无效。');
    const bytes = files['models/' + a.id + '.glb'];
    if (!bytes) throw new Error('作品包缺少自定义模型。');
    const blob = new Blob(
      [
        bytes.buffer.slice(
          bytes.byteOffset,
          bytes.byteOffset + bytes.byteLength,
        ) as ArrayBuffer,
      ],
      { type: 'model/gltf-binary' },
    );
    await inspectGLB(blob);
    if ((await modelId(blob)) !== a.id)
      throw new Error('模型校验失败，作品包中的模型与清单不一致。');
    prepared.push({ a, b: blob });
  }
  const allowed = new Set(assets.map((a) => a.id));
  for (const i of design.items)
    if (i.assetId.startsWith('custom-') && !allowed.has(i.assetId))
      throw new Error('作品引用了未打包的模型。');
  for (const { a, b } of prepared) await saveModel(a, b);
  return { design, assets };
}
export async function modelId(blob: Blob) {
  const hash = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return (
    'custom-' +
    Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  );
}
