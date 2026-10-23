import { useStore } from '../store'
import { awakenOf, imageOf, glowOf } from '../lib/art'
import { CONFIG } from '../config/gameConfig'
import { MonsterImage } from '../components/MonsterImage'
import { bannerNodeOf } from '../components/GachaBanner'
import { ELEMENT_COLOR, ELEMENT_LABEL, ZERO_LABEL } from '../lib/element'
import { castleAvailable, castleBest, castleCleared, castleOpen, lastBossOf } from '../lib/castle'
import { towerMonth } from '../lib/tower'
import { FloorReqs } from '../components/FloorReqs'
import { towerRewardText } from './Tower'
import type { Go } from '../nav'
import { patternLabel, patternTag } from '../lib/pattern'

/** 零の孤城：全11階のエンドコンテンツ。毎月21日〜月末。1〜10階は孤城限定の子、11階は零属性の城主（どちらも毎月の初回クリアで手に入る） */
export function Castle({ go }: { go: Go }) {
  const { state, castle, defs, today } = useStore()
  const cleared = castleCleared(state, towerMonth(today))
  const done = cleared >= CONFIG.castle.floors
  const open = castleOpen(today)
  return (
    <div className="page">
      <button className="back" onClick={() => go({ name: 'quests' })}>
        ← クエストに戻る
      </button>
      <h1 className="title">🏯 零の孤城{patternTag(towerMonth(today))}</h1>
      <p className="pattern-badge">
        今月は<strong>{patternLabel(towerMonth(today))}</strong>：どのボスもこの部位のボス。この部位の種目がよく効いて、この部位のモンスターが求められます（毎月 胸腕→脚→背肩 の順に入れ替わり、最上階のボスも変わる）
      </p>
      <p className="muted">
        {!open
          ? `開催は毎月${CONFIG.castle.openDays[0]}日〜月末です（今は試練の塔の期間）。条件は今から見られます。`
          : done
            ? '今月は踏破！ おめでとう！'
            : `全部突破 ${cleared}／${CONFIG.castle.floors}階。各階は${CONFIG.quest.battles}バトル。出撃は1回で、その日に削れたぶんだけ突破します。${CONFIG.castle.battlesToNext}バトル突破で次の階、最上階は1〜10階を全部突破してから。`}
      </p>
      <p className="muted small">
        どの階も爆絶（属性が合わないモンスターの攻撃は3分の1）。弱点属性とアビリティの持ち物検査がきびしく、2アビ・3アビの噛み合ったモンスターがいないと満たせません。
        最上階の城主は{ZERO_LABEL}：弱点がない代わりに、いろんな属性のモンスターをそろえるほど強くなれます。
      </p>
      <ol className="tower castle">
        {[...castle].reverse().map((f) => {
          const best = castleBest(state, towerMonth(today), f.floor)
          const clear = best >= CONFIG.quest.battles
          const next = !clear && castleAvailable(state, towerMonth(today), f.floor)
          const boss = defs.find((d) => d.id === f.quest.bossDefId)
          const el = f.quest.element
          return (
            <li key={f.floor}>
              <button
                className={`tower-floor${clear ? ' done' : ''}${next && open ? ' next' : ''}`}
                style={el ? { ['--el' as string]: ELEMENT_COLOR[el] } : undefined}
                onClick={() => go({ name: 'quest', id: f.quest.id })}
              >
                <span className="tower-no">{f.floor === CONFIG.castle.floors ? '頂' : `${f.floor}F`}</span>
                {boss ? (
                  <MonsterImage imageId={imageOf(boss, bannerNodeOf(boss))} awaken={awakenOf(boss, bannerNodeOf(boss))} glow={glowOf(boss)} size={48} silhouette={!clear && !next} />
                ) : (
                  <span className="tower-blank">？</span>
                )}
                <span className="tower-body">
                  <strong>
                    {el ? <span style={{ color: ELEMENT_COLOR[el] }}>{ELEMENT_LABEL[el]}</span> : ZERO_LABEL}{' '}
                    <span className="grade-badge grade-bakuzetsu">{CONFIG.quest.grades.bakuzetsu.label}</span>
                  </strong>
                  <FloorReqs quest={f.quest} />
                  <span className="small castle-battles">
                    {'⚔️'.repeat(best)}
                    {'・'.repeat(CONFIG.quest.battles - best)} バトル {best}/{CONFIG.quest.battles}
                  </span>
                  <span className="small">{clear ? '受け取り済み' : towerRewardText(f, defs, state)}</span>
                </span>
                <span className="tower-state">{clear ? '✓' : next && open ? '挑戦' : '🔒'}</span>
              </button>
            </li>
          )
        })}
      </ol>
      {!lastBossOf(defs) && (
        <p className="muted small">
          城主がまだいないので、最上階はトク玉になります。爆絶の降臨の登録で「👑 零の孤城の城主にする」を選ぶと、最上階のボスになり、倒すともらえます。
        </p>
      )}
      {!defs.some((d) => d.questOnly && d.castleOnly) && (
        <p className="muted small">
          孤城限定のモンスターがまだいないので、1〜10階は爆絶のボスなどで埋めています（埋めた階のボスは落ちません）。降臨の登録で「🏯 零の孤城の限定にする」を選ぶと、ここに並んで、毎月の初回クリアで手に入ります。
        </p>
      )}
    </div>
  )
}
