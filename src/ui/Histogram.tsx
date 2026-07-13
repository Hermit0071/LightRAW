import type { HistogramData } from "../renderer/histogram";

export function Histogram({ data }: { data: HistogramData | null }) {
  if (!data) return <div className="histogram-placeholder">等待照片数据</div>;
  const maximum = Math.max(1, ...data.red, ...data.green, ...data.blue);
  return (
    <div className="histogram" aria-label="编辑后实时直方图">
      <svg viewBox="0 0 256 72" preserveAspectRatio="none">
        <path className="histogram-red" d={histogramPath(data.red, maximum)} />
        <path className="histogram-green" d={histogramPath(data.green, maximum)} />
        <path className="histogram-blue" d={histogramPath(data.blue, maximum)} />
      </svg>
      <span>{data.samples.toLocaleString()} SAMPLES</span>
    </div>
  );
}

function histogramPath(bins: number[], maximum: number): string {
  const points = bins.map((count, index) => `${index},${72 - Math.sqrt(count / maximum) * 68}`);
  return `M0,72 L${points.join(" L")} L255,72 Z`;
}
