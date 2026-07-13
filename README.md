# LightRAW

LightRAW 是一款面向 macOS 和 Windows 的轻量级、非破坏性 RAW 照片编辑器。当前仓库已完成五个 MVP 阶段：从实时调色与局部蒙版，到持久化图库、批量导入和 GPU 合成导出。

## 当前支持

- JPEG、PNG、TIFF
- HEIF、HEIC
- Canon CR2/CR3、Nikon NEF/NRW、Sony ARW、Fujifilm RAF、Panasonic RW2、OM/Olympus ORF、DNG
- 色温、色调、曝光、对比度、高光、阴影、白色色阶、黑色色阶
- 纹理、清晰度、去雾、自然饱和度、饱和度
- RGB 主曲线及红、绿、蓝分通道曲线
- 8 色 HSL、实时编辑后直方图、锐化和基础降噪
- 自由裁剪、常用比例、旋转、翻转和角度拉直
- 最多 8 个局部调整图层，每层支持独立基本调色、HSL、四通道曲线、不透明度，以及正常/正片叠底/滤色三种混合模式
- 每层可用线性、径向、画笔、钢笔、色度组件按添加/减去/相交组合最终蒙版
- 图层与子组件分级显隐、反相、编辑和删除，画布可显示最终蒙版覆盖
- 100 步撤销/重做、原图/编辑后切换、图层重排
- 保存、应用、导入和导出 JSON 调色预设；预设不包含照片专属的裁剪和旋转
- 持久化缩略图图库、文件名/导入时间/评分排序和 0–5 星评分
- JPEG、PNG、TIFF 单张或批量导出，支持长边、短边、百分比缩放、JPEG 质量和文字水印；输出为 sRGB
- `⌘/Ctrl+Z` 撤销、`⇧⌘/Ctrl+Z` 或 `Ctrl+Y` 重做、`⌘/Ctrl+O` 导入、`⌘/Ctrl+Shift+E` 导出
- `\` 前后对比、`G/D/R/M/P` 切换图库/调色/裁剪/蒙版/预设、`0–5` 评分；保留 `E/C/X` 作为调色/裁剪/导出兼容键
- 调色与 HSL 滑块支持扩展范围和 0.1 浮点步进，曝光与锐化半径支持 0.01 步进
- WebGL 2 实时预览
- 参考专业摄影软件工作流的三栏界面、底部胶片栏、可伸缩检查器，以及深色/灰色/浅色三种主题

RAW 兼容性最终取决于 LibRaw 对具体相机型号及记录格式的支持情况。

## macOS 运行

需要 Node.js、Rust、Xcode Command Line Tools 和 Homebrew：

```bash
brew install cmake pkg-config libraw libheif
npm ci
npm run tauri dev
```

生成可直接打开的开发版 `.app`：

```bash
npm run tauri -- build --debug --bundles app
open src-tauri/target/debug/bundle/macos/LightRAW.app
```

当前开发版 `.app` 会动态链接 Homebrew 安装的 LibRaw 和 libheif；发布给未安装这些库的电脑前，仍需完成依赖随包分发和签名公证。

## Windows 运行

安装 Node.js、Rust MSVC toolchain、Visual Studio 2022 C++ Build Tools、CMake 和 NASM，然后执行：

```powershell
cargo install cargo-vcpkg --version 0.1.7
cd src-tauri
cargo vcpkg build
cd ..
npm ci
npm run tauri dev
```

## 测试

```bash
npm run typecheck
npm run test:run
cargo test --manifest-path src-tauri/Cargo.toml
npm run build
```

使用本地真实照片检查解码时间：

```bash
LIGHTRAW_REAL_IMAGE=/path/to/photo.ARW \
  cargo test --manifest-path src-tauri/Cargo.toml \
  decode::tests::decodes_a_real_photo_within_the_interactive_budget \
  -- --ignored --nocapture
```

各阶段的详细边界与验收记录见 [docs/PHASE-1.md](docs/PHASE-1.md)、[docs/PHASE-2.md](docs/PHASE-2.md)、[docs/PHASE-3.md](docs/PHASE-3.md)、[docs/PHASE-4.md](docs/PHASE-4.md) 与 [docs/PHASE-5.md](docs/PHASE-5.md)。RapidRAW 参考改版的独立实现边界、体积预算和本地能力清单见 [docs/RAPIDRAW-PARITY.md](docs/RAPIDRAW-PARITY.md)。
