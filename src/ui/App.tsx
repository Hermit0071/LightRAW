import { useEffect, useRef, useState } from "react";
import { chooseAndOpenImage, type PreviewInfo } from "../bridge/images";
import {
  createDefaultAdjustments,
  updateAdjustment,
  BASIC_ADJUSTMENT_LIMITS,
  type BasicAdjustmentName,
  type BasicAdjustments,
} from "../editor/basic-adjustments";
import { PreviewRenderer } from "../renderer/preview-renderer";
import type { PreviewMetrics } from "../renderer/preview-renderer";

interface SliderDefinition {
  name: BasicAdjustmentName;
  label: string;
  step: number;
}

const WHITE_BALANCE: SliderDefinition[] = [
  { name: "temperature", label: "色温", step: 1 },
  { name: "tint", label: "色调", step: 1 },
];

const TONE: SliderDefinition[] = [
  { name: "exposure", label: "曝光", step: 0.05 },
  { name: "contrast", label: "对比度", step: 1 },
  { name: "highlights", label: "高光", step: 1 },
  { name: "shadows", label: "阴影", step: 1 },
];

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<PreviewRenderer | null>(null);
  const [adjustments, setAdjustments] = useState(createDefaultAdjustments);
  const [photo, setPhoto] = useState<PreviewInfo | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [message, setMessage] = useState("");
  const [metrics, setMetrics] = useState<PreviewMetrics | null>(null);

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }
    try {
      rendererRef.current = new PreviewRenderer(canvasRef.current, adjustments, setMetrics);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : String(error));
    }
    return () => rendererRef.current?.destroy();
    // The renderer owns subsequent adjustment updates through its public interface.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    rendererRef.current?.setAdjustments(adjustments);
  }, [adjustments]);

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
      const neutral = createDefaultAdjustments();
      rendererRef.current?.setImage(opened.info.width, opened.info.height, opened.pixels);
      rendererRef.current?.setAdjustments(neutral);
      setAdjustments(neutral);
      setPhoto(opened.info);
      setStatus("ready");
      setMessage("");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  function changeAdjustment(name: BasicAdjustmentName, value: number) {
    setAdjustments((current) => updateAdjustment(current, name, value));
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand" aria-label="LightRAW">
          <span className="brand-mark">Lr</span>
          <span className="brand-name">LightRAW</span>
          <span className="phase-tag">PHASE 01</span>
        </div>
        <div className="file-summary">
          {photo ? (
            <>
              <strong>{photo.fileName}</strong>
              <span>{photo.width} × {photo.height}</span>
            </>
          ) : (
            <span>非破坏性 RAW 工作区</span>
          )}
        </div>
        <button className="open-button" type="button" onClick={openPhoto} disabled={status === "loading"}>
          <OpenIcon />
          {status === "loading" ? "正在打开" : "打开照片"}
        </button>
      </header>

      <aside className="tool-rail" aria-label="阶段一工具">
        <button className="tool-button active" type="button" aria-label="调色">
          <AdjustIcon />
          <span>调色</span>
        </button>
        <div className="tool-rule" />
        <button className="tool-button disabled" type="button" aria-label="裁剪，阶段二开放" disabled>
          <CropIcon />
          <span>裁剪</span>
        </button>
        <button className="tool-button disabled" type="button" aria-label="蒙版，阶段三开放" disabled>
          <MaskIcon />
          <span>蒙版</span>
        </button>
        <div className="gpu-badge"><i />GPU</div>
      </aside>

      <section className="viewport" aria-label="照片预览">
        <canvas ref={canvasRef} />
        {!photo && status !== "loading" && (
          <div className="empty-state">
            <div className="empty-aperture"><ApertureIcon /></div>
            <p className="eyebrow">LIGHTRAW · DEVELOP</p>
            <h1>让照片回到光线本身</h1>
            <p className="empty-copy">打开一张 JPEG、HEIF 或相机 RAW，开始进行非破坏性实时调色。</p>
            <button className="empty-open" type="button" onClick={openPhoto}>选择照片</button>
            <p className="format-list">JPG · HEIC · CR3 · NEF · ARW · RAF · DNG</p>
          </div>
        )}
        {status === "loading" && (
          <div className="loading-state">
            <span className="spinner" />
            <strong>构建线性预览</strong>
            <span>{message}</span>
          </div>
        )}
        {status === "error" && (
          <div className="error-toast" role="alert">
            <strong>无法打开照片</strong>
            <span>{message}</span>
            <button type="button" onClick={() => { setStatus(photo ? "ready" : "idle"); setMessage(""); }}>关闭</button>
          </div>
        )}
        {photo && (
          <div className="preview-status">
            <span>{photo.format}</span>
            {photo.camera && <span>{photo.camera}</span>}
            <span className="live">
              <i />实时预览
              {metrics && ` · ${metrics.fps || "—"} FPS · ${metrics.frameLatencyMs.toFixed(1)} ms`}
            </span>
          </div>
        )}
      </section>

      <aside className="adjustments-panel" aria-label="基本调色">
        <div className="panel-heading">
          <div>
            <p>DEVELOP</p>
            <h2>基本调色</h2>
          </div>
          <button
            type="button"
            className="reset-button"
            onClick={() => setAdjustments(createDefaultAdjustments())}
            disabled={!photo}
          >
            重置
          </button>
        </div>
        <PanelSection title="白平衡" badge="WB">
          {WHITE_BALANCE.map((slider) => (
            <AdjustmentSlider
              key={slider.name}
              definition={slider}
              value={adjustments[slider.name]}
              disabled={!photo}
              onChange={changeAdjustment}
            />
          ))}
        </PanelSection>
        <PanelSection title="影调" badge="TONE">
          {TONE.map((slider) => (
            <AdjustmentSlider
              key={slider.name}
              definition={slider}
              value={adjustments[slider.name]}
              disabled={!photo}
              onChange={changeAdjustment}
            />
          ))}
        </PanelSection>
        <div className="panel-footer">
          <span>16-bit linear preview</span>
          <span>WebGL 2</span>
        </div>
      </aside>
    </main>
  );
}

