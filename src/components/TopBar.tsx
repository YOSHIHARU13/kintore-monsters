import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { ATTRS, ATTR_LABEL, type Attr } from '../data/exercises'
import { ATTR_COLOR, type Go } from '../nav'
import { CORE_KEYS, CORE_LABEL } from '../lib/cores'

type Key = 'gold' | 'eggs' | Attr | 'any' | 'cores'
interface Pop {
  id: number
  key: Key
  amount: number
}

const POP_MS = 1600

/** どの画面でも上に出す所持（G・タマゴ・EXP）。増えると「+N」が浮かぶ */
export function TopBar({ go }: { go: Go }) {
  const { state } = useStore()
  const values: Record<Key, number> = {
    gold: state.gold,
    eggs: state.eggs,
    chestArms: state.exp.chestArms.trained + state.exp.chestArms.bought,
    legs: state.exp.legs.trained + state.exp.legs.bought,
    backShoulders: state.exp.backShoulders.trained + state.exp.backShoulders.bought,
    any: state.anyExp,
    cores: CORE_KEYS.reduce((sum, k) => sum + (state.cores[k] ?? 0), 0),
  }
  const prev = useRef(values)
  const [pops, setPops] = useState<Pop[]>([])
  const [open, setOpen] = useState(false)

  // 前回より増えた分だけ浮かべる
  useEffect(() => {
    const added = (Object.keys(values) as Key[])
      .filter((k) => values[k] > prev.current[k])
      .map((k) => ({ id: Date.now() + Math.random(), key: k, amount: values[k] - prev.current[k] }))
    prev.current = values
    if (added.length === 0) return
    setPops((p) => [...p, ...added])
    const t = setTimeout(() => setPops((p) => p.filter((x) => !added.includes(x))), POP_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.gold, values.eggs, values.chestArms, values.legs, values.backShoulders, values.any, values.cores])

  const item = (key: Key, icon: string, value: number, color?: string) => (
    <span className="topbar-item" style={color ? { color } : undefined}>
      <span className="topbar-icon">{icon}</span>
      <strong className="num">{value.toLocaleString()}</strong>
      {pops
        .filter((p) => p.key === key)
        .map((p) => (
          <span key={p.id} className="topbar-pop">
            +{p.amount.toLocaleString()}
          </span>
        ))}
    </span>
  )

  return (
    <header className="topbar">
      <button className="topbar-main" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="所持の内訳">
        {item('gold', '💰', values.gold, 'var(--gold)')}
        {item('eggs', '🥚', values.eggs)}
        {item('cores', '💎', values.cores, '#9be7ff')}
        {ATTRS.map((a) => (
          <span key={a}>{item(a, ATTR_LABEL[a].slice(0, 1), values[a], ATTR_COLOR[a])}</span>
        ))}
        {item('any', '万', values.any, '#c9cbd6')}
      </button>
      <button className="topbar-gear" onClick={() => go({ name: 'settings' })} aria-label="設定">
        ⚙️
      </button>
      {open && (
        <div className="topbar-detail" onClick={() => setOpen(false)}>
          {ATTRS.map((a) => (
            <div key={a}>
              <span style={{ color: ATTR_COLOR[a] }}>{ATTR_LABEL[a]}EXP</span> {values[a]}
              {state.exp[a].bought > 0 && <span className="muted small">（うち購入 {state.exp[a].bought}）</span>}
            </div>
          ))}
          <div>万能EXP {values.any}（どの属性の進化にも使える）</div>
          <div>
            💎 {CORE_KEYS.map((k) => `${CORE_LABEL[k]} ${state.cores[k] ?? 0}`).join('・')}
          </div>
          <div>
            ゴールド {values.gold.toLocaleString()}G・タマゴ {values.eggs}個
          </div>
        </div>
      )}
    </header>
  )
}
