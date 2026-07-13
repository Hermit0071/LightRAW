import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import {
  cropFromDisplay,
  cropToDisplay,
  normalizeCrop,
  type CropRect,
  type GeometrySettings,
} from "../editor/geometry";
import type { PreviewLayout } from "../renderer/preview-renderer";
import { useI18n } from "./i18n";

const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;
type Handle = (typeof HANDLES)[number];

export function CropOverlay({ layout, geometry, onChange }: {
  layout: PreviewLayout;
  geometry: GeometrySettings;
  onChange: (crop: CropRect) => void;
}) {
  const { t } = useI18n();
  const displayCrop = cropToDisplay(geometry.crop, geometry);
  const drag = useRef<{ handle: Handle; x: number; y: number; crop: CropRect } | null>(null);
  const frame = {
    left: layout.x + displayCrop.x * layout.width,
    top: layout.y + displayCrop.y * layout.height,
    width: displayCrop.width * layout.width,
    height: displayCrop.height * layout.height,
  };

  function start(event: ReactPointerEvent<HTMLButtonElement>, handle: Handle) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { handle, x: event.clientX, y: event.clientY, crop: displayCrop };
  }

  function move(event: ReactPointerEvent<HTMLButtonElement>) {
    const state = drag.current;
    if (!state) return;
    const dx = (event.clientX - state.x) / layout.width;
    const dy = (event.clientY - state.y) / layout.height;
    let { x, y, width, height } = state.crop;
    if (state.handle.includes("w")) { x += dx; width -= dx; }
    if (state.handle.includes("e")) width += dx;
    if (state.handle.includes("n")) { y += dy; height -= dy; }
    if (state.handle.includes("s")) height += dy;
    const edited = normalizeCrop({ x, y, width, height });
    onChange(cropFromDisplay(edited, geometry));
  }

  return (
    <div className="crop-overlay" style={frame}>
      <div className="crop-thirds horizontal one" /><div className="crop-thirds horizontal two" />
      <div className="crop-thirds vertical one" /><div className="crop-thirds vertical two" />
      {HANDLES.map((handle) => <button key={handle} type="button" className={`crop-handle ${handle}`} aria-label={`${t("裁剪手柄", "Crop handle")} ${handle}`}
        onPointerDown={(event) => start(event, handle)} onPointerMove={move} onPointerUp={() => { drag.current = null; }} />)}
    </div>
  );
}
