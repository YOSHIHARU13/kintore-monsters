import { useState } from 'react'
import { awakenOf, imageOf, glowOf } from '../lib/art'
import { useStore } from '../store'
import { CONFIG } from '../config/gameConfig'
import { DAYS, FORM_ATTR_LABEL, SLOTS, exerciseOfSlot } from '../data/exercises'
import { MonsterImage } from '../components/MonsterImage'
import { Stars } from '../components/Stars'
import { QuestBanner } from '../components/QuestBanner'
import { BOSS_DIFFICULTY, DIFFICULTIES, atDifficulty, fitsQuest, isStrict, sessionEstimate, attrOf, dropPlus, gradeOf, powerOf, questGold, questHp, type Member } from '../lib/quest'
import { formationOf, requirementsOf, shortfallHelp, tagLabel, tagsOf } from '../lib/formation'
import { FormationPanel } from '../components/FormationPanel'
import { dropLuck, luckBonus } from '../lib/fusion'
import { ELEMENT_COLOR, ELEMENT_LABEL, advantageElements, elementInfo, elementName } from '../lib/element'
import { ATTR_COLOR, type Go } from '../nav'
import { attackOf } from '../lib/stats'
import { allGimmicks } from '../lib/gimmick'
import { DROP_ICON, STONE_LABEL, dropLabel, dropOf, expectedDrop } from '../lib/cores'
import { towerCleared, towerMonth } from '../lib/tower'
import { towerRewardText } from './Tower'
import { plusName, type MaterialDrop, type QuestDifficulty } from '../types'

