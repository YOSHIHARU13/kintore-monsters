import { useMemo } from 'react'
import { useStore } from '../store'
import { CONFIG } from '../config/gameConfig'
import { FIT_MARK, fitForms, fitMembers, fitQuests } from '../lib/fit'
import { gradeOf } from '../lib/quest'
import type { TowerFloor } from '../lib/tower'
import { monArt } from '../lib/art'
import { grown } from '../lib/lifespan'
import { MonsterImage } from './MonsterImage'
import type { Go } from '../nav'
import type { MonsterDef, Quest } from '../types'

/** 適正を見るクエスト：超絶・超究極・爆絶と、高難度（試練の塔・禁筋の獄・零の孤城）。究極以下は余裕なので出さない */
const HARD_GRADES = ['chozetsu', 'chokyukyoku', 'bakuzetsu']
function fitTargets(quests: Quest[], highEnd: TowerFloor[][]): Quest[] {
  return [...quests.filter((q) => HARD_GRADES.includes(gradeOf(q))), ...highEnd.flat().map((f) => f.quest)]
}

/** そのモンスターが適正のクエスト（閉じた欄。タップで開く） */
export function FitQuests({ def, go, limit }: { def: MonsterDef; go?: Go; limit?: number }) {
  const { defs, quests, tower, kinkin, castle } = useStore()
  // 適正度（適正ランキングと同じ%）をつけて、高い順に
  const list = useMemo(
    () =>
      fitQuests(def, fitTargets(quests, [tower, kinkin, castle]))
        .map((x) => ({ ...x, percent: fitMembers(x.quest, defs).find((m) => m.def.id === def.id)?.percent ?? 0 }))
        .sort((a, b) => b.percent - a.percent)
        .slice(0, limit ?? 99),
    [def, defs, quests, tower, kinkin, castle, limit],
  )
  if (list.length === 0) return null
  return (
    <details className="card fold fit-list">
      <summary>
        <h2>
          🎯 適正のクエスト <span className="small">◎{list.filter((x) => x.fit === 'best').length}・○{list.filter((x) => x.fit === 'good').length}</span>
        </h2>
      </summary>
      <ul className="mini-list">
        {list.map(({ quest, fit, percent }) => (
          <li key={quest.id}>
            <button className="link-button" onClick={() => go?.({ name: 'quest', id: quest.id })}>
              {FIT_MARK[fit]} <span className={`grade-badge grade-${gradeOf(quest)}`}>{CONFIG.quest.grades[gradeOf(quest)].label}</span> {quest.name}
              {(() => {
                // 分岐があって部位の条件があるクエストは、どの形態が適正か
                const forms = fitForms(def, quest)
                const ok = forms.filter((f) => f.ok)
                return forms.length > 1 && ok.length < forms.length && ok.length > 0 ? (
                  <span className="small muted">（{ok.map((f) => f.name).join('・')}が適正）</span>
                ) : null
              })()}
            </button>
            <span className={`tag${percent >= 90 ? ' keep' : ''}`}>{percent}%</span>
          </li>
        ))}
      </ul>
    </details>
  )
}

/** 引いた直後などに出す、刺さるクエストの短い一覧（上位3つ） */
export function FitHint({ def }: { def: MonsterDef }) {
  const { quests, tower, kinkin, castle } = useStore()
  const list = fitQuests(def, fitTargets(quests, [tower, kinkin, castle])).slice(0, 3)
  if (list.length === 0) return null
  return (
    <div className="fit-hint small">
      🎯 刺さる：{list.map(({ quest, fit }) => `${FIT_MARK[fit]}${CONFIG.quest.grades[gradeOf(quest)].label}「${quest.name}」`).join('・')}
    </div>
  )
}

/** 育ちきった姿の絵（獣神化できれば★4。金・銀の絵や後光も） */
function grownArt(def: MonsterDef, quest: Quest) {
  const g = grown(def, quest.attr)
  return monArt(def, g.mon)
}

