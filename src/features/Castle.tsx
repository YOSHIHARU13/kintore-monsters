import { useStore } from '../store'
import { awakenOf, imageOf, glowOf } from '../lib/art'
import { CONFIG } from '../config/gameConfig'
import { MonsterImage } from '../components/MonsterImage'
import { bannerNodeOf } from '../components/GachaBanner'
import { ELEMENT_COLOR, ELEMENT_LABEL, ZERO_LABEL } from '../lib/element'
import { castleCleared, isBakuzetsuBoss, lastBossOf } from '../lib/castle'
import { towerRewardText } from './Tower'
import type { Go } from '../nav'

/** 零の孤城：全11階のエンドコンテンツ。1〜10階は爆絶のボス、11階は零属性の城主。報酬は各階1回だけ */
export function Castle({ go }: { go: Go }) {
  const { state, castle, defs } = useStore()
  const cleared = castleCleared(state)
  const done = cleared >= CONFIG.castle.floors
  return (
    <div className="page">
      <button className="back" onClick={() => go({ name: 'quests' })}>
        ← クエストに戻る
      </button>
      <h1 className="title">🏯 零の孤城</h1>
      <p className="muted">
        {done ? '踏破！ おめでとう！' : `${cleared}／${CONFIG.castle.floors}階クリア・次は${cleared + 1}階`}
        。下から1階ずつ。報酬は各階1回きりです。
      </p>
      <p className="muted small">
        どの階も爆絶（属性が合わない子の攻撃は3分の1）。弱点属性とアビリティの持ち物検査がきびしく、2アビ・3アビの噛み合った子がいないと満たせません。
        最上階の城主は{ZERO_LABEL}：弱点がない代わりに、いろんな属性の子をそろえるほど強くなれます。
      </p>
      <ol className="tower castle">
        {[...castle].reverse().map((f) => {
          const clear = f.floor <= cleared
          const next = f.floor === cleared + 1
          const boss = defs.find((d) => d.id === f.quest.bossDefId)
          const el = f.quest.element
          return (
            <li key={f.floor}>
              <button
                className={`tower-floor${clear ? ' done' : ''}${next ? ' next' : ''}`}
                disabled={!clear && !next}
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
                  <span className="small">{clear ? '受け取り済み' : towerRewardText(f, defs, state)}</span>
                </span>
                <span className="tower-state">{clear ? '✓' : next ? '挑戦' : '🔒'}</span>
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
      {!defs.some(isBakuzetsuBoss) && (
        <p className="muted small">
          爆絶の降臨がまだいないので、1〜10階はほかのボスで埋めています。降臨の格を爆絶で登録すると、ここに並びます。
        </p>
      )}
    </div>
  )
}
