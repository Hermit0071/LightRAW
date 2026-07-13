# LightRAW

LightRAW 是一款面向 macOS 和 Windows 的轻量级、非破坏性 RAW 照片编辑器。当前仓库完成了阶段三：在完整基础调色与裁剪几何之上，加入局部调整图层和可组合蒙版。

## 当前支持

- JPEG、PNG、TIFF
- HEIF、HEIC
- Canon CR2/CR3、Nikon NEF/NRW、Sony ARW、Fujifilm RAF、Panasonic RW2、OM/Olympus ORF、DNG
- 色温、色调、曝光、对比度、高光、阴影、白色色阶、黑色色阶
- 纹理、清晰度、去雾、自然饱和度、饱和度
- RGB 主曲线及红、绿、蓝分通道曲线
- 8 色 HSL、实时编辑后直方图、锐化和基础降噪
- 自由裁剪、常用比例、旋转、翻转和角度拉直
- 最多 8 个局部调整图层，每层支持独立基本调色、HSL、四通道曲线和不透明度
- 每层可用线性、径向、画笔、钢笔、色度组件按添加/减去/相交组合最终蒙版
- 图层与子组件分级显隐、反相、编辑和删除，画布可显示最终蒙版覆盖
- WebGL 2 实时预览

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

当前阶段的 `.app` 会动态链接 Homebrew 安装的 LibRaw 和 libheif；面向其他电脑分发的自包含安装包属于阶段五的打包工作。

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

各阶段的详细边界与验收记录见 [docs/PHASE-1.md](docs/PHASE-1.md)、[docs/PHASE-2.md](docs/PHASE-2.md) 与 [docs/PHASE-3.md](docs/PHASE-3.md)。
