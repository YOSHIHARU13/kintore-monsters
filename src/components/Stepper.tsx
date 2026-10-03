interface Props {
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  unit: string
  big?: boolean
}

/** −／＋ボタンで数値を変える入力 */
export function Stepper({ value, onChange, min, max, step = 1, unit, big = false }: Props) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v))
  return (
    <div className={`stepper${big ? ' big' : ''}`}>
      <button type="button" onClick={() => onChange(clamp(value - step))} disabled={value <= min} aria-label="減らす">
        −
      </button>
      <div className="stepper-value">
        <strong>{value}</strong>
        <span>{unit}</span>
      </div>
      <button type="button" onClick={() => onChange(clamp(value + step))} disabled={value >= max} aria-label="増やす">
        ＋
      </button>
    </div>
  )
}
