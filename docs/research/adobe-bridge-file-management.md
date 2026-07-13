# Adobe Bridge 本地文件管理调研

调研日期：2026-07-13。仅使用 Adobe 官方 Bridge 桌面帮助；排除 Creative Cloud Libraries、Adobe Stock、Portfolio、发布和其他云端工作流。

## Bridge 当前行为

| 工作流 | Adobe Bridge 行为 | 来源 |
| --- | --- | --- |
| 删除文件 | Bridge 可删除文件和文件夹。常规 `Delete` 会先出现对话框；确认后执行删除。官方“收藏集”文档进一步明确：在收藏集里按 `Delete` 可选择“标记为拒绝”“移到系统废纸篓/回收站”或取消。 | [复制、移动和删除文件及文件夹](https://helpx.adobe.com/in/bridge/desktop/organize-and-find-files/organize-files-and-folders/cut-copy-and-move-files-and-folders.html)、[使用收藏集](https://helpx.adobe.com/bridge/desktop/organize-and-find-files/organize-files-and-folders/use-collections.html) |
| 仅移除组织关系 | 从普通收藏集中可以执行 **Remove From Collection**，不会删除磁盘文件；删除整个收藏集也只删除集合本身。智能收藏集由搜索条件生成，应修改条件来移除项目；直接删除其中的照片则会送入系统废纸篓/回收站。 | [使用收藏集](https://helpx.adobe.com/bridge/desktop/organize-and-find-files/organize-files-and-folders/use-collections.html) |
| 在文件系统中定位 | Bridge 支持在 Finder/Explorer 中显示文件；收藏集视图还提供 **Reveal In Bridge**，跳转到文件真实所在文件夹。 | [Bridge 参考文档：查看和管理文件](https://helpx.adobe.com/content/dam/help/en/pdf/bridge_reference.pdf)、[使用收藏集](https://helpx.adobe.com/bridge/desktop/organize-and-find-files/organize-files-and-folders/use-collections.html) |
| 复制和移动 | 可从上下文菜单选择 **Copy To** 或 **Move To** 并指定文件夹；也支持与 Finder/Explorer 互相复制、剪切、粘贴。跨卷拖动默认是复制，需使用修饰键才会强制移动。 | [复制、移动和删除文件及文件夹](https://helpx.adobe.com/in/bridge/desktop/organize-and-find-files/organize-files-and-folders/cut-copy-and-move-files-and-folders.html) |
| 单个及批量重命名 | 除单项重命名外，批量重命名可选择原位置、移动到新目录或复制到新目录；名称可由多个片段组成，也支持字符串替换和正则表达式。执行前可预览全部新旧文件名，还可把原文件名保存在 XMP 中并保存命名预设。 | [批量更改文件名](https://helpx.adobe.com/bridge/desktop/organize-and-find-files/tag-and-find-files/batch-rename-files.html) |
| 评分、色标和拒绝 | 支持 0–5 星、可命名的颜色标签和 Reject。它们可批量应用，并用于排序、筛选；标签名会写入文件元数据。 | [对文件进行标记和评级](https://helpx.adobe.com/uk/bridge/desktop/organize-and-find-files/tag-and-find-files/label-and-rate-files.html) |
| 元数据 | Metadata 面板可查看一个或多个文件的共同元数据，并在明确点击 Apply 后写入；File Info 支持多选批量覆盖描述、作者、版权、关键词和 IPTC 等字段。Bridge 以 XMP 统一元数据；无法嵌入文件时使用 sidecar。 | [查看和编辑元数据](https://helpx.adobe.com/bridge/desktop/organize-and-find-files/tag-and-find-files/view-and-edit-metadata.html)、[添加元数据](https://helpx.adobe.com/in/bridge/desktop/organize-and-find-files/tag-and-find-files/add-metadata.html)、[关于元数据](https://helpx.adobe.com/bridge/desktop/organize-and-find-files/tag-and-find-files/about-metadata.html) |
| 关键词 | 关键词可分父子层级、批量应用、搜索和筛选，并可用文本文件导入/导出。 | [使用关键词](https://helpx.adobe.com/bridge/desktop/organize-and-find-files/tag-and-find-files/use-keywords.html) |
| 外部改名或移动 | 收藏集中的文件若在 Bridge 内移动，集合关系仍保留；若在 Finder/Explorer 外部移动或改名，Bridge 会标记缺失，并提供重新定位、跳过或从收藏集中移除。 | [使用收藏集](https://helpx.adobe.com/bridge/desktop/organize-and-find-files/organize-files-and-folders/use-collections.html) |

Adobe 当前公开帮助没有说明复制、移动或重命名遇到同名文件时的具体冲突选项。因此不能把“覆盖/跳过/自动改名”中的任何一种宣称为 Bridge 的既定行为。

## LightRAW 建议的安全子集

Bridge 是文件浏览器，LightRAW 是带导入记录和非破坏性编辑状态的图库；以下是借鉴工作流后的独立产品建议，不是对 Bridge 行为的复述。

### 本轮高优先级

1. **删除选择器**：每次明确列出选中数量，并让用户选择：
   - `仅从 LightRAW 图库移除`：默认且最安全，只删图库记录，保留原文件。
   - `移到系统废纸篓/回收站`：移动原文件后再移除图库记录，显示不可由 LightRAW 撤销的提示；失败时保留图库记录并报告具体文件。
   - `取消`。
2. **在 Finder/Explorer 中显示**：单项选择可直接定位；多选时定位第一项所在目录并说明行为。
3. **重命名**：先做单项重命名和轻量批量重命名（固定前缀/后缀、日期、递增序号）。必须展示逐项预览并预检空名称、非法字符、重复目标名和已存在目标。
4. **复制到 / 移动到**：使用系统目录选择器；完成文件操作后再原子更新图库路径。移动失败不得留下指向不存在路径的图库记录。
5. **冲突对话框**：因为 Adobe 文档未规定具体策略，LightRAW 应独立采用 `跳过`、`保留两者（自动编号）`、`替换`；默认 `保留两者`，`替换`需明确确认。批量操作可选择“应用到全部冲突”。
6. **批量评分、颜色标签、拒绝标记**：保留现有 0–5 星，并增加少量可筛选色标和 Reject；Reject 只是筛选状态，绝不等同于删除。

### 紧随其后的重要能力

- **基础信息面板**：只读显示路径、文件大小、尺寸、拍摄时间、相机、镜头、曝光参数；可编辑标题、描述、版权和关键词。
- **XMP/sidecar 互操作**：评分、色标、关键词和版权优先写入标准 XMP sidecar；写入原图必须是后续独立开关，默认不改原文件。
- **缺失文件修复**：检测路径失效后提供“重新定位”“从图库移除”“稍后处理”，不静默丢弃编辑指令。
- **收藏集**：普通收藏集只保存引用，删除收藏集或移出收藏集不得影响原文件。

### 暂缓

- 正则表达式批量重命名、可保存的复杂命名预设、层级关键词管理器、元数据模板和智能收藏集。它们有价值，但不是日常文件安全与管理的前置条件。
- 文件夹级递归删除。图库首版只对已导入照片操作，避免把未展示的伴随文件一起删除。

## 验收要点

- 所有破坏性操作必须展示实际文件数量和动作结果，且失败可逐项追踪。
- “从图库移除”“Reject”“移到废纸篓”在文案、图标和快捷键上不可混用。
- 批量移动、复制、重命名执行前必须完成冲突预检；执行后图库路径、缩略图、当前打开照片和选择状态一致。
- RAW 及其 LightRAW 编辑状态应作为逻辑资产一起更新；不应误删同目录中未被 LightRAW 管理的其他文件。
