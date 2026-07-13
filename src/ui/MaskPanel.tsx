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

  return <aside className="adjustments-panel mask-panel" aria-label="图层与蒙版">
    <PanelHeading title={mask ? "编辑选区组件" : "图层与蒙版"} disabled={!layer || !!mask} onReset={resetLayer} />
    <PanelSection title="新建调整图层" badge={`${recipe.layers.length}/${MAX_LAYERS}`}>
      <ToolGrid disabled={disabled || recipe.layers.length >= MAX_LAYERS} onChoose={onCreate} />
    </PanelSection>

    <PanelSection title="调整图层" badge="LAYERS">
      <div className="mask-list layer-list">{recipe.layers.length === 0 && <p>选择一种蒙版，新建调整图层</p>}{layersForDisplay(recipe.layers).map((item, index) => <div key={item.id} className="layer-entry">
        <div className={`mask-row layer-row ${selectedLayerId === item.id && !selectedMaskId ? "active" : ""}`}>
          <button type="button" className="mask-select" onClick={() => onSelectLayer(item.id)}>
            <LayerMaskThumbnail layer={item} imageAspect={imageAspect} sampleSource={sampleSource} />
            <span className="layer-number">{recipe.layers.length - index}</span><strong>{item.name}</strong><small>{item.mask.components.length} 个组件</small>
          </button>
          <button type="button" className={item.visible ? "visible" : ""} aria-label={item.visible ? "隐藏图层" : "显示图层"}
            onClick={() => onUpdateLayer({ ...item, visible: !item.visible })}>{item.visible ? "●" : "○"}</button>
          <button type="button" aria-label="删除图层" onClick={() => onDeleteLayer(item.id)}>×</button>
        </div>
        <div className="mask-components">{item.mask.components.map((component) => <div key={component.id}
          className={`mask-row component-row ${selectedMaskId === component.id ? "active" : ""}`}>
          <button type="button" className="mask-select" onClick={() => onSelectMask(item.id, component.id)}>
            <span>{component.mode === "add" ? "+" : component.mode === "subtract" ? "−" : "∩"}</span>
            <strong>{component.name}</strong><small>{MODE_LABELS[component.mode]}</small>
          </button>
          <button type="button" className={component.visible ? "visible" : ""} aria-label="切换组件显示"
            onClick={() => onSetMaskVisibility(item.id, component.id, !component.visible)}>
            {component.visible ? "●" : "○"}
          </button>
          <button type="button" aria-label="删除组件" onClick={() => onDeleteMask(item.id, component.id)}>×</button>
        </div>)}</div>
      </div>)}</div>
    </PanelSection>

    {layer && !mask && <>
      <PanelSection title="添加选区组件" badge={`${layer.mask.components.length}/${MAX_MASK_COMPONENTS}`}>
        <div className="parameter-tabs combine-tabs">{(["add", "subtract", "intersect"] as const).map((mode) => <button key={mode}
          type="button" className={combineMode === mode ? "active" : ""} onClick={() => setCombineMode(mode)}>{MODE_LABELS[mode]}</button>)}</div>
        <ToolGrid disabled={layer.mask.components.length >= MAX_MASK_COMPONENTS} onChoose={(type) => onAdd(type, combineMode)} />
      </PanelSection>
      <PanelSection title="图层属性" badge="ADJUSTMENT">
        <label className="layer-name-field"><span>名称</span><input value={layer.name}
          onChange={(event) => onUpdateLayer({ ...layer, name: event.target.value })} /></label>
        <div className="mask-actions"><button type="button" className={layer.mask.inverted ? "active" : ""}
          onClick={() => onUpdateLayer({ ...layer, mask: { ...layer.mask, inverted: !layer.mask.inverted } })}>反相整个蒙版</button></div>
        <Slider label="不透明度" value={layer.opacity * 100} minimum={0} maximum={100} step={1} disabled={false}
          onChange={(value) => onUpdateLayer({ ...layer, opacity: value / 100 })} />
        <div className="layer-stack-controls"><label><span>混合模式</span><select value={layer.blendMode}
          onChange={(event) => onUpdateLayer({ ...layer, blendMode: event.target.value as LayerBlendMode })}>
          <option value="normal">正常</option><option value="multiply">正片叠底</option><option value="screen">滤色</option>
        </select></label><div><button type="button" disabled={recipe.layers.at(-1)?.id === layer.id}
          onClick={() => onMoveLayer(layer.id, 1)}>上移</button><button type="button" disabled={recipe.layers[0]?.id === layer.id}
          onClick={() => onMoveLayer(layer.id, -1)}>下移</button></div></div>
      </PanelSection>
    </>}

    {mask && layer && <MaskProperties mask={mask} brush={brush} onUpdate={(value) => onUpdateMask(layer.id, value)} onBrushChange={onBrushChange} />}

    {layer && !mask && <>
      <PanelSection title="图层调整" badge="BASIC"><div className="sliders">{BASIC_CONTROLS.map((control) => {
        const [minimum, maximum] = BASIC_ADJUSTMENT_LIMITS[control.name];
        return <Slider key={control.name} label={control.label} value={layer.adjustments[control.name]} minimum={minimum} maximum={maximum}
          step={control.step ?? 0.1} digits={control.digits ?? 1} disabled={false}
          onChange={(value) => onUpdateLayer({ ...layer, adjustments: updateAdjustment(layer.adjustments, control.name, value) })} />;
      })}</div></PanelSection>
      <PanelSection title="图层曲线" badge="CURVE">
        <ToneCurveEditor curves={layer.curves} disabled={false} onChange={(curves) => onUpdateLayer({ ...layer, curves })} />
      </PanelSection>
      <PanelSection title="图层 HSL" badge="8 COLOR">
        <div className="parameter-tabs">{(["hue", "saturation", "luminance"] as const).map((name) => <button key={name}
          type="button" className={hslParameter === name ? "active" : ""} onClick={() => setHslParameter(name)}>
          {{ hue: "色相", saturation: "饱和度", luminance: "明亮度" }[name]}</button>)}</div>
        <div className="sliders hsl-sliders">{HSL_CHANNELS.map((channel) => <Slider key={channel}
          label={HSL_LABELS[channel][0]} accent={HSL_LABELS[channel][1]} value={layer.hsl[channel][hslParameter]}
          minimum={HSL_PARAMETER_LIMITS[hslParameter][0]} maximum={HSL_PARAMETER_LIMITS[hslParameter][1]}
          step={0.1} digits={1} disabled={false}
          onChange={(value) => onUpdateLayer({ ...layer, hsl: updateHslChannel(layer.hsl, channel, hslParameter, value) })} />)}</div>
      </PanelSection>
    </>}
    <div className="panel-footer"><span>ADJUSTMENT LAYERS</span><span>MAX {MAX_LAYERS}</span></div>
  </aside>;
}

