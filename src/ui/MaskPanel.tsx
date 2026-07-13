import { useEffect, useRef, useState } from "react";
import { BASIC_ADJUSTMENT_LIMITS, createDefaultAdjustments, updateAdjustment, type BasicAdjustmentName } from "../editor/basic-adjustments";
import type { DevelopRecipe } from "../editor/develop-recipe";
import { createDefaultHsl, HSL_CHANNELS, HSL_PARAMETER_LIMITS, updateHslChannel, type HslParameter } from "../editor/hsl";
import {
  MAX_LAYERS,
  MAX_MASK_COMPONENTS,
  layersForDisplay,
  type AdjustmentLayer,
  type LayerBlendMode,
  type MaskCombineMode,
  type MaskComponent,
  type MaskType,
} from "../editor/masks";
import { createDefaultToneCurves } from "../editor/tone-curve";
import { rasterizeLayerMask, type SourceSampler } from "../renderer/mask-rasterizer";
import { PanelHeading } from "./AdjustmentPanel";
import { PanelSection, Slider } from "./controls";
import { ToneCurveEditor } from "./ToneCurveEditor";
import { useI18n } from "./i18n";

export interface BrushSettings { size: number; feather: number; flow: number }

const MASK_TYPES: { type: MaskType; label: string; glyph: string }[] = [
  { type: "linear", label: "线性", glyph: "↗" }, { type: "radial", label: "径向", glyph: "◯" },
  { type: "brush", label: "画笔", glyph: "✎" }, { type: "pen", label: "钢笔", glyph: "◇" },
  { type: "chroma", label: "色度", glyph: "◉" },
];
const BASIC_CONTROLS: { name: BasicAdjustmentName; label: string; step?: number; digits?: number }[] = [
  { name: "temperature", label: "色温" }, { name: "tint", label: "色调" },
  { name: "exposure", label: "曝光", step: 0.01, digits: 2 }, { name: "contrast", label: "对比度" },
  { name: "highlights", label: "高光" }, { name: "shadows", label: "阴影" },
  { name: "whites", label: "白色色阶" }, { name: "blacks", label: "黑色色阶" },
  { name: "texture", label: "纹理" }, { name: "clarity", label: "清晰度" },
  { name: "dehaze", label: "去雾" }, { name: "vibrance", label: "自然饱和度" }, { name: "saturation", label: "饱和度" },
];
const HSL_LABELS = {
  red: ["红色", "#ef5b54"], orange: ["橙色", "#ef9b45"], yellow: ["黄色", "#e4cb4b"], green: ["绿色", "#63bd6b"],
  aqua: ["青色", "#4dc4bd"], blue: ["蓝色", "#5795e8"], purple: ["紫色", "#986bd3"], magenta: ["洋红", "#d35b9f"],
} as const;
const MODE_LABELS: Record<MaskCombineMode, string> = { add: "添加", subtract: "减去", intersect: "相交" };
type Translate = (zh: string, en: string) => string;

const MASK_TYPE_EN: Record<MaskType, string> = { linear: "Linear", radial: "Radial", brush: "Brush", pen: "Pen", chroma: "Color range" };
const MODE_EN: Record<MaskCombineMode, string> = { add: "Add", subtract: "Subtract", intersect: "Intersect" };
const BASIC_EN: Record<BasicAdjustmentName, string> = {
  temperature: "Temperature", tint: "Tint", exposure: "Exposure", contrast: "Contrast", highlights: "Highlights", shadows: "Shadows",
  whites: "Whites", blacks: "Blacks", texture: "Texture", clarity: "Clarity", dehaze: "Dehaze", vibrance: "Vibrance", saturation: "Saturation",
};
const HSL_EN = { red: "Red", orange: "Orange", yellow: "Yellow", green: "Green", aqua: "Aqua", blue: "Blue", purple: "Purple", magenta: "Magenta" } as const;

function maskTypeLabel(t: Translate, type: MaskType) {
  return t(MASK_TYPES.find((item) => item.type === type)!.label, MASK_TYPE_EN[type]);
}

function localizedMaskName(t: Translate, mask: MaskComponent) {
  const defaults: Record<MaskType, string> = { linear: "线性渐变", radial: "径向渐变", brush: "画笔", pen: "钢笔路径", chroma: "色度范围" };
  return mask.name === defaults[mask.type] ? t(mask.name, MASK_TYPE_EN[mask.type]) : mask.name;
}

