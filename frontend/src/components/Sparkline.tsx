interface Props {
  values: number[];
  className?: string;
}

/** Mini gráfica de línea/área en SVG, sin dependencias. */
export default function Sparkline({ values, className }: Props) {
  const w = 300;
  const h = 60;
  const max = Math.max(1, ...values);
  const step = w / Math.max(1, values.length - 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(h - 4 - (v / max) * (h - 8)).toFixed(1)}`);
  const line = pts.join(" ");
  const area = `0,${h} ${line} ${w},${h}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className} aria-hidden>
      <polygon points={area} className="fill-indigo-500/20" />
      <polyline points={line} fill="none" strokeWidth={2} vectorEffect="non-scaling-stroke" className="stroke-indigo-400" />
    </svg>
  );
}
