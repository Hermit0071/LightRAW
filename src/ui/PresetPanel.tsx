import { useState } from "react";
import type { DevelopPreset } from "../editor/presets";
import { PanelHeading } from "./AdjustmentPanel";
import { PanelSection } from "./controls";
import { useI18n } from "./i18n";

export function PresetPanel({ presets, disabled, onSave, onApply, onImport, onExport, onDelete }: {
  presets: DevelopPreset[];
  disabled: boolean;
  onSave: (name: string) => void;
  onApply: (preset: DevelopPreset) => void;
  onImport: () => void;
  onExport: (preset: DevelopPreset) => void;
  onDelete: (id: string) => void;
}) {
  const { t, locale } = useI18n();
  const [name, setName] = useState("");
  return <aside className="adjustments-panel preset-panel" aria-label={t("预设", "Presets")}>
    <PanelHeading title={t("预设", "Presets")} disabled onReset={() => undefined} />
    <PanelSection title={t("保存当前效果", "Save current look")} badge="JSON">
      <div className="preset-create"><input aria-label={t("预设名称", "Preset name")} placeholder={t("例如：柔和人像", "e.g. Soft portrait")} value={name}
        onChange={(event) => setName(event.target.value)} />
        <button type="button" disabled={disabled || !name.trim()} onClick={() => { onSave(name); setName(""); }}>{t("保存", "Save")}</button></div>
      <p className="preset-note">{t("保存全局调色、细节与调整图层；裁剪和旋转不会写入预设。", "Saves global edits, detail, and adjustment layers; crop and rotation are excluded.")}</p>
    </PanelSection>
    <PanelSection title={t("我的预设", "My presets")} badge={`${presets.length}`}>
      <div className="preset-list">{presets.length === 0 && <p>{t("暂无预设", "No presets yet")}</p>}{presets.map((preset) => <div key={preset.id} className="preset-row">
        <button type="button" disabled={disabled} onClick={() => onApply(preset)}><strong>{preset.name}</strong><small>{new Date(preset.createdAt).toLocaleDateString(locale === "en" ? "en-US" : "zh-CN")}</small></button>
        <button type="button" aria-label={`${t("导出", "Export")} ${preset.name}`} onClick={() => onExport(preset)}>⇧</button>
        <button type="button" aria-label={`${t("删除", "Delete")} ${preset.name}`} onClick={() => onDelete(preset.id)}>×</button>
      </div>)}</div>
    </PanelSection>
    <div className="preset-import"><button type="button" onClick={onImport}>{t("导入 JSON 预设", "Import JSON preset")}</button></div>
    <div className="panel-footer"><span>LIGHTRAW PRESET</span><span>VERSION 1</span></div>
  </aside>;
}
