# 照片编辑器的蒙版与局部调整图层工作流

研究日期：2026-07-13
范围：Adobe Lightroom / Lightroom Classic、Capture One；Affinity Photo 仅用于区分“调整图层”和“蒙版本体”。所有产品事实均来自官方帮助文档。

## 结论先行

用户所说“蒙版是不同的图层”在产品概念上是正确的，但需要把两个对象分开命名：

- **局部调整图层（effect layer）**保存一组局部调整，负责“做什么改变”。
- **该图层的蒙版（mask）**只产生 0–1 覆盖率，负责“改变作用在哪里”。
- **蒙版组件（mask component）**是画笔、线性渐变、径向渐变、钢笔区域、色度范围等选区生成器；多个组件通过添加、减去或相交共同生成同一个图层的最终蒙版。

Capture One 在界面和术语上直接采用这套结构。Lightroom 把顶层局部调整单元命名为“Mask”，但顶层 Mask 下面仍有多个 Add / Subtract / Intersect 的工具选区，而调整参数属于顶层单元，不属于每个子选区。LightRAW 应采用 Capture One 式的明确命名，同时保留 Lightroom 式的简洁创建流程。

## 1. 主流产品如何落地

### Adobe Lightroom / Lightroom Classic

Lightroom 的 Masks 面板存在两个层级：

1. 顶层 Mask 是一个可命名、隐藏、复制、删除的局部调整单元，并拥有自己的局部调整参数。
2. 顶层 Mask 下可以有多个工具选区；用户可用任意蒙版工具继续 **Add**，用工具 **Subtract**，或用新工具与现有蒙版 **Intersect**。Adobe 文档还明确称 Subtract 产生的项目为父蒙版下的“child mask”。

