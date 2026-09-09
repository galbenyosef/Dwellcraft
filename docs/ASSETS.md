# 资源与许可

## 本地部署的第三方资源

以下资源来自 Poly Haven，下载并随项目本地部署，使用 CC0。许可说明：https://polyhaven.com/license 。用户模型不依赖外部资源请求。

| 用途             | 来源                                         | 文件                                           |
| ---------------- | -------------------------------------------- | ---------------------------------------------- |
| 木地板颜色、法线 | https://polyhaven.com/a/wood_floor           | wood_floor_Diffuse.jpg / wood_floor_nor_gl.jpg |
| 布艺法线         | https://polyhaven.com/a/fabric_pattern_07    | fabric_pattern_07_nor_gl.jpg                   |
| 室内环境光       | https://polyhaven.com/a/brown_photostudio_02 | studio.hdr                                     |
| 复古沙发扫描模型 | https://polyhaven.com/a/sofa_03              | sofa-heritage.glb                              |

沙发由原始glTF、bin和内嵌贴图整理为GLB，几何来源未改变。其余家具由本项目使用几何体程序化建模。界面图标来自Lucide，遵循其ISC许可。UI基础组件来自shadcn/Base UI及对应开源许可。

## 本轮新增实时材质

同样使用 Poly Haven CC0 素材，文件位于 `public/assets/materials/`：

| 用途 | 来源 | 文件 |
| --- | --- | --- |
| 墙面微法线 | https://polyhaven.com/a/white_plaster_02 | white_plaster_02-normal.jpg |
| 家具和墙面木饰面 | https://polyhaven.com/a/oak_veneer_01 | oak_veneer_01-color.jpg |
| 奢华背景墙、厨卫石材 | https://polyhaven.com/a/marble_01 | marble_01-color.jpg |
| 室外铺地 | https://polyhaven.com/a/stone_tiles_02 | stone_tiles_02-color.jpg |
| 布艺表面明暗纹理 | https://polyhaven.com/a/fabric_pattern_07 | fabric-weave.jpg（原 AO 贴图） |

墙面颜色使用程序化细微颗粒，布艺保留用户风格色。天空渐变为程序生成。

## 概念效果图

`public/concepts/` 以及 `docs/scene-design/assets/` 中的三张图为此前设计阶段生成的概念参考，**不是当前实时渲染截图**。不要把参考图当作当前版本画质已达到的证据。

## 用户导入模型

当前实现仅保存在浏览器IndexedDB中，导出作品包时随用户作品打包。项目不收集或发布用户模型。
