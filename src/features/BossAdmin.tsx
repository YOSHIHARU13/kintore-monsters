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
import type { MonsterDef } from '../types'

type Tab = 'tower' | 'kinkin' | 'castle'

/** 開発者メニュー：高難度（試練の塔・禁筋の獄・零の孤城）のボス。今月の各階のボスと、最上階の入れ替わるボス。絵や設定はここから直せる */
export function BossAdmin({ go }: { go: Go }) {
  const { tower, kinkin, castle, defs, today } = useStore()
  const [tab, setTab] = useState<Tab>('tower')
  const floors: Record<Tab, TowerFloor[]> = { tower, kinkin, castle }
  const lords: Record<Tab, { label: string; list: MonsterDef[]; need: number; hint: string }[]> = {
    tower: [{ label: '🗼 11階のボス（塔限定）', list: towerMonsters(defs), need: 3, hint: '「🗼 試練の塔の11階のボスにする」' }],
    kinkin: [{ label: '⛓ 20階のボス', list: kinkinLords(defs), need: 3, hint: '「⛓ 禁筋の獄の最上階のボスにする」' }],
    castle: [
      { label: '👑 城主（11階）', list: defs.filter((d) => d.questOnly && d.castleLord), need: 3, hint: '爆絶で「👑 零の孤城の城主にする」' },
      { label: '🏯 1〜10階のボス（孤城限定）', list: castleMonsters(defs), need: 10, hint: '「🏯 零の孤城の限定にする」' },
    ],
  }
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
        今月は{patternLabel(towerMonth(today))}。ボスの絵や名前・属性は、タップして登録画面から直せます。途中の階のボスは超絶・爆絶の降臨の使い回しで、最上階のボスだけ毎月入れ替わります。
      </p>
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
          {g.list.length < g.need && (
            <p className="warn small">あと{g.need - g.list.length}体。降臨の登録で{g.hint}を選んでください（いない分は、ほかのボスやトク玉で埋まります）。</p>
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
          <button className="btn small" onClick={() => go({ name: 'monsterForm', preset: 'quest' })}>
            ＋ 降臨を登録する
          </button>
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
