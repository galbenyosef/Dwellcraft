'use client';
import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
} from 'react';
import {
  ArrowLeft,
  Box,
  Check,
  ChevronDown,
  Undo2,
  Redo2,
  Save,
  Download,
  Upload,
  FolderOpen,
  Search,
  Plus,
  Minus,
  RotateCw,
  Copy,
  Trash2,
  Sun,
  Sunset,
  Moon,
  Glasses,
  Camera,
  Maximize2,
  Grid2X2,
  Footprints,
  MousePointer2,
  Layers3,
  Paintbrush,
  Sofa,
  Armchair,
  BedDouble,
  Table2,
  LampFloor,
  Flower2,
  Frame,
  BookOpen,
  Bath,
  Package,
  Move,
  Info,
  X,
  LoaderCircle,
  PanelLeftClose,
  PanelRightClose,
  Home as HomeIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import {
  HomeId,
  Design,
  DesignStyle,
  ViewMode,
  TimeOfDay,
  Asset,
  Item,
  CATALOG,
  CATEGORIES,
  HOMES,
  STYLES,
  TIERS,
  initialDesign,
  floorsFor,
  assetFor,
} from '@/lib/world';
import {
  loadDesign,
  saveDesign,
  customAssets,
  modelBlob,
  saveModel,
  inspectGLB,
  modelId,
  download,
  exportProject,
  importProject,
} from '@/lib/storage';
import Image from 'next/image';
import type { DwellEngine } from '@/lib/engine';

type Actions = {
  add: (a: Asset, t?: Partial<Item>) => string | null;
  modify: (c: Partial<Item>) => void;
  remove: () => void;
  rotate: () => void;
  duplicate: () => void;
  commit: (fn: (d: Design) => Design) => void;
  restoreHistory: (redo?: boolean) => void;
  notify: (s: string) => void;
};
type ModelTool = {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean };
  execute: (input: unknown) => unknown;
};
type ModelContext = {
  registerTool: (
    tool: ModelTool,
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};
type Diagnostic = {
  projectedItems: () => object[] | undefined;
  snapshot: () => object;
  catalog: () => Asset[];
  inspectInitialPlacement: () => object[];
};
const ICONS: Record<string, typeof Sofa> = {
  sofa: Sofa,
  heritage: Sofa,
  table: Table2,
  coffee: Table2,
  desk: Table2,
  chair: Armchair,
  stool: Armchair,
  bench: Armchair,
  sunbed: Armchair,
  bed: BedDouble,
  lamp: LampFloor,
  plant: Flower2,
  vase: Flower2,
  art: Frame,
  mirror: Frame,
  rug: Grid2X2,
  curtain: Layers3,
  bookshelf: BookOpen,
  bath: Bath,
  sink: Bath,
};
function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [local, setLocal] = useState(value);
  return (
    <label className="color-field">
      <span>{label}</span>
      <span className="color-control">
        <input
          aria-label={label}
          type="color"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => {
            if (local !== value) onChange(local);
          }}
        />
        <small>{local.toUpperCase()}</small>
      </span>
    </label>
  );
}
function Choice({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => {
        if (v !== null) onChange(v);
      }}
      items={options}
    >
      <SelectTrigger aria-label={label} className="choice">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem value={o.value} key={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function Studio({
  home,
  onExit,
}: {
  home: HomeId;
  onExit: () => void;
}) {
  const [design, setDesign] = useState<Design>(() => initialDesign(home)),
    [assets, setAssets] = useState<Asset[]>([]),
    [hydrated, setHydrated] = useState(false),
    [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [selected, setSelected] = useState<string | null>(null),
    [view, setView] = useState<ViewMode>('orbit'),
    [category, setCategory] = useState('全部'),
    [query, setQuery] = useState(''),
    [filterStyle, setFilterStyle] = useState('all'),
    [tier, setTier] = useState('all'),
    [leftTab, setLeftTab] = useState('furniture'),
    [saveStatus, setSaveStatus] = useState('正在读取作品'),
    [undoAvailable, setUndoAvailable] = useState(false),
    [redoAvailable, setRedoAvailable] = useState(false),
    [fps, setFps] = useState(0),
    [snap, setSnap] = useState(true),
    [labels, setLabels] = useState(false),
    [quality, setQuality] = useState('medium'),
    [toast, setToast] = useState(''),
    [dialog, setDialog] = useState<'model' | 'reset' | 'help' | null>(null),
    [busy, setBusy] = useState(''),
    [side, setSide] = useState<'both' | 'left' | 'right' | 'none'>('both'),
    [modelDraft, setModelDraft] = useState<{
      file: File;
      w: number;
      h: number;
      d: number;
      triangles: number;
      name: string;
    } | null>(null),
    [modelWidth, setModelWidth] = useState('1.5');
  const canvas = useRef<HTMLCanvasElement>(null),
    engine = useRef<DwellEngine | null>(null),
    designRef = useRef(design),
    assetsRef = useRef(assets),
    selectedRef = useRef(selected),
    history = useRef<{ undo: Design[]; redo: Design[] }>({
      undo: [],
      redo: [],
    }),
    toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    projectInput = useRef<HTMLInputElement>(null),
    actions = useRef<Actions>({} as Actions);
  useLayoutEffect(() => {
    designRef.current = design;
    assetsRef.current = assets;
    selectedRef.current = selected;
  });
  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 5500);
  }, []);
  const commit = useCallback((fn: (d: Design) => Design) => {
    const current = designRef.current,
      next = { ...fn(current), updated: Date.now() };
    history.current.undo.push(structuredClone(current));
    if (history.current.undo.length > 50) history.current.undo.shift();
    history.current.redo = [];
    designRef.current = next;
    setDesign(next);
    setUndoAvailable(true);
    setRedoAvailable(false);
    setSaveStatus('等待保存');
  }, []);
  const restoreHistory = (redo = false) => {
    const h = history.current,
      from = redo ? h.redo : h.undo,
      to = redo ? h.undo : h.redo;
    if (!from.length) return;
    to.push(structuredClone(designRef.current));
    const next = from.pop()!;
    designRef.current = next;
    setDesign(next);
    setUndoAvailable(!!h.undo.length);
    setRedoAvailable(!!h.redo.length);
    setSaveStatus('等待保存');
    setSelected(null);
    engine.current?.select(null, false);
  };

  const add = (a: Asset, template: Partial<Item> = {}) => {
    if (!engine.current || !ready) return null;
    if (designRef.current.items.length >= 500) {
      notify('当前作品已达500件，请先移除部分家具。');
      return null;
    }
    engine.current.custom = assetsRef.current;
    const item = engine.current.findPlacement(a, template);
    if (!item) {
      notify('附近没有足够空间，请先移动视角或整理家具。');
      return null;
    }
    commit((d) => ({ ...d, items: [...d.items, item] }));
    setSelected(item.id);
    notify('已添加 ' + a.name + '，拖动即可摆放');
    return item.id;
  };
  const modify = (changes: Partial<Item>) => {
    const id = selectedRef.current,
      item = designRef.current.items.find((i) => i.id === id);
    if (!item) return;
    const next = { ...item, ...changes };
    if (!engine.current?.canPlace(next)) {
      notify('这个位置会与墙体或家具重叠。');
      return;
    }
    commit((d) => ({
      ...d,
      items: d.items.map((i) => (i.id === id ? next : i)),
    }));
  };
  const remove = () => {
    const id = selectedRef.current;
    if (!id) return;
    commit((d) => ({ ...d, items: d.items.filter((i) => i.id !== id) }));
    setSelected(null);
    engine.current?.select(null, false);
    notify('已移除家具，可撤销恢复');
  };
  const rotate = () => {
    const item = designRef.current.items.find(
      (i) => i.id === selectedRef.current,
    );
    if (item) modify({ rotation: item.rotation + Math.PI / 4 });
  };
  const duplicate = () => {
    const item = designRef.current.items.find(
        (i) => i.id === selectedRef.current,
      ),
      a = item && assetFor(item.assetId, assetsRef.current);
    if (item && a)
      add(a, {
        rotation: item.rotation,
        scale: item.scale,
        y: item.y,
        color: item.color,
      });
  };
  useLayoutEffect(() => {
    actions.current = {
      add,
      modify,
      remove,
      rotate,
      duplicate,
      commit,
      restoreHistory,
      notify,
    };
  });
  useEffect(() => {
    let active = true;
    void Promise.all([loadDesign(home), customAssets()])
      .then(([saved, list]) => {
        if (active) {
          setAssets(list);
          if (saved) setDesign(saved);
          setSaveStatus(saved ? '已恢复本机作品' : '准备好开始创作');
          setHydrated(true);
        }
      })
      .catch(() => {
        if (active) {
          setSaveStatus('存储不可用，请导出备份');
          setHydrated(true);
        }
      });
    return () => {
      active = false;
    };
  }, [home]);
  useEffect(() => {
    if (!hydrated || !canvas.current) return;
    let cancelled = false;
    void import('@/lib/engine')
      .then(({ DwellEngine }) => {
        if (cancelled || !canvas.current) return;
        const instance = new DwellEngine(canvas.current, designRef.current, {
          select: setSelected,
          move: (id, x, z) =>
            actions.current.commit((d: Design) => ({
              ...d,
              items: d.items.map((i) => (i.id === id ? { ...i, x, z } : i)),
            })),
          notify,
          fps: setFps,
          ready: () => {
            if (!cancelled) setReady(true);
          },
          loadModel: modelBlob,
          view: setView,
          vrAction: (action) => {
            if (action === 'rotate') actions.current.rotate();
            if (action === 'duplicate') actions.current.duplicate();
            if (action === 'delete') actions.current.remove();
            if (action === 'add-chair')
              actions.current.add(
                CATALOG.find(
                  (a) =>
                    a.kind === 'chair' &&
                    a.style === designRef.current.style &&
                    a.tier === 0,
                )!,
              );
          },
        });
        engine.current = instance;
        instance.setDesign(designRef.current, assetsRef.current);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '3D场景加载失败');
        }
      });
    return () => {
      cancelled = true;
      engine.current?.dispose();
      engine.current = null;
    };
  }, [hydrated, notify]);
  useEffect(() => {
    engine.current?.setDesign(design, assets);
  }, [design, assets]);
  useEffect(() => {
    if (ready && !engine.current?.xrActive) engine.current?.setMode(view);
  }, [view, ready]);
  useEffect(() => {
    if (ready) {
      engine.current?.resetCamera();
      engine.current?.updateVisibility();
    }
  }, [design.floor, ready]);
  useEffect(() => {
    if (ready) engine.current?.select(selected, false);
  }, [selected, ready, design]);
  useEffect(() => {
    if (!hydrated || !ready) return;
    const timer = setTimeout(() => {
      setSaveStatus('保存中');
      void saveDesign(design)
        .then(() => setSaveStatus('已保存到此浏览器'))
        .catch(() => {
          setSaveStatus('保存失败');
          notify('本机存储空间不足或不可用，请导出作品备份。');
        });
    }, 3000);
    return () => clearTimeout(timer);
  }, [design, hydrated, ready, notify]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input,textarea,[contenteditable=true]') || dialog)
        return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        actions.current.restoreHistory(e.shiftKey);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        actions.current.duplicate();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        actions.current.remove();
      } else if (e.key.toLowerCase() === 'r' && selectedRef.current) {
        actions.current.rotate();
      } else if (e.key === 'Escape') {
        setView('orbit');
        setSelected(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dialog]);
  useEffect(() => {
    if (!ready) return;
    const context = (document as Document & { modelContext?: ModelContext })
      .modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: ModelTool) => {
      try {
        Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {}
    };
    register({
      name: 'dwellcraft_read_design',
      description:
        'Read the currently open home, selected furniture and item count.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: () => ({
        home: designRef.current.home,
        floor: designRef.current.floor,
        style: designRef.current.style,
        itemCount: designRef.current.items.length,
        selected: selectedRef.current,
      }),
    });
    register({
      name: 'dwellcraft_place_furniture',
      description:
        'Add one catalog furniture item to an available position in the current home. Changes the design.',
      inputSchema: {
        type: 'object',
        properties: { assetId: { type: 'string' } },
        required: ['assetId'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: async (input: unknown) => {
        const value = input as { assetId: string };
        if (!value || typeof value.assetId !== 'string')
          throw new Error('assetId required');
        const a = assetFor(value.assetId, assetsRef.current);
        if (!a) throw new Error('Unknown asset');
        const id = actions.current.add(a);
        if (!id) throw new Error('No space available');
        await new Promise<void>((r) =>
          requestAnimationFrame(() => requestAnimationFrame(() => r())),
        );
        return { id, itemCount: designRef.current.items.length };
      },
    });
    return () => lifecycle.abort();
  }, [ready]);
  useEffect(() => {
    if (!ready) return;
    (window as Window & { __dwellcraft?: Diagnostic }).__dwellcraft = {
      projectedItems: () => engine.current?.projectedItems(),
      snapshot: () => ({
        home: designRef.current.home,
        style: designRef.current.style,
        floor: designRef.current.floor,
        items: designRef.current.items,
        selected: selectedRef.current,
        meshCount: engine.current?.scene.meshes.length,
        fps: engine.current?.engine.getFps(),
        camera: engine.current?.mode,
      }),
      catalog: () => CATALOG,
      inspectInitialPlacement: () =>
        designRef.current.items
          .filter((i) => !engine.current?.canPlace(i))
          .map((i) => ({ id: i.id, asset: i.assetId, x: i.x, z: i.z })),
    };
    return () => {
      delete (window as Window & { __dwellcraft?: Diagnostic }).__dwellcraft;
    };
  }, [ready]);
  const pickStyle = (style: DesignStyle) =>
    commit((d) => ({
      ...d,
      style,
      wallColor: STYLES[style].wall,
      floorColor: STYLES[style].floor,
      items: d.items.map((i) => {
        const a = assetFor(i.assetId);
        return a && i.assetId.includes('-') && !a.custom
          ? { ...i, assetId: `${a.kind}-${style}-${a.tier}` }
          : i;
      }),
    }));
  const saveNow = async () => {
    try {
      await saveDesign(designRef.current);
      setSaveStatus('已保存到此浏览器');
      notify('作品已保存');
      return true;
    } catch {
      notify('本机保存失败，请导出作品备份。');
      return false;
    }
  };
  const exportNow = async () => {
    setBusy('正在打包作品');
    try {
      const blob = await exportProject(designRef.current, assetsRef.current);
      download(
        blob,
        `Dwellcraft-${home}-${new Date().toISOString().slice(0, 10)}.home.zip`,
      );
      notify('作品包已导出，包含使用中的自定义模型');
    } catch (e) {
      notify(e instanceof Error ? e.message : '导出失败');
    } finally {
      setBusy('');
    }
  };
  const importNow = async (file: File) => {
    setBusy('正在读取作品');
    try {
      const result = await importProject(file, home);
      if (result.design.home !== home)
        throw new Error('请先进入作品对应的住宅，再导入此作品。');
      const merged = [
        ...assetsRef.current.filter(
          (a) => !result.assets.some((b) => b.id === a.id),
        ),
        ...result.assets,
      ];
      setAssets(merged);
      commit(() => result.design);
      setSelected(null);
      notify('作品已导入');
    } catch (e) {
      notify(e instanceof Error ? e.message : '无法导入作品');
    } finally {
      setBusy('');
    }
  };
  const chooseModel = async (file: File) => {
    setBusy('正在检查模型');
    setModelDraft(null);
    try {
      const info = await inspectGLB(file);
      const size = await engine.current!.measureModel(file);
      setModelDraft({
        file,
        ...size,
        triangles: info.triangles,
        name: file.name.replace(/\.glb$/i, '').slice(0, 60),
      });
      setModelWidth(Math.min(8, Math.max(0.05, size.w)).toFixed(2));
    } catch (e) {
      notify(e instanceof Error ? e.message : '无法导入模型');
    } finally {
      setBusy('');
    }
  };
  const confirmModel = async () => {
    if (!modelDraft) return;
    const w = Number(modelWidth);
    if (!Number.isFinite(w) || w < 0.05 || w > 10) {
      notify('请填写0.05到10米之间的宽度。');
      return;
    }
    setBusy('正在保存模型');
    try {
      const id = await modelId(modelDraft.file),
        ratio = w / modelDraft.w,
        a: Asset = {
          id,
          name: modelDraft.name || '我的模型',
          kind: 'custom',
          custom: true,
          style: design.style,
          tier: 0,
          w,
          d: modelDraft.d * ratio,
          h: modelDraft.h * ratio,
          category: '我的模型',
        };
      if (a.h > 20 || a.d > 20) throw new Error('模型尺寸过大，请减小宽度。');
      await saveModel(a, modelDraft.file);
      const all = [...assetsRef.current.filter((x) => x.id !== id), a];
      assetsRef.current = all;
      setAssets(all);
      engine.current!.custom = all;
      setCategory('我的模型');
      setFilterStyle('all');
      setTier('all');
      setQuery('');
      setDialog(null);
      setModelDraft(null);
      add(a);
      notify('模型已加入“我的模型”');
    } catch (e) {
      notify(e instanceof Error ? e.message : '模型保存失败');
    } finally {
      setBusy('');
    }
  };
  const item = design.items.find((i) => i.id === selected),
    selectedAsset = item ? assetFor(item.assetId, assets) : undefined,
    currentHome = HOMES.find((h) => h.id === home)!,
    floor = floorsFor(home)[design.floor],
    library = [...CATALOG, ...assets].filter(
      (a) =>
        (category === '全部' || a.category === category) &&
        (filterStyle === 'all' || a.style === filterStyle) &&
        (tier === 'all' || a.tier === Number(tier)) &&
        a.name.includes(query),
    );
  const floors = floorsFor(home),
    showLeft = side === 'both' || side === 'left',
    showRight = side === 'both' || side === 'right';
  return (
    <main
      className={
        'studio ' +
        (!showLeft ? 'hide-left ' : '') +
        (!showRight ? 'hide-right' : '')
      }
    >
      <header className="studio-header">
        <div className="studio-brand">
          <Button
            variant="ghost"
            size="icon"
            aria-label="返回选房"
            onClick={async () => {
              if (await saveNow()) onExit();
            }}
          >
            <ArrowLeft size={18} />
          </Button>
          <span className="brand">
            <Box size={22} />
            <b>Dwellcraft</b>
          </span>
        </div>
        <div className="project-name">
          <span>{currentHome.name}</span>
          <small>
            {currentHome.area}㎡{home === 'estate' ? ' 庄园' : ''}
          </small>
          <ChevronDown size={14} />
        </div>
        <div className="header-actions">
          <Button
            variant="ghost"
            size="icon"
            aria-label="撤销"
            title="撤销 ⌘Z"
            disabled={!undoAvailable}
            onClick={() => restoreHistory()}
          >
            <Undo2 />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="重做"
            disabled={!redoAvailable}
            onClick={() => restoreHistory(true)}
          >
            <Redo2 />
          </Button>
          <span className="header-separator" />
          <Button variant="ghost" onClick={() => setDialog('help')}>
            <Info size={16} />
            <span className="wide-label">操作指南</span>
          </Button>
          <Button
            variant="outline"
            onClick={exportNow}
            disabled={!!busy || !ready}
          >
            <Download size={16} />
            <span className="wide-label">导出作品</span>
          </Button>
          <Button className="save-button" onClick={saveNow} disabled={!ready}>
            <Save size={15} />
            保存
          </Button>
        </div>
      </header>
      <aside className="library-panel">
        <Tabs value={leftTab} onValueChange={(v) => setLeftTab(String(v))}>
          <TabsList variant="line" className="library-tabs">
            <TabsTrigger value="furniture">
              <Sofa />
              家具库
            </TabsTrigger>
            <TabsTrigger value="rooms">
              <HomeIcon />
              空间
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {leftTab === 'furniture' ? (
          <>
            <div className="library-search">
              <Search size={16} />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="寻找一件心仪的家具"
                aria-label="搜索家具"
              />
            </div>
            <div className="library-filters">
              <Choice
                label="家具风格"
                value={filterStyle}
                onChange={setFilterStyle}
                options={[
                  { value: 'all', label: '所有风格' },
                  ...Object.entries(STYLES).map(([value, s]) => ({
                    value,
                    label: s.name,
                  })),
                ]}
              />
              <Choice
                label="家具等级"
                value={tier}
                onChange={setTier}
                options={[
                  { value: 'all', label: '所有等级' },
                  ...TIERS.map((label, i) => ({ value: String(i), label })),
                ]}
              />
            </div>
            <div className="categories">
              {CATEGORIES.map((c) => (
                <button
                  className={category === c ? 'active' : ''}
                  onClick={() => setCategory(c)}
                  key={c}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="library-caption">
              <span>{category}家具</span>
              <small>{library.length} 件可用</small>
            </div>
            <div className="asset-grid">
              {library.map((a) => {
                const Icon = ICONS[a.kind] || Package;
                return (
                  <button
                    className="asset-card"
                    key={a.id}
                    disabled={!ready || view === 'walk'}
                    onClick={() => add(a)}
                    aria-label={
                      '添加' +
                      a.name +
                      ' ' +
                      STYLES[a.style].name +
                      ' ' +
                      TIERS[a.tier]
                    }
                  >
                    <div className={'asset-preview ' + a.style}>
                      <Icon size={42} strokeWidth={1.1} />
                      <span className="add-dot">
                        <Plus size={13} />
                      </span>
                      {a.custom && <small>GLB</small>}
                    </div>
                    <strong>{a.name}</strong>
                    <span>
                      {a.w.toFixed(1)} × {a.d.toFixed(1)} m{' '}
                      <i>{a.custom ? '自带' : TIERS[a.tier]}</i>
                    </span>
                  </button>
                );
              })}
              {!library.length && (
                <div className="empty-library">
                  <Package />
                  <p>还没有匹配的家具</p>
                  <small>换个分类，或导入自己的模型。</small>
                </div>
              )}
            </div>
            <div className="library-bottom">
              <Button
                variant="outline"
                className="import-model"
                disabled={!ready}
                onClick={() => setDialog('model')}
              >
                <Upload size={16} />
                导入我的模型<span>GLB</span>
              </Button>
              <p>家具全部开放，随心搭配。</p>
            </div>
          </>
        ) : (
          <div className="room-list">
            <p className="panel-note">选一个房间，靠近看看。</p>
            {floor.rooms
              .filter((r) => r.kind !== 'circulation')
              .map((r) => (
                <button
                  key={r.id}
                  onClick={() => engine.current?.focusRoom(r.id)}
                >
                  <HomeIcon size={18} />
                  <span>
                    {r.name}
                    <small>
                      {r.w.toFixed(1)} × {r.h.toFixed(1)} m
                    </small>
                  </span>
                  <ChevronDown size={14} />
                </button>
              ))}
            <Button variant="outline" onClick={() => setDialog('reset')}>
              重新布置这个家
            </Button>
          </div>
        )}
      </aside>
      <section className="viewport">
        <canvas
          ref={canvas}
          aria-label="Dwellcraft 交互式3D住宅场景"
          tabIndex={0}
        />
        <div className="view-top">
          <div className="view-switch">
            <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
              <TabsList>
                <TabsTrigger value="orbit">
                  <Box size={15} />
                  3D视角
                </TabsTrigger>
                <TabsTrigger value="top">
                  <Grid2X2 size={15} />
                  俯视
                </TabsTrigger>
                <TabsTrigger value="walk">
                  <Footprints size={15} />
                  漫游
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="view-right-controls">
            {floors.length > 1 && (
              <div className="floor-buttons">
                {floors.map((f, i) => (
                  <button
                    key={f.id}
                    onClick={() => {
                      commit((d) => ({ ...d, floor: i }));
                      setSelected(null);
                    }}
                    className={i === design.floor ? 'active' : ''}
                  >
                    {i + 1}F
                  </button>
                ))}
              </div>
            )}
            <Button
              variant="outline"
              className="vr-button"
              disabled={!ready}
              onClick={() => void engine.current?.enterVR()}
            >
              <Glasses size={17} />
              进入VR
            </Button>
          </div>
        </div>
        <div className="scene-caption">
          <span className="tiny-overline">{currentHome.tag}</span>
          <strong>{currentHome.name}</strong>
          <span>
            <i />
            {STYLES[design.style].name} ·{' '}
            {view === 'walk' ? '沉浸漫游' : '自由布置'}
          </span>
        </div>
        <div className="camera-tools">
          <Button
            variant="outline"
            size="icon"
            aria-label="放大"
            onClick={() => engine.current?.zoom(-2)}
          >
            <Plus />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="缩小"
            onClick={() => engine.current?.zoom(2)}
          >
            <Minus />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="重置视角"
            onClick={() => engine.current?.resetCamera()}
          >
            <Maximize2 />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="保存场景截图"
            onClick={() => {
              const url = engine.current?.screenshot();
              if (url) {
                const a = document.createElement('a');
                a.href = url;
                a.download = `Dwellcraft-${home}.png`;
                a.click();
                notify('已保存场景截图');
              }
            }}
          >
            <Camera />
          </Button>
        </div>
        {selected && view !== 'walk' && (
          <div className="selection-toolbar">
            <span>{selectedAsset?.name}</span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="旋转家具"
              title="旋转 R"
              onClick={rotate}
            >
              <RotateCw />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="复制家具"
              onClick={duplicate}
            >
              <Copy />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="删除家具"
              onClick={remove}
            >
              <Trash2 />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="取消选择"
              onClick={() => setSelected(null)}
            >
              <X />
            </Button>
          </div>
        )}
        <div className="viewport-bottom">
          <div className="input-hint">
            {view === 'walk' ? (
              <>
                <Footprints size={14} />
                <span>W A S D 移动 · 点击画面转向 · Esc 返回</span>
              </>
            ) : (
              <>
                <MousePointer2 size={14} />
                <span>拖动家具摆放 · 空白处旋转 · 滚轮缩放</span>
              </>
            )}
          </div>
          <div className="panel-toggles">
            <button
              aria-label="切换家具栏"
              onClick={() =>
                setSide(
                  showLeft
                    ? showRight
                      ? 'right'
                      : 'none'
                    : showRight
                      ? 'both'
                      : 'left',
                )
              }
            >
              <PanelLeftClose size={17} />
            </button>
            <button
              aria-label="切换属性栏"
              onClick={() =>
                setSide(
                  showRight
                    ? showLeft
                      ? 'left'
                      : 'none'
                    : showLeft
                      ? 'both'
                      : 'right',
                )
              }
            >
              <PanelRightClose size={17} />
            </button>
          </div>
        </div>
        {(!ready || error) && (
          <div className="scene-loading">
            {error ? (
              <>
                <Info />
                <h3>暂时无法打开3D场景</h3>
                <p>{error}</p>
                <Button onClick={() => window.location.reload()}>
                  重新加载
                </Button>
              </>
            ) : (
              <>
                <div className="loading-mark">
                  <Box size={32} />
                </div>
                <h3>正在为你打开这个家</h3>
                <p>准备材质、光线与家具</p>
                <span className="loading-line" />
              </>
            )}
          </div>
        )}
        {toast && (
          <output className="toast">
            <Check size={15} />
            {toast}
          </output>
        )}
        {busy && (
          <output className="busy-note">
            <LoaderCircle className="spin" size={17} />
            {busy}
          </output>
        )}
      </section>
      <aside className="properties-panel">
        <div className="panel-title">
          <span>{item ? '家具属性' : '空间氛围'}</span>
          {item ? <Move size={17} /> : <Paintbrush size={17} />}
        </div>
        {item && selectedAsset ? (
          <>
            <div className="selected-preview">
              <div className={'asset-preview ' + selectedAsset.style}>
                {(() => {
                  const Icon = ICONS[selectedAsset.kind] || Package;
                  return <Icon size={52} strokeWidth={1} />;
                })()}
              </div>
              <h3>{selectedAsset.name}</h3>
              <p>
                {selectedAsset.custom
                  ? '我的模型'
                  : STYLES[selectedAsset.style].name +
                    ' / ' +
                    TIERS[selectedAsset.tier]}
              </p>
            </div>
            <section className="property-group">
              <h4>
                位置 <small>米</small>
              </h4>
              <div className="position-inputs">
                {(['x', 'z', 'y'] as const).map((key, i) => (
                  <label key={key}>
                    <span>{['X', 'Z', '高度'][i]}</span>
                    <Input
                      aria-label={'家具' + key + '坐标'}
                      key={item.id + ':' + key + ':' + item[key]}
                      type="number"
                      step="0.1"
                      defaultValue={item[key].toFixed(2)}
                      onBlur={(e) => {
                        const value = Number(e.target.value);
                        if (Number.isFinite(value) && value !== item[key])
                          modify({ [key]: value });
                      }}
                    />
                  </label>
                ))}
              </div>
              <div className="rotation-label">
                <span>旋转</span>
                <strong>
                  {Math.round(
                    ((((item.rotation * 180) / Math.PI) % 360) + 360) % 360,
                  )}
                  °
                </strong>
              </div>
              <Slider
                key={item.id + ':' + item.rotation}
                aria-label="旋转角度"
                min={0}
                max={360}
                step={15}
                defaultValue={
                  ((((item.rotation * 180) / Math.PI) % 360) + 360) % 360
                }
                onValueCommitted={(v) =>
                  modify({ rotation: (Number(v) * Math.PI) / 180 })
                }
              />
              {(['rug', 'vase', 'plant', 'art'].includes(selectedAsset.kind) ||
                selectedAsset.custom) && (
                <div className="scale-field">
                  <label htmlFor="furniture-scale">等比缩放</label>
                  <Input
                    id="furniture-scale"
                    aria-label="家具缩放比例"
                    type="number"
                    min="0.1"
                    max="3"
                    step="0.1"
                    key={item.id + ':' + item.scale}
                    defaultValue={item.scale}
                    onBlur={(e) => {
                      const n = Number(e.target.value);
                      if (n >= 0.1 && n <= 3) modify({ scale: n });
                    }}
                  />
                </div>
              )}
            </section>
            {!selectedAsset.custom && selectedAsset.kind !== 'heritage' && (
              <section className="property-group">
                <h4>材质颜色</h4>
                <ColorField
                  key={item.id + item.color}
                  label="主色"
                  value={item.color || STYLES[selectedAsset.style].fabric}
                  onChange={(color) =>
                    commit((d) => ({
                      ...d,
                      items: d.items.map((i) =>
                        i.id === item.id ? { ...i, color } : i,
                      ),
                    }))
                  }
                />
              </section>
            )}
            <div className="property-actions">
              <Button variant="outline" onClick={duplicate}>
                <Copy />
                复制家具
              </Button>
              <Button
                variant="ghost"
                className="delete-button"
                onClick={remove}
              >
                <Trash2 />
                移除家具
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="style-reference">
              <Image
                unoptimized
                width={1600}
                height={1000}
                src={'/concepts/' + currentHome.image}
                alt={currentHome.name + '风格参考'}
              />
              <span>风格参考</span>
            </div>
            <section className="property-group">
              <h4>装修风格</h4>
              <div className="style-options">
                {Object.entries(STYLES).map(([key, s]) => (
                  <button
                    key={key}
                    onClick={() => pickStyle(key as DesignStyle)}
                    className={design.style === key ? 'active' : ''}
                  >
                    <span style={{ background: s.fabric }} />
                    <span>{s.name}</span>
                    {design.style === key && <Check size={13} />}
                  </button>
                ))}
              </div>
            </section>
            <section className="property-group">
              <h4>一天的光线</h4>
              <Tabs
                value={design.time}
                onValueChange={(v) =>
                  commit((d) => ({ ...d, time: v as TimeOfDay }))
                }
              >
                <TabsList className="time-tabs">
                  <TabsTrigger value="day" aria-label="白天">
                    <Sun size={17} />
                    <small>白天</small>
                  </TabsTrigger>
                  <TabsTrigger value="sunset" aria-label="黄昏">
                    <Sunset size={17} />
                    <small>黄昏</small>
                  </TabsTrigger>
                  <TabsTrigger value="night" aria-label="夜晚">
                    <Moon size={17} />
                    <small>夜晚</small>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </section>
            <section className="property-group">
              <h4>墙面与地板</h4>
              <ColorField
                key={design.wallColor}
                label="墙面"
                value={design.wallColor}
                onChange={(wallColor) => commit((d) => ({ ...d, wallColor }))}
              />
              <ColorField
                key={design.floorColor}
                label="地板"
                value={design.floorColor}
                onChange={(floorColor) => commit((d) => ({ ...d, floorColor }))}
              />
            </section>
          </>
        )}
        <section className="property-group settings">
          <h4>工作台设置</h4>
          <label htmlFor="snap-toggle">
            <span>
              网格吸附 <small>0.1m</small>
            </span>
            <Switch
              id="snap-toggle"
              checked={snap}
              onCheckedChange={(v) => {
                setSnap(v);
                if (engine.current) engine.current.snap = v;
              }}
              aria-label="网格吸附"
            />
          </label>
          <label htmlFor="labels-toggle">
            <span>房间名称</span>
            <Switch
              id="labels-toggle"
              checked={labels}
              onCheckedChange={(v) => {
                setLabels(v);
                if (engine.current) {
                  engine.current.showLabels = v;
                  engine.current.updateVisibility();
                }
              }}
              aria-label="房间名称"
            />
          </label>
          <div className="quality-row">
            <span>画质</span>
            <Choice
              label="画质"
              value={quality}
              onChange={(v) => {
                setQuality(v);
                engine.current?.setQuality(v);
              }}
              options={[
                { value: 'low', label: '流畅' },
                { value: 'medium', label: '均衡' },
                { value: 'high', label: '精细' },
              ]}
            />
          </div>
        </section>
        <div className="project-import">
          <Button
            variant="ghost"
            onClick={() => projectInput.current?.click()}
            disabled={!!busy}
          >
            <FolderOpen size={16} />
            导入作品包
          </Button>
          <input
            ref={projectInput}
            type="file"
            accept=".zip"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importNow(file);
              e.currentTarget.value = '';
            }}
          />
          <p>
            作品只保存在此浏览器。
            <br />
            导出一份，带去下一台设备。
          </p>
        </div>
      </aside>
      <footer className="studio-status">
        <span>
          <i />
          {saveStatus}
        </span>
        <span>
          {design.items.filter((i) => i.floor === design.floor).length} 件家具
          <span className="status-divider">/</span>
          {design.floor + 1}F<span className="status-divider">/</span>
          {fps} FPS
        </span>
        <span>DWELLCRAFT · BUILD A HOME. MAKE IT YOURS.</span>
      </footer>
      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <DialogContent className="studio-dialog">
          <DialogTitle>
            {dialog === 'model'
              ? '把喜欢的家具，带进来'
              : dialog === 'reset'
                ? '重新布置这个家'
                : '让灵感，自由落地'}
          </DialogTitle>
          <DialogDescription>
            {dialog === 'model'
              ? '导入自包含GLB文件，模型保存在你的浏览器中。'
              : dialog === 'reset'
                ? '选择空房重新开始，或恢复当前风格的样板间。此操作可以撤销。'
                : '你可以在3D视角布置家具，或走进房间感受实际尺度。'}
          </DialogDescription>
          {dialog === 'model' && (
            <div className="model-dialog">
              <label className="model-drop">
                <Upload size={30} />
                <strong>选择 GLB 模型</strong>
                <span>≤ 50MB · ≤ 20万三角面 · 内嵌贴图</span>
                <input
                  type="file"
                  accept=".glb"
                  disabled={!!busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void chooseModel(f);
                  }}
                />
              </label>
              {modelDraft && (
                <div className="model-fields">
                  <label htmlFor="model-name">
                    家具名称
                    <Input
                      id="model-name"
                      value={modelDraft.name}
                      onChange={(e) =>
                        setModelDraft({
                          ...modelDraft,
                          name: e.target.value.slice(0, 60),
                        })
                      }
                    />
                  </label>
                  <label htmlFor="model-width">
                    实际宽度（米）
                    <Input
                      id="model-width"
                      type="number"
                      value={modelWidth}
                      step="0.1"
                      onChange={(e) => setModelWidth(e.target.value)}
                    />
                  </label>
                  <p>
                    {modelDraft.triangles.toLocaleString()} 个三角面 ·{' '}
                    {(modelDraft.file.size / 1024 / 1024).toFixed(1)} MB
                  </p>
                  <Button disabled={!!busy} onClick={confirmModel}>
                    加入我的模型 <Plus size={17} />
                  </Button>
                </div>
              )}
            </div>
          )}
          {dialog === 'reset' && (
            <div className="reset-options">
              <Button
                variant="outline"
                onClick={() => {
                  commit(() => initialDesign(home, true));
                  setSelected(null);
                  setDialog(null);
                  notify('已切换为空房，可以撤销恢复');
                }}
              >
                <Box />
                从空房开始
              </Button>
              <Button
                onClick={() => {
                  commit(() => initialDesign(home));
                  setSelected(null);
                  setDialog(null);
                  notify('已恢复样板间');
                }}
              >
                <Sofa />
                恢复样板间
              </Button>
            </div>
          )}
          {dialog === 'help' && (
            <div className="help-grid">
              {[
                ['旋转视角', '在空白处按住鼠标左键拖动'],
                ['摆放家具', '点家具库添加，然后拖动摆放'],
                ['旋转 / 复制', 'R 旋转 · ⌘ / Ctrl + D 复制'],
                ['撤销 / 重做', '⌘ / Ctrl + Z · 加 Shift 重做'],
                ['走进房间', '切换漫游，WASD移动，点击画面转向'],
                ['退出漫游', '按 Esc 返回3D视角'],
                ['VR参观', '使用 Quest 浏览器打开网站并进入VR'],
                ['带走作品', '导出作品包，再到另一台设备导入'],
              ].map(([a, b]) => (
                <div key={a}>
                  <strong>{a}</strong>
                  <p>{b}</p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
