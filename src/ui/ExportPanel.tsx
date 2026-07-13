import type { ExportFormat, ExportSizeMode } from "../export/export-options";
import { PanelHeading } from "./AdjustmentPanel";
import { PanelSection, Slider } from "./controls";
import { useI18n } from "./i18n";

export interface ExportUiOptions {
  format: ExportFormat;
  sizeMode: ExportSizeMode;
  sizeValue: number;
  quality: number;
  watermark: string;
}

export function ExportPanel({ options, disabled, selectedCount, progress, onChange, onCurrent, onBatch }: {
  options: ExportUiOptions;
  disabled: boolean;
  selectedCount: number;
  progress: string;
  onChange: (options: ExportUiOptions) => void;
  onCurrent: () => void;
  onBatch: () => void;
}) {
  const { t } = useI18n();
  return <aside className="adjustments-panel export-panel" aria-label={t("导出", "Export")}>
    <PanelHeading title={t("导出", "Export")} disabled onReset={() => undefined} />
    <PanelSection title={t("文件格式", "File format")} badge="sRGB"><div className="parameter-tabs">{(["jpeg", "png", "tiff"] as const).map((format) => <button key={format}
      type="button" className={options.format === format ? "active" : ""} onClick={() => onChange({ ...options, format })}>{format.toUpperCase()}</button>)}</div>
      {options.format === "jpeg" && <div className="sliders"><Slider label={t("质量", "Quality")} value={options.quality} minimum={1} maximum={100} step={1} disabled={false}
        onChange={(quality) => onChange({ ...options, quality })} /></div>}</PanelSection>
    <PanelSection title={t("输出尺寸", "Output size")} badge="PIXELS"><div className="parameter-tabs">{(["longEdge", "shortEdge", "percent"] as ExportSizeMode[]).map((mode) => <button key={mode}
      type="button" className={options.sizeMode === mode ? "active" : ""} onClick={() => onChange({ ...options, sizeMode: mode })}>
      {mode === "longEdge" ? t("长边", "Long edge") : mode === "shortEdge" ? t("短边", "Short edge") : t("百分比", "Percent")}</button>)}</div>
      <label className="panel-field"><span>{options.sizeMode === "percent" ? "%" : "px"}</span><input type="number" min="1" max={options.sizeMode === "percent" ? 100 : 16384}
        value={options.sizeValue} onChange={(event) => onChange({ ...options, sizeValue: Number(event.target.value) })} /></label></PanelSection>
    <PanelSection title={t("文字水印", "Text watermark")} badge="OPTIONAL"><label className="panel-field"><span>{t("文字", "Text")}</span><input maxLength={80} placeholder={t("留空则不添加", "Leave empty to omit")}
      value={options.watermark} onChange={(event) => onChange({ ...options, watermark: event.target.value })} /></label></PanelSection>
    <div className="export-actions"><button className="panel-primary" type="button" disabled={disabled} onClick={onCurrent}>{t("导出当前照片", "Export current photo")}</button>
      <button type="button" disabled={selectedCount === 0 || !!progress} onClick={onBatch}>{t("批量导出已选", "Batch export selected")} · {selectedCount}</button>
      {progress && <p>{progress}</p>}</div>
    <div className="panel-footer"><span>GPU RENDER</span><span>sRGB</span></div>
  </aside>;
}
