import type { DevelopRecipe } from "../editor/develop-recipe";
import {
  applyCropAspect,
  CROP_ASPECTS,
  createDefaultGeometry,
  rotateGeometry,
  updateStraighten,
  type CropAspect,
} from "../editor/geometry";
import { PanelSection, Slider } from "./controls";
import { PanelHeading } from "./AdjustmentPanel";

export function CropPanel({ recipe, imageAspect, disabled, freeCropEnabled, onChange }: {
  recipe: DevelopRecipe;
  imageAspect: number;
  disabled: boolean;
  freeCropEnabled: boolean;
  onChange: (recipe: DevelopRecipe) => void;
}) {
  const geometry = recipe.geometry;
  function setAspect(aspect: CropAspect) {
    if (aspect === "free") {
      onChange({ ...recipe, geometry: { ...geometry, aspect } });
      return;
    }
    const quarterTurn = geometry.rotation === 90 || geometry.rotation === 270;
    const target = quarterTurn ? 1 / CROP_ASPECTS[aspect] : CROP_ASPECTS[aspect];
    onChange({ ...recipe, geometry: {
      ...geometry,
      aspect,
      crop: applyCropAspect(geometry.crop, imageAspect, target),
    } });
  }
  return (
    <aside className="adjustments-panel crop-panel" aria-label="裁剪与几何">
      <PanelHeading title="裁剪与几何" disabled={disabled} onReset={() => onChange({ ...recipe, geometry: createDefaultGeometry() })} />
      <PanelSection title="裁剪比例" badge="CROP">
        <div className="aspect-grid">
          {(["free", "1:1", "4:3", "16:9", "3:2"] as CropAspect[]).map((aspect) => (
            <button key={aspect} type="button" className={geometry.aspect === aspect ? "active" : ""} disabled={disabled} onClick={() => setAspect(aspect)}>
              {aspect === "free" ? "自由" : aspect}
            </button>
          ))}
        </div>
        <p className="tool-help">{freeCropEnabled
          ? "拖动预览边框或四角手柄进行自由裁剪。"
          : "当前显示拉直后的最终裁剪；角度归零后可继续拖动自由裁剪。"}</p>
      </PanelSection>
      <PanelSection title="拉直" badge="ANGLE">
        <div className="sliders"><Slider label="角度" value={geometry.straighten} minimum={-45} maximum={45} step={0.1} digits={1}
          disabled={disabled} onChange={(value) => onChange({ ...recipe, geometry: updateStraighten(geometry, value) })} /></div>
      </PanelSection>
      <PanelSection title="旋转与翻转" badge="GEOMETRY">
        <div className="geometry-buttons">
          <button type="button" disabled={disabled} onClick={() => onChange({ ...recipe, geometry: rotateGeometry(geometry, "counterclockwise") })}>↶ <span>左转 90°</span></button>
          <button type="button" disabled={disabled} onClick={() => onChange({ ...recipe, geometry: rotateGeometry(geometry, "clockwise") })}>↷ <span>右转 90°</span></button>
          <button type="button" className={geometry.flipHorizontal ? "active" : ""} disabled={disabled}
            onClick={() => onChange({ ...recipe, geometry: { ...geometry, flipHorizontal: !geometry.flipHorizontal } })}>↔ <span>水平翻转</span></button>
          <button type="button" className={geometry.flipVertical ? "active" : ""} disabled={disabled}
            onClick={() => onChange({ ...recipe, geometry: { ...geometry, flipVertical: !geometry.flipVertical } })}>↕ <span>垂直翻转</span></button>
        </div>
      </PanelSection>
      <div className="crop-readout">
        <span>ROTATION</span><strong>{geometry.rotation + geometry.straighten}°</strong>
        <span>CROP</span><strong>{Math.round(geometry.crop.width * 100)} × {Math.round(geometry.crop.height * 100)}%</strong>
      </div>
    </aside>
  );
}
