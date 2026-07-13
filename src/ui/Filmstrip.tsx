import type { LibraryPhoto } from "../library/catalog";
import { useI18n } from "./i18n";

export function Filmstrip({ photos, activeId, onOpen }: {
  photos: LibraryPhoto[];
  activeId: string | null;
  onOpen: (photo: LibraryPhoto) => void;
}) {
  const { t } = useI18n();
  return <div className="filmstrip" aria-label={t("胶片栏", "Filmstrip")}>
    <div className="filmstrip-summary"><strong>{photos.length}</strong><span>{t("胶片", "film")}</span></div>
    <div className="filmstrip-track">{photos.map((photo) => <button key={photo.id} type="button"
      className={activeId === photo.id ? "active" : ""} title={photo.fileName} onClick={() => onOpen(photo)}>
      {photo.thumbnail ? <img src={photo.thumbnail} alt="" /> : <span>{photo.format}</span>}
      {photo.rating > 0 && <i>{photo.rating}★</i>}
    </button>)}</div>
  </div>;
}
