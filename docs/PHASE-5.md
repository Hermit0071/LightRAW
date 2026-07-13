# 阶段五：图库、批量处理与导出

## 本阶段交付

- 批量导入 JPEG、PNG、TIFF、HEIF/HEIC 和 LibRaw 支持的主流相机 RAW；重复路径不会在图库中产生重复项。
- 本机持久化图库保存缩略图、导入时间、评分和每张照片的非破坏性编辑配方；缩略图独立落盘，常规目录序列化在 Web Worker 中进行，避免每次调色都重写 base64 图片。
- 网格缩略图浏览，支持按导入时间、文件名或评分排序，以及 0–5 星评分和批量选择。
- 当前照片或已选照片可批量导出为 JPEG、PNG、TIFF；导出复用预览调色管线，并支持长边、短边、百分比、JPEG 质量、sRGB 和文字水印。同名照片及目标目录中的既有文件会自动追加序号，不会静默覆盖。
- 导出前仅按目标尺寸解码所需分辨率，避免小尺寸批量导出无谓占用完整源图内存。
- 图库关闭前会强制落盘，并用同目录临时文件、上一版本备份和原子替换避免截断 JSON。
- 自动保存与关闭快照经过前端保存队列和 Rust 互斥锁串行执行，关闭快照不会与较早的后台保存互相覆盖。
- 主图库无法解析时会先验证并恢复上一份备份，恢复失败时保持只读错误态，不会用空图库覆盖现有文件。
- 批量导出期间锁定导入、编辑和工具导航，避免共享解码缓存或 GPU 渲染器被并发操作打断。
- 批量导入每成功处理一张就立即提交到图库；导入期间禁止关闭或再次打开照片，避免长批次中途退出丢失已完成项目。
- 补充 `G` 图库、`X` 导出和 `0–5` 评分快捷键。

## 本地运行

macOS 需要 Node.js、Rust、Xcode Command Line Tools、CMake、LibRaw 和 libheif：

```bash
brew install cmake pkg-config libraw libheif
npm ci
npm run tauri dev
```

Windows 需要 Node.js、Rust MSVC toolchain、Visual Studio 2022 C++ Build Tools、CMake 和 NASM；依赖安装步骤见仓库根目录 README。

## 使用与手动验收

1. 点击“导入照片”并在系统选择器中多选照片。
2. 在图库中点击左上角选择按钮加入批处理，点击星级评分；重启应用后确认图库和评分仍在。
3. 双击缩略图进入调色，完成编辑后进入“导出”。
4. 选择 JPEG、PNG 或 TIFF，设置尺寸和可选文字水印；单张导出使用文件选择器，批量导出使用目录选择器。
5. 用系统预览或图片信息检查输出像素尺寸、格式和水印。

快捷键：

- macOS `⌘O` / Windows `Ctrl+O`：批量导入
- `G` / `X`：图库 / 导出
- `0–5`：给当前照片评分，`0` 清除评分
- `E` / `C` / `M` / `P`：调色、裁剪、蒙版、预设
- macOS `⌘Z` / Windows `Ctrl+Z`：撤销
- macOS `⇧⌘Z` / Windows `Ctrl+Shift+Z`：重做；Windows 也支持 `Ctrl+Y`
- `\`：前后对比

## 自动化测试

```bash
npm run typecheck
npm run test:run
npm run build
CARGO_HOME="$PWD/src-tauri/.cargo-home" cargo test --manifest-path src-tauri/Cargo.toml
CARGO_HOME="$PWD/src-tauri/.cargo-home" cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

macOS 开发版应用包：

```bash
npm run tauri -- build --debug --bundles app
open src-tauri/target/debug/bundle/macos/LightRAW.app
```

本阶段原生验收使用系统 `Sonoma.heic`：确认 6016 × 6016 HEIF 导入、图库重启与关闭前评分持久化、1504 × 1504 PNG 水印导出，以及 602 × 602 JPEG 批量导出。

## 当前边界

- 图库是轻量本机目录，不包含关键字、智能收藏夹、云同步或文件移动管理。
- 输出工作色彩空间固定为 sRGB，不实现完整 ICC 工作流。
- 单张输出限制为最多 4000 万像素，避免 WebView、GPU 和整图水印缓冲在普通笔记本上失控；更高分辨率的分块导出不在 MVP 内。
- 开发版 macOS 应用仍依赖本机 LibRaw 与 libheif；面向其他电脑发布前需完成依赖随包分发、签名和公证。
- Windows 源码路径和 MSVC/vcpkg 配置已保留，但本阶段只在 macOS 进行了原生 GUI 实机验收。
