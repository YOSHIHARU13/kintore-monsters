import { useStore } from '../store'
import { BONUS_SLOT, DAYS, SLOTS, TASK_SLOTS, exerciseOfSlot, type Slot } from '../data/exercises'
import { formationOf, requirementsOf } from '../lib/formation'
import { setHit, type Member } from '../lib/quest'
import type { Quest } from '../types'

/**
 * 倒すまでの目安を、セット数で出す：弱点種目・ボスの部位・ほかの部位・ローラーの、1セットのダメージと「あと何セット」
 * hpLeft は残りのHP（出撃前ならHPそのまま）
 */
export function SetsEstimate({ quest, party, hpLeft }: { quest: Quest; party: Member[]; hpLeft: number }) {
  const { menu } = useStore()
  const { rate } = formationOf(
    party.map((m) => m.def),
    requirementsOf(quest),
  )
  const name = (slot: Slot) => exerciseOfSlot(slot, menu).name
  const per = (slot: Slot) => setHit({ slotId: slot.id, day: slot.day, eligible: true }, quest, party, '', rate).damage
  const weak = SLOTS.filter((s) => quest.weakSlots.includes(s.id))
  const bossPart = TASK_SLOTS.filter((s) => DAYS[s.day as keyof typeof DAYS]?.attr === quest.attr && !quest.weakSlots.includes(s.id))
  const others = TASK_SLOTS.filter((s) => DAYS[s.day as keyof typeof DAYS]?.attr !== quest.attr && !quest.weakSlots.includes(s.id))
  // それぞれ、いちばん効く種目で代表させる
  const top = (list: Slot[]) => list.map((s) => ({ s, d: per(s) })).sort((a, b) => b.d - a.d)[0]
  const rows = [
    ...weak.map((s) => ({ label: `🎯 弱点種目（${name(s)}）`, d: per(s) })),
    ...(bossPart.length > 0 ? [{ label: `⚔️ ${DAYS[bossPart[0].day as keyof typeof DAYS].title}の種目（ボスの部位）`, d: top(bossPart)!.d }] : []),
    ...(others.length > 0 ? [{ label: 'ほかの部位の種目', d: top(others)!.d }] : []),
    { label: `全身枠（${name(BONUS_SLOT)}など）`, d: per(BONUS_SLOT) },
  ].filter((r) => r.d > 0)
  return (
    <div className="sets-estimate">
      <table className="estimate-table">
        <thead>
          <tr>
            <th>セットの種類</th>
            <th>1セット</th>
            <th>倒すまで</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td>{r.label}</td>
              <td className="num">{r.d.toLocaleString()}</td>
              <td className="num">
                <strong>{hpLeft <= 0 ? '倒せる！' : `あと${Math.ceil(hpLeft / r.d)}セット`}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small">
        残りHP {Math.max(0, hpLeft).toLocaleString()}・追加のセットもダメージになります。選んだメンバーと編成倍率 ×{rate.toFixed(2)} 込み。
      </p>
    </div>
  )
}
