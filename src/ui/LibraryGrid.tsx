import type { LibraryPhoto, PhotoRating } from "../library/catalog";
import { useI18n } from "./i18n";

export function LibraryGrid({ photos, activeId, selectedIds, onOpen, onToggle, onRate }: {
  photos: LibraryPhoto[];
  activeId: string | null;
  selectedIds: ReadonlySet<string>;
  onOpen: (photo: LibraryPhoto) => void;
  onToggle: (id: string) => void;
  onRate: (id: string, rating: PhotoRating) => void;
}) {
  const { t } = useI18n();
  return <div className="library-view" aria-label={t("照片图库", "Photo library")}>
    <div className="library-heading"><div><p>LIGHTRAW · LIBRARY</p><h1>{photos.length} {t("张照片", "photos")}</h1></div><span>{t("双击缩略图进入调色", "Double-click a thumbnail to edit")}</span></div>
    <div className="photo-grid">{photos.map((photo) => <article key={photo.id} className={`photo-card ${activeId === photo.id ? "active" : ""}`}>
      <button className="photo-thumb" type="button" onDoubleClick={() => onOpen(photo)} onClick={() => onToggle(photo.id)}>
        {photo.thumbnail ? <img src={photo.thumbnail} alt="" /> : <span className="photo-placeholder">{photo.format}</span>}
        <i className={selectedIds.has(photo.id) ? "selected" : ""}>{selectedIds.has(photo.id) ? "✓" : ""}</i>
      </button>
      <div className="photo-meta"><button type="button" onClick={() => onOpen(photo)}><strong title={photo.fileName}>{photo.fileName}</strong>
        <small>{photo.sourceWidth} × {photo.sourceHeight} · {photo.format}</small></button>
        <div className="star-rating" aria-label={`${photo.fileName} ${t("评分", "rating")}`}>{([1, 2, 3, 4, 5] as PhotoRating[]).map((rating) => <button key={rating}
          type="button" className={rating <= photo.rating ? "active" : ""} aria-label={`${rating} ${t("星", "stars")}`}
          onClick={() => onRate(photo.id, photo.rating === rating ? 0 : rating)}>★</button>)}</div>
      </div>
    </article>)}</div>
  </div>;
}
