import { useState } from "react";
import {
  BASIC_ADJUSTMENT_LIMITS,
  updateAdjustment,
  type BasicAdjustmentName,
} from "../editor/basic-adjustments";
import { DETAIL_LIMITS, updateDetail, type DetailAdjustmentName } from "../editor/detail";
import type { DevelopRecipe } from "../editor/develop-recipe";
import {
  HSL_CHANNELS,
  HSL_PARAMETER_LIMITS,
  updateHslChannel,
  type HslParameter,
} from "../editor/hsl";
import type { HistogramData } from "../renderer/histogram";
import { Histogram } from "./Histogram";
import { PanelSection, Slider } from "./controls";
import { ToneCurveEditor } from "./ToneCurveEditor";

interface BasicSlider { name: BasicAdjustmentName; label: string; step?: number; digits?: number; }
const WHITE_BALANCE: BasicSlider[] = [
  { name: "temperature", label: "色温" }, { name: "tint", label: "色调" },
];
const TONE: BasicSlider[] = [
  { name: "exposure", label: "曝光", step: 0.01, digits: 2 }, { name: "contrast", label: "对比度" },
  { name: "highlights", label: "高光" }, { name: "shadows", label: "阴影" },
  { name: "whites", label: "白色色阶" }, { name: "blacks", label: "黑色色阶" },
];
const PRESENCE: BasicSlider[] = [
  { name: "texture", label: "纹理" }, { name: "clarity", label: "清晰度" },
  { name: "dehaze", label: "去雾" }, { name: "vibrance", label: "自然饱和度" },
  { name: "saturation", label: "饱和度" },
];
const HSL_LABELS = {
  red: ["红色", "#ef5b54"], orange: ["橙色", "#ef9b45"], yellow: ["黄色", "#e4cb4b"],
  green: ["绿色", "#63bd6b"], aqua: ["青色", "#4dc4bd"], blue: ["蓝色", "#5795e8"],
  purple: ["紫色", "#986bd3"], magenta: ["洋红", "#d35b9f"],
} as const;
const DETAIL: { name: DetailAdjustmentName; label: string; step?: number; digits?: number }[] = [
  { name: "sharpeningAmount", label: "锐化数量" },
  { name: "sharpeningRadius", label: "锐化半径", step: 0.01, digits: 2 },
  { name: "sharpeningDetail", label: "锐化细节" },
  { name: "luminanceNoiseReduction", label: "明亮度降噪" },
  { name: "colorNoiseReduction", label: "颜色降噪" },
];

export function AdjustmentPanel({ recipe, histogram, disabled, onChange, onReset }: {
  recipe: DevelopRecipe;
  histogram: HistogramData | null;
  disabled: boolean;
  onChange: (recipe: DevelopRecipe) => void;
  onReset: () => void;
}) {
  const [hslParameter, setHslParameter] = useState<HslParameter>("hue");
  const updateBasic = (name: BasicAdjustmentName, value: number) => onChange({
    ...recipe, basic: updateAdjustment(recipe.basic, name, value),
  });
  return (
    <aside className="adjustments-panel" aria-label="完整调色">
      <PanelHeading title="完整调色" disabled={disabled} onReset={onReset} />
      <Histogram data={histogram} />
      <PanelSection title="白平衡" badge="WB"><div className="sliders">{WHITE_BALANCE.map((item) => (
        <BasicControl key={item.name} item={item} recipe={recipe} disabled={disabled} onChange={updateBasic} />
      ))}</div></PanelSection>
      <PanelSection title="影调" badge="TONE"><div className="sliders">{TONE.map((item) => (
        <BasicControl key={item.name} item={item} recipe={recipe} disabled={disabled} onChange={updateBasic} />
      ))}</div></PanelSection>
      <PanelSection title="存在感" badge="PRESENCE"><div className="sliders">{PRESENCE.map((item) => (
        <BasicControl key={item.name} item={item} recipe={recipe} disabled={disabled} onChange={updateBasic} />
      ))}</div></PanelSection>
      <PanelSection title="色调曲线" badge="CURVE">
        <ToneCurveEditor curves={recipe.curves} disabled={disabled} onChange={(curves) => onChange({ ...recipe, curves })} />
      </PanelSection>
      <PanelSection title="HSL" badge="8 COLOR">
        <div className="parameter-tabs">
          {(["hue", "saturation", "luminance"] as const).map((name) => (
            <button key={name} type="button" className={hslParameter === name ? "active" : ""} onClick={() => setHslParameter(name)}>
              {{ hue: "色相", saturation: "饱和度", luminance: "明亮度" }[name]}
            </button>
          ))}
        </div>
        <div className="sliders hsl-sliders">{HSL_CHANNELS.map((channel) => (
          <Slider
            key={channel}
            label={HSL_LABELS[channel][0]}
            accent={HSL_LABELS[channel][1]}
            value={recipe.hsl[channel][hslParameter]}
            minimum={HSL_PARAMETER_LIMITS[hslParameter][0]} maximum={HSL_PARAMETER_LIMITS[hslParameter][1]}
            step={0.1} digits={1} disabled={disabled}
            onChange={(value) => onChange({ ...recipe, hsl: updateHslChannel(recipe.hsl, channel, hslParameter, value) })}
          />
        ))}</div>
      </PanelSection>
      <PanelSection title="细节" badge="DETAIL"><div className="sliders">{DETAIL.map((item) => {
        const [minimum, maximum] = DETAIL_LIMITS[item.name];
        return <Slider key={item.name} label={item.label} value={recipe.detail[item.name]} minimum={minimum} maximum={maximum}
          step={item.step ?? 0.1} digits={item.digits ?? 1} disabled={disabled}
          onChange={(value) => onChange({ ...recipe, detail: updateDetail(recipe.detail, item.name, value) })} />;
      })}</div></PanelSection>
      <div className="panel-footer"><span>16-bit linear preview</span><span>WebGL 2</span></div>
    </aside>
  );
}

function BasicControl({ item, recipe, disabled, onChange }: {
  item: BasicSlider; recipe: DevelopRecipe; disabled: boolean;
  onChange: (name: BasicAdjustmentName, value: number) => void;
}) {
  const [minimum, maximum] = BASIC_ADJUSTMENT_LIMITS[item.name];
  return <Slider label={item.label} value={recipe.basic[item.name]} minimum={minimum} maximum={maximum}
    step={item.step ?? 0.1} digits={item.digits ?? 1} disabled={disabled}
    onChange={(value) => onChange(item.name, value)} />;
}

export function PanelHeading({ title, disabled, onReset }: { title: string; disabled: boolean; onReset: () => void }) {
  return <div className="panel-heading"><div><p>DEVELOP</p><h2>{title}</h2></div>
    <button type="button" className="reset-button" onClick={onReset} disabled={disabled}>重置</button></div>;
}
