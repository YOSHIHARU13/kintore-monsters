interface Props {
  value: number
  max: number
  color?: string
}

export function Gauge({ value, max, color }: Props) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="gauge">
      <div className="gauge-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}
