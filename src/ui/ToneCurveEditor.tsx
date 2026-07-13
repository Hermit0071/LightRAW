import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  addCurvePoint,
  moveCurvePoint,
  removeCurvePoint,
  sampleCurve,
  type CurveChannel,
  type CurvePoint,
  type ToneCurves,
} from "../editor/tone-curve";

const CHANNELS: { name: CurveChannel; label: string }[] = [
  { name: "master", label: "RGB" }, { name: "red", label: "R" },
  { name: "green", label: "G" }, { name: "blue", label: "B" },
];

export function ToneCurveEditor({ curves, disabled, onChange }: {
  curves: ToneCurves;
  disabled: boolean;
  onChange: (curves: ToneCurves) => void;
}) {
  const [channel, setChannel] = useState<CurveChannel>("master");
  const dragging = useRef<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const curve = curves[channel];
  const colour = channel === "master" ? "#e6e4dc" : channel;
  const path = sampleCurve(curve, 121)
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x * 240} ${(1 - point.y) * 150}`)
    .join(" ");

  function position(event: ReactPointerEvent<SVGSVGElement | SVGCircleElement>): CurvePoint {
    const bounds = svgRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
      y: Math.min(1, Math.max(0, 1 - (event.clientY - bounds.top) / bounds.height)),
    };
  }

  function update(next: CurvePoint[]) {
    onChange({ ...curves, [channel]: next });
  }

  return (
    <div className={`curve-editor ${disabled ? "is-disabled" : ""}`}>
      <div className="curve-tabs">
        {CHANNELS.map((item) => (
          <button key={item.name} className={channel === item.name ? "active" : ""} type="button" onClick={() => setChannel(item.name)}>
            {item.label}
          </button>
        ))}
      </div>
      <svg
        ref={svgRef}
        viewBox="0 0 240 150"
        onPointerDown={(event) => {
          if (disabled || event.target !== event.currentTarget) return;
          update(addCurvePoint(curve, position(event)));
        }}
        onPointerMove={(event) => {
          if (dragging.current !== null) update(moveCurvePoint(curve, dragging.current, position(event)));
        }}
        onPointerUp={(event) => {
          dragging.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => { dragging.current = null; }}
        onLostPointerCapture={() => { dragging.current = null; }}
      >
        <path className="curve-grid" d="M0 37.5H240M0 75H240M0 112.5H240M60 0V150M120 0V150M180 0V150" />
        <path
          className="curve-line"
          style={{ stroke: colour }}
          d={path}
        />
        {curve.map((point, index) => (
          <circle
            key={index}
            cx={point.x * 240}
            cy={(1 - point.y) * 150}
            r="5"
            style={{ stroke: colour }}
            onPointerDown={(event) => {
              if (disabled) return;
              event.stopPropagation();
              svgRef.current?.setPointerCapture(event.pointerId);
              dragging.current = index;
            }}
            onDoubleClick={() => update(removeCurvePoint(curve, index))}
          />
        ))}
      </svg>
      <p>点击添加 · 拖动调整 · 双击删除</p>
    </div>
  );
}
