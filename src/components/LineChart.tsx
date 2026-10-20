import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';

// Colours validated with the dataviz palette checker against the panel colour (#1e2128).
export const GOLD_COLOR = '#c98500';
/** Goal lines in this fixed order; it passes the colour-blindness checks for neighbouring lines. */
export const GOAL_COLORS = ['#3987e5', '#d95926', '#199e70', '#9085e9', '#d55181', '#008300', '#e66767'];
const SURFACE = '#1e2128';

export interface LineSeries {
  id: string;
  name: string;
  color: string;
  values: number[];
}

/** A shaded range under the lines, e.g. the 10th–90th percentile. */
export interface Band {
  name: string;
  color: string;
  lo: number[];
  hi: number[];
}

/** A labelled dot on a series at one index. */
export interface Marker {
  seriesId: string;
  index: number;
  label: string;
}

interface Props {
  label: string;
  series: LineSeries[];
  band?: Band;
  /** Fixed top of the y axis (1 for probabilities); otherwise rounded up from the data. */
  yMax?: number;
  formatTick: (v: number) => string;
  formatValue: (v: number) => string;
  /** Name of the point at an index, e.g. "Fight 12". */
  xName: (index: number) => string;
  markers?: Marker[];
  /** Print each series' last value at the end of its line. */
  endLabels?: boolean;
  height?: number;
}

function niceStep(raw: number): number {
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
}

function yTicks(max: number, fixed: boolean): number[] {
  const step = fixed ? max / 4 : niceStep(max / 4);
  const top = fixed ? max : Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);
  return ticks;
}

function xTicks(n: number): number[] {
  const step = Math.max(1, niceStep(n / 6));
  const ticks = [0];
  for (let s = step; s <= n; s += step) ticks.push(s - 1);
  return ticks;
}

export function LineChart({ label, series, band, yMax, formatTick, formatValue, xName, markers = [], endLabels, height = 220 }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);
  const n = series[0]?.values.length ?? band?.lo.length ?? 0;

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, [n > 0]);

  if (n === 0) return null;
  const m = { top: 12, right: endLabels ? 52 : 16, bottom: 26, left: 46 };
  const plotW = width - m.left - m.right;
  const plotH = height - m.top - m.bottom;
  // At least 1, so an all-zero chart still gets a readable axis.
  const dataMax = Math.max(1, ...series.flatMap((s) => s.values), ...(band?.hi ?? []));
  const ticks = yTicks(yMax ?? dataMax, yMax !== undefined);
  const top = ticks[ticks.length - 1];
  const x = (i: number) => m.left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => m.top + plotH - (v / top) * plotH;
  const path = (values: number[]) => values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');

  const pick = (clientX: number) => {
    const rect = wrap.current!.getBoundingClientRect();
    const i = Math.round(((clientX - rect.left - m.left) / plotW) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  };
  const onKey = (e: KeyboardEvent) => {
    const keys: Record<string, (i: number) => number> = {
      ArrowLeft: (i) => i - 1,
      ArrowRight: (i) => i + 1,
      Home: () => 0,
      End: () => n - 1,
    };
    const move = keys[e.key];
    if (!move) return;
    e.preventDefault();
    setHover((h) => Math.min(n - 1, Math.max(0, move(h ?? n - 1))));
  };

  const tipLeft = hover !== null && x(hover) > width - 200 ? x(hover) - 196 : (hover !== null ? x(hover) : 0) + 12;

  return (
    <div className="chart">
      {series.length > 1 && (
        <div className="legend" aria-hidden>
          {series.map((s) => (
            <span key={s.id}>
              <i className="key" style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
      <div
        ref={wrap}
        className="plot"
        tabIndex={0}
        role="img"
        aria-label={`${label}. Use the arrow keys to read values; a table follows.`}
        onPointerMove={(e) => pick(e.clientX)}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
      >
        <svg width={width} height={height}>
          <g className="gridlines">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={m.left} x2={m.left + plotW} y1={y(t)} y2={y(t)} className={t === 0 ? 'baseline' : undefined} />
                <text x={m.left - 8} y={y(t)} dy="0.32em" textAnchor="end">
                  {formatTick(t)}
                </text>
              </g>
            ))}
            {xTicks(n).map((i) => (
              <text key={i} x={x(i)} y={height - 8} textAnchor="middle">
                {i + 1}
              </text>
            ))}
          </g>
          {band && (
            <path
              d={`${path(band.hi)}${band.lo
                .map((v, i) => [i, v] as const)
                .reverse()
                .map(([i, v]) => `L${x(i).toFixed(1)},${y(v).toFixed(1)}`)
                .join('')}Z`}
              fill={band.color}
              fillOpacity={0.16}
            />
          )}
          {series.map((s) => (
            <path key={s.id} d={path(s.values)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {endLabels &&
            series.map((s) => (
              <text key={s.id} className="end-label" x={x(n - 1) + 8} y={y(s.values[n - 1])} dy="0.32em">
                {formatValue(s.values[n - 1])}
              </text>
            ))}
          {markers.map((mk) => {
            const s = series.find((s) => s.id === mk.seriesId);
            if (!s) return null;
            const right = x(mk.index) < m.left + plotW * 0.7;
            return (
              <g key={mk.seriesId}>
                <circle cx={x(mk.index)} cy={y(s.values[mk.index])} r={4} fill={s.color} stroke={SURFACE} strokeWidth={2} />
                <text
                  className="marker-label"
                  x={x(mk.index) + (right ? 8 : -8)}
                  y={y(s.values[mk.index]) + 14}
                  textAnchor={right ? 'start' : 'end'}
                >
                  {mk.label}
                </text>
              </g>
            );
          })}
          {hover !== null && (
            <g className="crosshair">
              <line x1={x(hover)} x2={x(hover)} y1={m.top} y2={m.top + plotH} />
              {series.map((s) => (
                <circle key={s.id} cx={x(hover)} cy={y(s.values[hover])} r={4} fill={s.color} stroke={SURFACE} strokeWidth={2} />
              ))}
            </g>
          )}
        </svg>
        {hover !== null && (
          <div className="tooltip" style={{ left: tipLeft, top: m.top }}>
            <div className="tip-title">{xName(hover)}</div>
            {series.map((s) => (
              <div className="tip-row" key={s.id}>
                <i className="key" style={{ background: s.color }} />
                <strong>{formatValue(s.values[hover])}</strong>
                <span>{s.name}</span>
              </div>
            ))}
            {band && (
              <div className="tip-row">
                <i className="key band" style={{ background: band.color }} />
                <strong>
                  {formatValue(band.lo[hover])} – {formatValue(band.hi[hover])}
                </strong>
                <span>{band.name}</span>
              </div>
            )}
          </div>
        )}
      </div>
      <details className="table-view">
        <summary>Show as table</summary>
        <div className="table-scroll">
          <table className="grid">
            <thead>
              <tr>
                <th />
                {band && <th className="num">{band.name}</th>}
                {series.map((s) => (
                  <th key={s.id} className="num">
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: n }, (_, i) => (
                <tr key={i}>
                  <td>{xName(i)}</td>
                  {band && (
                    <td className="num">
                      {formatValue(band.lo[i])} – {formatValue(band.hi[i])}
                    </td>
                  )}
                  {series.map((s) => (
                    <td key={s.id} className="num">
                      {formatValue(s.values[i])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