export function MaskPanel({
  recipe, selectedLayerId, selectedMaskId, brush, disabled, imageAspect, sampleSource, onCreate, onAdd, onSelectLayer, onSelectMask,
  onUpdateLayer, onMoveLayer, onUpdateMask, onSetMaskVisibility, onDeleteLayer, onDeleteMask, onBrushChange,
}: {
  recipe: DevelopRecipe;
  selectedLayerId: string | null;
  selectedMaskId: string | null;
  brush: BrushSettings;
  disabled: boolean;
  imageAspect: number;
  sampleSource: SourceSampler;
  onCreate: (type: MaskType) => void;
  onAdd: (type: MaskType, mode: MaskCombineMode) => void;
  onSelectLayer: (id: string) => void;
  onSelectMask: (layerId: string, maskId: string) => void;
  onUpdateLayer: (layer: AdjustmentLayer) => void;
  onMoveLayer: (id: string, direction: -1 | 1) => void;
  onUpdateMask: (layerId: string, mask: MaskComponent) => void;
  onSetMaskVisibility: (layerId: string, maskId: string, visible: boolean) => void;
  onDeleteLayer: (id: string) => void;
  onDeleteMask: (layerId: string, maskId: string) => void;
  onBrushChange: (settings: BrushSettings) => void;
}) {
  const { t } = useI18n();
  const [combineMode, setCombineMode] = useState<MaskCombineMode>("add");
  const [hslParameter, setHslParameter] = useState<HslParameter>("hue");
  const layer = recipe.layers.find((value) => value.id === selectedLayerId) ?? null;
  const mask = layer?.mask.components.find((value) => value.id === selectedMaskId) ?? null;
  const resetLayer = () => layer && onUpdateLayer({
    ...layer,
    adjustments: createDefaultAdjustments(),
    hsl: createDefaultHsl(),
    curves: createDefaultToneCurves(),
  });

  return <aside className="adjustments-panel mask-panel" aria-label={t("图层与蒙版", "Layers and masks")}>
    <PanelHeading title={mask ? t("编辑选区组件", "Edit selection component") : t("图层与蒙版", "Layers and masks")} disabled={!layer || !!mask} onReset={resetLayer} />
    <PanelSection title={t("新建调整图层", "New adjustment layer")} badge={`${recipe.layers.length}/${MAX_LAYERS}`}>
      <ToolGrid disabled={disabled || recipe.layers.length >= MAX_LAYERS} onChoose={onCreate} />
    </PanelSection>

    <PanelSection title={t("调整图层", "Adjustment layers")} badge="LAYERS">
      <div className="mask-list layer-list">{recipe.layers.length === 0 && <p>{t("选择一种蒙版，新建调整图层", "Choose a mask to create an adjustment layer")}</p>}{layersForDisplay(recipe.layers).map((item, index) => <div key={item.id} className="layer-entry">
        <div className={`mask-row layer-row ${selectedLayerId === item.id && !selectedMaskId ? "active" : ""}`}>
          <button type="button" className="mask-select" onClick={() => onSelectLayer(item.id)}>
            <LayerMaskThumbnail layer={item} imageAspect={imageAspect} sampleSource={sampleSource} />
            <span className="layer-number">{recipe.layers.length - index}</span><strong>{item.mask.components[0] ? localizedMaskName(t, { ...item.mask.components[0], name: item.name }) : item.name}</strong><small>{item.mask.components.length} {t("个组件", "components")}</small>
          </button>
          <button type="button" className={item.visible ? "visible" : ""} aria-label={item.visible ? t("隐藏图层", "Hide layer") : t("显示图层", "Show layer")}
            onClick={() => onUpdateLayer({ ...item, visible: !item.visible })}>{item.visible ? "●" : "○"}</button>
          <button type="button" aria-label={t("删除图层", "Delete layer")} onClick={() => onDeleteLayer(item.id)}>×</button>
        </div>
        <div className="mask-components">{item.mask.components.map((component) => <div key={component.id}
          className={`mask-row component-row ${selectedMaskId === component.id ? "active" : ""}`}>
          <button type="button" className="mask-select" onClick={() => onSelectMask(item.id, component.id)}>
            <span>{component.mode === "add" ? "+" : component.mode === "subtract" ? "−" : "∩"}</span>
            <strong>{localizedMaskName(t, component)}</strong><small>{t(MODE_LABELS[component.mode], MODE_EN[component.mode])}</small>
          </button>
          <button type="button" className={component.visible ? "visible" : ""} aria-label={t("切换组件显示", "Toggle component visibility")}
            onClick={() => onSetMaskVisibility(item.id, component.id, !component.visible)}>
            {component.visible ? "●" : "○"}
          </button>
          <button type="button" aria-label={t("删除组件", "Delete component")} onClick={() => onDeleteMask(item.id, component.id)}>×</button>
        </div>)}</div>
      </div>)}</div>
    </PanelSection>

    {layer && !mask && <>
      <PanelSection title={t("添加选区组件", "Add selection component")} badge={`${layer.mask.components.length}/${MAX_MASK_COMPONENTS}`}>
        <div className="parameter-tabs combine-tabs">{(["add", "subtract", "intersect"] as const).map((mode) => <button key={mode}
          type="button" className={combineMode === mode ? "active" : ""} onClick={() => setCombineMode(mode)}>{t(MODE_LABELS[mode], MODE_EN[mode])}</button>)}</div>
        <ToolGrid disabled={layer.mask.components.length >= MAX_MASK_COMPONENTS} onChoose={(type) => onAdd(type, combineMode)} />
      </PanelSection>
      <PanelSection title={t("图层属性", "Layer properties")} badge="ADJUSTMENT">
        <label className="layer-name-field"><span>{t("名称", "Name")}</span><input value={layer.name}
          onChange={(event) => onUpdateLayer({ ...layer, name: event.target.value })} /></label>
        <div className="mask-actions"><button type="button" className={layer.mask.inverted ? "active" : ""}
          onClick={() => onUpdateLayer({ ...layer, mask: { ...layer.mask, inverted: !layer.mask.inverted } })}>{t("反相整个蒙版", "Invert entire mask")}</button></div>
        <Slider label={t("不透明度", "Opacity")} value={layer.opacity * 100} minimum={0} maximum={100} step={1} disabled={false}
          onChange={(value) => onUpdateLayer({ ...layer, opacity: value / 100 })} />
        <div className="layer-stack-controls"><label><span>{t("混合模式", "Blend mode")}</span><select value={layer.blendMode}
          onChange={(event) => onUpdateLayer({ ...layer, blendMode: event.target.value as LayerBlendMode })}>
          <option value="normal">{t("正常", "Normal")}</option><option value="multiply">{t("正片叠底", "Multiply")}</option><option value="screen">{t("滤色", "Screen")}</option>
        </select></label><div><button type="button" disabled={recipe.layers.at(-1)?.id === layer.id}
          onClick={() => onMoveLayer(layer.id, 1)}>{t("上移", "Move up")}</button><button type="button" disabled={recipe.layers[0]?.id === layer.id}
          onClick={() => onMoveLayer(layer.id, -1)}>{t("下移", "Move down")}</button></div></div>
      </PanelSection>
    </>}

    {mask && layer && <MaskProperties mask={mask} brush={brush} onUpdate={(value) => onUpdateMask(layer.id, value)} onBrushChange={onBrushChange} />}

    {layer && !mask && <>
      <PanelSection title={t("图层调整", "Layer adjustments")} badge="BASIC"><div className="sliders">{BASIC_CONTROLS.map((control) => {
        const [minimum, maximum] = BASIC_ADJUSTMENT_LIMITS[control.name];
        return <Slider key={control.name} label={t(control.label, BASIC_EN[control.name])} value={layer.adjustments[control.name]} minimum={minimum} maximum={maximum}
          step={control.step ?? 0.1} digits={control.digits ?? 1} disabled={false}
          onChange={(value) => onUpdateLayer({ ...layer, adjustments: updateAdjustment(layer.adjustments, control.name, value) })} />;
      })}</div></PanelSection>
      <PanelSection title={t("图层曲线", "Layer curve")} badge="CURVE">
        <ToneCurveEditor curves={layer.curves} disabled={false} onChange={(curves) => onUpdateLayer({ ...layer, curves })} />
      </PanelSection>
      <PanelSection title={t("图层 HSL", "Layer HSL")} badge="8 COLOR">
        <div className="parameter-tabs">{(["hue", "saturation", "luminance"] as const).map((name) => <button key={name}
          type="button" className={hslParameter === name ? "active" : ""} onClick={() => setHslParameter(name)}>
          {name === "hue" ? t("色相", "Hue") : name === "saturation" ? t("饱和度", "Saturation") : t("明亮度", "Luminance")}</button>)}</div>
        <div className="sliders hsl-sliders">{HSL_CHANNELS.map((channel) => <Slider key={channel}
          label={t(HSL_LABELS[channel][0], HSL_EN[channel])} accent={HSL_LABELS[channel][1]} value={layer.hsl[channel][hslParameter]}
          minimum={HSL_PARAMETER_LIMITS[hslParameter][0]} maximum={HSL_PARAMETER_LIMITS[hslParameter][1]}
          step={0.1} digits={1} disabled={false}
          onChange={(value) => onUpdateLayer({ ...layer, hsl: updateHslChannel(layer.hsl, channel, hslParameter, value) })} />)}</div>
      </PanelSection>
    </>}
    <div className="panel-footer"><span>ADJUSTMENT LAYERS</span><span>MAX {MAX_LAYERS}</span></div>
  </aside>;
}

