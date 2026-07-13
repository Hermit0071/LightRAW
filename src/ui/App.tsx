import { useCallback, useEffect, useRef, useState } from "react";
import { chooseAndOpenImage, type PreviewInfo } from "../bridge/images";
import { choosePresetJson, savePresetJson } from "../bridge/presets";
import { createDefaultDevelopRecipe, type DevelopRecipe } from "../editor/develop-recipe";
import { commitHistory, commitTransaction, createHistory, redoHistory, undoHistory } from "../editor/history";
import {
  addLayer,
  addMaskComponent,
  createAdjustmentLayer,
  createMaskComponent,
  moveLayer,
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
import { applyPreset, createPreset, parsePresetJson, stringifyPreset, type DevelopPreset } from "../editor/presets";
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
import { PresetPanel } from "./PresetPanel";

type ActiveTool = "adjust" | "crop" | "mask" | "preset";
const FULL_CROP = { x: 0, y: 0, width: 1, height: 1 } as const;
const PRESET_STORAGE_KEY = "lightraw.presets.v1";
type EditTransactionKind = "pointer" | "text";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<PreviewRenderer | null>(null);
  const [history, setHistory] = useState(() => createHistory(createDefaultDevelopRecipe()));
  const recipe = history.present;
  const recipeRef = useRef(recipe);
  const editTransaction = useRef<{ kind: EditTransactionKind; baseline: DevelopRecipe } | null>(null);
  recipeRef.current = recipe;
  const setRecipe = useCallback((next: DevelopRecipe | ((current: DevelopRecipe) => DevelopRecipe)) => {
    setHistory((current) => {
      const value = typeof next === "function" ? next(current.present) : next;
      if (Object.is(current.present, value)) return current;
      return editTransaction.current ? { ...current, present: value } : commitHistory(current, value);
    });
  }, []);
  const beginEditTransaction = useCallback((kind: EditTransactionKind) => {
    const previous = editTransaction.current;
    if (previous?.kind === kind) return;
    if (previous) setHistory((current) => commitTransaction(current, previous.baseline));
    editTransaction.current = { kind, baseline: recipeRef.current };
  }, []);
  const settleEditTransaction = useCallback(() => {
    const transaction = editTransaction.current;
    if (!transaction) return;
    editTransaction.current = null;
    setHistory((current) => commitTransaction(current, transaction.baseline));
  }, []);
  const endEditTransaction = useCallback((kind: EditTransactionKind) => {
    const transaction = editTransaction.current;
    if (!transaction || transaction.kind !== kind) return;
    settleEditTransaction();
  }, [settleEditTransaction]);
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
  const [showBefore, setShowBefore] = useState(false);
  const [presets, setPresets] = useState<DevelopPreset[]>(loadPresets);
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
    const displayed = showBefore ? createDefaultDevelopRecipe() : activeTool === "crop" && recipe.geometry.straighten === 0
      ? { ...recipe, geometry: { ...recipe.geometry, crop: FULL_CROP } }
      : recipe;
    rendererRef.current?.setRecipe(displayed);
  }, [activeTool, recipe, showBefore]);

  useEffect(() => {
    rendererRef.current?.setMaskOverlay(activeTool === "mask" && !showBefore ? selectedLayerId : null);
  }, [activeTool, selectedLayerId, showBefore]);

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
    settleEditTransaction();
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
      editTransaction.current = null;
      setHistory(createHistory(neutral));
      setPhoto(opened.info);
      setActiveTool("adjust");
      setSelectedLayerId(null);
      setSelectedMaskId(null);
      setShowBefore(false);
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

  function reorderLayer(id: string, direction: -1 | 1) {
    setRecipe((current) => ({ ...current, layers: moveLayer(current.layers, id, direction) }));
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

  function replacePresets(next: DevelopPreset[]) {
    setPresets(next);
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(next));
  }

  function saveCurrentPreset(name: string) {
    replacePresets([...presets, createPreset(name, recipe)]);
  }

  async function importPreset() {
    try {
      const contents = await choosePresetJson();
      if (!contents) return;
      const imported = parsePresetJson(contents);
      replacePresets([...presets.filter((preset) => preset.id !== imported.id), imported]);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function exportPreset(preset: DevelopPreset) {
    try {
      await savePresetJson(preset.name, stringifyPreset(preset));
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const command = event.metaKey || event.ctrlKey;
      if (command && event.key.toLowerCase() === "o") {
        event.preventDefault();
        void openPhoto();
      } else if (command && event.key.toLowerCase() === "z") {
        if (isTextEditingTarget(event.target)) return;
        event.preventDefault();
        setHistory((current) => event.shiftKey ? redoHistory(current) : undoHistory(current));
      } else if (command && event.key.toLowerCase() === "y") {
        if (isTextEditingTarget(event.target)) return;
        event.preventDefault();
        setHistory((current) => redoHistory(current));
      } else if (isTextEditingTarget(event.target) || event.target instanceof HTMLSelectElement) {
        return;
      } else if (event.key === "\\" && photo) {
        event.preventDefault();
        setShowBefore((current) => !current);
      } else if (!command && photo && ["c", "m", "e", "p"].includes(event.key.toLowerCase())) {
        setActiveTool(({ c: "crop", m: "mask", e: "adjust", p: "preset" } as const)[event.key.toLowerCase() as "c" | "m" | "e" | "p"]);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  useEffect(() => {
    const endPointerEdit = () => endEditTransaction("pointer");
    window.addEventListener("pointerup", endPointerEdit);
    window.addEventListener("pointercancel", endPointerEdit);
    return () => {
      window.removeEventListener("pointerup", endPointerEdit);
      window.removeEventListener("pointercancel", endPointerEdit);
    };
  }, [endEditTransaction]);

  return (
    <main className="app-shell"
      onPointerDownCapture={(event) => { if (isContinuousEditTarget(event.target)) beginEditTransaction("pointer"); }}
      onFocusCapture={(event) => { if (isRecipeTextInput(event.target)) beginEditTransaction("text"); }}
      onBlurCapture={(event) => { if (isRecipeTextInput(event.target)) endEditTransaction("text"); }}>
      <header className="topbar">
        <div className="brand" aria-label="LightRAW">
          <span className="brand-mark">Lr</span><span className="brand-name">LightRAW</span><span className="phase-tag">PHASE 04</span>
        </div>
        <div className="file-summary">
          {photo ? <><strong>{photo.fileName}</strong><span>{photo.width} × {photo.height}</span></> : <span>非破坏性 RAW 工作区</span>}
        </div>
        <div className="top-actions"><button className="history-button" type="button" aria-label="撤销" title="撤销 ⌘Z"
          disabled={history.past.length === 0} onClick={() => setHistory((current) => undoHistory(current))}>↶</button>
          <button className="history-button" type="button" aria-label="重做" title="重做 ⇧⌘Z"
            disabled={history.future.length === 0} onClick={() => setHistory((current) => redoHistory(current))}>↷</button>
          <button className={`compare-button ${showBefore ? "active" : ""}`} type="button" disabled={!photo}
            title="前后对比 \\" onClick={() => setShowBefore((current) => !current)}>{showBefore ? "原图" : "前后"}</button>
          <button className="open-button" type="button" onClick={openPhoto} disabled={status === "loading"}>
            <OpenIcon />{status === "loading" ? "正在打开" : "打开照片"}</button></div>
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
        <button className={`tool-button ${activeTool === "preset" ? "active" : ""}`} type="button" onClick={() => setActiveTool("preset")}><PresetIcon /><span>预设</span></button>
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
        {photo && activeTool === "mask" && !showBefore && previewLayout && selectedMask && <MaskOverlay layout={previewLayout} mask={selectedMask} geometry={recipe.geometry}
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
      ) : activeTool === "mask" ? (
        <MaskPanel recipe={recipe} selectedLayerId={selectedLayerId} selectedMaskId={selectedMaskId} brush={brush} disabled={!photo}
          imageAspect={photo ? photo.width / photo.height : 1} sampleSource={sampleSource}
          onCreate={createPhotoMask} onAdd={addSelection} onSelectLayer={(id) => { setSelectedLayerId(id); setSelectedMaskId(null); }}
          onSelectMask={(layerId, maskId) => { setSelectedLayerId(layerId); setSelectedMaskId(maskId); }}
          onUpdateLayer={changeLayer} onMoveLayer={reorderLayer} onUpdateMask={changeMask} onSetMaskVisibility={changeMaskVisibility}
          onDeleteLayer={deletePhotoLayer} onDeleteMask={deleteMask} onBrushChange={setBrush} />
      ) : (
        <PresetPanel presets={presets} disabled={!photo} onSave={saveCurrentPreset}
          onApply={(preset) => setRecipe((current) => applyPreset(current, preset))} onImport={importPreset}
          onExport={exportPreset} onDelete={(id) => replacePresets(presets.filter((preset) => preset.id !== id))} />
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
function PresetIcon() { return <svg viewBox="0 0 24 24"><path d="m12 3 2.4 5.2L20 9l-4 4 .9 5.7L12 16l-4.9 2.7L8 13 4 9l5.6-.8z"/></svg>; }
function ApertureIcon() { return <svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="26"/><path d="m18 11 15 21M53 18l-21 14M53 46H29M18 53l14-21M11 18l21 14M11 46l21-14"/></svg>; }

function loadPresets(): DevelopPreset[] {
  try {
    const value = JSON.parse(localStorage.getItem(PRESET_STORAGE_KEY) ?? "[]") as unknown;
    return Array.isArray(value) ? value.flatMap((item) => {
      try { return [parsePresetJson(JSON.stringify(item))]; } catch { return []; }
    }) : [];
  } catch {
    return [];
  }
}

function isTextEditingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable
    || target instanceof HTMLTextAreaElement
    || (target instanceof HTMLInputElement && target.type !== "range"));
}

function isContinuousEditTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('input[type="range"], .curve-editor, .crop-overlay, .mask-overlay') !== null;
}

function isRecipeTextInput(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement && target.closest(".layer-name-field") !== null;
}
