# LightRAW

LightRAW 是一款面向 macOS 和 Windows 的轻量级、非破坏性 RAW 照片编辑器。当前仓库完成了阶段一：桌面骨架、主流图片/RAW 解码、16-bit 线性 GPU 预览，以及白平衡和基础影调调整。

## 当前支持

- JPEG、PNG、TIFF
- HEIF、HEIC
- Canon CR2/CR3、Nikon NEF/NRW、Sony ARW、Fujifilm RAF、Panasonic RW2、OM/Olympus ORF、DNG
- 色温、色调、曝光、对比度、高光、阴影
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

阶段一的详细边界与验收记录见 [docs/PHASE-1.md](docs/PHASE-1.md)。
