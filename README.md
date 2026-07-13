# LightRAW

> A lightweight, GPU-accelerated and non-destructive RAW photo editor for macOS and Windows.
>
> RAW & HEIC support · local masking and adjustment layers · batch export · no cloud account required.

[English overview](#english-overview) · [Build from source](#macos-开发与编译) · [Contributing](CONTRIBUTING.md) · [Latest source release](https://github.com/Hermit0071/LightRAW/releases/latest)

LightRAW 是一款面向 macOS 和 Windows 的轻量级、非破坏性 RAW 照片编辑器。它聚焦摄影后期中最常用的图库管理、基础调色、HSL、曲线、蒙版、调整图层和批量导出，目标是提供一个容易安装、容易理解、也容易继续开发的 Lightroom“够用版”替代方案。

本仓库包含完整源代码、前后端依赖锁文件、Tauri 桌面配置、自动化测试和 macOS/Windows 构建说明。克隆或下载源码后，可按下文步骤在本地运行和编译。

## English overview

LightRAW is a cross-platform desktop RAW editor built for photographers who want a capable local workflow without a cloud account or destructive edits. It supports major camera RAW formats, JPEG/PNG/TIFF, HEIF/HEIC, real-time WebGL 2 preview, HSL and tone curves, masks, adjustment layers, presets, library file management, and batch JPEG/PNG/TIFF export.

Clone this repository and follow the macOS or Windows build instructions below. Feature requests and bug reports are welcome through the GitHub templates; see [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## 项目优点

- **轻量跨平台**：使用 Tauri，而不是把完整浏览器运行时打进安装包；同一套代码支持 macOS 和 Windows。
- **非破坏性编辑**：调整参数、蒙版和图层以编辑指令保存，不覆盖原始照片，导出时才合成最终图像。
- **实时预览**：主要调色管线由 WebGL 2 加速，拖动滑块时可接近实时查看结果。
- **覆盖高频工作流**：保留摄影爱好者常用的调色、HSL、曲线、裁剪、蒙版、图层、预设、历史记录和批量导出，主动控制功能复杂度。
- **本地优先**：图库和编辑数据保存在本机，不依赖账户、订阅或云端服务。
- **便于维护和扩展**：React UI、非破坏性编辑模型、渲染器和 Rust 本地能力相互分离；核心算法配有单元测试。

## 技术栈

- Tauri 2 + Rust：桌面壳、本地文件管理、解码和导出
- React 19 + TypeScript + Vite：界面与编辑状态
- WebGL 2：GPU 实时预览和图层合成
- LibRaw：主流相机 RAW 解码
- libheif：HEIF/HEIC 解码

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
- 图库支持在 Finder/Explorer 中定位、单个/批量重命名、复制到、移动到，以及“仅移出图库 / 移到系统废纸篓或回收站”两种删除方式
- JPEG、PNG、TIFF 单张或批量导出，支持长边、短边、百分比缩放、JPEG 质量和文字水印；输出为 sRGB
- `⌘/Ctrl+Z` 撤销、`⇧⌘/Ctrl+Z` 或 `Ctrl+Y` 重做、`⌘/Ctrl+O` 导入、`⌘/Ctrl+Shift+E` 导出
- `\` 前后对比、`G/D/R/M/P` 切换图库/调色/裁剪/蒙版/预设、`0–5` 评分；图库中可用 `F2` 重命名、`Delete/Backspace` 打开删除选择；保留 `E/C/X` 作为调色/裁剪/导出兼容键
- 调色与 HSL 滑块支持扩展范围和 0.1 浮点步进，曝光与锐化半径支持 0.01 步进
- WebGL 2 实时预览
- 中文 / English 界面一键切换，语言偏好保存在本机
- 参考专业摄影软件工作流的三栏界面、底部胶片栏、可伸缩检查器，以及深色/灰色/浅色三种主题

RAW 兼容性最终取决于 LibRaw 对具体相机型号及记录格式的支持情况。

## 如何使用

1. 打开 LightRAW，点击导入或按 `⌘/Ctrl+O`，选择照片或包含照片的文件夹。
2. 在图库中浏览、排序、评分或管理文件，双击照片进入调色工作区。
3. 使用基础调色、HSL、曲线、细节和裁剪工具完成全局调整。
4. 需要局部处理时，添加调整图层，并在线性、径向、画笔、钢笔或色度蒙版中选择合适方式。
5. 使用 `\` 对比原图，使用 `⌘/Ctrl+Z` 和重做快捷键检查调整过程。
6. 保存为预设，或导出单张/多张 JPEG、PNG、TIFF。

## 源码布局

- `src/editor`：非破坏性编辑指令与纯数据模型。
- `src/renderer`：CPU 参考算法、蒙版栅格化与 WebGL 预览渲染。
- `src/library`：图库记录、持久化序列化与缩略图处理。
- `src/bridge`：前端到 Tauri 本地命令的薄适配层。
- `src/ui`：React 工作区与交互界面。
- `src-tauri/src/catalog.rs`：图库文件和缩略图的原子持久化。
- `src-tauri/src/file_management.rs`：重命名、复制、移动、定位和系统废纸篓。
- `src-tauri/src/export_queue.rs`：导出请求队列与安全文件写入。
- `src-tauri/src/decode`：JPEG、PNG、TIFF、HEIF 和 RAW 解码管线。

## 获取源代码

可在 GitHub 页面选择 **Code → Download ZIP**，解压后进入项目目录；也可以使用 Git：

```bash
git clone https://github.com/Hermit0071/LightRAW.git
cd LightRAW
```

## macOS 开发与编译

### 环境要求

- Node.js 24 或更高版本
- Rust stable
- Xcode Command Line Tools
- Homebrew

安装原生图像依赖和前端依赖：

```bash
brew install cmake pkg-config libraw libheif
npm ci
```

启动开发模式：

```bash
npm run tauri dev
```

编译调试版 `.app`：

```bash
npm run tauri -- build --debug --bundles app
open src-tauri/target/debug/bundle/macos/LightRAW.app
```

编译发布版 `.app`：

```bash
npm run tauri -- build --bundles app
open src-tauri/target/release/bundle/macos/LightRAW.app
```

当前标准构建会动态链接 Homebrew 安装的 LibRaw 和 libheif。若要把 `.app` 分发给未安装这些库的用户，还需要将动态库随包分发，并完成 Apple 代码签名和公证。

## Windows 开发与编译

### 环境要求

- Node.js 24 或更高版本
- Rust stable（`x86_64-pc-windows-msvc` 或 `aarch64-pc-windows-msvc`）
- Visual Studio 2022 C++ Build Tools
- CMake、NASM 和 WebView2

在 PowerShell 中安装原生依赖并启动开发模式：

```powershell
cargo install cargo-vcpkg --version 0.1.7
cd src-tauri
cargo vcpkg build
cd ..
npm ci
npm run tauri dev
```

编译 Windows 安装包：

```powershell
npm run tauri -- build
```

构建产物位于 `src-tauri\target\release\bundle\`。实际生成的安装包类型取决于本机已安装的 Tauri 打包工具。

## 测试

```bash
npm run typecheck
npm run test:run
cargo test --manifest-path src-tauri/Cargo.toml
npm run build
```

GitHub Actions 也会在 macOS 和 Windows 上执行类型检查、前端测试和 Rust 测试；工作流见 [`.github/workflows/check.yml`](.github/workflows/check.yml)。

使用本地真实照片检查解码时间：

```bash
LIGHTRAW_REAL_IMAGE=/path/to/photo.ARW \
  cargo test --manifest-path src-tauri/Cargo.toml \
  decode::tests::decodes_a_real_photo_within_the_interactive_budget \
  -- --ignored --nocapture
```

各阶段的详细边界与验收记录见 [docs/PHASE-1.md](docs/PHASE-1.md)、[docs/PHASE-2.md](docs/PHASE-2.md)、[docs/PHASE-3.md](docs/PHASE-3.md)、[docs/PHASE-4.md](docs/PHASE-4.md) 与 [docs/PHASE-5.md](docs/PHASE-5.md)。图库文件管理的安全边界与验收方式见 [docs/LIBRARY-MANAGEMENT.md](docs/LIBRARY-MANAGEMENT.md)。RapidRAW 参考改版的独立实现边界、体积预算和本地能力清单见 [docs/RAPIDRAW-PARITY.md](docs/RAPIDRAW-PARITY.md)。

## 当前边界

LightRAW 目前不包含镜头配置文件自动校正、HDR/全景合并、AI 主体选择、AI 降噪、完整 ICC 工作流、视频编辑、云同步和插件系统。项目仍处于早期版本，建议处理重要照片前保留原始文件和独立备份。

## 社区与贡献

- 使用问题、功能想法和工作流讨论：前往 [GitHub Discussions](https://github.com/Hermit0071/LightRAW/discussions)。
- 发现问题或提出新功能：使用仓库的 Issue 模板。
- 准备贡献代码或文档：阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 和 [MIT License](LICENSE)。

## 许可证

LightRAW 使用 [MIT License](LICENSE) 开源。你可以使用、修改和分发本项目，但需要保留原始版权和许可声明。
