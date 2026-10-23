import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { ATTRS, ATTR_LABEL, type Attr } from '../data/exercises'
import { ATTR_COLOR, type Go } from '../nav'
import { playerRankOf, rankExpOf } from '../lib/rank'
import { Gauge } from './Gauge'

type Key = 'gold' | 'coins' | 'eggs' | Attr | 'any' | 'rank'
interface Pop {
  id: number
  key: Key
  amount: number
}

const POP_MS = 1600

/** どの画面でも上に出す：ランク・EXP・タマゴ・オーブ・コイン。増えると「+N」が浮かぶ（素材の数は「その他」の所持アイテムで見る） */
export function TopBar({ go }: { go: Go }) {
  const { state } = useStore()
  const values: Record<Key, number> = {
    gold: state.gold,
    coins: state.coins ?? 0,
    eggs: state.eggs,
    chestArms: state.exp.chestArms.trained + state.exp.chestArms.bought,
    legs: state.exp.legs.trained + state.exp.legs.bought,
    backShoulders: state.exp.backShoulders.trained + state.exp.backShoulders.bought,
    any: state.anyExp,
    rank: playerRankOf(rankExpOf(state)).rank,
  }
  const rank = playerRankOf(rankExpOf(state))
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
  }, [values.gold, values.coins, values.eggs, values.chestArms, values.legs, values.backShoulders, values.any, values.rank])

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
        {item('rank', 'R', values.rank, '#ffd166')}
        {ATTRS.map((a) => (
          <span key={a}>{item(a, ATTR_LABEL[a].slice(0, 1), values[a], ATTR_COLOR[a])}</span>
        ))}
        {item('any', '万', values.any, '#c9cbd6')}
        {item('eggs', '🥚', values.eggs)}
        {item('gold', '🔮', values.gold, 'var(--gold)')}
        {item('coins', '🪙', values.coins, '#ffd166')}
      </button>
      {open && (
        <div className="topbar-detail" onClick={() => setOpen(false)}>
          <div>
            ランク {rank.rank}（次まで {rank.need - rank.into}EXP）
            <Gauge value={rank.into} max={rank.need} color="#ffd166" />
          </div>
          {ATTRS.map((a) => (
            <div key={a}>
              <span style={{ color: ATTR_COLOR[a] }}>{ATTR_LABEL[a]}EXP</span> {values[a]}
              {state.exp[a].bought > 0 && <span className="muted small">（うち購入 {state.exp[a].bought}）</span>}
            </div>
          ))}
          <div>万能EXP {values.any}（どの属性の進化にも使える）</div>
          <div>
            オーブ {values.gold.toLocaleString()}・進化コイン {values.coins.toLocaleString()}・タマゴ {values.eggs}個
          </div>
          <button className="btn small" onClick={() => go({ name: 'items' })}>
            📦 所持アイテム（結晶・核・筋肉玉）を見る
          </button>
        </div>
      )}
    </header>
  )
}
