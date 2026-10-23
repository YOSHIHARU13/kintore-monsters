import { useStore } from '../store'
import { CONFIG } from '../config/gameConfig'
import { MonsterImage } from '../components/MonsterImage'
import { bannerNodeOf } from '../components/GachaBanner'
import { FloorReqs } from '../components/FloorReqs'
import { awakenOf, glowOf, imageOf } from '../lib/art'
import { ELEMENT_COLOR, ELEMENT_LABEL, ZERO_LABEL } from '../lib/element'
import { gradeOf } from '../lib/quest'
import { kinkinCleared, kinkinOpen } from '../lib/kinkin'
import { towerMonth } from '../lib/tower'
import { towerRewardText } from './Tower'
import type { Go } from '../nav'
import { patternLabel, patternTag } from '../lib/pattern'

/** 禁筋の獄：塔と孤城のあいだの高難度。毎月11〜20日・全10階。報酬はオーブ多め＋ちょいレア（ボスは落とさない） */
export function Kinkin({ go }: { go: Go }) {
  const { state, kinkin, defs, today } = useStore()
  const cleared = kinkinCleared(state, towerMonth(today))
  const open = kinkinOpen(today)
  const k = CONFIG.kinkin
  return (
    <div className="page">
      <button className="back" onClick={() => go({ name: 'quests' })}>
        ← クエストに戻る
      </button>
      <h1 className="title">⛓ 禁筋の獄{patternTag(towerMonth(today))}</h1>
      <p className="pattern-badge">
        今月は<strong>{patternLabel(towerMonth(today))}</strong>：どのボスもこの部位のボス。この部位の種目がよく効いて、この部位のモンスターが求められます（毎月 胸腕→脚→背肩 の順に入れ替わり、最上階のボスも変わる）
      </p>
      <p className="muted">
        {!open
          ? `開催は毎月${k.openDays[0]}〜${k.openDays[1]}日です。条件は今から見られます。`
          : cleared >= k.floors
            ? '今月は踏破！'
            : `${cleared}／${k.floors}階クリア・次は${cleared + 1}階。各階の報酬は月に1回です。`}
      </p>
      <p className="muted small">
        試練の塔より難しく、零の孤城より易しい高難度。1〜{k.bakuzetsuFrom - 1}階は超絶、{k.bakuzetsuFrom}階からは爆絶。どの階も「ボスと同じ部位のモンスター」を求めます。報酬はオーブ多めと、筋肉玉・銀のアイテム・ステッキ（ボスは落としません）。
      </p>
      <ol className="tower castle">
        {[...kinkin].reverse().map((f) => {
          const clear = f.floor <= cleared
          const next = f.floor === cleared + 1
          const boss = defs.find((d) => d.id === f.quest.bossDefId)
          const el = f.quest.element
          return (
            <li key={f.floor}>
              <button
                className={`tower-floor${clear ? ' done' : ''}${next && open ? ' next' : ''}`}
                style={el ? { ['--el' as string]: ELEMENT_COLOR[el] } : undefined}
                onClick={() => go({ name: 'quest', id: f.quest.id })}
              >
                <span className="tower-no">{f.floor}F</span>
                {boss ? (
                  <MonsterImage imageId={imageOf(boss, bannerNodeOf(boss))} awaken={awakenOf(boss, bannerNodeOf(boss))} glow={glowOf(boss)} size={48} silhouette={!clear && !next} />
                ) : (
                  <span className="tower-blank">？</span>
                )}
                <span className="tower-body">
                  <strong>
                    {el ? <span style={{ color: ELEMENT_COLOR[el] }}>{ELEMENT_LABEL[el]}</span> : ZERO_LABEL}{' '}
                    <span className={`grade-badge grade-${gradeOf(f.quest)}`}>{CONFIG.quest.grades[gradeOf(f.quest)].label}</span>
                  </strong>
                  <FloorReqs quest={f.quest} />
                  <span className="small">{clear ? '受け取り済み' : towerRewardText(f, defs, state)}</span>
                </span>
                <span className="tower-state">{clear ? '✓' : next && open ? '挑戦' : '🔒'}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