function ToolGrid({ disabled, onChoose }: { disabled: boolean; onChoose: (type: MaskType) => void }) {
  return <div className="mask-tool-grid">{MASK_TYPES.map((item) => <button key={item.type} type="button" disabled={disabled} onClick={() => onChoose(item.type)}>
    <b>{item.glyph}</b><span>{item.label}</span></button>)}</div>;
}

function LayerMaskThumbnail({ layer, imageAspect, sampleSource }: {
  layer: AdjustmentLayer;
  imageAspect: number;
  sampleSource: SourceSampler;
}) {
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
  return <canvas ref={canvas} className="layer-mask-thumbnail" width="32" height="32" aria-label="最终蒙版缩略图" />;
}

function MaskProperties({ mask, brush, onUpdate, onBrushChange }: {
  mask: MaskComponent;
  brush: BrushSettings;
  onUpdate: (mask: MaskComponent) => void;
  onBrushChange: (settings: BrushSettings) => void;
}) {
  return <PanelSection title="选区组件" badge={mask.type.toUpperCase()}>
    <div className="mask-actions">
      <button type="button" className={mask.inverted ? "active" : ""} onClick={() => onUpdate({ ...mask, inverted: !mask.inverted })}>反相</button>
      {(mask.type === "brush" || mask.type === "pen") && <button type="button" onClick={() => onUpdate(mask.type === "brush"
        ? { ...mask, strokes: [] } : { ...mask, points: [], closed: false })}>清除</button>}
      {mask.type === "pen" && <button type="button" className={mask.closed ? "active" : ""} disabled={mask.points.length < 3}
        onClick={() => onUpdate({ ...mask, closed: !mask.closed })}>闭合路径</button>}
    </div>
    <div className="sliders mask-shape-controls">
      {(mask.type === "linear" || mask.type === "radial" || mask.type === "pen") && <Slider label="羽化" value={mask.feather * 100}
        minimum={0} maximum={mask.type === "pen" ? 20 : 100} step={mask.type === "pen" ? 0.5 : 1} disabled={false}
        onChange={(value) => onUpdate({ ...mask, feather: value / 100 })} />}
      {mask.type === "radial" && <Slider label="旋转" value={mask.rotation} minimum={-180} maximum={180} step={1} disabled={false}
        onChange={(value) => onUpdate({ ...mask, rotation: value })} />}
      {mask.type === "brush" && <>
        <Slider label="大小" value={brush.size * 100} minimum={1} maximum={40} step={1} disabled={false}
          onChange={(value) => onBrushChange({ ...brush, size: value / 100 })} />
        <Slider label="羽化" value={brush.feather * 100} minimum={0} maximum={100} step={1} disabled={false}
          onChange={(value) => onBrushChange({ ...brush, feather: value / 100 })} />
        <Slider label="流量" value={brush.flow * 100} minimum={1} maximum={100} step={1} disabled={false}
          onChange={(value) => onBrushChange({ ...brush, flow: value / 100 })} />
      </>}
      {mask.type === "chroma" && <>
        <div className="chroma-sample"><i style={{ background: `rgb(${mask.target.map((value) => Math.round(value * 255)).join(",")})` }} />点击照片重新取样</div>
        <Slider label="容差" value={mask.tolerance * 100} minimum={1} maximum={40} step={1} disabled={false}
          onChange={(value) => onUpdate({ ...mask, tolerance: value / 100 })} />
        <Slider label="柔化" value={mask.softness * 100} minimum={0} maximum={30} step={1} disabled={false}
          onChange={(value) => onUpdate({ ...mask, softness: value / 100 })} />
      </>}
    </div>
  </PanelSection>;
}
