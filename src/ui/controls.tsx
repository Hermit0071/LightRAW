import type { CSSProperties, ReactNode } from "react";

export function PanelSection({ title, badge, children }: { title: string; badge: string; children: ReactNode }) {
  return (
    <section className="panel-section">
      <div className="section-title"><h3>{title}</h3><span>{badge}</span></div>
      {children}
    </section>
  );
}

export function Slider({
  label, value, minimum, maximum, step, disabled, onChange, accent, digits = 0,
}: {
  label: string;
  value: number;
  minimum: number;
  maximum: number;
  step: number;
  disabled: boolean;
  onChange: (value: number) => void;
  accent?: string;
  digits?: number;
}) {
  const fill = ((value - minimum) / (maximum - minimum)) * 100;
  const centre = ((0 - minimum) / (maximum - minimum)) * 100;
  const display = `${value > 0 ? "+" : ""}${value.toFixed(digits)}`;
  return (
    <label className={`adjustment ${disabled ? "is-disabled" : ""}`}>
      <span className="adjustment-label">{accent && <i style={{ background: accent }} />}{label}</span>
      <span className="adjustment-value">{display}</span>
      <span className="range-wrap" style={{
        "--fill": `${fill}%`, "--center": `${Math.min(100, Math.max(0, centre))}%`, "--accent": accent ?? "#d7ff45",
      } as CSSProperties}>
        <input
          type="range"
          min={minimum}
          max={maximum}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
          onDoubleClick={() => onChange(Math.min(maximum, Math.max(minimum, 0)))}
        />
      </span>
    </label>
  );
}