function PanelSection({ title, badge, children }: { title: string; badge: string; children: React.ReactNode }) {
  return (
    <section className="panel-section">
      <div className="section-title"><h3>{title}</h3><span>{badge}</span></div>
      <div className="sliders">{children}</div>
    </section>
  );
}

function AdjustmentSlider({
  definition,
  value,
  disabled,
  onChange,
}: {
  definition: SliderDefinition;
  value: number;
  disabled: boolean;
  onChange: (name: BasicAdjustmentName, value: number) => void;
}) {
  const display = definition.name === "exposure"
    ? `${value > 0 ? "+" : ""}${value.toFixed(2)}`
    : `${value > 0 ? "+" : ""}${Math.round(value)}`;
  const [minimum, maximum] = BASIC_ADJUSTMENT_LIMITS[definition.name];
  const fill = ((value - minimum) / (maximum - minimum)) * 100;
  const center = ((0 - minimum) / (maximum - minimum)) * 100;

  return (
    <label className={`adjustment ${disabled ? "is-disabled" : ""}`}>
      <span className="adjustment-label">{definition.label}</span>
      <span className="adjustment-value">{display}</span>
      <span className="range-wrap" style={{ "--fill": `${fill}%`, "--center": `${center}%` } as React.CSSProperties}>
        <input
          type="range"
          min={minimum}
          max={maximum}
          step={definition.step}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(definition.name, Number(event.target.value))}
          onDoubleClick={() => onChange(definition.name, 0)}
        />
      </span>
    </label>
  );
}

function OpenIcon() { return <svg viewBox="0 0 24 24"><path d="M4 8.5h6l2-2h8v11H4z"/><path d="M4 10h16"/></svg>; }
function AdjustIcon() { return <svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>; }
function CropIcon() { return <svg viewBox="0 0 24 24"><path d="M7 3v14h14M3 7h14v14"/></svg>; }
function MaskIcon() { return <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 0 0 16z"/></svg>; }
function ApertureIcon() { return <svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="26"/><path d="m18 11 15 21M53 18l-21 14M53 46H29M18 53l14-21M11 18l21 14M11 46l21-14"/></svg>; }
