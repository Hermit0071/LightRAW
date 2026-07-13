import { useEffect, useRef, useState } from "react";
import { chooseAndOpenImage, type PreviewInfo } from "../bridge/images";
import { createDefaultDevelopRecipe, type DevelopRecipe } from "../editor/develop-recipe";
import {
  addLayer,
  addMaskComponent,
  createAdjustmentLayer,
  createMaskComponent,
  removeLayer,
  removeMaskComponent,
  setMaskComponentVisibility,
  updateLayer,
  type AdjustmentLayer,
  type MaskCombineMode,
  type MaskComponent,
  type MaskPoint,
  type MaskType,
} from "../editor/masks";
import { calculateHistogram, type HistogramData } from "../renderer/histogram";
import { halfToFloat } from "../renderer/histogram";
import {
  PreviewRenderer,
  type PreviewLayout,
  type PreviewMetrics,
} from "../renderer/preview-renderer";
import { AdjustmentPanel } from "./AdjustmentPanel";
import { CropOverlay } from "./CropOverlay";
import { CropPanel } from "./CropPanel";
import { MaskOverlay } from "./MaskOverlay";
import { MaskPanel, type BrushSettings } from "./MaskPanel";

type ActiveTool = "adjust" | "crop" | "mask";
const FULL_CROP = { x: 0, y: 0, width: 1, height: 1 } as const;

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<PreviewRenderer | null>(null);
  const [recipe, setRecipe] = useState(createDefaultDevelopRecipe);
  const [photo, setPhoto] = useState<PreviewInfo | null>(null);
  const [sourcePixels, setSourcePixels] = useState<Uint16Array | null>(null);
  const [histogram, setHistogram] = useState<HistogramData | null>(null);
  const [activeTool, setActiveTool] = useState<ActiveTool>("adjust");
  const [previewLayout, setPreviewLayout] = useState<PreviewLayout | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [message, setMessage] = useState("");
  const [metrics, setMetrics] = useState<PreviewMetrics | null>(null);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [selectedMaskId, setSelectedMaskId] = useState<string | null>(null);
  const [brush, setBrush] = useState<BrushSettings>({ size: 0.08, feather: 0.65, flow: 0.8 });
  const selectedLayer = recipe.layers.find((layer) => layer.id === selectedLayerId) ?? null;
  const selectedMask = selectedLayer?.mask.components.find((mask) => mask.id === selectedMaskId && mask.visible) ?? null;

  useEffect(() => {
    if (!canvasRef.current) return;
    try {
      rendererRef.current = new PreviewRenderer(canvasRef.current, recipe, setMetrics, setPreviewLayout);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : String(error));
    }
    return () => rendererRef.current?.destroy();
    // Renderer updates flow through setRecipe after initial construction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const displayed = activeTool === "crop" && recipe.geometry.straighten === 0
      ? { ...recipe, geometry: { ...recipe.geometry, crop: FULL_CROP } }
      : recipe;
    rendererRef.current?.setRecipe(displayed);
  }, [activeTool, recipe]);

  useEffect(() => {
    rendererRef.current?.setMaskOverlay(activeTool === "mask" ? selectedLayerId : null);
  }, [activeTool, selectedLayerId]);

  useEffect(() => {
    if (!sourcePixels || !photo) {
      setHistogram(null);
      return;
    }
    const timer = window.setTimeout(() => {
      setHistogram(calculateHistogram(sourcePixels, photo.width, photo.height, recipe));
    }, 80);
    return () => window.clearTimeout(timer);
  }, [photo, recipe, sourcePixels]);

  async function openPhoto() {
    setStatus("loading");
    setMessage("正在解码高精度预览…");
    try {
      const opened = await chooseAndOpenImage();
      if (!opened) {
        setStatus(photo ? "ready" : "idle");
        setMessage("");
        return;
      }
      const neutral = createDefaultDevelopRecipe();
      rendererRef.current?.setImage(opened.info.width, opened.info.height, opened.pixels);
      setSourcePixels(new Uint16Array(
        opened.pixels.buffer,
        opened.pixels.byteOffset,
        opened.pixels.byteLength / Uint16Array.BYTES_PER_ELEMENT,
      ));
      setRecipe(neutral);
      setPhoto(opened.info);
      setActiveTool("adjust");
      setSelectedLayerId(null);
      setSelectedMaskId(null);
      setStatus("ready");
      setMessage("");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function createPhotoMask(type: MaskType) {
    const mask = createMaskComponent(type, crypto.randomUUID());
    const layer = createAdjustmentLayer(crypto.randomUUID(), mask);
    setRecipe((current) => ({ ...current, layers: addLayer(current.layers, layer) }));
    setSelectedLayerId(layer.id);
    setSelectedMaskId(mask.id);
  }

  function addSelection(type: MaskType, mode: MaskCombineMode) {
    if (!selectedLayer) return;
    const mask = createMaskComponent(type, crypto.randomUUID(), selectedLayer.mask.components.length === 0 ? "add" : mode);
    changeLayer(addMaskComponent(selectedLayer, mask));
    setSelectedMaskId(mask.id);
  }

  function changeLayer(layer: AdjustmentLayer) {
    setRecipe((current) => ({ ...current, layers: updateLayer(current.layers, layer) }));
  }

  function changeMask(layerId: string, mask: MaskComponent) {
    setRecipe((current) => ({ ...current, layers: current.layers.map((layer) => layer.id === layerId
      ? { ...layer, mask: { ...layer.mask, components: layer.mask.components.map((value) => value.id === mask.id ? mask : value) } }
      : layer) }));
  }

  function deletePhotoLayer(id: string) {
    setRecipe((current) => ({ ...current, layers: removeLayer(current.layers, id) }));
    if (selectedLayerId === id) {
      setSelectedLayerId(null);
      setSelectedMaskId(null);
    }
  }

  function deleteMask(layerId: string, id: string) {
    setRecipe((current) => ({ ...current, layers: current.layers.map((layer) => layer.id === layerId
      ? removeMaskComponent(layer, id)
      : layer) }));
    if (selectedMaskId === id) setSelectedMaskId(null);
  }

  function changeMaskVisibility(layerId: string, id: string, visible: boolean) {
    setRecipe((current) => ({ ...current, layers: current.layers.map((layer) => layer.id === layerId
      ? setMaskComponentVisibility(layer, id, visible)
      : layer) }));
  }

  function sampleSource(point: MaskPoint): readonly [number, number, number] {
    if (!sourcePixels || !photo) return [0.5, 0.5, 0.5];
    const x = Math.min(photo.width - 1, Math.max(0, Math.floor(point.x * photo.width)));
    const y = Math.min(photo.height - 1, Math.max(0, Math.floor(point.y * photo.height)));
    const offset = (y * photo.width + x) * 4;
    return [halfToFloat(sourcePixels[offset]), halfToFloat(sourcePixels[offset + 1]), halfToFloat(sourcePixels[offset + 2])];
  }

  function resetCurrentPanel() {
    if (activeTool === "adjust") {
      const neutral = createDefaultDevelopRecipe();
      setRecipe({ ...recipe, basic: neutral.basic, hsl: neutral.hsl, curves: neutral.curves, detail: neutral.detail });
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand" aria-label="LightRAW">
          <span className="brand-mark">Lr</span><span className="brand-name">LightRAW</span><span className="phase-tag">PHASE 03</span>
        </div>
        <div className="file-summary">
          {photo ? <><strong>{photo.fileName}</strong><span>{photo.width} × {photo.height}</span></> : <span>非破坏性 RAW 工作区</span>}
        </div>
        <button className="open-button" type="button" onClick={openPhoto} disabled={status === "loading"}>
          <OpenIcon />{status === "loading" ? "正在打开" : "打开照片"}
        </button>
      </header>

      <aside className="tool-rail" aria-label="编辑工具">
        <button className={`tool-button ${activeTool === "adjust" ? "active" : ""}`} type="button" onClick={() => setActiveTool("adjust")}>
          <AdjustIcon /><span>调色</span>
        </button>
        <div className="tool-rule" />
        <button className={`tool-button ${activeTool === "crop" ? "active" : ""}`} type="button" disabled={!photo} onClick={() => setActiveTool("crop")}>
          <CropIcon /><span>裁剪</span>
        </button>
        <button className={`tool-button ${activeTool === "mask" ? "active" : ""}`} type="button" disabled={!photo} onClick={() => setActiveTool("mask")}><MaskIcon /><span>蒙版</span></button>
        <div className="gpu-badge"><i />GPU</div>
      </aside>

      <section className={`viewport ${activeTool === "crop" ? "crop-active" : ""}`} aria-label="照片预览">
        <canvas ref={canvasRef} />
        {!photo && status !== "loading" && <EmptyState onOpen={openPhoto} />}
        {status === "loading" && <div className="loading-state"><span className="spinner" /><strong>构建线性预览</strong><span>{message}</span></div>}
        {status === "error" && (
          <div className="error-toast" role="alert"><strong>无法打开照片</strong><span>{message}</span>
            <button type="button" onClick={() => { setStatus(photo ? "ready" : "idle"); setMessage(""); }}>关闭</button></div>
        )}
        {photo && activeTool === "crop" && recipe.geometry.straighten === 0 && previewLayout && (
          <CropOverlay layout={previewLayout} geometry={recipe.geometry}
            onChange={(crop) => setRecipe((current) => ({ ...current, geometry: { ...current.geometry, crop, aspect: "free" } }))} />
        )}
        {photo && activeTool === "mask" && previewLayout && selectedMask && <MaskOverlay layout={previewLayout} mask={selectedMask} geometry={recipe.geometry}
          imageWidth={photo.width} imageHeight={photo.height} brush={brush}
          onUpdate={(mask) => selectedLayerId && changeMask(selectedLayerId, mask)} onSample={sampleSource} />}
        {photo && <div className="preview-status">
          <span>{photo.format}</span>{photo.camera && <span>{photo.camera}</span>}
          <span className="live"><i />实时预览{metrics && ` · ${metrics.fps || "—"} FPS · ${metrics.frameLatencyMs.toFixed(1)} ms`}</span>
        </div>}
      </section>

      {activeTool === "adjust" ? (
        <AdjustmentPanel recipe={recipe} histogram={histogram} disabled={!photo} onChange={setRecipe}
          onReset={resetCurrentPanel} />
      ) : activeTool === "crop" ? (
        <CropPanel recipe={recipe} imageAspect={photo ? photo.width / photo.height : 1} disabled={!photo}
          freeCropEnabled={recipe.geometry.straighten === 0} onChange={setRecipe} />
      ) : (
        <MaskPanel recipe={recipe} selectedLayerId={selectedLayerId} selectedMaskId={selectedMaskId} brush={brush} disabled={!photo}
          imageAspect={photo ? photo.width / photo.height : 1} sampleSource={sampleSource}
          onCreate={createPhotoMask} onAdd={addSelection} onSelectLayer={(id) => { setSelectedLayerId(id); setSelectedMaskId(null); }}
          onSelectMask={(layerId, maskId) => { setSelectedLayerId(layerId); setSelectedMaskId(maskId); }}
          onUpdateLayer={changeLayer} onUpdateMask={changeMask} onSetMaskVisibility={changeMaskVisibility}
          onDeleteLayer={deletePhotoLayer} onDeleteMask={deleteMask} onBrushChange={setBrush} />
      )}
    </main>
  );
}

function EmptyState({ onOpen }: { onOpen: () => void }) {
  return <div className="empty-state"><div className="empty-aperture"><ApertureIcon /></div>
    <p className="eyebrow">LIGHTRAW · DEVELOP</p><h1>让照片回到光线本身</h1>
    <p className="empty-copy">打开一张 JPEG、HEIF 或相机 RAW，开始进行非破坏性实时调色。</p>
    <button className="empty-open" type="button" onClick={onOpen}>选择照片</button>
    <p className="format-list">JPG · HEIC · CR3 · NEF · ARW · RAF · DNG</p></div>;
}

function OpenIcon() { return <svg viewBox="0 0 24 24"><path d="M4 8.5h6l2-2h8v11H4z"/><path d="M4 10h16"/></svg>; }
function AdjustIcon() { return <svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>; }
function CropIcon() { return <svg viewBox="0 0 24 24"><path d="M7 3v14h14M3 7h14v14"/></svg>; }
function MaskIcon() { return <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 0 0 16z"/></svg>; }
function ApertureIcon() { return <svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="26"/><path d="m18 11 15 21M53 18l-21 14M53 46H29M18 53l14-21M11 18l21 14M11 46l21-14"/></svg>; }
