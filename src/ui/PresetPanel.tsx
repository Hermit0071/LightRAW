import { useState } from "react";
import type { DevelopPreset } from "../editor/presets";
import { PanelHeading } from "./AdjustmentPanel";
import { PanelSection } from "./controls";

export function PresetPanel({ presets, disabled, onSave, onApply, onImport, onExport, onDelete }: {
  presets: DevelopPreset[];
  disabled: boolean;
  onSave: (name: string) => void;
  onApply: (preset: DevelopPreset) => void;
  onImport: () => void;
  onExport: (preset: DevelopPreset) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState("");
  return <aside className="adjustments-panel preset-panel" aria-label="预设">
    <PanelHeading title="预设" disabled onReset={() => undefined} />
    <PanelSection title="保存当前效果" badge="JSON">
      <div className="preset-create"><input aria-label="预设名称" placeholder="例如：柔和人像" value={name}
        onChange={(event) => setName(event.target.value)} />
        <button type="button" disabled={disabled || !name.trim()} onClick={() => { onSave(name); setName(""); }}>保存</button></div>
      <p className="preset-note">保存全局调色、细节与调整图层；裁剪和旋转不会写入预设。</p>
    </PanelSection>
    <PanelSection title="我的预设" badge={`${presets.length}`}>
      <div className="preset-list">{presets.length === 0 && <p>暂无预设</p>}{presets.map((preset) => <div key={preset.id} className="preset-row">
        <button type="button" disabled={disabled} onClick={() => onApply(preset)}><strong>{preset.name}</strong><small>{new Date(preset.createdAt).toLocaleDateString()}</small></button>
        <button type="button" aria-label={`导出 ${preset.name}`} onClick={() => onExport(preset)}>⇧</button>
        <button type="button" aria-label={`删除 ${preset.name}`} onClick={() => onDelete(preset.id)}>×</button>
      </div>)}</div>
    </PanelSection>
    <div className="preset-import"><button type="button" onClick={onImport}>导入 JSON 预设</button></div>
    <div className="panel-footer"><span>LIGHTRAW PRESET</span><span>VERSION 1</span></div>
  </aside>;
}
