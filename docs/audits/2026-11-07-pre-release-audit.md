# LightRAW 发布前审计（2026-11-07）

## 审计范围与结论

- 审计日期：2026-11-07（Asia/Singapore）。
- 仓库：`Hermit0071/LightRAW`。
- 源码基线：`main@bfaded52121d46833e1da744d5df400b4b921d50`，审计时本地与远端一致。
- 核对范围：README、Windows 构建依赖、中英文界面、许可证、贡献流程、版本信息和实际发布入口。
- 方法：只读检查源码、GitHub 元数据、Release、Actions 结果及相关依赖的官方许可说明；在临时源码副本运行前端检查。

项目已有较完整的源码发布基础，但尚缺少面向普通用户分发安装包的验证和配套流程。需要先处理最新 Release 与当前源码错位、Windows 构建路径不一致，以及原生依赖的打包和许可证风险。

本报告记录上述固定提交及审计时的远端状态。后续新增文档、提交或发布不会改变本次审计基线；“未验证”表示证据不足，不等同于功能必然失败。审计期间未修改应用源码或配置。

## 逐项核对结果

| 核对项 | 有证据支持的结果 | 证据 |
| --- | --- | --- |
| 仓库状态 | 公开、未归档，默认分支为 `main`；审计时没有开放的 Issue 或 Pull Request。 | [仓库元数据][repo]、[开放 Issue][issues]、[开放 PR][pulls] |
| README | 已包含功能、macOS/Windows 构建、测试命令和早期版本限制；部分使用说明与实现存在差异，详见建议事项。 | [README][readme] |
| Windows 依赖 | 文档列出 Node.js 24、Rust MSVC、VS 2022 C++ Build Tools、CMake、NASM、WebView2；Cargo 配置包含 LibRaw/libheif 及 x64、ARM64 的 `static-md` triplet。文档与 CI 的依赖安装步骤尚不一致。 | [Windows 构建说明][windows-readme]、[Cargo 配置][cargo]、[CI][workflow] |
| 中英文界面 | `main` 已实现语言切换、本地偏好保存和页面语言更新；部分文件对话框和错误提示仍固定为中文。 | [语言偏好保存][locale-save]、[照片选择器][image-dialog]、[预设对话框][preset-dialog]、[重命名验证][rename-validation] |
| 许可证 | 根目录存在完整 MIT 文本，版权声明为 `2026 LightRAW contributors`；该声明不能替代第三方依赖的分发许可核对。 | [LICENSE][license]、[libheif 许可][libheif-license]、[LibRaw 许可选项][libraw-license] |
| 贡献流程 | 已有贡献指南、Bug/功能 Issue 模板、PR 模板及提交前测试要求；仓库元数据确认 Discussions 已启用。 | [贡献指南][contributing]、[GitHub 配置目录][github-config]、[仓库元数据][repo] |
| 版本信息 | `package.json`、`Cargo.toml`、`tauri.conf.json` 均为 `0.1.0`，三处一致；Release 标签的内容却落后于当前 `main`。 | [前端版本][package]、[Cargo 配置][cargo]、[桌面配置][tauri-config]、[标签与 main 差异][release-compare] |
| 实际发布入口 | README 的 Latest source release 链接有效，指向 `v0.1.0 — Source Release`，发布于 2026-07-13；说明明确仅提供源码，上传附件为空，没有安装包。 | [Release 页面][release]、[latest API][latest-release] |

## 必须先修复

以下为建议执行顺序。其中第 3、4 项是二进制安装包的发布门槛；继续提供明确标注的源码包不必等待 Apple 签名和公证。

### 1. 使 Release、版本号和已验证源码对应

**发现：** `v0.1.0` 指向 `948b7742c6305af9b39448bfda280d7e4ba511d8`，比审计基线落后 4 个提交，缺少中英文界面及三项 Windows 构建修复。该标签对应的 Windows CI 在 `cargo test` 步骤失败，而最新 `main` 的两平台检查已经通过。

