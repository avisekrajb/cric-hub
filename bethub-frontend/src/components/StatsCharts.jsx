import { cn } from "../lib/utils";

const num = (value) => Number(value) || 0;
const shorten = (value = "", max = 12) =>
  String(value).length > max ? `${String(value).slice(0, max - 1)}…` : String(value);

/**
 * Dependency-free responsive SVG bar chart. Bars are keyed by `label` and
 * scaled by `valueKey` (defaults to `value`).
 */
export function BarChart({
  data = [],
  valueKey = "value",
  labelKey = "label",
  color = "#c8ff3d",
  height = 230,
  formatValue = (value) => num(value),
  emptyLabel = "No data yet",
  className = "",
}) {
  const rows = (data || []).filter(Boolean);
  if (!rows.length) {
    return (
      <div className={cn("grid place-items-center rounded-xl border border-dashed border-white/10 text-[11px] text-white/30", className)} style={{ height }}>
        {emptyLabel}
      </div>
    );
  }

  const W = 640;
  const H = height;
  const padX = 18;
  const padTop = 20;
  const padBottom = 38;
  const innerW = W - padX * 2;
  const innerH = H - padTop - padBottom;
  const max = Math.max(...rows.map((row) => num(row[valueKey])), 1);
  const gap = rows.length > 10 ? 5 : rows.length > 6 ? 9 : 16;
  const barW = Math.max(6, (innerW - gap * Math.max(0, rows.length - 1)) / rows.length);
  const rotate = rows.length > 7;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Bar chart"
      className={cn("h-auto w-full overflow-visible", className)}
      preserveAspectRatio="xMidYMid meet"
    >
      {[0, 0.25, 0.5, 0.75, 1].map((step) => {
        const y = padTop + innerH - innerH * step;
        return (
          <g key={step}>
            <line x1={padX} x2={W - padX} y1={y} y2={y} stroke="currentColor" strokeOpacity={step === 0 ? 0.18 : 0.08} strokeWidth="1" />
            <text x={padX - 6} y={y + 3} textAnchor="end" fontSize="9" fill="currentColor" fillOpacity="0.4">
              {formatValue(max * step)}
            </text>
          </g>
        );
      })}

      {rows.map((row, index) => {
        const value = num(row[valueKey]);
        const barH = Math.max(2, (value / max) * innerH);
        const x = padX + index * (barW + gap);
        const y = padTop + innerH - barH;
        const label = shorten(row[labelKey], rotate ? 14 : 12);
        return (
          <g key={row[labelKey] ?? index} className="transition-opacity hover:opacity-80">
            <title>{`${row[labelKey] ?? ""}: ${formatValue(value)}`}</title>
            <rect x={x} y={padTop} width={barW} height={innerH} rx={barW / 3} fill="currentColor" fillOpacity="0.05" />
            <rect x={x} y={y} width={barW} height={barH} rx={Math.min(6, barW / 2)} fill={color} fillOpacity="0.9" />
            <text
              x={x + barW / 2}
              y={padTop + innerH + 14}
              textAnchor={rotate ? "end" : "middle"}
              fontSize="9.5"
              fill="currentColor"
              fillOpacity="0.55"
              transform={rotate ? `rotate(-32 ${x + barW / 2} ${padTop + innerH + 14})` : undefined}
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Multi-series SVG line chart. Each series needs a `key`, `label` and `color`.
 */
export function LineChart({
  data = [],
  series = [],
  xKey = "label",
  height = 230,
  formatValue = (value) => num(value),
  emptyLabel = "No matches yet",
  area = true,
  className = "",
}) {
  const rows = (data || []).filter(Boolean);
  const active = (series || []).filter(Boolean);
  if (!rows.length || !active.length) {
    return (
      <div className={cn("grid place-items-center rounded-xl border border-dashed border-white/10 text-[11px] text-white/30", className)} style={{ height }}>
        {emptyLabel}
      </div>
    );
  }

  const W = 640;
  const H = height;
  const padX = 30;
  const padTop = 18;
  const padBottom = 34;
  const innerW = W - padX * 2;
  const innerH = H - padTop - padBottom;
  const max = Math.max(...active.flatMap((s) => rows.map((row) => num(row[s.key]))), 1);

  const xAt = (index) => padX + (rows.length === 1 ? innerW / 2 : (index / (rows.length - 1)) * innerW);
  const yAt = (value) => padTop + innerH - (num(value) / max) * innerH;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Line chart"
      className={cn("h-auto w-full overflow-visible", className)}
      preserveAspectRatio="xMidYMid meet"
    >
      {[0, 0.25, 0.5, 0.75, 1].map((step) => {
        const y = padTop + innerH - innerH * step;
        return (
          <g key={step}>
            <line x1={padX} x2={W - padX} y1={y} y2={y} stroke="currentColor" strokeOpacity={step === 0 ? 0.18 : 0.08} strokeWidth="1" />
            <text x={padX - 6} y={y + 3} textAnchor="end" fontSize="9" fill="currentColor" fillOpacity="0.4">
              {formatValue(max * step)}
            </text>
          </g>
        );
      })}

      {active.map((line) => {
        const points = rows.map((row, index) => [xAt(index), yAt(row[line.key])]);
        const path = points.map((point, index) => `${index ? "L" : "M"}${point[0].toFixed(1)},${point[1].toFixed(1)}`).join(" ");
        const areaPath = `${path} L${points[points.length - 1][0].toFixed(1)},${padTop + innerH} L${points[0][0].toFixed(1)},${padTop + innerH} Z`;
        return (
          <g key={line.key}>
            {area && (
              <path d={areaPath} fill={line.color} fillOpacity="0.1">
                <title>{line.label}</title>
              </path>
            )}
            <path d={path} fill="none" stroke={line.color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            {points.map((point, index) => (
              <circle key={index} cx={point[0]} cy={point[1]} r="2.8" fill="#040906" stroke={line.color} strokeWidth="2">
                <title>{`${rows[index][xKey]} · ${line.label}: ${formatValue(rows[index][line.key])}`}</title>
              </circle>
            ))}
          </g>
        );
      })}

      {rows.map((row, index) => (
        <text
          key={row[xKey] ?? index}
          x={xAt(index)}
          y={padTop + innerH + 16}
          textAnchor={rows.length > 7 && index % 2 === 1 ? "middle" : "middle"}
          fontSize="9.5"
          fill="currentColor"
          fillOpacity="0.5"
        >
          {shorten(row[xKey], 10)}
        </text>
      ))}
    </svg>
  );
}

/** Horizontal comparison bars, used for team winning percentages. */
export function HorizontalBars({ rows = [], max, suffix = "%", color = "#c8ff3d", emptyLabel = "No completed matches yet" }) {
  if (!rows.length) {
    return <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-[11px] text-white/30">{emptyLabel}</p>;
  }
  const ceiling = Math.max(max ?? Math.max(...rows.map((row) => num(row.value)), 1), 1);

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-2.5">
          {row.logo || row.avatar}
          <span className="w-28 shrink-0 truncate text-[11px] font-medium text-white/70">{row.label}</span>
          <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
            <span
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (num(row.value) / ceiling) * 100)}%`, background: row.color || color }}
            />
          </span>
          <span className="w-12 shrink-0 text-right font-mono text-[10px] font-semibold text-white/55">
            {num(row.value).toFixed(row.decimals ?? 0)}{suffix}
          </span>
        </div>
      ))}
    </div>
  );
}

export default BarChart;
