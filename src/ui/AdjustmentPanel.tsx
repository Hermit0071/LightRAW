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
import { useI18n } from "./i18n";

interface BasicSlider { name: BasicAdjustmentName; label: readonly [string, string]; step?: number; digits?: number; }
const WHITE_BALANCE: BasicSlider[] = [
  { name: "temperature", label: ["色温", "Temperature"] }, { name: "tint", label: ["色调", "Tint"] },
];
const TONE: BasicSlider[] = [
  { name: "exposure", label: ["曝光", "Exposure"], step: 0.01, digits: 2 }, { name: "contrast", label: ["对比度", "Contrast"] },
  { name: "highlights", label: ["高光", "Highlights"] }, { name: "shadows", label: ["阴影", "Shadows"] },
  { name: "whites", label: ["白色色阶", "Whites"] }, { name: "blacks", label: ["黑色色阶", "Blacks"] },
];
const PRESENCE: BasicSlider[] = [
  { name: "texture", label: ["纹理", "Texture"] }, { name: "clarity", label: ["清晰度", "Clarity"] },
  { name: "dehaze", label: ["去雾", "Dehaze"] }, { name: "vibrance", label: ["自然饱和度", "Vibrance"] },
  { name: "saturation", label: ["饱和度", "Saturation"] },
];
const HSL_LABELS = {
  red: [["红色", "Red"], "#ef5b54"], orange: [["橙色", "Orange"], "#ef9b45"], yellow: [["黄色", "Yellow"], "#e4cb4b"],
  green: [["绿色", "Green"], "#63bd6b"], aqua: [["青色", "Aqua"], "#4dc4bd"], blue: [["蓝色", "Blue"], "#5795e8"],
  purple: [["紫色", "Purple"], "#986bd3"], magenta: [["洋红", "Magenta"], "#d35b9f"],
} as const;
const DETAIL: { name: DetailAdjustmentName; label: readonly [string, string]; step?: number; digits?: number }[] = [
  { name: "sharpeningAmount", label: ["锐化数量", "Sharpening amount"] },
  { name: "sharpeningRadius", label: ["锐化半径", "Sharpening radius"], step: 0.01, digits: 2 },
  { name: "sharpeningDetail", label: ["锐化细节", "Sharpening detail"] },
  { name: "luminanceNoiseReduction", label: ["明亮度降噪", "Luminance noise reduction"] },
  { name: "colorNoiseReduction", label: ["颜色降噪", "Color noise reduction"] },
];

export function AdjustmentPanel({ recipe, histogram, disabled, onChange, onReset }: {
  recipe: DevelopRecipe;
  histogram: HistogramData | null;
  disabled: boolean;
  onChange: (recipe: DevelopRecipe) => void;
  onReset: () => void;
}) {
  const { t } = useI18n();
  const [hslParameter, setHslParameter] = useState<HslParameter>("hue");
  const updateBasic = (name: BasicAdjustmentName, value: number) => onChange({
    ...recipe, basic: updateAdjustment(recipe.basic, name, value),
  });
  return (
    <aside className="adjustments-panel" aria-label={t("完整调色", "Adjustments")}>
      <PanelHeading title={t("完整调色", "Adjustments")} disabled={disabled} onReset={onReset} />
      <Histogram data={histogram} />
      <PanelSection title={t("白平衡", "White balance")} badge="WB"><div className="sliders">{WHITE_BALANCE.map((item) => (
        <BasicControl key={item.name} item={item} recipe={recipe} disabled={disabled} onChange={updateBasic} />
      ))}</div></PanelSection>
      <PanelSection title={t("影调", "Tone")} badge="TONE"><div className="sliders">{TONE.map((item) => (
        <BasicControl key={item.name} item={item} recipe={recipe} disabled={disabled} onChange={updateBasic} />
      ))}</div></PanelSection>
      <PanelSection title={t("存在感", "Presence")} badge="PRESENCE"><div className="sliders">{PRESENCE.map((item) => (
        <BasicControl key={item.name} item={item} recipe={recipe} disabled={disabled} onChange={updateBasic} />
      ))}</div></PanelSection>
      <PanelSection title={t("色调曲线", "Tone curve")} badge="CURVE">
        <ToneCurveEditor curves={recipe.curves} disabled={disabled} onChange={(curves) => onChange({ ...recipe, curves })} />
      </PanelSection>
      <PanelSection title="HSL" badge="8 COLOR">
        <div className="parameter-tabs">
          {(["hue", "saturation", "luminance"] as const).map((name) => (
            <button key={name} type="button" className={hslParameter === name ? "active" : ""} onClick={() => setHslParameter(name)}>
              {name === "hue" ? t("色相", "Hue") : name === "saturation" ? t("饱和度", "Saturation") : t("明亮度", "Luminance")}
            </button>
          ))}
        </div>
        <div className="sliders hsl-sliders">{HSL_CHANNELS.map((channel) => (
          <Slider
            key={channel}
            label={t(HSL_LABELS[channel][0][0], HSL_LABELS[channel][0][1])}
            accent={HSL_LABELS[channel][1]}
            value={recipe.hsl[channel][hslParameter]}
            minimum={HSL_PARAMETER_LIMITS[hslParameter][0]} maximum={HSL_PARAMETER_LIMITS[hslParameter][1]}
            step={0.1} digits={1} disabled={disabled}
            onChange={(value) => onChange({ ...recipe, hsl: updateHslChannel(recipe.hsl, channel, hslParameter, value) })}
          />
        ))}</div>
      </PanelSection>
      <PanelSection title={t("细节", "Detail")} badge="DETAIL"><div className="sliders">{DETAIL.map((item) => {
        const [minimum, maximum] = DETAIL_LIMITS[item.name];
        return <Slider key={item.name} label={t(...item.label)} value={recipe.detail[item.name]} minimum={minimum} maximum={maximum}
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
  const { t } = useI18n();
  const [minimum, maximum] = BASIC_ADJUSTMENT_LIMITS[item.name];
  return <Slider label={t(...item.label)} value={recipe.basic[item.name]} minimum={minimum} maximum={maximum}
    step={item.step ?? 0.1} digits={item.digits ?? 1} disabled={disabled}
    onChange={(value) => onChange(item.name, value)} />;
}

export function PanelHeading({ title, disabled, onReset }: { title: string; disabled: boolean; onReset: () => void }) {
  const { t } = useI18n();
  return <div className="panel-heading"><div><p>DEVELOP</p><h2>{title}</h2></div>
    <button type="button" className="reset-button" onClick={onReset} disabled={disabled}>{t("重置", "Reset")}</button></div>;
}