因此，一条线性渐变和一笔画笔不一定是两个独立效果。真实案例是：先用线性渐变覆盖天空，再用画笔减去建筑；两者共同定义一个“压暗天空”局部调整单元，只共享一组曝光、色温等参数。Adobe 官方说明 Add 可用任意蒙版工具扩充既有选择、Subtract 可移除区域、Intersect 会在同一蒙版内创建相交组件；Masks 面板同时列出所有顶层蒙版和工具选区。来源：[Lightroom Classic Masking tool](https://helpx.adobe.com/lightroom-classic/desktop/process-and-develop-photos/masking.html)、[Lightroom desktop — Apply Masking for local adjustments](https://helpx.adobe.com/lightroom/desktop/edit-photos/masking.html)。

Adobe 当前提供的手动选区包括 Brush、Linear Gradient、Radial Gradient 和 Color / Luminance / Depth Range；Brush 有 Size、Feather、Flow、Density，Color Range 支持多个取样并用 Refine 调整范围。来源：[Lightroom desktop — Masking tools](https://helpx.adobe.com/lightroom/desktop/edit-photos/masking.html)。

局部调整控件在各种蒙版类型上保持一致，而不是由某种选区工具决定。Adobe 的官方局部控件参考包括 Exposure、Contrast、Highlights、Shadows、Whites、Blacks、Temp、Tint、Saturation、Hue、Color，以及 Texture、Clarity、Dehaze、Noise、Sharpness、Moiré、Defringe；桌面版文档还列出 Curves 和 Grain。来源：[Lightroom local adjustment controls](https://helpx.adobe.com/uk/lightroom/mobile/masks-and-selective-adjustments/local-adjustment-controls.html)、[Lightroom desktop — Local adjustment sliders](https://helpx.adobe.com/lightroom/desktop/edit-photos/masking.html#local-adjustment-sliders)。

Lightroom 的准确抽象不是“每个工具形状带一套调整”，而是：

```text
Mask 1（局部调整：曝光 -0.7、色温 -5）
├── Add: Linear Gradient（天空大范围）
├── Subtract: Brush（建筑）
└── Intersect: Color Range（只保留蓝色区域）
```

### Capture One

Capture One 使用更明确的“图层优先”模型。官方说明：创建 mask 后，在同一个 **Layer mask** 上可组合 Exposure、Clarity、Color Balance 等多种调整；如果要在不同区域应用不同局部调整，就创建一个带独立 mask 的新 layer。来源：[Capture One — Overview of Layers and Masks](https://support.captureone.com/hc/en-us/articles/360002601658-Overview-of-Layers-and-Masks)。

图层是可独立管理的一级对象：Layers 面板以堆栈列出每层的类型、主不透明度和启用状态；可开关、重命名、删除、拖动排序。每层还有 mask 缩略图。来源：[Capture One — Working with multiple Layers](https://support.captureone.com/hc/en-us/articles/360002615097-Working-with-multiple-Layers)。

图层的主 Opacity 会整体淡化该层 mask 上已经应用的一项或多项局部调整，不要求逐个修改调整参数。来源：[Capture One — Opacity slider effect in the Layers tool](https://support.captureone.com/hc/en-us/articles/360002615497-Opacity-slider-effect-in-the-Layers-tool)。

Capture One 也允许一个图层含多个子蒙版：Add 合并覆盖区域，Subtract 移除区域，Intersect 仅保留重叠区域；组合后的整个 group 仍只算一个 layer，动态线性/径向渐变仍可编辑。来源：[Capture One — Combine Masks](https://support.captureone.com/hc/en-us/articles/31021514753053-Combine-Masks)、[Capture One — Overview of Layers and Masks](https://support.captureone.com/hc/en-us/articles/360002601658-Overview-of-Layers-and-Masks)。

一个非常直接的实际案例来自官方说明：如果想对完全相同的区域应用另一组调整并保持独立控制，应把 mask 复制到另一个 adjustment layer，而不是往原 mask 组件上再塞一套调整。来源：[Capture One — Copy a mask to another Layer](https://support.captureone.com/hc/en-us/articles/360002615437-Copy-a-mask-to-another-Layer)。

Capture One 还明确说明重叠图层上的局部颜色调整会累积。这意味着图层是独立效果单元，重叠只是覆盖率相交，不会把多层自动合并成一套参数。来源：[Capture One — Making local adjustments with the Color Editor](https://support.captureone.com/hc/en-us/articles/360007944857-Making-local-adjustments-with-the-Color-Editor)。

### Affinity Photo（概念对照）

Affinity 的模型更接近通用像素编辑器：Adjustment Layer 是非破坏调整本体，同时具备 mask 属性；可在 adjustment layer 上擦除、恢复或绘制渐变来限制效果区域。官方还说明 adjustment layer 在 Layers 面板中独立存在并可改变堆栈位置。来源：[Affinity Photo 2 — Using adjustment layers](https://affinity.help/photo2/English.lproj/pages/Layers/adjustmentLayers.html)。

这个对照再次说明：**调整图层是效果，蒙版是该效果的覆盖控制**。不能把“线性渐变工具”和“曝光调整图层”当成同一个领域对象。

## 2. LightRAW 阶段三的最小正确模型

### 领域对象

阶段三只需引入“局部调整图层”，不需要提前实现 Photoshop 式像素图层或混合模式：

```ts
interface LocalAdjustmentLayer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number; // 0..1，整层效果强度
  adjustments: BasicAdjustments;
  hsl: HslAdjustments;
  curves: ToneCurves;
  mask: LayerMask;
}

interface LayerMask {
  inverted: boolean;
  components: MaskComponent[];
}

type MaskOperation = "add" | "subtract" | "intersect";

type MaskComponent = {
  id: string;
  name: string;
  operation: MaskOperation;
  inverted: boolean;
} & (
  | LinearSelection
  | RadialSelection
  | BrushSelection
  | PenSelection
  | ChromaRangeSelection
);
```

职责边界必须固定：

- `LocalAdjustmentLayer` 才能持有 Basic / HSL / Curves。
- `MaskComponent` 只能持有生成覆盖率所需的数据。例如 Brush 持有 strokes / size / feather / flow；Chroma 持有 samples / tolerance / softness。
- 图层可见性关闭的是整层效果；组件的选中状态只决定当前编辑哪个选区工具，不应改变调整参数的归属。
- 色度抠像应是一个范围组件。最常用方式是与线性、径向、钢笔或画笔选区相交，而不是默认成为“全图色度调整图层”。它也可以作为某层的首个 Add 组件，以支持纯颜色范围选择。

### 蒙版合成

按组件顺序计算 0–1 覆盖率 `coverage`。为避免没有基底的减去/相交产生含糊结果，第一项在 MVP 中限定为 `add`：

```text
add:       coverage = max(coverage, component)
subtract:  coverage = coverage * (1 - component)
intersect: coverage = coverage * component
```

先应用组件自身 `inverted`，最后再应用整个 `LayerMask.inverted`。低 Flow 画笔的重复笔划应在同一 Brush component 内累积，而不同组件的 Add 仍按选择区域并集处理。

每个局部图层只计算一次最终 mask，然后整体混合该层效果：

```text
adjusted = applyLocalAdjustments(input, layer.adjustments, layer.hsl, layer.curves)
output   = mix(input, adjusted, finalMaskCoverage * layer.opacity)
```

多个局部图层按固定堆栈顺序依次处理；重叠区域自然累积。阶段三可仅支持 Normal 式局部调整合成，阶段四再把同一图层抽象扩展为三种混合模式，避免创建第二套平行“图层系统”。

### 最小 UI 层级

```text
局部图层
├── ☑ 压暗天空                         85%
│   ├── ＋ 线性渐变
│   ├── － 画笔（排除建筑）
│   └── ∩ 色度范围（蓝色）
├── ☑ 提亮人物                        100%
│   └── ＋ 钢笔区域
└── ＋ 新建局部图层
```

交互规则：

- 选择**图层行**：右侧显示该层的 Basic / HSL / Curves，以及图层名称、可见性和不透明度。
- 选择**组件行**：右侧只显示该组件参数；画布显示并编辑对应控制柄或笔刷。
- “新建局部图层 → 选择工具”创建新层及首个 Add 组件。
- 选中既有层后，“添加 / 减去 / 相交 → 选择工具”只创建子组件，不创建新的调整层。
- 每层展示最终 mask 缩略图；画布 overlay 默认显示当前层最终覆盖，编辑组件时可额外高亮当前组件。
- 删除组件只改变该层覆盖；删除图层才会连同调整参数和全部组件一起删除。

## 3. 当前 `PhotoMask[]` 模型缺失的内容

当前实现的 `PhotoMask` 把 `adjustments`、`hsl`、`curves` 直接放在 `LinearMask | RadialMask | BrushMask | PenMask | ChromaMask` 的共同基类上，`DevelopRecipe` 则保存 `masks: PhotoMask[]`。这会导致以下结构性问题：

1. **效果与选区生成器混为一体。** 每画一条线性渐变或一笔独立画笔都会成为一套新的调整参数，而不是某个局部图层的一个选区组件。
2. **无法表达一个效果层的复合蒙版。** 不能表达“线性渐变 Add，画笔 Subtract，色度范围 Intersect，但三者共享同一曝光和色温”。
3. **缺少 Add / Subtract / Intersect 的父子关系。** 当前只有整个 `PhotoMask.inverted`，无法区分组件反相、整组反相和不同布尔/覆盖运算。
4. **UI 语义必然错误。** 用户选中的是形状工具，却同时编辑局部调色；列表没有“图层行”和“子蒙版组件行”的层级，也无法清楚区分“删除选区组件”与“删除整层效果”。
5. **色度范围的角色错误。** `ChromaMask` 直接携带调整，天然变成整图颜色选择效果；真实高频工作流是把颜色范围作为已有空间蒙版的相交/细化条件。
6. **缺少图层级强度。** Capture One 式的 layer opacity 应整体淡化该层所有调整；它不属于某种具体 mask shape。
7. **渲染合成单位错误。** 当前引擎逐个 `PhotoMask` 应用其调整，本质上把每个选区组件当成一层；正确做法是先合成一层的最终覆盖，再只应用一次该层的调整。
8. **阶段四会产生重复架构。** 如果保留 `PhotoMask[]`，阶段四再增加调整图层，将出现“蒙版自带调整”和“调整图层再带蒙版”两套相互竞争的模型。阶段三现在就建立 `LocalAdjustmentLayer[]`，阶段四只需扩展 opacity / blend mode / reorder / history。

当前模型并非所有部分都应丢弃：五种具体 shape 的几何数据、覆盖率算法、GPU mask atlas、画布控制柄都可复用。需要重构的是**所有权和合成层级**，而不是重写每种选区算法。

## 建议的阶段三验收标准

1. 新建“压暗天空”局部图层，首个组件为线性渐变；调低曝光后，仅该层最终蒙版覆盖区变化。
2. 在同一层添加画笔减去建筑，调整参数列表不增加第二份，建筑恢复为下层结果。
3. 在同一层相交色度范围，最终只保留线性渐变内、且符合颜色范围的区域。
4. 新建第二层“提亮人物”，两层拥有独立名称、可见性、不透明度和调整参数；重叠区域效果累积。
5. 删除子组件不删除图层调整；删除图层会删除其调整及全部组件。
6. 选择图层与选择组件时，右侧面板内容和画布 overlay 明确切换，用户不会把“选区工具”误认成“调整图层”。