function ToolGrid({ disabled, onChoose }: { disabled: boolean; onChoose: (type: MaskType) => void }) {
  const { t } = useI18n();
  return <div className="mask-tool-grid">{MASK_TYPES.map((item) => <button key={item.type} type="button" disabled={disabled} onClick={() => onChoose(item.type)}>
    <b>{item.glyph}</b><span>{t(item.label, MASK_TYPE_EN[item.type])}</span></button>)}</div>;
}

function LayerMaskThumbnail({ layer, imageAspect, sampleSource }: {
  layer: AdjustmentLayer;
  imageAspect: number;
  sampleSource: SourceSampler;
}) {
  const { t } = useI18n();
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const context = canvas.current?.getContext("2d");
    if (!context) return;
    const size = 32;
    const coverage = rasterizeLayerMask(layer, size, imageAspect, sampleSource);
    const image = context.createImageData(size, size);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const value = coverage[(size - 1 - y) * size + x];
        const offset = (y * size + x) * 4;
        image.data.set([value, value, value, 255], offset);
      }
    }
    context.putImageData(image, 0, 0);
  }, [imageAspect, layer, sampleSource]);
  return <canvas ref={canvas} className="layer-mask-thumbnail" width="32" height="32" aria-label={t("最终蒙版缩略图", "Final mask thumbnail")} />;
}

