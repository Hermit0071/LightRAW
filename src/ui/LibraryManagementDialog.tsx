import type { LibraryPhoto } from "../library/catalog";
import { buildRenameRequests } from "./file-management";
import { useI18n } from "./i18n";

export type LibraryManagementDialogMode = "delete" | "rename";

export function LibraryManagementDialog({ mode, photos, renameValue, busy, onRenameValue, onRename, onRemoveCatalog, onTrash, onCancel }: {
  mode: LibraryManagementDialogMode;
  photos: LibraryPhoto[];
  renameValue: string;
  busy: boolean;
  onRenameValue: (value: string) => void;
  onRename: () => void;
  onRemoveCatalog: () => void;
  onTrash: () => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  let preview: ReturnType<typeof buildRenameRequests> = [];
  let renameError = "";
  if (mode === "rename") {
    try { preview = buildRenameRequests(photos, renameValue); } catch (error) { renameError = error instanceof Error ? error.message : String(error); }
  }
  return <div className="management-backdrop" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
    <section className="management-dialog" role="dialog" aria-modal="true" aria-label={mode === "delete" ? t("删除照片", "Delete photos") : t("重命名照片", "Rename photos")}>
      <header><div><p>LIBRARY · FILES</p><h2>{mode === "delete" ? t("如何删除？", "How should these be deleted?") : photos.length > 1 ? t("批量重命名", "Batch rename") : t("重命名照片", "Rename photo")}</h2></div>
        <button type="button" aria-label={t("关闭", "Close")} disabled={busy} onClick={onCancel}>×</button></header>
      {mode === "delete" ? <div className="delete-choices">
        <p>{t(`已选择 ${photos.length} 张照片。请选择是否保留磁盘中的原始文件。`, `${photos.length} photo(s) selected. Choose whether to keep the original files on disk.`)}</p>
        <button type="button" autoFocus disabled={busy} onClick={onRemoveCatalog}><strong>{t("仅从图库移除", "Remove from library only")}</strong><span>{t("推荐 · 原始文件保持不变，稍后可以重新导入", "Recommended · original files stay intact and can be re-imported later")}</span></button>
        <button className="danger" type="button" disabled={busy} onClick={onTrash}><strong>{t("移到系统废纸篓 / 回收站", "Move to system Trash / Recycle Bin")}</strong><span>{t("同时从 LightRAW 图库移除，可在系统废纸篓中恢复", "Also removes from LightRAW; recoverable from the system Trash/Recycle Bin")}</span></button>
      </div> : <form onSubmit={(event) => { event.preventDefault(); if (!renameError) onRename(); }}>
        <label><span>{photos.length > 1 ? t("基础名称", "Base name") : t("新文件名", "New file name")}</span><input autoFocus value={renameValue} disabled={busy}
          onChange={(event) => onRenameValue(event.target.value)} /></label>
        {photos.length > 1 && <p className="management-note">{t("自动保留扩展名并添加三位序号。现有同名文件不会被覆盖。", "Extensions are preserved and three-digit sequence numbers are added. Existing files are never overwritten.")}</p>}
        {renameError ? <p className="management-error">{renameError}</p> : <div className="rename-preview">{preview.map((item) => <div key={item.path}>
          <span>{item.path.split(/[/\\]/).at(-1)}</span><b>→</b><strong>{item.newName}</strong></div>)}</div>}
        <div className="management-actions"><button type="button" disabled={busy} onClick={onCancel}>{t("取消", "Cancel")}</button><button className="primary" type="submit" disabled={busy || !!renameError}>{t("确认重命名", "Confirm rename")}</button></div>
      </form>}
      {mode === "delete" && <div className="management-actions"><button type="button" disabled={busy} onClick={onCancel}>{t("取消", "Cancel")}</button></div>}
    </section>
  </div>;
}
