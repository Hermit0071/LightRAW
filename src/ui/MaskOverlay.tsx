import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { mapOutputToSource, mapSourceToOutput, type GeometrySettings } from "../editor/geometry";
import type { BrushSettings } from "./MaskPanel";
import type { MaskComponent, MaskPoint } from "../editor/masks";
import type { PreviewLayout } from "../renderer/preview-renderer";

type Drag = { kind: "linear-end" | "radial" | "radial-x" | "radial-y" | "brush" | "linear-start" | "radial-center"; stroke?: number }
  | { kind: "pen-point"; index: number };

export function MaskOverlay({ layout, mask, geometry, imageWidth, imageHeight, brush, onUpdate, onSample }: {
  layout: PreviewLayout;
  mask: MaskComponent;
  geometry: GeometrySettings;
  imageWidth: number;
  imageHeight: number;
  brush: BrushSettings;
  onUpdate: (mask: MaskComponent) => void;
  onSample: (point: MaskPoint) => readonly [number, number, number];
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  const aspect = imageWidth / imageHeight;
  const toOutput = (point: MaskPoint) => mapSourceToOutput(point, geometry, imageWidth, imageHeight);

  function sourcePoint(event: ReactPointerEvent<SVGSVGElement | SVGCircleElement>): MaskPoint {
    const bounds = svgRef.current!.getBoundingClientRect();
    return mapOutputToSource({
      x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
      y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)),
    }, geometry, imageWidth, imageHeight);
  }

  function begin(event: ReactPointerEvent<SVGSVGElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = sourcePoint(event);
    if (mask.type === "linear") {
      drag.current = { kind: "linear-end" };
      onUpdate({ ...mask, start: point, end: point });
    } else if (mask.type === "radial") {
      drag.current = { kind: "radial" };
      onUpdate({ ...mask, center: point, radiusX: 0.01, radiusY: 0.01 });
    } else if (mask.type === "brush") {
      const stroke = { points: [point], ...brush };
      drag.current = { kind: "brush", stroke: mask.strokes.length };
      onUpdate({ ...mask, strokes: [...mask.strokes, stroke] });
    } else if (mask.type === "pen") {
      if (!mask.closed) onUpdate({ ...mask, points: [...mask.points, point] });
    } else {
      onUpdate({ ...mask, target: onSample(point) });
    }
  }

  function move(event: ReactPointerEvent<SVGSVGElement>) {
    const active = drag.current;
    if (!active) return;
    const point = sourcePoint(event);
    if (mask.type === "linear") {
      if (active.kind === "linear-start") onUpdate({ ...mask, start: point });
      else onUpdate({ ...mask, end: point });
    } else if (mask.type === "radial") {
      if (active.kind === "radial-center") onUpdate({ ...mask, center: point });
      else {
        const angle = -mask.rotation * Math.PI / 180;
        const dx = point.x - mask.center.x;
        const dy = point.y - mask.center.y;
        const radiusX = Math.max(0.01, Math.abs(Math.cos(angle) * dx - Math.sin(angle) * dy));
        const radiusY = Math.max(0.01, Math.abs(Math.sin(angle) * dx + Math.cos(angle) * dy));
        onUpdate({ ...mask,
          radiusX: active.kind === "radial-y" ? mask.radiusX : radiusX,
          radiusY: active.kind === "radial-x" ? mask.radiusY : radiusY,
        });
      }
    } else if (mask.type === "brush" && active.kind === "brush" && active.stroke !== undefined) {
      const strokes = mask.strokes.map((stroke, index) => index === active.stroke
        ? { ...stroke, points: appendSpaced(stroke.points, point, aspect) } : stroke);
      onUpdate({ ...mask, strokes });
    } else if (mask.type === "pen" && active.kind === "pen-point") {
      onUpdate({ ...mask, points: mask.points.map((value, index) => index === active.index ? point : value) });
    }
  }

  function startHandle(event: ReactPointerEvent<SVGCircleElement>, value: Drag) {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = value;
  }

  const line = mask.type === "linear" ? [toOutput(mask.start), toOutput(mask.end)] : null;
  const radial = mask.type === "radial" ? {
    center: toOutput(mask.center),
    boundary: radialBoundary(mask.center, mask.radiusX, mask.radiusY, mask.rotation).map(toOutput),
  } : null;
  return <svg ref={svgRef} className="mask-overlay" style={{ left: layout.x, top: layout.y, width: layout.width, height: layout.height }} viewBox="0 0 1000 1000" preserveAspectRatio="none"
    onPointerDown={begin} onPointerMove={move} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
    {line && <><line x1={line[0].x * 1000} y1={line[0].y * 1000} x2={line[1].x * 1000} y2={line[1].y * 1000} />
      <Handle point={line[0]} onDown={(event) => startHandle(event, { kind: "linear-start" })} />
      <Handle point={line[1]} onDown={(event) => startHandle(event, { kind: "linear-end" })} /></>}
    {radial && <><polyline className="radial-path" points={radial.boundary.map((point) => `${point.x * 1000},${point.y * 1000}`).join(" ")} />
      <Handle point={radial.center} onDown={(event) => startHandle(event, { kind: "radial-center" })} />
      <Handle point={radial.boundary[0]} onDown={(event) => startHandle(event, { kind: "radial-x" })} />
      <Handle point={radial.boundary[12]} onDown={(event) => startHandle(event, { kind: "radial-y" })} /></>}
    {mask.type === "brush" && mask.strokes.map((stroke, index) => <polygon key={index}
      className="brush-stroke"
      points={brushOutline(stroke.points, stroke.size, aspect).map(toOutput).map((point) => `${point.x * 1000},${point.y * 1000}`).join(" ")} />)}
    {mask.type === "pen" && <><polyline className={mask.closed ? "pen-path closed" : "pen-path"}
      points={mask.points.map(toOutput).map((point) => `${point.x * 1000},${point.y * 1000}`).join(" ")} />
      {mask.points.map((point, index) => <Handle key={index} point={toOutput(point)} onDown={(event) => startHandle(event, { kind: "pen-point", index })} />)}</>}
    {mask.type === "chroma" && <text x="500" y="55" textAnchor="middle">点击照片选择颜色</text>}
  </svg>;
}

