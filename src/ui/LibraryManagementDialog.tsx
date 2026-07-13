import type { LibraryPhoto } from "../library/catalog";
import { buildRenameRequests } from "./file-management";

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
  let preview: ReturnType<typeof buildRenameRequests> = [];
  let renameError = "";
  if (mode === "rename") {
    try { preview = buildRenameRequests(photos, renameValue); } catch (error) { renameError = error instanceof Error ? error.message : String(error); }
  }
  return <div className="management-backdrop" role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
    <section className="management-dialog" role="dialog" aria-modal="true" aria-label={mode === "delete" ? "删除照片" : "重命名照片"}>
      <header><div><p>LIBRARY · FILES</p><h2>{mode === "delete" ? "如何删除？" : photos.length > 1 ? "批量重命名" : "重命名照片"}</h2></div>
        <button type="button" aria-label="关闭" disabled={busy} onClick={onCancel}>×</button></header>
      {mode === "delete" ? <div className="delete-choices">
        <p>已选择 {photos.length} 张照片。请选择是否保留磁盘中的原始文件。</p>
        <button type="button" autoFocus disabled={busy} onClick={onRemoveCatalog}><strong>仅从图库移除</strong><span>推荐 · 原始文件保持不变，稍后可以重新导入</span></button>
        <button className="danger" type="button" disabled={busy} onClick={onTrash}><strong>移到系统废纸篓 / 回收站</strong><span>同时从 LightRAW 图库移除，可在系统废纸篓中恢复</span></button>
      </div> : <form onSubmit={(event) => { event.preventDefault(); if (!renameError) onRename(); }}>
        <label><span>{photos.length > 1 ? "基础名称" : "新文件名"}</span><input autoFocus value={renameValue} disabled={busy}
          onChange={(event) => onRenameValue(event.target.value)} /></label>
        {photos.length > 1 && <p className="management-note">自动保留扩展名并添加三位序号。现有同名文件不会被覆盖。</p>}
        {renameError ? <p className="management-error">{renameError}</p> : <div className="rename-preview">{preview.map((item) => <div key={item.path}>
          <span>{item.path.split(/[/\\]/).at(-1)}</span><b>→</b><strong>{item.newName}</strong></div>)}</div>}
        <div className="management-actions"><button type="button" disabled={busy} onClick={onCancel}>取消</button><button className="primary" type="submit" disabled={busy || !!renameError}>确认重命名</button></div>
      </form>}
      {mode === "delete" && <div className="management-actions"><button type="button" disabled={busy} onClick={onCancel}>取消</button></div>}
    </section>
  </div>;
}
