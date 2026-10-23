import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { CONFIG } from '../config/gameConfig'
import { selectableGimmicks } from '../lib/gimmick'
import { superRareCount, type Lifespan } from '../lib/lifespan'
import { towerMonth } from '../lib/tower'
import type { Go } from '../nav'

const CACHE_KEY = 'lifespan'

/** 登録の中身が変わったときだけ計算し直すための目印 */
function signature(month: string, defs: { id: string; element?: string; tier?: string; abilities?: string[]; bossGrade?: string; castleOnly?: boolean; castleLord?: boolean }[], quests: number): string {
  const body = defs.map((d) => `${d.id}:${d.element ?? ''}:${d.tier ?? ''}:${(d.abilities ?? []).join(',')}:${d.bossGrade ?? ''}:${d.castleOnly ? 1 : 0}${d.castleLord ? 1 : 0}`).join('|')
  let h = 0
  for (let i = 0; i < body.length; i++) h = (Math.imul(h, 31) + body.charCodeAt(i)) | 0
  return `${month}:${quests}:${h}`
}

/** 寿命の目安を、画面を止めずに計算する（結果はこの端末に覚えておき、登録が変わったら計算し直す） */
export function useLifespan(): { result: Lifespan | null; busy: boolean } {
  const { defs, quests, today, loaded } = useStore()
  const month = towerMonth(today)
  const boss = quests.filter((q) => q.kind !== 'material' && !q.builtin)
  const sig = signature(month, defs, boss.length)
  const [result, setResult] = useState<Lifespan | null>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as { sig: string; result: Lifespan } | null
      return saved?.sig === sig ? saved.result : null
    } catch {
      return null
    }
  })
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!loaded || defs.length === 0) return
    try {
      const saved = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as { sig: string; result: Lifespan } | null
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
    worker.onmessage = (e: MessageEvent<Lifespan>) => {
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
    worker.postMessage({ month, defs, gimmicks: selectableGimmicks(quests), quests: boss })
    return () => worker.terminate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, loaded])
  return { result, busy }
}

/** 寿命のひとこと（その他のメニューに出す） */
export function lifespanText(r: Lifespan): string {
  if (r.typical === 0) return '孤城は楽勝。新しいギミック・高難度の足しどき'
  if (r.typical === null) return `孤城はまだまだ手ごたえあり（激レア${CONFIG.lifespan.maxAdds}体以上先）`
  return `孤城が楽勝になるまで 激レアあと約${r.typical}体`
}

/** コンテンツの寿命：孤城の各階を1日で倒せるか、全部の階が楽勝になるまで激レアがあと何体か */
export function LifespanCard({ go }: { go?: Go }) {
  const { defs } = useStore()
  const { result, busy } = useLifespan()
  const floors = CONFIG.castle.floors
  return (
    <section className="card lifespan">
      <h2>📈 コンテンツの寿命（目安）</h2>
      {!result ? (
        <p className="muted small">{busy ? '計算中…（数秒かかります）' : 'まだ計算していません'}</p>
      ) : (
        <>
          <p>
            <strong>{lifespanText(result)}</strong>
          </p>
          <p className="small">
            零の孤城で1日で倒せる階：{result.easy}／{floors}階・今の激レア {superRareCount(defs)}体
            {result.best !== null && result.best > 0 && `・ぴったり刺さる子ばかりなら最短${result.best}体`}
          </p>
          <div className="lifespan-floors">
            {result.floors.map((f) => (
              <span key={f.floor} className={`lifespan-floor${f.ratio >= CONFIG.lifespan.easyRatio ? ' easy' : ''}`} title={`${f.floor}階 ${Math.round(f.ratio * 100)}%`}>
                <i style={{ height: `${Math.min(100, Math.round(f.ratio * 100))}%` }} />
                <span>{f.floor}</span>
              </span>
            ))}
          </div>
          <p className="muted small">
            登録している子を全員持っていて育ちきっていると考えて、各階を最強の6体で1日ぶんのメニューで削れる割合（100%で1日で倒せる）。
            「あと約◯体」は、属性やアビリティがばらばらの激レアを足していったときの目安です。全部当たるわけではないので参考程度に。
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