**执行：** 基于通过检查的提交发布后续版本，同步前端、Rust、Tauri 版本文件及相关锁文件，在发布说明中写明源码提交和分发类型。保留历史标签，避免使用当前 `main` 的能力描述代替旧版源码的实际能力。

**验收：** 新 Release 标签包含上述修复；该标签的 macOS、Windows 检查通过；Release 页面、源码版本号和实际下载内容一致。

证据：[4 个提交的差异][release-compare]、[v0.1.0 对应 CI][tag-ci]、[审计基线 CI][current-ci]。

### 2. 统一 Windows 文档与 CI 的原生依赖安装路径

**发现：** README 仅执行 `cargo vcpkg build`。CI 则提前克隆并引导 vcpkg、显式安装 LibRaw/libheif，再设置 `VCPKG_ROOT`。Cargo 配置写有 `2026.05.25` 基线，CI 的手动克隆没有显式固定 revision。因此，现有 CI 成功不能直接证明仅按 README 操作也能成功；这也不能单凭静态差异判定 README 路径必然失败。

**执行：** 统一依赖安装入口和实际使用的 vcpkg revision、triplet，在干净 Windows 环境逐条执行 README，并完成 `tauri build`。明确 C++ 工具链、系统 SDK 和 NASM 的安装及 PATH 要求。

**验收：** 不依赖预先安装的 vcpkg 库，仅按 README 即可完成测试及安装包构建；构建记录能定位实际原生库版本和 triplet。

证据：[README 命令][windows-readme]、[CI 原生依赖安装步骤][workflow]、[Cargo 的 vcpkg 基线与 triplet][cargo]。

### 3. 发布二进制前，关闭第三方许可证风险

**发现：** 审计基线未见第三方许可清单或随包许可流程。项目指定的 vcpkg `2026.05.25` 基线将 libheif 标为 LGPL-3.0，其默认 `hevc` 特性会引入 GPL 的 x265；Windows 配置又采用静态库 triplet。LibRaw 也有自己的 LGPL/CDDL 许可选项。根目录 MIT 文件不足以完成这些依赖的分发核对。

**执行：** 确定最终使用的编解码器和实际链接结果；只需解码时关闭不需要的 x265 编码特性；按最终依赖补齐第三方许可文本，以及对应许可证要求的源码、重链接等材料。

**验收：** 安装包附带与实际依赖一致的许可清单和文件；构建记录能解释静态/动态链接及所启用的 codec 特性；相关分发要求已有落实记录。

这是尚未关闭的二进制分发风险，不构成对既有安装包违规的判定；当前 Release 没有二进制附件。

证据：[vcpkg 的 libheif 定义][vcpkg-libheif]、[libheif 许可全文][libheif-license]、[LibRaw 官方许可选项][libraw-license]、[Windows 静态库 triplet][cargo]。

### 4. 正式安装包发布前，补齐构建与干净系统验收

**发现：** 当前 CI 只运行类型检查、前端测试、Rust 测试和前端构建，没有执行 `tauri build`、上传安装包或验证安装。README 明确说明 macOS 仍需完成动态库随包分发、签名和公证；阶段文档仅记录 macOS 原生 GUI 验收。

**执行：** 完成 macOS 动态库及必要 codec 插件的随包分发、签名和公证；确定 Windows 安装包类型与运行库/WebView2 的处理方式；增加桌面安装包构建及产物保存。在未安装开发依赖的系统验收启动、RAW/HEIC 导入、导出、图库恢复和文件管理。

**验收：** 新系统可从 Release 下载、安装和启动；没有指向开发机依赖路径的问题；核心工作流通过；产物记录明确系统、架构、版本和构建来源。

证据：[CI 范围][workflow]、[macOS 分发边界][mac-distribution]、[阶段五原生验收与边界][phase5]。

## 建议随后处理

### 5. 补齐双语边缘流程

**发现：** 文件选择器的“照片与 RAW”“LightRAW 预设”，以及无效重命名提示仍固定为中文；重命名对话框直接显示该错误。现有 i18n 单元测试验证的是语言归一化和字符串选择，没有覆盖这些原生对话框与完整操作流程。