function Handle({ point, onDown }: { point: MaskPoint; onDown: (event: ReactPointerEvent<SVGCircleElement>) => void }) {
  return <circle className="mask-handle" cx={point.x * 1000} cy={point.y * 1000} r="9" vectorEffect="non-scaling-stroke" onPointerDown={onDown} />;
}

function appendSpaced(points: MaskPoint[], point: MaskPoint, aspect: number): MaskPoint[] {
  const last = points[points.length - 1];
  if (last && Math.hypot((point.x - last.x) * aspect, point.y - last.y) < 0.003) return points;
  return [...points, point];
}

function radialBoundary(center: MaskPoint, radiusX: number, radiusY: number, rotation: number): MaskPoint[] {
  const angle = rotation * Math.PI / 180;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return Array.from({ length: 49 }, (_, index) => {
    const parameter = index / 48 * Math.PI * 2;
    const x = Math.cos(parameter) * radiusX;
    const y = Math.sin(parameter) * radiusY;
    return { x: center.x + cosine * x - sine * y, y: center.y + sine * x + cosine * y };
  });
}

function brushOutline(points: MaskPoint[], size: number, aspect: number): MaskPoint[] {
  if (points.length === 0) return [];
  const radius = size / 2;
  if (points.length === 1) {
    return Array.from({ length: 25 }, (_, index) => offsetPoint(points[0], index / 24 * Math.PI * 2, radius, aspect));
  }

  const tangent = (index: number) => {
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    return Math.atan2(next.y - previous.y, (next.x - previous.x) * aspect);
  };
  const left = points.map((point, index) => offsetPoint(point, tangent(index) + Math.PI / 2, radius, aspect));
  const right = points.map((point, index) => offsetPoint(point, tangent(index) - Math.PI / 2, radius, aspect));
  const endAngle = tangent(points.length - 1);
  const startAngle = tangent(0);
  const endCap = Array.from({ length: 9 }, (_, index) => offsetPoint(
    points[points.length - 1],
    endAngle - Math.PI / 2 + index / 8 * Math.PI,
    radius,
    aspect,
  ));
  const startCap = Array.from({ length: 9 }, (_, index) => offsetPoint(
    points[0],
    startAngle + Math.PI / 2 + index / 8 * Math.PI,
    radius,
    aspect,
  ));
  return [...left.slice(0, -1), ...endCap, ...right.reverse().slice(1), ...startCap.slice(1, -1)];
}

function offsetPoint(point: MaskPoint, angle: number, radius: number, aspect: number): MaskPoint {
  return {
    x: point.x + Math.cos(angle) * radius / aspect,
    y: point.y + Math.sin(angle) * radius,
  };
}
