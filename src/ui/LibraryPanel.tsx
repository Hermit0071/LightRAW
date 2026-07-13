import type { LibrarySort } from "../library/catalog";
import { PanelHeading } from "./AdjustmentPanel";
import { PanelSection } from "./controls";
import { useI18n } from "./i18n";

export function LibraryPanel({ count, selectedCount, sort, busy, progress, onSort, onImport, onSelectAll, onClear,
  onReveal, onRename, onCopy, onMove, onDelete }: {
  count: number;
  selectedCount: number;
  sort: LibrarySort;
  busy: boolean;
  progress: string;
  onSort: (sort: LibrarySort) => void;
  onImport: () => void;
  onSelectAll: () => void;
  onClear: () => void;
  onReveal: () => void;
  onRename: () => void;
  onCopy: () => void;
  onMove: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  return <aside className="adjustments-panel library-panel" aria-label={t("图库管理", "Library management")}>
    <PanelHeading title={t("照片图库", "Photo library")} disabled onReset={() => undefined} />
    <PanelSection title={t("导入", "Import")} badge="LIBRARY"><button className="panel-primary" type="button" disabled={busy} onClick={onImport}>
      {busy ? t("正在导入…", "Importing…") : t("批量导入照片", "Import photos")}</button><p className="preset-note">{t("支持 JPEG、PNG、TIFF、HEIF/HEIC 与主流相机 RAW。", "Supports JPEG, PNG, TIFF, HEIF/HEIC, and major camera RAW formats.")}</p></PanelSection>
    <PanelSection title={t("排序", "Sort")} badge={`${count}`}><label className="panel-field"><span>{t("依据", "By")}</span><select value={sort} onChange={(event) => onSort(event.target.value as LibrarySort)}>
      <option value="importedAt">{t("导入时间", "Import time")}</option><option value="fileName">{t("文件名", "File name")}</option><option value="rating">{t("星级评分", "Rating")}</option>
    </select></label></PanelSection>
    <PanelSection title={t("批量选择", "Selection")} badge={`${selectedCount} SELECTED`}><div className="panel-button-row"><button type="button" disabled={count === 0} onClick={onSelectAll}>{t("全选", "Select all")}</button>
      <button type="button" disabled={selectedCount === 0} onClick={onClear}>{t("清除选择", "Clear selection")}</button></div></PanelSection>
    <PanelSection title={t("文件管理", "File management")} badge="LOCAL"><div className="management-grid">
      <button type="button" disabled={busy || selectedCount !== 1} onClick={onReveal}>{t("显示所在位置", "Reveal in Finder/Explorer")}</button>
      <button type="button" disabled={busy || selectedCount === 0} onClick={onRename}>{selectedCount > 1 ? t("批量重命名", "Batch rename") : t("重命名", "Rename")}</button>
      <button type="button" disabled={busy || selectedCount === 0} onClick={onCopy}>{t("复制到…", "Copy to…")}</button>
      <button type="button" disabled={busy || selectedCount === 0} onClick={onMove}>{t("移动到…", "Move to…")}</button>
      <button className="danger" type="button" disabled={busy || selectedCount === 0} onClick={onDelete}>{t("删除…", "Delete…")}</button>
    </div><p className="preset-note">{t("复制与移动遇到同名文件时自动保留两者，不会覆盖。", "Copy and move never overwrite same-named files.")}</p>{progress && <p className="operation-progress">{progress}</p>}</PanelSection>
    <div className="panel-footer"><span>PERSISTENT CATALOG</span><span>{count} PHOTOS</span></div>
  </aside>;
}
