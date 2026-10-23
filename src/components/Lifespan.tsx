import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { CONFIG } from '../config/gameConfig'
import { selectableGimmicks } from '../lib/gimmick'
import { superRareCount, type Lifespan, type Lifespans } from '../lib/lifespan'
import { towerMonth } from '../lib/tower'
import type { Go } from '../nav'
import type { MonsterDef, OwnedMonster } from '../types'

const CACHE_KEY = 'lifespan2'

/** 登録の中身が変わったときだけ計算し直すための目印 */
function signature(month: string, defs: MonsterDef[], owned: OwnedMonster[], quests: number, order: string[] = []): string {
  const body = [
    ...defs.map((d) => `${d.id}:${d.element ?? ''}:${d.tier ?? ''}:${(d.abilities ?? []).join(',')}:${d.bossGrade ?? ''}:${d.castleOnly ? 1 : 0}${d.castleLord ? 1 : 0}`),
    ...owned.map((o) => `${o.id}:${o.nodeId}:${o.shinka ? 1 : 0}${o.shinkaGold ? 1 : 0}:${o.custom ?? ''}:${o.customSlot ?? ''}`),
    order.join(','),
  ].join('|')
  let h = 0
  for (let i = 0; i < body.length; i++) h = (Math.imul(h, 31) + body.charCodeAt(i)) | 0
  return `${month}:${quests}:${h}`
}

/** 寿命の目安を、画面を止めずに計算する（結果はこの端末に覚えておき、登録が変わったら計算し直す） */
export function useLifespan(): { result: Lifespans | null; busy: boolean } {
  const { defs, owned, quests, state, today, loaded, tower, kinkin } = useStore()
  const month = towerMonth(today)
  const boss = quests.filter((q) => q.kind !== 'material' && !q.builtin)
  const order = state.bossOrder?.castle
  const sig = signature(month, defs, owned, boss.length, order)
  const [result, setResult] = useState<Lifespans | null>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as { sig: string; result: Lifespans } | null
      return saved?.sig === sig ? saved.result : null
    } catch {
      return null
    }
  })
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!loaded || defs.length === 0) return
    try {
      const saved = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as { sig: string; result: Lifespans } | null
      if (saved?.sig === sig) {
        setResult(saved.result)
        return
      }
    } catch {
      // 覚えておけなくても、計算はできる
    }
    if (typeof Worker === 'undefined') return
    setBusy(true)
    const worker = new Worker(new URL('../lib/lifespan.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<Lifespans>) => {
      setResult(e.data)
      setBusy(false)
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ sig, result: e.data }))
      } catch {
        // 覚えておけなくてもよい
      }
      worker.terminate()
    }
    worker.onerror = () => {
      setBusy(false)
      worker.terminate()
    }
    worker.postMessage({ month, defs, owned, gimmicks: selectableGimmicks(quests), quests: boss, order, taken: [...tower, ...kinkin].map((f) => f.quest) })
    return () => worker.terminate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, loaded])
  return { result, busy }
}

/** 寿命のひとこと（その他のメニューに出す。手持ちで見る） */
export function lifespanText(r: Lifespan): string {
  if (r.typical === 0) return '孤城は楽勝。新しいギミック・高難度の足しどき'
  if (r.typical === null) return `孤城はまだまだ手ごたえあり（激レア${CONFIG.lifespan.maxAdds}体以上先）`
  return `孤城が楽勝になるまで 激レアあと約${r.typical}体`
}

/** 各階を1日で削れる割合の棒グラフ */
function FloorBars({ r }: { r: Lifespan }) {
  return (
    <div className="lifespan-floors">
      {r.floors.map((f) => (
        <span key={f.floor} className={`lifespan-floor${f.ratio >= CONFIG.lifespan.easyRatio ? ' easy' : ''}`} title={`${f.floor}階 ${Math.round(f.ratio * 100)}%`}>
          <i style={{ height: `${Math.min(100, Math.round(f.ratio * 100))}%` }} />
          <span>{f.floor}</span>
        </span>
      ))}
    </div>
  )
}

/** コンテンツの寿命：孤城の各階を1日で倒せるか、全部の階が楽勝になるまで激レアがあと何体か（手持ちと理想） */
export function LifespanCard({ go }: { go?: Go }) {
  const { defs } = useStore()
  const { result, busy } = useLifespan()
  const floors = CONFIG.castle.floors
  const best = (r: Lifespan) => (r.best !== null && r.best > 0 ? `・ぴったり刺さる激レアばかりなら最短${r.best}体` : '')
  return (
    <section className="card lifespan">
      <h2>📈 コンテンツの寿命（目安）</h2>
      {!result ? (
        <p className="muted small">{busy ? '計算中…（数秒かかります）' : 'まだ計算していません'}</p>
      ) : (
        <>
          <h3>あなたの手持ち</h3>
          <p>
            <strong>{lifespanText(result.mine)}</strong>
          </p>
          <p className="small">
            零の孤城を1日で倒せる階：{result.mine.easy}／{floors}階{best(result.mine)}
            <br />
            手持ちを全員育てきったら：{result.mine.grownEasy}／{floors}階
          </p>
          <FloorBars r={result.mine} />
          <h3>理想（登録しているモンスターを全員持っていて、育ちきっている）</h3>
          <p className="small">
            <strong>{lifespanText(result.ideal)}</strong>
            <br />
            1日で倒せる階：{result.ideal.easy}／{floors}階・今の激レア {superRareCount(defs)}体{best(result.ideal)}
          </p>
          <FloorBars r={result.ideal} />
          <p className="muted small">
            棒は、各階をいちばん強い6体で「1日ぶんのメニュー」をやったときに削れるHPの割合（100%で1日で倒せる）。
            1日ぶんのメニュー＝その月の部位の種目（4〜5種目）と全身枠1種目を、それぞれ基本の3セット。
            手持ちは今の育ち具合のまま、「あと約◯体」は新しい激レア（属性やアビリティはばらばら）を引いて育てきったときの目安です。
            {busy && '（計算し直し中…）'}
          </p>
        </>
      )}
      {go && (
        <button className="btn small" onClick={() => go({ name: 'bossAdmin' })}>
          高難度のボスを見る
        </button>
      )}
    </section>
  )
}
