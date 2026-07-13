# Contributing to LightRAW

感谢你帮助改进 LightRAW。欢迎提交 Bug 报告、功能建议、文档修正、测试和代码贡献。

## 开始之前

1. 先搜索已有 Issue 和 Discussion，避免重复讨论。
2. 适合首次贡献的工作会标记为 [`good first issue`](https://github.com/Hermit0071/LightRAW/labels/good%20first%20issue)；需要社区协助的工作会标记为 [`help wanted`](https://github.com/Hermit0071/LightRAW/labels/help%20wanted)。
3. 较大的功能或影响编辑模型、解码管线、文件管理安全边界的改动，请先开 Issue 讨论方案。

## 本地开发

按 [README](README.md) 的 macOS 或 Windows 环境说明安装依赖，然后执行：

```bash
npm ci
npm run tauri dev
```

提交前运行：

```bash
npm run typecheck
npm run test:run
cargo test --manifest-path src-tauri/Cargo.toml
npm run build
```

## 提交 Pull Request

1. 从 `main` 创建主题明确的分支。
2. 保持一个 PR 只解决一个问题，并补充或更新相关测试。
3. 使用清晰的提交前缀，例如 `feat:`、`fix:`、`docs:`、`test:` 或 `refactor:`。
4. 在 PR 描述中说明动机、实现方式、测试结果，以及任何用户可见的变化。
5. 若修改调色、蒙版、图库或导出界面，请提供前后截图或短录屏；不要上传包含隐私信息的照片。

## Issue 反馈建议

请附上操作系统、应用版本、输入文件格式和可复现步骤。涉及 RAW 解码的问题，请提供相机型号和文件扩展名；除非你明确愿意公开该照片，否则不要上传原始照片。

参与本项目即表示同意遵守 [MIT License](LICENSE)。
