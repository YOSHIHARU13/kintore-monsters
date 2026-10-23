import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { awakenOf, imageOf, glowOf } from '../lib/art'
import { CONFIG } from '../config/gameConfig'
import { MonsterImage } from '../components/MonsterImage'
import { bannerNodeOf } from '../components/GachaBanner'
import { ELEMENT_COLOR, ELEMENT_LABEL } from '../lib/element'
import { CORE_LABEL } from '../lib/cores'
import { gradeOf } from '../lib/quest'
import { snapshotTower, towerCleared, towerMonth, towerOpen, type TowerFloor } from '../lib/tower'
import { FloorReqs } from '../components/FloorReqs'
import type { Go } from '../nav'
import type { GameState, MonsterDef } from '../types'
import { boosterName } from '../lib/boosters'
import { itemLabel } from '../lib/custom'
import { isCastleQuest } from '../lib/castle'

/** 報酬の説明（例：🔮300・トク玉1・剛腕の核×3・🗼アシリュウ） */
export function towerRewardText(floor: TowerFloor, defs: MonsterDef[], state: GameState): string {
  const r = floor.reward
  const parts = [`🔮${r.gold}`]
  if (r.eggs > 0) parts.push(`🟡トク玉×${r.eggs}`)
  if (r.cores > 0 && floor.quest.attr !== 'none') parts.push(`💎${CORE_LABEL[floor.quest.attr]}×${r.cores}`)
  if (r.booster) parts.push(boosterName(state, r.booster))
  if (r.sticks) parts.push(`🪄ワクワクステッキ×${r.sticks}`)
  if (r.balls) parts.push(`🟣筋肉玉×${r.balls}`)
  if (r.boosters && r.boosters.length > 0) parts.push(`🎁ブースター詰め合わせ×${r.boosters.length}`)
  if (r.custom) parts.push(itemLabel(r.custom))
  const castle = isCastleQuest(floor.quest.id)
  if (r.monsterDefId)
    parts.push(`${castle ? '👑' : '🗼'}${defs.find((d) => d.id === r.monsterDefId)?.name ?? (castle ? '城主' : '塔限定モンスター')}`)
  return parts.join('・')
}

/** 月の残り日数 */
function daysLeft(today: string): number {
  const d = new Date(`${today}T12:00:00`)
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 12)
  return Math.round((end.getTime() - d.getTime()) / 86400000) + 1
}

/** 試練の塔：毎月1〜10日。超絶の降臨10体ごとに1つの塔（1〜10階が超絶、11階は塔限定モンスター） */
export function Tower({ go }: { go: Go }) {
  const { state, tower: allFloors, defs, today, towerFixed, fixTower } = useStore()
  const count = Math.max(1, ...allFloors.map((f) => (f.tower ?? 0) + 1))
  const [index, setIndex] = useState(0)
  const tower = allFloors.filter((f) => (f.tower ?? 0) === index)
  // まだ保存していなければ、1つ目の塔を保存して、来月以降も同じにする
  useEffect(() => {
    const first = allFloors.filter((f) => (f.tower ?? 0) === 0)
    if (!towerFixed && first.some((f) => f.quest.bossDefId)) fixTower(snapshotTower(first))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [towerFixed])
  const cleared = towerCleared(state, towerMonth(today), index)
  const [, m] = towerMonth(today).split('-').map(Number)
  const open = towerOpen(today)
  const left = CONFIG.tower.openDays[1] - Number(today.slice(8, 10)) + 1

  return (
    <div className="page">
      <button className="back" onClick={() => go({ name: 'quests' })}>
        ← クエストに戻る
      </button>
      <h1 className="title">🗼 試練の塔（{m}月）</h1>
      {count > 1 && (
        <div className="segmented" role="tablist" aria-label="塔">
          {Array.from({ length: count }, (_, i) => (
            <button key={i} className={index === i ? 'on' : ''} onClick={() => setIndex(i)}>
              第{i + 1}の塔{towerCleared(state, towerMonth(today), i) >= CONFIG.tower.floors ? ' ✓' : ''}
            </button>
          ))}
        </div>
      )}
      <p className="muted">
        {open
          ? `${cleared}／${CONFIG.tower.floors}階クリア・のこり${left}日（毎月${CONFIG.tower.openDays[0]}〜${CONFIG.tower.openDays[1]}日）。各階の報酬は月に1回です。`
          : `開催は毎月${CONFIG.tower.openDays[0]}〜${CONFIG.tower.openDays[1]}日です（今は零の孤城の期間・あと${daysLeft(today)}日で開催）。条件は今から見られます。`}
      </p>
      <p className="muted small">
        超絶の降臨が10体そろうごとに、新しい塔が開きます。上の階では「ボスと同じ部位の子」も求められます（部位限定ガチャの子が活躍）。11階のボスは塔限定モンスター（倒すと運{CONFIG.luck.prizeDrop}で手に入る）。
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
                className={`tower-floor${done ? ' done' : ''}${next && open ? ' next' : ''}`}
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
                  <FloorReqs quest={f.quest} />
                  <span className="small">{towerRewardText(f, defs, state)}</span>
                </span>
                {prize && <MonsterImage imageId={imageOf(prize, bannerNodeOf(prize))} awaken={awakenOf(prize, bannerNodeOf(prize))} glow={glowOf(prize)} size={40} silhouette={!done} />}
                <span className="tower-state">{done ? '✓' : next && open ? '挑戦' : '🔒'}</span>
              </button>
            </li>
          )
        })}
      </ol>
      {!tower.some((f) => f.reward.monsterDefId) && (
        <p className="muted small">
          塔限定モンスターがまだいないので、11階はトク玉になります。降臨モンスターの登録で「🗼
          試練の塔の報酬にする」を選ぶと、11階のボスになり、倒すともらえます。
        </p>
      )}
    </div>
  )
}