/** クエストの詳細：ボスの弱点を見て、難易度と出撃メンバーを選んで挑戦する */
export function QuestDetail({ id, go }: { id: string; go: Go }) {
  const { state, quests, tower, defs, owned, menu, today, startChallenge } = useStore()
  const towerFloor = tower.find((f) => f.quest.id === id)
  const found = quests.find((q) => q.id === id) ?? towerFloor?.quest
  const backTo = towerFloor ? ({ name: 'tower' } as const) : ({ name: 'quests' } as const)
  const towerLocked = !!towerFloor && towerFloor.floor !== towerCleared(state, towerMonth(today)) + 1
  const current = state.challenge?.date === today ? state.challenge : null
  const [difficulty, setDifficulty] = useState<QuestDifficulty>(
    current?.questId === id ? current.difficulty : BOSS_DIFFICULTY,
  )
  // 前回の出撃メンバーを最初から選んでおく（同じメンバーで周回しやすいように）
  const [party, setParty] = useState<string[]>(
    (state.challenge?.party ?? []).filter((p) => owned.some((o) => o.id === p)),
  )

  if (!found) {
    return (
      <div className="page">
        <button className="back" onClick={() => go({ name: 'quests' })}>
          ← クエストに戻る
        </button>
        <p className="muted">クエストが見つかりません。</p>
      </div>
    )
  }

  // 最初からある素材クエストは、難易度ごとに編成の条件と弱点が違う
  const quest = atDifficulty(found, difficulty)
  const boss = defs.find((d) => d.id === quest.bossDefId)
  const misses = state.coreMisses[quest.id] ?? 0
  const kind = dropOf(quest)
  const names = allGimmicks(quests)
  const exerciseName = (slotId: string) => {
    const slot = SLOTS.find((s) => s.id === slotId)
    return slot ? exerciseOfSlot(slot, menu).name : '？'
  }
  const requirements = requirementsOf(quest)
  const partyDefs = party.flatMap((id) => {
    const mon = owned.find((o) => o.id === id)
    const def = mon && defs.find((d) => d.id === mon.defId)
    return def ? [def] : []
  })
  const formation = formationOf(partyDefs, requirements)
  const partyMons = party.flatMap((pid) => owned.filter((o) => o.id === pid))
  const luck = luckBonus(partyMons)
  // 候補は「まだ足りていない条件にいくつ貢献できるか」の順。同じなら攻撃力の順
  const members = owned
    .flatMap((mon): (Member & { help: number; tags: string[] })[] => {
      const def = defs.find((d) => d.id === mon.defId)
      if (!def) return []
      const own = tagsOf(def)
      const tags = requirements
        .filter((r) => own[r.tag])
        .map((r) => `${tagLabel(r.tag, names)}${own[r.tag] > 1 ? `×${own[r.tag]}` : ''}`)
      if (def.favoriteSlot && quest.weakSlots.includes(def.favoriteSlot)) tags.push('得意種目が弱点')
      if (fitsQuest(def, quest)) tags.unshift('属性◎')
      else if (isStrict(quest)) tags.push('半減')
      return [{ mon, def, help: shortfallHelp(def, formation.rows), tags }]
    })
    .sort((a, b) => {
      const onA = party.includes(a.mon.id) ? 1 : 0
      const onB = party.includes(b.mon.id) ? 1 : 0
      const advA = fitsQuest(a.def, quest) ? 1 : 0
      const advB = fitsQuest(b.def, quest) ? 1 : 0
      return onB - onA || advB - advA || b.help - a.help || b.tags.length - a.tags.length || powerOf(b) - powerOf(a)
    })
  const max = CONFIG.quest.partySize
  // 選んだメンバーで、各部位の日に1回トレーニングしたときのダメージの見込み
  const partyMembers = party.flatMap((pid) => members.filter((m) => m.mon.id === pid))
  const estimate = sessionEstimate(quest, partyMembers)
  const hp = questHp(quest, difficulty)
  const bestEntry = estimate.reduce((a, b) => (b.damage > a.damage ? b : a), estimate[0])
  const best = bestEntry.damage
  const bestDay = bestEntry.day
  const switching = !!current && current.questId !== id

  const toggle = (monId: string) =>
    setParty(party.includes(monId) ? party.filter((p) => p !== monId) : party.length < max ? [...party, monId] : party)

  return (
    <div className="page">
      <button className="back" onClick={() => go(backTo)}>
        {towerFloor ? '← 試練の塔に戻る' : '← クエストに戻る'}
      </button>
      <QuestBanner quest={quest} boss={boss} />

      <section className="card">
        <h2>求められる編成</h2>
        <FormationPanel formation={formation} names={names} />
        {luck.count > 0 && (
          <p className="small luck-bonus">
            <span className="luck-max">運極</span> ×{luck.count}：報酬のオーブ ×{luck.goldRate.toFixed(1)}
            {quest.kind === 'material' && `・素材のくじ +${luck.extraRolls}回`}
          </p>
        )}
      </section>

      <section className="card">
        <h2>ボスの情報</h2>
        <ul className="mini-list">
          <li>
            <span>属性</span>
            <span style={quest.element ? { color: ELEMENT_COLOR[quest.element] } : undefined}>
              {quest.element ? ELEMENT_LABEL[quest.element] : '無属性'}
            </span>
          </li>
          {quest.element && (
            <li>
              <span>適正（有利な属性）</span>
              <span>
                {advantageElements(quest.element).map((e) => (
                  <span key={e} style={{ color: ELEMENT_COLOR[e] }}>
                    {ELEMENT_LABEL[e]}{' '}
                  </span>
                ))}
              </span>
            </li>
          )}
          <li>
            <span>弱点種目（ダメージ×{CONFIG.quest.weakSlot}）</span>
            <span>{quest.weakSlots.map(exerciseName).join('・') || 'なし'}</span>
          </li>
        </ul>
        {isStrict(quest) && (
          <p className="warn small">
            {CONFIG.quest.grades[gradeOf(quest)].label}：ボスに有利な属性も、編成で求められている属性も持たないモンスターの攻撃は半減します。
          </p>
        )}
        <p className="muted small">
          出撃した全員が毎セット攻撃します。セットの部位（胸腕・脚・背肩）と一致するモンスターはダメージ×{CONFIG.quest.partMatch}。最後に、下の編成倍率がかかります。
        </p>
      </section>

      <section className="card">
        {quest.kind === 'material' ? (
          <>
            <h2>難易度</h2>
            <div className="chips" role="group" aria-label="難易度">
              {DIFFICULTIES.map((d) => (
                <button key={d} type="button" className={`chip${difficulty === d ? ' on' : ''}`} onClick={() => setDifficulty(d)}>
                  {CONFIG.quest.difficulties[d].label}
                </button>
              ))}
            </div>
            <p className="small">
              HP {questHp(quest, difficulty).toLocaleString()}・🔮{questGold(quest, difficulty)}
            </p>
          </>
        ) : (
          <>
            <h2>
              <span className={`grade-badge grade-${gradeOf(quest)}`}>{CONFIG.quest.grades[gradeOf(quest)].label}</span>
            </h2>
            <p className="small">
              HP {questHp(quest, difficulty).toLocaleString()}
              {!towerFloor && `・🔮${questGold(quest, difficulty)}`}
            </p>
          </>
        )}
        {quest.kind === 'material' ? (
          <MaterialDropInfo kind={kind} label={dropLabel(quest)} difficulty={difficulty} luckCount={luck.count} misses={misses} />
        ) : towerFloor ? (
          <p className="small">報酬（月に1回）：{towerRewardText(towerFloor, defs, state)}</p>
        ) : (
          <p className="small">
            ドロップ {boss?.name ?? '？'}
            {dropPlus(quest) > 0 ? `＋${dropPlus(quest)}` : ''}（運{dropLuck(partyMons)}）・ときどき
            {quest.element ? STONE_LABEL(quest.element) : '結晶'}
          </p>
        )}
      </section>

      {party.length > 0 && (
        <section className="card">
          <h2>倒せる見込み</h2>
          <ul className="mini-list">
            {estimate.map((e) => (
              <li key={e.day}>
                <span>{DAYS[e.day].title}メニュー1回分</span>
                <span className={`tag ${e.damage >= hp ? 'keep' : 'warn'}`}>
                  約{Math.round(e.damage).toLocaleString()}（{Math.round((e.damage / hp) * 100)}%）
                </span>
              </li>
            ))}
          </ul>
          <p className="small">
            {best >= hp
              ? `${DAYS[bestDay].title}メニューを1回やれば、その日のうちに倒せそう（HP ${hp.toLocaleString()}）。`
              : `今のメンバーだと、メニュー1回でHPの約${Math.round((best / hp) * 100)}%。出撃した日のうちに倒す必要があるので、2部位やる日に挑むか、編成をそろえるか、格の低いクエストがおすすめ。`}
          </p>
          <p className="muted small">基本セット（1種目3セット）とローラーを全部やったときの目安。弱点種目・得意種目・部位の一致・編成倍率込み。</p>
        </section>
      )}

      <section className="card">
        <h2>
          出撃メンバー（{party.length}/{max}）
        </h2>
        <p className="muted small">まだ足りていない条件に貢献できる順に並んでいます。選ぶと上の編成メーターが埋まります。</p>
        <ul className="choice-list">
          {members.map((m) => {
            const on = party.includes(m.mon.id)
            return (
              <li key={m.mon.id}>
                <button
                  className={`choice${on ? ' on' : ''}`}
                  disabled={!on && party.length >= max}
                  onClick={() => toggle(m.mon.id)}
                >
                  <span className="monster-row">
                    <MonsterImage imageId={imageOf(m.def, m.mon.nodeId)} awaken={awakenOf(m.def, m.mon.nodeId)} glow={glowOf(m.def)} size={44} plus={m.mon.plus} shiny={m.mon.shiny} />
                    <span>
                      {on ? '✓ ' : ''}
                      {plusName(m.def, m.mon)} <Stars def={m.def} nodeId={m.mon.nodeId} mon={m.mon} />
                      <br />
                      <span className="small" style={{ color: ATTR_COLOR[attrOf(m)] }}>
                        {FORM_ATTR_LABEL[attrOf(m)]}
                      </span>
                      <span className="small"> {elementName(elementInfo(m.def))}</span>
                      <span className="small"> 攻撃力 {attackOf(m.mon, m.def).toLocaleString()}</span>
                      {m.tags.map((t) => (
                        <span key={t} className={`tag ${t === '半減' ? 'warn' : 'keep'}`}>
                          {' '}
                          {t}
                        </span>
                      ))}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <button
        className="btn primary wide"
        disabled={party.length === 0 || towerLocked}
        onClick={() => {
          startChallenge(quest.id, quest.kind === 'material' ? difficulty : BOSS_DIFFICULTY, party)
          go({ name: 'quests' })
        }}
      >
        {towerLocked
          ? '下の階をクリアすると挑戦できます'
          : switching
            ? '今の戦いをやめて、これに出撃する'
            : current?.questId === id
              ? 'この内容で出撃し直す'
              : '出撃する'}
      </button>
      {(switching || current?.questId === id) && (
        <p className="warn small center">出撃し直すと、それまでのダメージは0に戻ります。</p>
      )}
      <p className="muted small center">出撃したら、その日のうちに倒そう。倒すまでのセットがダメージになります。</p>
      {!towerFloor && !quest.builtin && (
        <button className="btn small" onClick={() => go({ name: 'questForm', id: quest.id })}>
          このクエストを編集
        </button>
      )}
    </div>
  )
}

/** 素材クエストのくじの説明：何回引けて、1回あたりどれくらいで当たるか */
function MaterialDropInfo({ kind, label, difficulty, luckCount, misses }: {
  kind: MaterialDrop
  label: string
  difficulty: QuestDifficulty
  luckCount: number
  misses: number
}) {
  const d = CONFIG.materials.drops[kind][difficulty]
  const extra = luckCount * CONFIG.materials.luckRolls
  const avg = expectedDrop(kind, difficulty, luckCount)
  return (
    <p className="small core-drop">
      {DROP_ICON[kind]} {label}：くじ{d.rolls}回{extra > 0 && `＋運極${extra}回`}（1回{Math.round(d.rate * 100)}%で
      {d.amount > 1 ? `${d.amount}枚` : '1個'}）・平均{kind === 'coins' ? Math.round(avg) : avg.toFixed(1)}
      {kind === 'ball' && misses > 0 && `・いま${misses}回続けて落ちていない（${CONFIG.materials.ballPityMisses}回目は確定）`}
    </p>
  )
}
