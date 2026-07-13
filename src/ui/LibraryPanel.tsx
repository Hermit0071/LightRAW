import type { LibrarySort } from "../library/catalog";
import { PanelHeading } from "./AdjustmentPanel";
import { PanelSection } from "./controls";

export function LibraryPanel({ count, selectedCount, sort, busy, onSort, onImport, onSelectAll, onClear }: {
  count: number;
  selectedCount: number;
  sort: LibrarySort;
  busy: boolean;
  onSort: (sort: LibrarySort) => void;
  onImport: () => void;
  onSelectAll: () => void;
  onClear: () => void;
}) {
  return <aside className="adjustments-panel library-panel" aria-label="图库管理">
    <PanelHeading title="照片图库" disabled onReset={() => undefined} />
    <PanelSection title="导入" badge="LIBRARY"><button className="panel-primary" type="button" disabled={busy} onClick={onImport}>
      {busy ? "正在导入…" : "批量导入照片"}</button><p className="preset-note">支持 JPEG、PNG、TIFF、HEIF/HEIC 与主流相机 RAW。</p></PanelSection>
    <PanelSection title="排序" badge={`${count}`}><label className="panel-field"><span>依据</span><select value={sort} onChange={(event) => onSort(event.target.value as LibrarySort)}>
      <option value="importedAt">导入时间</option><option value="fileName">文件名</option><option value="rating">星级评分</option>
    </select></label></PanelSection>
    <PanelSection title="批量选择" badge={`${selectedCount} SELECTED`}><div className="panel-button-row"><button type="button" disabled={count === 0} onClick={onSelectAll}>全选</button>
      <button type="button" disabled={selectedCount === 0} onClick={onClear}>清除选择</button></div></PanelSection>
    <div className="panel-footer"><span>PERSISTENT CATALOG</span><span>{count} PHOTOS</span></div>
  </aside>;
}