function MaskProperties({ mask, brush, onUpdate, onBrushChange }: {
  mask: MaskComponent;
  brush: BrushSettings;
  onUpdate: (mask: MaskComponent) => void;
  onBrushChange: (settings: BrushSettings) => void;
}) {
  const { t } = useI18n();
  return <PanelSection title={t("选区组件", "Selection component")} badge={mask.type.toUpperCase()}>
    <div className="mask-actions">
      <button type="button" className={mask.inverted ? "active" : ""} onClick={() => onUpdate({ ...mask, inverted: !mask.inverted })}>{t("反相", "Invert")}</button>
      {(mask.type === "brush" || mask.type === "pen") && <button type="button" onClick={() => onUpdate(mask.type === "brush"
        ? { ...mask, strokes: [] } : { ...mask, points: [], closed: false })}>{t("清除", "Clear")}</button>}
      {mask.type === "pen" && <button type="button" className={mask.closed ? "active" : ""} disabled={mask.points.length < 3}
        onClick={() => onUpdate({ ...mask, closed: !mask.closed })}>{t("闭合路径", "Close path")}</button>}
    </div>
    <div className="sliders mask-shape-controls">
      {(mask.type === "linear" || mask.type === "radial" || mask.type === "pen") && <Slider label={t("羽化", "Feather")} value={mask.feather * 100}
        minimum={0} maximum={mask.type === "pen" ? 20 : 100} step={mask.type === "pen" ? 0.5 : 1} disabled={false}
        onChange={(value) => onUpdate({ ...mask, feather: value / 100 })} />}
      {mask.type === "radial" && <Slider label={t("旋转", "Rotation")} value={mask.rotation} minimum={-180} maximum={180} step={1} disabled={false}
        onChange={(value) => onUpdate({ ...mask, rotation: value })} />}
      {mask.type === "brush" && <>
        <Slider label={t("大小", "Size")} value={brush.size * 100} minimum={1} maximum={40} step={1} disabled={false}
          onChange={(value) => onBrushChange({ ...brush, size: value / 100 })} />
        <Slider label={t("羽化", "Feather")} value={brush.feather * 100} minimum={0} maximum={100} step={1} disabled={false}
          onChange={(value) => onBrushChange({ ...brush, feather: value / 100 })} />
        <Slider label={t("流量", "Flow")} value={brush.flow * 100} minimum={1} maximum={100} step={1} disabled={false}
          onChange={(value) => onBrushChange({ ...brush, flow: value / 100 })} />
      </>}
      {mask.type === "chroma" && <>
        <div className="chroma-sample"><i style={{ background: `rgb(${mask.target.map((value) => Math.round(value * 255)).join(",")})` }} />{t("点击照片重新取样", "Click the photo to resample")}</div>
        <Slider label={t("容差", "Tolerance")} value={mask.tolerance * 100} minimum={1} maximum={40} step={1} disabled={false}
          onChange={(value) => onUpdate({ ...mask, tolerance: value / 100 })} />
        <Slider label={t("柔化", "Softness")} value={mask.softness * 100} minimum={0} maximum={30} step={1} disabled={false}
          onChange={(value) => onUpdate({ ...mask, softness: value / 100 })} />
      </>}
    </div>
  </PanelSection>;
}
