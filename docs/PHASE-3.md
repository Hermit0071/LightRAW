# LightRAW 阶段三规格与验收

## 交付边界

阶段三采用“调整图层 → 蒙版组件”的模型：

- 调整图层保存名称、显隐、不透明度，以及独立的基本调色、8 色 HSL 和 RGB / R / G / B 曲线。
- 线性渐变、径向渐变、画笔、钢笔路径和色度范围只是选区组件，不保存调色参数。
- 一个图层可用多个组件按“添加 / 减去 / 相交”合成最终蒙版；组件和整层蒙版均可反相。
- 新建一种选区工具时会创建一个新调整图层；在现有图层中添加工具只会创建子组件。
- 最多 8 个调整图层、每层最多 8 个选区组件。图层按列表顺序合成，重叠区域效果累积。
- AI 主体、天空和人物选择仍明确排除。

该结构依据 Lightroom 与 Capture One 的官方工作流重新校正，调研与领域映射见 [research/mask-layer-workflows.md](research/mask-layer-workflows.md)。

## 实现约束

- `DevelopRecipe` 版本 3 保存 `layers: AdjustmentLayer[]`，所有编辑均可 JSON 序列化。
- CPU 参考引擎先合成同一图层的最终覆盖，再且仅应用一次该层调整。
- GPU 使用每个调整图层一层 256×256 R8 最终蒙版纹理，并用单独的 RGBA16F 数组保存图层曲线。
- 组件几何变化才重建该层蒙版；曝光、HSL、曲线等参数变化不会重复栅格化选区。
- 色度范围在预览蒙版栅格化时从原始线性像素采样，可独立作为首个组件，也可与空间选区相交。
- 画笔使用分段包围盒栅格化，低流量的不同笔画会累积。
- 蒙版坐标保存为原图归一化坐标；画布交互通过裁剪、旋转、翻转和拉直的正反映射保持一致。
- 选中图层时，画布显示该层最终蒙版的红色覆盖；选中子组件时显示其可编辑几何控制柄。

## 本地运行和测试

```bash
npm run tauri dev
npm run typecheck
npm run test:run
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

生成 macOS 开发版应用：

```bash
npm run tauri -- build --debug --bundles app
open src-tauri/target/debug/bundle/macos/LightRAW.app
```

## 自动化验收

- 49 个前端单元测试通过。
- 覆盖图层与子组件所有权、Add / Subtract / Intersect、图层不透明度、组件与整层反相、五种选区、画笔流量累积、色度取样、栅格化缓存、局部 HSL / 曲线和几何坐标往返。
- TypeScript 类型检查和 Vite 生产构建通过。

## macOS 原生验收

- 开发版 `.app` 成功加载 2880×2880 的 HEIC，WebGL 2 图层 shader 在 WKWebView 中编译并持续渲染。
- 在同一调整图层中实际创建“添加：线性渐变”“减去：画笔”“相交：色度范围”三个子组件；面板始终只显示一套图层调整。
- 原生界面可区分删除图层与删除组件，并显示图层名称、不透明度、整层反相和组件参数。
- 三组件图层的预览反馈读数约 17–24 ms；此数字只表示本次 macOS 开发机构建，不代表 Windows 性能结论。

## 已知限制

- Windows 实机仍未验证。
- 256×256 蒙版纹理只用于实时预览；阶段五导出时会按输出尺寸重新栅格化。
- 钢笔工具是闭合多边形路径，不包含 Photoshop 级贝塞尔手柄。
- 画笔支持添加笔画和整体清除，暂不含单独橡皮擦；可用“减去 → 画笔”组件完成同类选区修正。
- 图层排序、混合模式和撤销/重做在阶段四实现；阶段三已建立可扩展的图层数据结构。
