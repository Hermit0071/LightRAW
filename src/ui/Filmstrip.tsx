import type { LibraryPhoto } from "../library/catalog";

export function Filmstrip({ photos, activeId, onOpen }: {
  photos: LibraryPhoto[];
  activeId: string | null;
  onOpen: (photo: LibraryPhoto) => void;
}) {
  return <div className="filmstrip" aria-label="胶片栏">
    <div className="filmstrip-summary"><strong>{photos.length}</strong><span>胶片</span></div>
    <div className="filmstrip-track">{photos.map((photo) => <button key={photo.id} type="button"
      className={activeId === photo.id ? "active" : ""} title={photo.fileName} onClick={() => onOpen(photo)}>
      {photo.thumbnail ? <img src={photo.thumbnail} alt="" /> : <span>{photo.format}</span>}
      {photo.rating > 0 && <i>{photo.rating}★</i>}
    </button>)}</div>
  </div>;
}
