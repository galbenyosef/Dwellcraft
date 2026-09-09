# Dwellcraft · 住进想象

一个可在浏览器里运行的 3D 家装游戏原型。当前版本为 **0.1.0 / 首个可体验版本**，包含选房、装修工作台、家具编辑、本机存档与模型导入。完整产品路线见 `docs/scene-design/development-plan.md`；实际完成状态见 `docs/DEVELOPMENT.md`。

## 启动

需要 Node.js 22.13 或更高版本。

```sh
npm install
npm run dev
```

打开终端显示的本机网址。默认端口 3000 被占用时会自动换端口。

```sh
npm test           # 户型、门洞、碰撞、存档格式与 GLB 校验
npm run typecheck  # TypeScript
npm run lint       # 项目代码检查，原始 shadcn 模板组件单独保留
npm run build     # 正式构建
npm start         # 运行构建后的 Worker
```

## 目前可以体验

- 100㎡三室两厅、200㎡四室两厅、4000㎡庄园。庄园的4000㎡是总占地，别墅两层各500㎡。
- 72款内置家具：54款由3种风格 × 3个等级 × 6类家具组成，另有18款配套物件。
- 添加、拖动、旋转、复制、删除、属性调整、0.1m吸附、碰撞检查和50步撤销/重做。
- 3D环绕、俯视、第一人称漫游、别墅楼层切换、房间聚焦。
- 奶油风、小清新、奢华风；木饰面、布艺、石材、窗帘、室内补光与接触阴影，支持墙面/地板颜色和白天/黄昏/夜晚光照。
- 3个本机作品槽（每户型一个）、3秒延迟自动保存、手动保存、含模型的 `.home.zip` 导入/导出。
- 自包含GLB导入，识别尺寸、设置宽度、保存到我的模型库。文件≤50MB、≤20万三角面、贴图≤4096px，不加载外部引用。
- WebXR VR入口、传送和基础家具操作代码。**尚未完成Quest真机验收。**

## 操作

从家具库把卡片直接拖进3D/俯视布局，绿色可放、红色表示冲突，也可点击添加；拖动已放置家具移动，拖动空白处旋转视角，滚轮缩放。R旋转、⌘/Ctrl+D复制、Delete删除、⌘/Ctrl+Z撤销。漫游采用1.6m眼高，WASD沿地面移动，点击画面后用鼠标转向，Esc返回。自定义模型和作品只保存在当前浏览器，换设备前请导出作品包。

## 项目结构

- `app/`：选房页面、布局与样式
- `components/studio.tsx`：装修工作台与编辑状态
- `lib/world.ts`：场景和家具数据
- `lib/scene-design.json`：已审查的户型与门洞设计
- `lib/engine.ts`、`lib/furniture.ts`：Babylon.js场景、材质、家具与XR
- `lib/placement.ts`：有向包围盒碰撞检查
- `lib/storage.ts`：本机保存、GLB校验与作品包
- `public/assets/`：可离线随项目部署的模型、材质和环境光
- `docs/scene-design/`：原始开发计划、三个场景设计、效果参考与审查记录
- `tests/`：自动化测试

当前使用 React + TypeScript + Babylon.js + IndexedDB，站点构建采用 Sites / vinext。无登录服务，无用户模型云端上传。依赖已锁定；纹理与扫描模型来源见 `docs/ASSETS.md`。
