import { useState } from 'react'
import { useStore } from '../store'
import { CONFIG } from '../config/gameConfig'
import { FORM_ATTR_LABEL, SLOTS, exerciseOfSlot } from '../data/exercises'
import { MonsterImage } from '../components/MonsterImage'
import { Stars } from '../components/Stars'
import { QuestBanner } from '../components/QuestBanner'
import { DIFFICULTIES, affinityOf, attrOf, powerOf, questGold, rankOf, type Member } from '../lib/quest'
import { ELEMENT_COLOR, ELEMENT_LABEL, advantageElements, elementInfo, elementName } from '../lib/element'
import { ATTR_COLOR, type Go } from '../nav'
import { attackOf } from '../lib/stats'
import { abilityName, allGimmicks, gimmickRate, unmatchedGimmicks } from '../lib/gimmick'
import { CORE_LABEL } from '../lib/cores'
import { plusName, type QuestDifficulty } from '../types'

/** クエストの詳細：ボスの弱点を見て、難易度と出撃メンバーを選んで挑戦する */
export function QuestDetail({ id, go }: { id: string; go: Go }) {
  const { state, quests, defs, owned, menu, today, startChallenge } = useStore()
  const quest = quests.find((q) => q.id === id)
  const current = state.challenge?.date === today ? state.challenge : null
  const [difficulty, setDifficulty] = useState<QuestDifficulty>(
    current?.questId === id ? current.difficulty : 'normal',
  )
  // 前回の出撃メンバーを最初から選んでおく（同じメンバーで周回しやすいように）
  const [party, setParty] = useState<string[]>(
    (state.challenge?.party ?? []).filter((p) => owned.some((o) => o.id === p)),
  )

  if (!quest) {
    return (
      <div className="page">
        <button className="back" onClick={() => go({ name: 'quests' })}>
          ← クエストに戻る
        </button>
        <p className="muted">クエストが見つかりません。</p>
      </div>
    )
  }

  const boss = defs.find((d) => d.id === quest.bossDefId)
  const rank = rankOf(quest)
  const misses = state.coreMisses[quest.id] ?? 0
  const names = allGimmicks(quests)
  const exerciseName = (slotId: string) => {
    const slot = SLOTS.find((s) => s.id === slotId)
    return slot ? exerciseOfSlot(slot, menu).name : '？'
  }
  const adv = advantageElements(quest.element)
  // このボスへの効きやすさの目安：攻撃力 × 相性 × 得意種目が弱点か × 特攻が弱点か
  const members = owned
    .flatMap((mon): (Member & { score: number; tags: string[] })[] => {
      const def = defs.find((d) => d.id === mon.defId)
      if (!def) return []
      const m = { mon, def }
      const tags: string[] = []
      const a = affinityOf(m, quest)
      if (a > 1) tags.push('相性◎')
      if (a < 1) tags.push('相性×')
      const fav = !!def.favoriteSlot && quest.weakSlots.includes(def.favoriteSlot)
      if (fav) tags.push('得意種目が弱点')
      const missing = unmatchedGimmicks(def, quest)
      for (const g of quest.gimmicks ?? []) if (!missing.includes(g)) tags.push(abilityName(g, names))
      if (missing.length > 0) tags.push(`${missing.join('・')}で弱体`)
      const score = powerOf(m) * a * (fav ? CONFIG.quest.favorite : 1) * gimmickRate(def, quest)
      return [{ ...m, score, tags }]
    })
    .sort((a, b) => b.score - a.score)
  const max = CONFIG.quest.partySize
  const switching = !!current && current.questId !== id

  const toggle = (monId: string) =>
    setParty(party.includes(monId) ? party.filter((p) => p !== monId) : party.length < max ? [...party, monId] : party)

  return (
    <div className="page">
      <button className="back" onClick={() => go({ name: 'quests' })}>
        ← クエストに戻る
      </button>
      <QuestBanner quest={quest} boss={boss} />

      <section className="card">
        <h2>ボスの情報</h2>
        <ul className="mini-list">
          <li>
            <span>属性</span>
            <span style={quest.element ? { color: ELEMENT_COLOR[quest.element] } : undefined}>
              {quest.element ? ELEMENT_LABEL[quest.element] : '無属性'}
            </span>
          </li>
          <li>
            <span>適正（相性◎）</span>
            <span>
              {adv.length === 0
                ? 'なし'
                : adv.map((e) => (
                    <span key={e} style={{ color: ELEMENT_COLOR[e] }}>
                      {ELEMENT_LABEL[e]}{' '}
                    </span>
                  ))}
            </span>
          </li>
          <li>
            <span>弱点種目（ダメージ×{CONFIG.quest.weakSlot}）</span>
            <span>{quest.weakSlots.map(exerciseName).join('・') || 'なし'}</span>
          </li>
          <li>
            <span>ギミック（対応がないと1つにつき攻撃 -{Math.round(CONFIG.gimmicks.penaltyPerGimmick * 100)}%）</span>
            <span className="gimmicks">
              {(quest.gimmicks ?? []).length === 0
                ? 'なし'
                : (quest.gimmicks ?? []).map((g) => (
                    <span key={g} className="gimmick">
                      {g}
                    </span>
                  ))}
            </span>
          </li>
        </ul>
        <p className="muted small">
          筋トレのセットでは、その部位（胸腕・脚・背肩）のモンスターと、部位が「無」のモンスターが攻撃します。ローラーは全員で攻撃。相性は属性（炎→木→水→炎、光⇔闇）で決まります。
        </p>
      </section>

      <section className="card">
        <h2>難易度</h2>
        <div className="chips" role="group" aria-label="難易度">
          {DIFFICULTIES.map((d) => (
            <button key={d} type="button" className={`chip${difficulty === d ? ' on' : ''}`} onClick={() => setDifficulty(d)}>
              {CONFIG.quest.difficulties[d].label}
            </button>
          ))}
        </div>
        <p className="small">
          ボスの格：{rank.label}・HP {quest.hp[difficulty].toLocaleString()}・{questGold(quest, difficulty)}G
        </p>
        {quest.kind === 'material' ? (
          <p className="small core-drop">
            💎 {CORE_LABEL[quest.attr]}：{Math.round(CONFIG.cores.drop[difficulty].rate * 100)}%で落ちる
            {CONFIG.cores.drop[difficulty].double > 0 && `（${Math.round(CONFIG.cores.drop[difficulty].double * 100)}%で2個）`}
            {misses > 0 && `・いま${misses}回連続で落ちていない（${CONFIG.cores.pityMisses}回続くと次は確定）`}
          </p>
        ) : (
          <p className="small">
            ドロップ {boss?.name ?? '？'}＋{CONFIG.quest.difficulties[difficulty].plus}・たまに{CORE_LABEL[quest.attr]}（
            {Math.round(CONFIG.cores.bossBonusRate * 100)}%）
          </p>
        )}
      </section>

      <section className="card">
        <h2>
          出撃メンバー（{party.length}/{max}）
        </h2>
        <p className="muted small">このボスに効きやすい順に並んでいます。</p>
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
                    <MonsterImage imageId={m.def.images[m.mon.nodeId]} size={44} plus={m.mon.plus} shiny={m.mon.shiny} />
                    <span>
                      {on ? '✓ ' : ''}
                      {plusName(m.def, m.mon)} <Stars def={m.def} nodeId={m.mon.nodeId} />
                      <br />
                      <span className="small" style={{ color: ATTR_COLOR[attrOf(m)] }}>
                        {FORM_ATTR_LABEL[attrOf(m)]}
                      </span>
                      <span className="small"> {elementName(elementInfo(m.def))}</span>
                      <span className="small"> 攻撃力 {attackOf(m.mon, m.def).toLocaleString()}</span>
                      {m.tags.map((t) => (
                        <span key={t} className={`tag${t === '相性×' || t.endsWith('で弱体') ? ' warn' : ' keep'}`}>
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
        disabled={party.length === 0}
        onClick={() => {
          startChallenge(quest.id, difficulty, party)
          go({ name: 'quests' })
        }}
      >
        {switching ? '今の戦いをやめて、これに出撃する' : current?.questId === id ? 'この内容で出撃し直す' : '出撃する'}
      </button>
      {(switching || current?.questId === id) && (
        <p className="warn small center">出撃し直すと、それまでのダメージは0に戻ります。</p>
      )}
      <p className="muted small center">出撃したら、その日のうちに倒そう。倒すまでのセットがダメージになります。</p>
      <button className="btn small" onClick={() => go({ name: 'questForm', id: quest.id })}>
        このクエストを編集
      </button>
    </div>
  )
}
