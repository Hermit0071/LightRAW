# 阶段四：图层、历史与预设

## 本阶段交付

- 调整图层可重排，并支持正常、正片叠底、滤色三种真实 GPU/CPU 混合模式。
- 非破坏性配方使用 100 步快照历史；撤销后产生新编辑时会清除旧的重做分支。
- 工具栏和键盘均可撤销/重做；`\` 可在原图与编辑后效果间切换。
- 当前全局调色、细节和调整图层可保存为本机预设，并以版本化 JSON 导入导出。
- 预设不包含裁剪、旋转和翻转，避免把单张照片的几何决定错误应用到其他照片。

## 本地运行

```bash
npm ci
npm run tauri dev
```

快捷键：

- macOS `⌘Z` / Windows `Ctrl+Z`：撤销
- macOS `⇧⌘Z` / Windows `Ctrl+Shift+Z`：重做；Windows 也支持 `Ctrl+Y`
- `\`：前后对比
- `E` / `C` / `M` / `P`：调色、裁剪、蒙版、预设
- macOS `⌘O` / Windows `Ctrl+O`：打开照片

## 测试与验收

```bash
npm run typecheck
npm run test:run
npm run build
CARGO_HOME="$PWD/src-tauri/.cargo-home" cargo test --manifest-path src-tauri/Cargo.toml
CARGO_HOME="$PWD/src-tauri/.cargo-home" cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

手动验收建议：新建两个重叠调整图层，分别切换正片叠底和滤色并调换顺序；随后连续撤销、重做，确认顺序与画面同步恢复。保存预设后修改裁剪，重新应用预设，裁剪应保持不变。