**执行与验收：** 覆盖英文模式下的原生对话框、错误提示，以及重启后的语言恢复；在两种语言分别检查导入、预设、重命名和删除流程。

证据：[照片选择器][image-dialog]、[预设对话框][preset-dialog]、[重命名错误][rename-validation]、[错误显示位置][rename-dialog]、[i18n 测试][i18n-test]。

### 6. 修正文档与实现的差异

**发现：** README 指引用户选择“照片或包含照片的文件夹”，实际导入选择器设置为 `directory: false`。非 Windows 构建脚本明确要求 LibRaw ≥0.22，而 README 仅列出安装库的名称，尚缺少明确的最低系统版本和已验证架构说明。

**执行与验收：** 更简单的处理是先将使用说明改为选择照片文件；补充最低系统版本、已验证架构和原生库最低版本。以干净环境逐条核对文档，不把“有构建配置”写成“已完成运行验收”。

证据：[README 使用说明][usage]、[导入选择器][image-dialog]、[LibRaw 最低版本检查][build-script]。

### 7. 把格式支持声明对应到样片验收记录

**发现：** 默认测试会跳过要求 `LIGHTRAW_REAL_IMAGE` 的真实照片测试。阶段文档明确写明多家相机品牌缺少真实 RAW 样片矩阵，Windows GUI 尚未实机验收。CI 编译和单元测试不能替代这些验收。

**执行与验收：** 先建立 RAW、HEIC、JPEG 基础样片集，记录相机型号、系统、架构和结果；在临时照片副本上验证导入、调色、导出及文件管理；根据验证范围调整支持声明。

证据：[默认忽略的真实照片测试][decode-tests]、[阶段一验收缺口][phase1]、[阶段五 Windows GUI 边界][phase5]。

## 可延后

1. 完整英文构建/贡献文档、截图教程和更丰富的发布说明。目前已有英文概览和可执行的贡献流程；这些内容适合在上述构建与分发事项完成后补充。证据：[README][readme]、[贡献指南][contributing]。
2. 镜头校正、HDR/全景、AI、完整 ICC 等功能。README 已将这些功能排除在当前范围之外，无需为了本次发布补做。证据：[当前边界][boundaries]。

## 验证记录与限制

本次审计在临时源码副本重跑以下检查，应用源码与配置保持原样：

| 检查 | 结果 |
| --- | --- |
| `npm run typecheck` | 通过。 |
| `npm run test:run` | 29 个测试文件、108 项测试通过。 |
| `npm run build` | 通过；这是前端生产构建，不是桌面安装包构建。 |
| `cargo test --offline --locked --manifest-path src-tauri/Cargo.toml` | 未完成；合并可用本地依赖缓存后仍缺少 `rustix v1.1.4`，离线模式无法下载。该结果属于本次验证环境限制。 |
| 审计基线的 GitHub Actions | macOS、Windows 的类型检查、前端测试、Rust 测试和前端构建均成功；运行时间为 2026-07-15，结果来自远端已有记录。 |
| Windows GUI、正式安装包、干净系统安装 | 本次未实测，仍为待验收事项。 |

远端证据：[审计基线的 Actions 运行][current-ci]。

## 证据索引

仓库代码链接固定在审计提交；GitHub 元数据、开放列表及 `latest` 接口反映访问时状态，后续可能变化。

