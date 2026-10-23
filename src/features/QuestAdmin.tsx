import { useState } from 'react'
import { useStore } from '../store'
import { FIRST_NODE_ID } from '../data/evolutionTemplates'
import { CONFIG } from '../config/gameConfig'
import { defaultBossHp, gradeOf } from '../lib/quest'
import { autoGradeOf, autoQuestSetup } from '../lib/questAuto'
import { selectableGimmicks } from '../lib/gimmick'
import { elementInfo } from '../lib/element'
import type { Go } from '../nav'
import { nodeAttr, type Quest } from '../types'

/** クエストを作る道具：降臨ごとにまとめて作る・条件を作り直す */
export function useQuestTools() {
  const { quests, defs, saveQuest } = useStore()
  // まだボスクエストがない降臨モンスター（塔限定・城主は塔と孤城でもらえるので除く）
  const pending = defs.filter(
    (d) => d.questOnly && !d.tower && !d.castleLord && !d.castleOnly && !d.kinkinLord && !quests.some((q) => q.kind !== 'material' && q.bossDefId === d.id),
  )
  const topQuests = quests.filter((q) => !q.builtin && q.kind !== 'material')

  /** 降臨モンスター1体につき1つ、おまかせでボスクエストを作る（名前はボスの名前・格はレア度から）。作った数 */
  const makeAll = () => {
    const gimmicks = selectableGimmicks(quests)
    const sofar: Pick<Quest, 'id' | 'requirements' | 'gimmicks'>[] = [...quests]
    for (const d of pending) {
      const grade = autoGradeOf(d)
      const r = autoQuestSetup(d, grade, 'boss', sofar, gimmicks, undefined, defs)
      const hp = defaultBossHp(grade)
      saveQuest({
        name: '',
        kind: 'boss',
        bossDefId: d.id,
        attr: nodeAttr(d, FIRST_NODE_ID),
        element: elementInfo(d).elements[0],
        weakSlots: r.weakSlots,
        requirements: r.requirements,
        customGimmicks: {},
        hp: { easy: hp, normal: hp, hard: hp },
        rank: 1,
        grade,
        catchphrase: '',
        theme: 'flame',
      })
      sofar.push({ id: `new-${d.id}`, requirements: r.requirements })
    }
    return pending.length
  }

  /** ボスクエストの条件を、おまかせ（弱点属性＋アビリティ）で作り直す。作り直した数 */
  const redoTop = () => {
    const gimmicks = selectableGimmicks(quests)
    const sofar: Pick<Quest, 'id' | 'requirements' | 'gimmicks'>[] = quests.filter((q) => !topQuests.includes(q))
    for (const q of topQuests) {
      const boss = defs.find((d) => d.id === q.bossDefId)
      if (!boss) continue
      const r = autoQuestSetup(boss, gradeOf(q), 'boss', sofar, gimmicks, q.id, defs)
      const { id, createdAt: _c, autoName, builtin: _b, ...rest } = q
      saveQuest({ ...rest, id, name: autoName ? '' : q.name, requirements: r.requirements, weakSlots: r.weakSlots })
      sofar.push({ id, requirements: r.requirements })
    }
    return topQuests.length
  }
  return { pending, topQuests, makeAll, redoTop }
}

/** 開発者メニュー：クエストの管理（作る・まとめて作る・作り直す・編集・試練の塔の作り直し） */
export function QuestAdmin({ go }: { go: Go }) {
  const { pending, topQuests, makeAll, redoTop } = useQuestTools()
  const [made, setMade] = useState<string | null>(null)
  const [confirmRedo, setConfirmRedo] = useState(false)
  return (
    <div className="page">
      <button className="back" onClick={() => go({ name: 'more' })}>
        ← その他に戻る
      </button>
      <h1 className="title">クエストの管理</h1>

      <section className="card">
        <button className="btn primary wide" onClick={() => go({ name: 'questForm' })}>
          ＋ クエストを作る
        </button>
        {pending.length > 0 && (
          <>
            <button className="btn wide" onClick={() => setMade(`${makeAll()}個のクエストを作りました`)}>
              ✨ 降臨モンスター{pending.length}体ぶん、まとめて作る
            </button>
            <p className="muted small">
              クエストがまだない降臨モンスターごとに、ボスの名前・属性で作ります。格はレア度から（降臨の激レア→爆絶・レア→超絶（コラボは超究極）・ノーマル→究極・ハズレ→上級）、編成の条件と弱点はおまかせ。
            </p>
          </>
        )}
        {topQuests.length > 0 && (
          <button
            className={`btn wide${confirmRedo ? ' primary' : ' ghost'}`}
            onClick={() => {
              if (!confirmRedo) return setConfirmRedo(true)
              setMade(`${redoTop()}個のクエストの条件を作り直しました`)
              setConfirmRedo(false)
            }}
          >
            {confirmRedo
              ? `本当にボスクエスト${topQuests.length}個の条件を作り直す（手で変えた条件は消えます）`
              : '🎯 ボスクエストの条件を、おまかせ（弱点属性＋アビリティ）で作り直す'}
          </button>
        )}
        {made && <div className="result keep">{made}</div>}
      </section>

      <section className="card">
        <h2>作ったクエスト（{topQuests.length}個）</h2>
        <ul className="mini-list">
          {topQuests.map((q) => (
            <li key={q.id}>
              <span>
                <span className={`grade-badge grade-${gradeOf(q)}`}>{CONFIG.quest.grades[gradeOf(q)].label}</span> {q.name}
              </span>
              <button className="btn small" onClick={() => go({ name: 'questForm', id: q.id })}>
                編集
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
