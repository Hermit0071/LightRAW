# 图库文件管理

本轮参考 Adobe Bridge 的本地文件工作流，保留与 LightRAW 非破坏性图库模型直接相关的高频功能。详细依据见 [research/adobe-bridge-file-management.md](research/adobe-bridge-file-management.md)。

## 功能与安全边界

- 单选照片可以在 Finder 或 Explorer 中显示原文件。
- 支持单个重命名，以及保留扩展名并添加三位序号的批量重命名；执行前显示全部新旧文件名。
- 支持复制到和移动到系统文件夹。遇到同名文件时自动添加 `-2`、`-3` 等后缀，不覆盖已有文件。
- 删除必须由用户选择：`仅从图库移除`只删除 LightRAW 记录和缩略图；`移到系统废纸篓 / 回收站`只移走已选原文件，成功后才移除对应图库记录。
- 批量操作按文件返回结果。部分失败时仅更新成功项，失败项保留原图库记录并显示首个错误。
- 不递归删除文件夹，也不处理未导入的同目录伴随文件。

## 快捷键

- 图库中按 `F2` 打开单个或批量重命名。
- 图库中按 `Delete` 或 macOS 的 `Backspace` 打开删除方式选择，不会直接删除原文件。

## 本地运行与测试

```bash
npm ci
npm run tauri dev
```

自动验证：

```bash
npm run typecheck
npm run test:run
cargo test --manifest-path src-tauri/Cargo.toml
npm run build
```

手动验收建议使用临时照片副本：选择一张或多张照片，依次检查重命名预览、同名复制自动编号、移动后图库路径更新，以及两种删除方式的文案和结果。系统废纸篓行为由 macOS/Windows 提供，LightRAW 不提供绕过系统废纸篓的永久删除。
