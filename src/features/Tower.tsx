import { useStore } from '../store'
import { awakenOf, imageOf, glowOf } from '../lib/art'
import { CONFIG } from '../config/gameConfig'
import { MonsterImage } from '../components/MonsterImage'
import { bannerNodeOf } from '../components/GachaBanner'
import { ELEMENT_COLOR, ELEMENT_LABEL } from '../lib/element'
import { CORE_LABEL } from '../lib/cores'
import { gradeOf } from '../lib/quest'
import { towerCleared, towerMonth, type TowerFloor } from '../lib/tower'
import type { Go } from '../nav'
import type { GameState, MonsterDef } from '../types'
import { boosterName } from '../lib/boosters'

/** 報酬の説明（例：300G・卵1・胸腕の核×3・🗼アシリュウ） */
export function towerRewardText(floor: TowerFloor, defs: MonsterDef[], state: GameState): string {
  const r = floor.reward
  const parts = [`${r.gold}G`]
  if (r.eggs > 0) parts.push(`🥚卵×${r.eggs}`)
  if (r.cores > 0) parts.push(`💎${CORE_LABEL[floor.quest.attr]}×${r.cores}`)
  if (r.booster) parts.push(boosterName(state, r.booster))
  if (r.monsterDefId) parts.push(`🗼${defs.find((d) => d.id === r.monsterDefId)?.name ?? '塔限定モンスター'}`)
  return parts.join('・')
}

/** 月の残り日数 */
function daysLeft(today: string): number {
  const d = new Date(`${today}T12:00:00`)
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 12)
  return Math.round((end.getTime() - d.getTime()) / 86400000) + 1
}

/** 試練の塔：毎月11階。1〜10階は超絶ボスが属性順に2周、11階は塔限定モンスターがボス */
export function Tower({ go }: { go: Go }) {
  const { state, tower, defs, today } = useStore()
  const cleared = towerCleared(state, towerMonth(today))
  const [, m] = towerMonth(today).split('-').map(Number)

  return (
    <div className="page">
      <button className="back" onClick={() => go({ name: 'quests' })}>
        ← クエストに戻る
      </button>
      <h1 className="title">🗼 試練の塔（{m}月）</h1>
      <p className="muted">
        {cleared}／{CONFIG.tower.floors}階クリア・のこり{daysLeft(today)}
        日。毎月1日に新しい塔になります。各階の報酬は月に1回です。
      </p>
      <ol className="tower">
        {[...tower].reverse().map((f) => {
          const done = f.floor <= cleared
          const next = f.floor === cleared + 1
          const boss = defs.find((d) => d.id === f.quest.bossDefId)
          const prize = f.reward.monsterDefId ? defs.find((d) => d.id === f.reward.monsterDefId) : undefined
          const el = f.quest.element
          return (
            <li key={f.floor}>
              <button
                className={`tower-floor${done ? ' done' : ''}${next ? ' next' : ''}`}
                disabled={!done && !next}
                style={el ? { ['--el' as string]: ELEMENT_COLOR[el] } : undefined}
                onClick={() => go({ name: 'quest', id: f.quest.id })}
              >
                <span className="tower-no">{f.floor}F</span>
                {boss ? (
                  <MonsterImage imageId={imageOf(boss, bannerNodeOf(boss))} awaken={awakenOf(boss, bannerNodeOf(boss))} glow={glowOf(boss)} size={48} silhouette={!done && !next} />
                ) : (
                  <span className="tower-blank">？</span>
                )}
                <span className="tower-body">
                  <strong>
                    {el && <span style={{ color: ELEMENT_COLOR[el] }}>{ELEMENT_LABEL[el]}</span>}{' '}
                    <span className={`grade-badge grade-${gradeOf(f.quest)}`}>
                      {CONFIG.quest.grades[gradeOf(f.quest)].label}
                    </span>
                  </strong>
                  <span className="small">{towerRewardText(f, defs, state)}</span>
                </span>
                {prize && <MonsterImage imageId={imageOf(prize, bannerNodeOf(prize))} awaken={awakenOf(prize, bannerNodeOf(prize))} glow={glowOf(prize)} size={40} silhouette={!done} />}
                <span className="tower-state">{done ? '✓' : next ? '挑戦' : '🔒'}</span>
              </button>
            </li>
          )
        })}
      </ol>
      {!tower.some((f) => f.reward.monsterDefId) && (
        <p className="muted small">
          塔限定モンスターがまだいないので、11階は卵になります。降臨モンスターの登録で「🗼
          試練の塔の報酬にする」を選ぶと、11階のボスになり、倒すともらえます。
        </p>
      )}
    </div>
  )
}