/** 最終形態の名前（分岐があれば、適正の形態だけ。部位の条件がなければ全部を「／」で） */
function formNames(def: MonsterDef, quest: Quest): string {
  // 獣神化できるなら★4の名前（金の獣神化の相手がいれば金）
  const g = grown(def, quest.attr).mon
  const shinkaName = g.shinka ? def.names?.[g.shinkaGold ? 'gold' : 'shinka']?.trim() : ''
  if (shinkaName) return `★4 ${shinkaName}`
  const forms = fitForms(def, quest)
  if (forms.length <= 1) return forms[0]?.name ?? def.name
  const ok = forms.filter((f) => f.ok)
  return (ok.length > 0 ? ok : forms).map((f) => `${f.name}（${f.attr}）`).join('／')
}

/**
 * そのクエストの適正キャラ：降臨の上位5体と、ガチャの上位5体。1撃の重さの順。
 * 持っていない子も出す（当てる・落とす目標になるように）。絵は薄い影をかけるだけ
 */
export function FitMembers({ quest }: { quest: Quest }) {
  const { defs, owned } = useStore()
  const all = fitMembers(quest, defs).filter((x) => x.score > 0)
  const drops = all.filter((x) => x.def.questOnly).slice(0, 5)
  const gacha = all.filter((x) => !x.def.questOnly).slice(0, 5)
  if (drops.length === 0 && gacha.length === 0) return null
  const has = (d: MonsterDef) => owned.some((o) => o.defId === d.id)
  const group = (label: string, list: typeof all) =>
    list.length > 0 && groupOf(label, list)
  const groupOf = (label: string, list: typeof all) => (
      <div className="fit-group">
        <h3 className="small">{label}</h3>
        <ol className="fit-rank">
          {list.map(({ def, fit, hit, support, percent }, i) => (
            <li key={def.id} className={`fit-member${has(def) ? '' : ' unowned'}${i === 0 ? ' top' : ''}`}>
              <span className="fit-no">{i + 1}</span>
              {/* 育ちきった姿（獣神化できれば★4の絵）で見せる */}
              <MonsterImage {...grownArt(def, quest)} size={44} />
              <span className="fit-name small">
                {fit ? `${FIT_MARK[fit]} ` : ''}{formNames(def, quest)}
                {!has(def) && <span className="muted">（未所持）</span>}
              </span>
              <span className="fit-rate">
                <strong>{percent}%</strong>
                <span className="fit-bar">
                  <i style={{ width: `${Math.min(100, percent)}%` }} />
                </span>
                <span className="muted small">
                  1撃{hit.toLocaleString()}＋編成{support.toLocaleString()}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    )
  return (
    <details className="card fold fit-list">
      <summary>
        <h2>🎯 適正キャラ（降臨{drops.length}体・ガチャ{gacha.length}体）</h2>
      </summary>
      <p className="muted small">
        適正度：このクエストのためにいるような激レア（有利な属性・求められるアビリティ2つ・ボスの部位、育ちきり）を100%として、入れたら編成全体のダメージ（1セットあたり）がどれだけ増えるか。目安は90%以上で最適、70%前後で主力、50%前後で代役。1撃＝育ちきった1体が与えるダメージ（攻撃力×属性・アビリティ・コラボ・部位一致・弱点・得意種目の倍率）、編成＝属性・属性の種類・アビリティ・部位の条件を埋めて、6体みんなのダメージが上がるぶん
      </p>
      {group('⚔️ 降臨（クエストで手に入る）', drops)}
      {group('🎰 ガチャ', gacha)}
    </details>
  )
}

/** ガチャのピックアップに付ける、適正の数のバッジ */
export function FitBadge({ def }: { def: MonsterDef }) {
  const { quests, tower, kinkin, castle } = useStore()
  const n = fitQuests(def, fitTargets(quests, [tower, kinkin, castle])).filter((x) => x.fit === 'best').length
  return n > 0 ? <span className="fit-badge">適正{n}</span> : null
}
