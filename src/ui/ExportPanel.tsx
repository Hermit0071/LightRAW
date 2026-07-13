import type { ExportFormat, ExportSizeMode } from "../export/export-options";
import { PanelHeading } from "./AdjustmentPanel";
import { PanelSection, Slider } from "./controls";

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
  return <aside className="adjustments-panel export-panel" aria-label="导出">
    <PanelHeading title="导出" disabled onReset={() => undefined} />
    <PanelSection title="文件格式" badge="sRGB"><div className="parameter-tabs">{(["jpeg", "png", "tiff"] as const).map((format) => <button key={format}
      type="button" className={options.format === format ? "active" : ""} onClick={() => onChange({ ...options, format })}>{format.toUpperCase()}</button>)}</div>
      {options.format === "jpeg" && <div className="sliders"><Slider label="质量" value={options.quality} minimum={1} maximum={100} step={1} disabled={false}
        onChange={(quality) => onChange({ ...options, quality })} /></div>}</PanelSection>
    <PanelSection title="输出尺寸" badge="PIXELS"><div className="parameter-tabs">{(["longEdge", "shortEdge", "percent"] as ExportSizeMode[]).map((mode) => <button key={mode}
      type="button" className={options.sizeMode === mode ? "active" : ""} onClick={() => onChange({ ...options, sizeMode: mode })}>
      {{ longEdge: "长边", shortEdge: "短边", percent: "百分比" }[mode]}</button>)}</div>
      <label className="panel-field"><span>{options.sizeMode === "percent" ? "%" : "px"}</span><input type="number" min="1" max={options.sizeMode === "percent" ? 100 : 16384}
        value={options.sizeValue} onChange={(event) => onChange({ ...options, sizeValue: Number(event.target.value) })} /></label></PanelSection>
    <PanelSection title="文字水印" badge="OPTIONAL"><label className="panel-field"><span>文字</span><input maxLength={80} placeholder="留空则不添加"
      value={options.watermark} onChange={(event) => onChange({ ...options, watermark: event.target.value })} /></label></PanelSection>
    <div className="export-actions"><button className="panel-primary" type="button" disabled={disabled} onClick={onCurrent}>导出当前照片</button>
      <button type="button" disabled={selectedCount === 0 || !!progress} onClick={onBatch}>批量导出已选 · {selectedCount}</button>
      {progress && <p>{progress}</p>}</div>
    <div className="panel-footer"><span>GPU RENDER</span><span>sRGB</span></div>
  </aside>;
}
