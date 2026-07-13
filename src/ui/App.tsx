import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  loadCatalogBackupFile,
  loadCatalogFile,
  loadCatalogThumbnails,
  saveCatalogFile,
  saveCatalogThumbnail,
} from "../bridge/catalog";
import { chooseExportDirectory, chooseExportPath, writeExport } from "../bridge/export";
import { chooseImagePaths, openImagePath, type OpenedPreview, type PreviewInfo } from "../bridge/images";
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
import { batchExportFileNames, calculateDecodeLongEdge, calculateExportDimensions } from "../export/export-options";
import { addTextWatermark } from "../export/raster";
import {
  applyCatalogThumbnails,
  createLibraryPhoto,
  mergeActiveRecipe,
  mergeImportedPhotos,
  parseCatalogCopies,
  ratePhoto,
  sortPhotos,
  stringifyCatalog,
  type LibraryPhoto,
  type LibrarySort,
  type PhotoRating,
} from "../library/catalog";
import { stringifyCatalogAsync } from "../library/catalog-serializer";
import { saveCatalogUnlessCancelled } from "../library/catalog-save";
import { thumbnailDataUrl } from "../library/thumbnail";
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
import { ExportPanel, type ExportUiOptions } from "./ExportPanel";
import { Filmstrip } from "./Filmstrip";
import { LibraryGrid } from "./LibraryGrid";
import { LibraryPanel } from "./LibraryPanel";
import { WorkspaceNavigator, type GpuStatus } from "./WorkspaceNavigator";
import { resolveShortcut, type ShortcutTool } from "./shortcuts";
import {
  clampInspectorWidth,
  filterLibraryPhotos,
  normalizeWorkspaceTheme,
  type LibraryCollection,
  type WorkspaceTheme,
} from "./workspace-layout";