[repo]: https://api.github.com/repos/Hermit0071/LightRAW
[issues]: https://api.github.com/repos/Hermit0071/LightRAW/issues?state=open&per_page=100
[pulls]: https://api.github.com/repos/Hermit0071/LightRAW/pulls?state=open&per_page=100
[readme]: https://github.com/Hermit0071/LightRAW/blob/bfaded52121d46833e1da744d5df400b4b921d50/README.md
[windows-readme]: https://github.com/Hermit0071/LightRAW/blob/bfaded52121d46833e1da744d5df400b4b921d50/README.md#L131
[cargo]: https://github.com/Hermit0071/LightRAW/blob/bfaded52121d46833e1da744d5df400b4b921d50/src-tauri/Cargo.toml
[workflow]: https://github.com/Hermit0071/LightRAW/blob/bfaded52121d46833e1da744d5df400b4b921d50/.github/workflows/check.yml
[locale-save]: https://github.com/Hermit0071/LightRAW/blob/bfaded52121d46833e1da744d5df400b4b921d50/src/ui/App.tsx#L784
[image-dialog]: https://github.com/Hermit0071/LightRAW/blob/bfaded52121d46833e1da744d5df400b4b921d50/src/bridge/images.ts#L26
[preset-dialog]: https://github.com/Hermit0071/LightRAW/blob/bfaded52121d46833e1da744d5df400b4b921d50/src/bridge/presets.ts#L4
[rename-validation]: https://github.com/Hermit0071/LightRAW/blob/bfaded52121d46833e1da744d5df400b4b921d50/src/ui/file-management.ts#L4
[license]: https://github.com/Hermit0071/LightRAW/blob/bfaded52121d46833e1da744d5df400b4b921d50/LICENSE
[libheif-license]: https://github.com/strukturag/libheif/blob/master/COPYING
[libraw-license]: https://www.libraw.org/about#licensing
[contributing]: https://github.com/Hermit0071/LightRAW/blob/bfaded52121d46833e1da744d5df400b4b921d50/CONTRIBUTING.md
[github-config]: https://github.com/Hermit0071/LightRAW/tree/bfaded52121d46833e1da744d5df400b4b921d50/.github
[package]: https://github.com/Hermit0071/LightRAW/blob/bfaded52121d46833e1da744d5df400b4b921d50/package.json#L4
[tauri-config]: https://github.com/Hermit0071/LightRAW/blob/bfaded52121d46833e1da744d5df400b4b921d50/src-tauri/tauri.conf.json#L4
[release-compare]: https://github.com/Hermit0071/LightRAW/compare/v0.1.0...bfaded52121d46833e1da744d5df400b4b921d50
[release]: https://github.com/Hermit0071/LightRAW/releases/tag/v0.1.0
[latest-release]: https://api.github.com/repos/Hermit0071/LightRAW/releases/latest
[tag-ci]: https://github.com/Hermit0071/LightRAW/actions/runs/29237524536
[current-ci]: https://github.com/Hermit0071/LightRAW/actions/runs/29398824206
[vcpkg-libheif]: https://github.com/microsoft/vcpkg/blob/2026.05.25/ports/libheif/vcpkg.json
[mac-distribution]: https://github.com/Hermit0071/LightRAW/blob/bfaded52121d46833e1da744d5df400b4b921d50/README.md#L129
[phase5]: https://github.com/Hermit0071/LightRAW/blob/bfaded52121d46833e1da744d5df400b4b921d50/docs/PHASE-5.md#L64
[rename-dialog]: https://github.com/Hermit0071/LightRAW/blob/bfaded52121d46833e1da744d5df400b4b921d50/src/ui/LibraryManagementDialog.tsx#L19
[i18n-test]: https://github.com/Hermit0071/LightRAW/blob/bfaded52121d46833e1da744d5df400b4b921d50/src/ui/i18n.test.ts
[usage]: https://github.com/Hermit0071/LightRAW/blob/bfaded52121d46833e1da744d5df400b4b921d50/README.md#L65
[build-script]: https://github.com/Hermit0071/LightRAW/blob/bfaded52121d46833e1da744d5df400b4b921d50/src-tauri/build.rs#L14
[decode-tests]: https://github.com/Hermit0071/LightRAW/blob/bfaded52121d46833e1da744d5df400b4b921d50/src-tauri/src/decode/mod.rs#L145
[phase1]: https://github.com/Hermit0071/LightRAW/blob/bfaded52121d46833e1da744d5df400b4b921d50/docs/PHASE-1.md#L35
[boundaries]: https://github.com/Hermit0071/LightRAW/blob/bfaded52121d46833e1da744d5df400b4b921d50/README.md#L181
