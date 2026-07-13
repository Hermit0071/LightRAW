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
import { useI18n } from "./i18n";

export function CropPanel({ recipe, imageAspect, disabled, freeCropEnabled, onChange }: {
  recipe: DevelopRecipe;
  imageAspect: number;
  disabled: boolean;
  freeCropEnabled: boolean;
  onChange: (recipe: DevelopRecipe) => void;
}) {
  const { t } = useI18n();
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
    <aside className="adjustments-panel crop-panel" aria-label={t("裁剪与几何", "Crop and geometry")}>
      <PanelHeading title={t("裁剪与几何", "Crop and geometry")} disabled={disabled} onReset={() => onChange({ ...recipe, geometry: createDefaultGeometry() })} />
      <PanelSection title={t("裁剪比例", "Aspect ratio")} badge="CROP">
        <div className="aspect-grid">
          {(["free", "1:1", "4:3", "16:9", "3:2"] as CropAspect[]).map((aspect) => (
            <button key={aspect} type="button" className={geometry.aspect === aspect ? "active" : ""} disabled={disabled} onClick={() => setAspect(aspect)}>
              {aspect === "free" ? t("自由", "Free") : aspect}
            </button>
          ))}
        </div>
        <p className="tool-help">{freeCropEnabled
          ? t("拖动预览边框或四角手柄进行自由裁剪。", "Drag the frame or corner handles to crop freely.")
          : t("当前显示拉直后的最终裁剪；角度归零后可继续拖动自由裁剪。", "The final straightened crop is shown; set the angle to zero to crop freely.")}</p>
      </PanelSection>
      <PanelSection title={t("拉直", "Straighten")} badge="ANGLE">
        <div className="sliders"><Slider label={t("角度", "Angle")} value={geometry.straighten} minimum={-45} maximum={45} step={0.1} digits={1}
          disabled={disabled} onChange={(value) => onChange({ ...recipe, geometry: updateStraighten(geometry, value) })} /></div>
      </PanelSection>
      <PanelSection title={t("旋转与翻转", "Rotate and flip")} badge="GEOMETRY">
        <div className="geometry-buttons">
          <button type="button" disabled={disabled} onClick={() => onChange({ ...recipe, geometry: rotateGeometry(geometry, "counterclockwise") })}>↶ <span>{t("左转 90°", "Rotate left 90°")}</span></button>
          <button type="button" disabled={disabled} onClick={() => onChange({ ...recipe, geometry: rotateGeometry(geometry, "clockwise") })}>↷ <span>{t("右转 90°", "Rotate right 90°")}</span></button>
          <button type="button" className={geometry.flipHorizontal ? "active" : ""} disabled={disabled}
            onClick={() => onChange({ ...recipe, geometry: { ...geometry, flipHorizontal: !geometry.flipHorizontal } })}>↔ <span>{t("水平翻转", "Flip horizontal")}</span></button>
          <button type="button" className={geometry.flipVertical ? "active" : ""} disabled={disabled}
            onClick={() => onChange({ ...recipe, geometry: { ...geometry, flipVertical: !geometry.flipVertical } })}>↕ <span>{t("垂直翻转", "Flip vertical")}</span></button>
        </div>
      </PanelSection>
      <div className="crop-readout">
        <span>ROTATION</span><strong>{geometry.rotation + geometry.straighten}°</strong>
        <span>CROP</span><strong>{Math.round(geometry.crop.width * 100)} × {Math.round(geometry.crop.height * 100)}%</strong>
      </div>
    </aside>
  );
}