type ActiveTool = ShortcutTool;
const FULL_CROP = { x: 0, y: 0, width: 1, height: 1 } as const;
const PRESET_STORAGE_KEY = "lightraw.presets.v1";
const THEME_STORAGE_KEY = "lightraw.workspace.theme";
const INSPECTOR_WIDTH_STORAGE_KEY = "lightraw.workspace.inspector-width";
type EditTransactionKind = "pointer" | "text";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<PreviewRenderer | null>(null);
  const exportingRef = useRef(false);
  const importingRef = useRef(false);
  const closingRef = useRef(false);
  const [history, setHistory] = useState(() => createHistory(createDefaultDevelopRecipe()));
  const recipe = history.present;
  const recipeRef = useRef(recipe);
  const editTransaction = useRef<{ kind: EditTransactionKind; baseline: DevelopRecipe } | null>(null);
  recipeRef.current = recipe;
  const setRecipe = useCallback((next: DevelopRecipe | ((current: DevelopRecipe) => DevelopRecipe)) => {
    if (exportingRef.current || importingRef.current) return;
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
  const [gpuStatus, setGpuStatus] = useState<GpuStatus>("checking");
  const [message, setMessage] = useState("");
  const [metrics, setMetrics] = useState<PreviewMetrics | null>(null);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [selectedMaskId, setSelectedMaskId] = useState<string | null>(null);
  const [brush, setBrush] = useState<BrushSettings>({ size: 0.08, feather: 0.65, flow: 0.8 });
  const [showBefore, setShowBefore] = useState(false);
  const [presets, setPresets] = useState<DevelopPreset[]>(loadPresets);
  const [library, setLibrary] = useState<LibraryPhoto[]>([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [librarySort, setLibrarySort] = useState<LibrarySort>("importedAt");
  const [libraryCollection, setLibraryCollection] = useState<LibraryCollection>("all");
  const [workspaceTheme, setWorkspaceTheme] = useState<WorkspaceTheme>(loadWorkspaceTheme);
  const [inspectorWidth, setInspectorWidth] = useState(loadInspectorWidth);
  const [exportOptions, setExportOptions] = useState<ExportUiOptions>({
    format: "jpeg", sizeMode: "percent", sizeValue: 100, quality: 90, watermark: "",
  });
  const [exportProgress, setExportProgress] = useState("");
  const libraryRef = useRef(library);
  const catalogLoadedRef = useRef(catalogLoaded);
  const activePhotoIdRef = useRef(activePhotoId);
  libraryRef.current = library;
  catalogLoadedRef.current = catalogLoaded;
  activePhotoIdRef.current = activePhotoId;
  const selectedPhotoIdSet = new Set(selectedPhotoIds);
  const workspaceBusy = !catalogLoaded || status === "loading" || !!exportProgress;
  const sortedLibrary = sortPhotos(library, librarySort);
  const visibleLibrary = filterLibraryPhotos(sortedLibrary, libraryCollection, selectedPhotoIdSet);
  const showFilmstrip = activeTool !== "library" && visibleLibrary.length > 0;
  const selectedLayer = recipe.layers.find((layer) => layer.id === selectedLayerId) ?? null;
  const selectedMask = selectedLayer?.mask.components.find((mask) => mask.id === selectedMaskId && mask.visible) ?? null;

  useEffect(() => {
    if (!canvasRef.current) return;
    try {
      rendererRef.current = new PreviewRenderer(canvasRef.current, recipe, setMetrics, setPreviewLayout);
      setGpuStatus("ready");
    } catch (error) {
      setGpuStatus("error");
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

  useEffect(() => {
    if (!isTauriRuntime()) {
      setCatalogLoaded(true);
      return;
    }
    void Promise.all([loadCatalogFile(), loadCatalogBackupFile()]).then(async ([primary, backup]) => {
      const result = parseCatalogCopies(primary, backup);
      const externalThumbnails = await loadCatalogThumbnails(result.photos.map((photo) => photo.id));
      const legacyThumbnails = result.photos.filter((photo) => photo.thumbnail && !externalThumbnails[photo.id]);
      await Promise.all(legacyThumbnails.map((photo) => saveCatalogThumbnail(photo.id, photo.thumbnail!)));
      const photos = applyCatalogThumbnails(result.photos, externalThumbnails);
      setLibrary(photos);
      if (photos.length > 0) setActiveTool("library");
      if (result.recovered) {
        setStatus("error");
        setMessage("图库主文件无效，已从上一份有效备份恢复。");
      }
      setCatalogLoaded(true);
    }).catch((error) => {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : String(error));
    });
  }, []);

  useEffect(() => {
    if (!catalogLoaded || !isTauriRuntime()) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (closingRef.current) return;
      void saveCatalogUnlessCancelled(
        () => stringifyCatalogAsync(library),
        () => cancelled || closingRef.current,
        saveCatalogFile,
      ).catch((error) => {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : String(error));
      });
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [catalogLoaded, library]);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let unlisten: (() => void) | undefined;
    let mounted = true;
    const appWindow = getCurrentWindow();
    void appWindow.onCloseRequested(async (event) => {
      event.preventDefault();
      if (exportingRef.current || importingRef.current) {
        setStatus("error");
        setMessage("请等待当前导入或导出完成后再关闭 LightRAW。");
        return;
      }
      closingRef.current = true;
      try {
        if (catalogLoadedRef.current) {
          const snapshot = mergeActiveRecipe(libraryRef.current, activePhotoIdRef.current, recipeRef.current);
          await saveCatalogFile(stringifyCatalog(snapshot));
        }
        await appWindow.destroy();
      } catch (error) {
        closingRef.current = false;
        setStatus("error");
        setMessage(error instanceof Error ? error.message : String(error));
      }
    }).then((dispose) => {
      if (mounted) unlisten = dispose;
      else dispose();
    });
    return () => {
      mounted = false;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!activePhotoId) return;
    setLibrary((current) => current.map((item) => item.id === activePhotoId && item.recipe !== recipe ? { ...item, recipe } : item));
  }, [activePhotoId, recipe]);

  async function openPhoto() {
    if (exportingRef.current || importingRef.current || !catalogLoadedRef.current) return;
    importingRef.current = true;
    settleEditTransaction();
    try {
      const paths = await chooseImagePaths(true);
      if (paths.length === 0) {
        setStatus(photo ? "ready" : "idle");
        setMessage("");
        return;
      }
      setStatus("loading");
      setSelectedPhotoIds([]);
      const known = new Set(library.map((item) => item.path));
      const imported: LibraryPhoto[] = [];
      const failures: string[] = [];
      for (let index = 0; index < paths.length; index += 1) {
        const path = paths[index];
        if (known.has(path)) continue;
        setMessage(`正在生成缩略图 ${index + 1} / ${paths.length}`);
        try {
          const opened = await openImagePath(path, 512);
          const pixels = previewPixels(opened);
          const item = createLibraryPhoto({
            path: opened.info.path, fileName: opened.info.fileName,
            sourceWidth: opened.info.sourceWidth, sourceHeight: opened.info.sourceHeight,
            format: opened.info.format, camera: opened.info.camera,
          });
          item.thumbnail = thumbnailDataUrl(pixels, opened.info.width, opened.info.height);
          await saveCatalogThumbnail(item.id, item.thumbnail);
          imported.push(item);
          known.add(path);
          const nextLibrary = mergeImportedPhotos(libraryRef.current, [item]);
          libraryRef.current = nextLibrary;
          setLibrary(nextLibrary);
          setSelectedPhotoIds((current) => [...current, item.id]);
        } catch (error) {
          failures.push(`${path}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      setActiveTool("library");
      if (failures.length > 0) {
        setStatus("error");
        setMessage(`已导入 ${imported.length} 张，${failures.length} 张失败。${failures[0]}`);
      } else {
        setStatus("ready");
        setMessage("");
      }
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      importingRef.current = false;
    }
  }

  async function openLibraryPhoto(item: LibraryPhoto) {
    if (exportingRef.current || importingRef.current || !catalogLoadedRef.current) return;
    settleEditTransaction();
    setStatus("loading");
    setMessage("正在解码高精度预览…");
    try {
      const opened = await openImagePath(item.path);
      showOpenedPreview(opened, item);
      setActiveTool("adjust");
      setStatus("ready");
      setMessage("");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function showOpenedPreview(opened: OpenedPreview, item: LibraryPhoto) {
    rendererRef.current?.setImage(opened.info.width, opened.info.height, opened.pixels);
    setSourcePixels(previewPixels(opened));
    editTransaction.current = null;
    setHistory(createHistory(item.recipe));
    setPhoto(opened.info);
    setActivePhotoId(item.id);
    setSelectedLayerId(null);
    setSelectedMaskId(null);
    setShowBefore(false);
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

  function togglePhotoSelection(id: string) {
    setSelectedPhotoIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  function changeRating(id: string, rating: PhotoRating) {
    setLibrary((current) => ratePhoto(current, id, rating));
  }

  async function exportCurrentPhoto() {
    const item = library.find((value) => value.id === activePhotoId);
    if (!item) return;
    const path = await chooseExportPath(item.fileName, exportOptions.format);
    if (!path) return;
    await exportPhotos([{ ...item, recipe: recipeRef.current }], { path });
  }

  async function exportSelectedPhotos() {
    const items = library.filter((item) => selectedPhotoIdSet.has(item.id))
      .map((item) => item.id === activePhotoId ? { ...item, recipe: recipeRef.current } : item);
    if (items.length === 0) return;
    const directory = await chooseExportDirectory();
    if (!directory) return;
    await exportPhotos(items, { directory });
  }

  async function exportPhotos(items: LibraryPhoto[], target: { path?: string; directory?: string }) {
    if (exportingRef.current) return;
    exportingRef.current = true;
    setExportProgress(`准备导出 0 / ${items.length}`);
    const fileNames = target.directory
      ? batchExportFileNames(items.map((item) => item.fileName), exportOptions.format)
      : [];
    try {
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        setExportProgress(`正在渲染 ${index + 1} / ${items.length}`);
        const dimensions = calculateExportDimensions(item.sourceWidth, item.sourceHeight, item.recipe.geometry, {
          mode: exportOptions.sizeMode, value: exportOptions.sizeValue,
        });
        if (Math.max(dimensions.width, dimensions.height) > 16_384) throw new RangeError("导出边长不能超过 16384 像素");
        const decodeEdge = calculateDecodeLongEdge(item.sourceWidth, item.sourceHeight, item.recipe.geometry, dimensions);
        const opened = await openImagePath(item.path, decodeEdge);
        rendererRef.current?.setRecipe(item.recipe);
        rendererRef.current?.setImage(opened.info.width, opened.info.height, opened.pixels);
        const rendered = rendererRef.current?.renderExport(dimensions.width, dimensions.height);
        if (!rendered) throw new Error("GPU 导出引擎尚未就绪");
        const rgba = addTextWatermark(rendered, dimensions.width, dimensions.height, exportOptions.watermark);
        await writeExport({
          ...target,
          fileName: target.directory ? fileNames[index] : undefined,
          width: dimensions.width, height: dimensions.height,
          format: exportOptions.format, quality: exportOptions.quality, rgba,
        });
      }
      setExportProgress(`已完成 ${items.length} 张`);
      window.setTimeout(() => setExportProgress(""), 1600);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : String(error));
      setExportProgress("");
    } finally {
      await restoreActivePreview();
      exportingRef.current = false;
    }
  }

  async function restoreActivePreview() {
    const item = library.find((value) => value.id === activePhotoId);
    if (!item) return;
    try {
      const opened = await openImagePath(item.path);
      rendererRef.current?.setRecipe(recipeRef.current);
      rendererRef.current?.setImage(opened.info.width, opened.info.height, opened.pixels);
      setSourcePixels(previewPixels(opened));
      setPhoto(opened.info);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : String(error));
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
      const shortcut = resolveShortcut(event);
      if (!shortcut) return;
      const command = event.metaKey || event.ctrlKey;
      if (exportingRef.current || importingRef.current || !catalogLoadedRef.current) {
        if (shortcut.type === "import") event.preventDefault();
        return;
      }
      if (shortcut.type === "import") {
        event.preventDefault();
        void openPhoto();
      } else if (isTextEditingTarget(event.target) || event.target instanceof HTMLSelectElement) {
        return;
      } else if (shortcut.type === "undo" || shortcut.type === "redo") {
        event.preventDefault();
        setHistory((current) => shortcut.type === "undo" ? undoHistory(current) : redoHistory(current));
      } else if (shortcut.type === "compare" && photo) {
        event.preventDefault();
        setShowBefore((current) => !current);
      } else if (shortcut.type === "rating" && activePhotoId) {
        changeRating(activePhotoId, shortcut.value as PhotoRating);
      } else if (shortcut.type === "tool" && (photo || ["library", "preset", "export"].includes(shortcut.tool))) {
        if (command) event.preventDefault();
        setActiveTool(shortcut.tool);
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

  useEffect(() => {
    try { localStorage.setItem(THEME_STORAGE_KEY, workspaceTheme); } catch { /* theme remains session-only */ }
  }, [workspaceTheme]);

  useEffect(() => {
    try { localStorage.setItem(INSPECTOR_WIDTH_STORAGE_KEY, String(inspectorWidth)); } catch { /* width remains session-only */ }
  }, [inspectorWidth]);

  function beginInspectorResize(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = inspectorWidth;
    const move = (pointerEvent: PointerEvent) => setInspectorWidth(clampInspectorWidth(startWidth + startX - pointerEvent.clientX));
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  }

  return (
    <main className="app-shell" data-theme={workspaceTheme} aria-busy={workspaceBusy}
      style={{ "--inspector-width": `${inspectorWidth}px` } as CSSProperties}
      onPointerDownCapture={(event) => { if (isContinuousEditTarget(event.target)) beginEditTransaction("pointer"); }}
      onFocusCapture={(event) => { if (isRecipeTextInput(event.target)) beginEditTransaction("text"); }}
      onBlurCapture={(event) => { if (isRecipeTextInput(event.target)) endEditTransaction("text"); }}>
      <header className="topbar">
        <div className="brand" aria-label="LightRAW">
          <span className="brand-mark" aria-hidden="true"><ApertureIcon /></span><span className="brand-name">LightRAW</span><span className="phase-tag">LOCAL STUDIO</span>
        </div>
        <div className="file-summary">
          {photo ? <><strong>{photo.fileName}</strong><span>{photo.sourceWidth} × {photo.sourceHeight}</span></> : <span>非破坏性 RAW 工作区</span>}
        </div>
        <div className="top-actions"><button className="history-button" type="button" aria-label="撤销" title="撤销 · ⌘/Ctrl+Z"
          disabled={history.past.length === 0 || workspaceBusy} onClick={() => setHistory((current) => undoHistory(current))}>↶</button>
          <button className="history-button" type="button" aria-label="重做" title="重做 · ⇧⌘/Ctrl+Z 或 Ctrl+Y"
            disabled={history.future.length === 0 || workspaceBusy} onClick={() => setHistory((current) => redoHistory(current))}>↷</button>
          <button className={`compare-button ${showBefore ? "active" : ""}`} type="button" disabled={!photo || workspaceBusy}
            title="前后对比 \\" onClick={() => setShowBefore((current) => !current)}>{showBefore ? "原图" : "前后"}</button>
          <button className="open-button" type="button" onClick={openPhoto} disabled={workspaceBusy}>
            <OpenIcon />{status === "loading" ? "正在导入" : "导入照片"}</button></div>
      </header>

      <WorkspaceNavigator collection={libraryCollection} total={library.length}
        rated={library.filter((item) => item.rating > 0).length} selected={selectedPhotoIds.length}
        theme={workspaceTheme} gpuStatus={gpuStatus} onTheme={setWorkspaceTheme}
        onCollection={(collection) => { setLibraryCollection(collection); setActiveTool("library"); }} />

      <section className={`editor-stage ${showFilmstrip ? "" : "without-filmstrip"}`}>
        <section className={`viewport ${activeTool === "crop" ? "crop-active" : ""}`} aria-label="照片预览">
          <canvas ref={canvasRef} />
          {activeTool === "library" && <LibraryGrid photos={visibleLibrary} activeId={activePhotoId} selectedIds={selectedPhotoIdSet}
            onOpen={(item) => void openLibraryPhoto(item)} onToggle={togglePhotoSelection} onRate={changeRating} />}
          {!photo && activeTool !== "library" && status !== "loading" && <EmptyState onOpen={openPhoto} />}
          {status === "loading" && <div className="loading-state"><span className="spinner" /><strong>构建线性预览</strong><span>{message}</span></div>}
          {status === "error" && (
            <div className="error-toast" role="alert"><strong>操作失败</strong><span>{message}</span>
              <button type="button" onClick={() => { setStatus(photo ? "ready" : "idle"); setMessage(""); }}>关闭</button></div>
          )}
          {photo && activeTool === "crop" && recipe.geometry.straighten === 0 && previewLayout && (
            <CropOverlay layout={previewLayout} geometry={recipe.geometry}
              onChange={(crop) => setRecipe((current) => ({ ...current, geometry: { ...current.geometry, crop, aspect: "free" } }))} />
          )}
          {photo && activeTool === "mask" && !showBefore && previewLayout && selectedMask && <MaskOverlay layout={previewLayout} mask={selectedMask} geometry={recipe.geometry}
            imageWidth={photo.width} imageHeight={photo.height} brush={brush}
            onUpdate={(mask) => selectedLayerId && changeMask(selectedLayerId, mask)} onSample={sampleSource} />}
          {photo && activeTool !== "library" && <div className="preview-status">
            <span>{photo.format}</span>{photo.camera && <span>{photo.camera}</span>}
            <span className="live"><i />实时预览{metrics && ` · ${metrics.fps || "—"} FPS · ${metrics.frameLatencyMs.toFixed(1)} ms`}</span>
          </div>}
        </section>
        {showFilmstrip && <Filmstrip photos={visibleLibrary} activeId={activePhotoId} onOpen={(item) => void openLibraryPhoto(item)} />}
      </section>

      <section className="right-dock" aria-label="编辑检查器">
        <button className="inspector-resizer" type="button" aria-label="调整右侧面板宽度" onPointerDown={beginInspectorResize}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            setInspectorWidth((width) => clampInspectorWidth(width + (event.key === "ArrowLeft" ? 12 : -12)));
          }} />
        <div className="inspector-content">{activeTool === "library" ? (
          <LibraryPanel count={visibleLibrary.length} selectedCount={selectedPhotoIds.length} sort={librarySort} busy={workspaceBusy}
            onSort={setLibrarySort} onImport={openPhoto} onSelectAll={() => setSelectedPhotoIds(visibleLibrary.map((item) => item.id))}
            onClear={() => setSelectedPhotoIds([])} />
        ) : activeTool === "adjust" ? (
          <AdjustmentPanel recipe={recipe} histogram={histogram} disabled={!photo} onChange={setRecipe} onReset={resetCurrentPanel} />
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
        ) : activeTool === "preset" ? (
          <PresetPanel presets={presets} disabled={!photo} onSave={saveCurrentPreset}
            onApply={(preset) => setRecipe((current) => applyPreset(current, preset))} onImport={importPreset}
            onExport={exportPreset} onDelete={(id) => replacePresets(presets.filter((preset) => preset.id !== id))} />
        ) : (
          <ExportPanel options={exportOptions} disabled={!activePhotoId || !!exportProgress} selectedCount={selectedPhotoIds.length}
            progress={exportProgress} onChange={setExportOptions} onCurrent={() => void exportCurrentPhoto()}
            onBatch={() => void exportSelectedPhotos()} />
        )}</div>
        <aside className="tool-rail" aria-label="编辑工具">
          <button className={`tool-button ${activeTool === "library" ? "active" : ""}`} type="button" title="图库 · G" disabled={workspaceBusy} onClick={() => setActiveTool("library")}><LibraryIcon /><span>图库</span></button>
          <div className="tool-rule" />
          <button className={`tool-button ${activeTool === "adjust" ? "active" : ""}`} type="button" title="调色 · D（兼容 E）" disabled={workspaceBusy} onClick={() => setActiveTool("adjust")}><AdjustIcon /><span>调色</span></button>
          <button className={`tool-button ${activeTool === "crop" ? "active" : ""}`} type="button" title="裁剪 · R（兼容 C）" disabled={!photo || workspaceBusy} onClick={() => setActiveTool("crop")}><CropIcon /><span>裁剪</span></button>
          <button className={`tool-button ${activeTool === "mask" ? "active" : ""}`} type="button" title="蒙版 · M" disabled={!photo || workspaceBusy} onClick={() => setActiveTool("mask")}><MaskIcon /><span>蒙版</span></button>
          <button className={`tool-button ${activeTool === "preset" ? "active" : ""}`} type="button" title="预设 · P" disabled={workspaceBusy} onClick={() => setActiveTool("preset")}><PresetIcon /><span>预设</span></button>
          <button className={`tool-button ${activeTool === "export" ? "active" : ""}`} type="button" disabled={(!photo && selectedPhotoIds.length === 0) || workspaceBusy}
            title="导出 · ⌘/Ctrl+Shift+E（兼容 X）" onClick={() => setActiveTool("export")}><ExportIcon /><span>导出</span></button>
          <div className={`gpu-badge ${gpuStatus}`}><i />GPU</div>
        </aside>
      </section>
    </main>
  );
}

function EmptyState({ onOpen }: { onOpen: () => void }) {
  return <div className="empty-state"><div className="empty-aperture"><ApertureIcon /></div>
    <p className="eyebrow">LIGHTRAW · DEVELOP</p><h1>让照片回到光线本身</h1>
    <p className="empty-copy">批量导入 JPEG、HEIF 或相机 RAW，建立图库并开始非破坏性实时调色。</p>
    <button className="empty-open" type="button" onClick={onOpen}>导入照片</button>
    <p className="format-list">JPG · HEIC · CR3 · NEF · ARW · RAF · DNG</p></div>;
}

function OpenIcon() { return <svg viewBox="0 0 24 24"><path d="M4 8.5h6l2-2h8v11H4z"/><path d="M4 10h16"/></svg>; }
function AdjustIcon() { return <svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>; }
function CropIcon() { return <svg viewBox="0 0 24 24"><path d="M7 3v14h14M3 7h14v14"/></svg>; }
function MaskIcon() { return <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 0 0 16z"/></svg>; }
function PresetIcon() { return <svg viewBox="0 0 24 24"><path d="m12 3 2.4 5.2L20 9l-4 4 .9 5.7L12 16l-4.9 2.7L8 13 4 9l5.6-.8z"/></svg>; }
function LibraryIcon() { return <svg viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/></svg>; }
function ExportIcon() { return <svg viewBox="0 0 24 24"><path d="M12 15V3m0 0L8 7m4-4 4 4M5 12v8h14v-8"/></svg>; }
function ApertureIcon() { return <svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="26"/>
  <path d="M32 6a26 26 0 0 1 22.5 13L43.4 32a11.4 11.4 0 0 0-5.7-9.9Z"/>
  <path d="M32 6a26 26 0 0 1 22.5 13L43.4 32a11.4 11.4 0 0 0-5.7-9.9Z" transform="rotate(60 32 32)"/>
  <path d="M32 6a26 26 0 0 1 22.5 13L43.4 32a11.4 11.4 0 0 0-5.7-9.9Z" transform="rotate(120 32 32)"/>
  <path d="M32 6a26 26 0 0 1 22.5 13L43.4 32a11.4 11.4 0 0 0-5.7-9.9Z" transform="rotate(180 32 32)"/>
  <path d="M32 6a26 26 0 0 1 22.5 13L43.4 32a11.4 11.4 0 0 0-5.7-9.9Z" transform="rotate(240 32 32)"/>
  <path d="M32 6a26 26 0 0 1 22.5 13L43.4 32a11.4 11.4 0 0 0-5.7-9.9Z" transform="rotate(300 32 32)"/>
  <circle cx="32" cy="32" r="10"/>
</svg>; }

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

function loadWorkspaceTheme(): WorkspaceTheme {
  try { return normalizeWorkspaceTheme(localStorage.getItem(THEME_STORAGE_KEY)); } catch { return "dark"; }
}

function loadInspectorWidth(): number {
  try {
    const width = Number(localStorage.getItem(INSPECTOR_WIDTH_STORAGE_KEY));
    return Number.isFinite(width) && width > 0 ? clampInspectorWidth(width) : 340;
  } catch {
    return 340;
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

function previewPixels(opened: OpenedPreview): Uint16Array {
  return new Uint16Array(opened.pixels.buffer, opened.pixels.byteOffset, opened.pixels.byteLength / Uint16Array.BYTES_PER_ELEMENT);
}

function isTauriRuntime(): boolean {
  return "__TAURI_INTERNALS__" in window;
}
