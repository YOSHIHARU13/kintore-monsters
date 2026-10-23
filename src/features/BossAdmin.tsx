import { useState } from 'react'
import { useStore } from '../store'
import { CONFIG } from '../config/gameConfig'
import { MonsterImage } from '../components/MonsterImage'
import { bannerNodeOf } from '../components/GachaBanner'
import { awakenOf, glowOf, imageOf } from '../lib/art'
import { patternLabel } from '../lib/pattern'
import { towerMonth, towerMonsters, type TowerFloor } from '../lib/tower'
import { kinkinLords } from '../lib/kinkin'
import { castleMonsters } from '../lib/castle'
import type { Go } from '../nav'
import { bossGradeOf } from '../lib/gacha'
import { ELEMENT_LABEL, ZERO_LABEL, elementInfo } from '../lib/element'
import type { BossRole } from '../lib/questAuto'
import { LifespanCard } from '../components/Lifespan'
import { isHidden, type MonsterDef } from '../types'

const ROLE_LABEL: Record<BossRole, string> = { tower: '塔の11階', kinkinLord: '禁筋の最上階', castleLord: '城主', castleOnly: '孤城限定' }
const roleOf = (d: MonsterDef): BossRole | null =>
  d.tower ? 'tower' : d.kinkinLord ? 'kinkinLord' : d.castleLord ? 'castleLord' : d.castleOnly ? 'castleOnly' : null

type Tab = 'tower' | 'kinkin' | 'castle'

/** 開発者メニュー：高難度（試練の塔・禁筋の獄・零の孤城）のボス。今月の各階のボスと、最上階の入れ替わるボス。絵や設定はここから直せる */
export function BossAdmin({ go }: { go: Go }) {
  const { tower, kinkin, castle, defs, today, setBossRole } = useStore()
  const [tab, setTab] = useState<Tab>('tower')
  // 選んでいる役割（開いているときだけ、降臨の一覧から付け外しできる）
  const [picking, setPicking] = useState<BossRole | null>(null)
  const floors: Record<Tab, TowerFloor[]> = { tower, kinkin, castle }
  const lords: Record<Tab, { role: BossRole; label: string; list: MonsterDef[]; need: number; hint: string }[]> = {
    tower: [{ role: 'tower', label: '🗼 11階のボス（塔限定）', list: towerMonsters(defs), need: 3, hint: '毎月入れ替わり、倒すと運33で手に入る' }],
    kinkin: [{ role: 'kinkinLord', label: '⛓ 20階のボス', list: kinkinLords(defs), need: 3, hint: '毎月入れ替わり、初回クリアで手に入る' }],
    castle: [
      { role: 'castleLord', label: '👑 城主（11階）', list: defs.filter((d) => d.questOnly && d.castleLord), need: 3, hint: '爆絶の降臨だけ。毎月入れ替わり、倒すと手に入る' },
      { role: 'castleOnly', label: '🏯 1〜10階のボス（孤城限定）', list: castleMonsters(defs), need: 10, hint: '属性の順に並び、その階を毎月はじめて突破すると運33で手に入る' },
    ],
  }
  // 役割を付けられる降臨（城主は爆絶だけ）
  const candidates = (role: BossRole) =>
    defs.filter((d) => d.questOnly && !isHidden(d) && (role !== 'castleLord' || bossGradeOf(d) === 'bakuzetsu'))
  const elText = (d: MonsterDef) => elementInfo(d).elements.map((e) => ELEMENT_LABEL[e]).join('') || ZERO_LABEL
  const name: Record<Tab, string> = { tower: '試練の塔', kinkin: '禁筋の獄', castle: '零の孤城' }
  const icon = (d: MonsterDef) => (
    <MonsterImage imageId={imageOf(d, bannerNodeOf(d))} awaken={awakenOf(d, bannerNodeOf(d))} glow={glowOf(d)} size={44} />
  )
  return (
    <div className="page">
      <button className="back" onClick={() => go({ name: 'more' })}>
        ← その他に戻る
      </button>
      <h1 className="title">高難度のボス</h1>
      <p className="muted small">
        今月は{patternLabel(towerMonth(today))}。どの降臨を高難度専用にするかは、ここでまとめて選べます（専用にした子は、ふつうのクエストには出ません）。ボスの絵や名前・属性は、タップして登録画面から直せます。
      </p>
      <LifespanCard />
      <div className="segmented" role="tablist" aria-label="高難度">
        {(['tower', 'kinkin', 'castle'] as const).map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {name[t]}
          </button>
        ))}
      </div>

      {lords[tab].map((g) => (
        <section key={g.label} className="card">
          <h2>
            {g.label}（{g.list.length}／{g.need}体）
          </h2>
          <p className="muted small">{g.hint}</p>
          {g.list.length < g.need && (
            <p className="warn small">あと{g.need - g.list.length}体。下の「選ぶ」から降臨を選んでください（いない分は、ほかのボスやトク玉で埋まります）。</p>
          )}
          <ul className="choice-list">
            {g.list.map((d) => (
              <li key={d.id}>
                <button className="choice" onClick={() => go({ name: 'monsterForm', id: d.id })}>
                  <span className="monster-row">
                    {icon(d)}
                    <span>{d.name}</span>
                  </span>
                  <span className="small">編集 ›</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="row">
            <button className={`btn small${picking === g.role ? ' primary' : ''}`} onClick={() => setPicking(picking === g.role ? null : g.role)}>
              {picking === g.role ? '選び終わる' : '✅ 降臨から選ぶ'}
            </button>
            <button className="btn small" onClick={() => go({ name: 'monsterForm', preset: 'quest' })}>
              ＋ 降臨を登録する
            </button>
          </div>
          {picking === g.role && (
            <ul className="choice-list role-pick">
              {candidates(g.role).map((d) => {
                const now = roleOf(d)
                const on = now === g.role
                return (
                  <li key={d.id}>
                    <label className="choice">
                      <span className="monster-row">
                        <input type="checkbox" checked={on} onChange={() => setBossRole([d.id], g.role, !on)} />
                        {icon(d)}
                        <span>
                          {d.name}
                          <br />
                          <span className="small muted">
                            {elText(d)}・{CONFIG.quest.grades[bossGradeOf(d) ?? 'kiwami'].label}
                            {now && now !== g.role ? `・いまは${ROLE_LABEL[now]}（選ぶと移る）` : ''}
                          </span>
                        </span>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      ))}

      <section className="card">
        <h2>今月の各階のボス</h2>
        <ul className="choice-list">
          {floors[tab].map((f) => {
            const d = defs.find((x) => x.id === f.quest.bossDefId)
            return (
              <li key={f.quest.id}>
                <button className="choice" disabled={!d} onClick={() => d && go({ name: 'monsterForm', id: d.id })}>
                  <span className="monster-row">
                    {d ? icon(d) : <span className="tower-blank">？</span>}
                    <span>
                      {f.quest.name}
                      <br />
                      <span className="small muted">
                        {d?.name ?? 'ボスがいません'}・{CONFIG.quest.grades[f.quest.grade ?? 'kiwami'].label}
                      </span>
                    </span>
                  </span>
                  {d && <span className="small">編集 ›</span>}
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
