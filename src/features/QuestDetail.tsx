import { useState } from 'react'
import { useStore } from '../store'
import { CONFIG } from '../config/gameConfig'
import { ATTR_LABEL, FORM_ATTR_LABEL, SLOTS, exerciseOfSlot } from '../data/exercises'
import { MonsterImage } from '../components/MonsterImage'
import { Stars } from '../components/Stars'
import { QuestBanner } from '../components/QuestBanner'
import { DIFFICULTIES, advantageAttr, affinity, attrOf, powerOf, type Member } from '../lib/quest'
import { ATTR_COLOR, type Go } from '../nav'
import { plusName, type QuestDifficulty } from '../types'

/** クエストの詳細：ボスの弱点を見て、難易度と出撃メンバーを選んで挑戦する */
export function QuestDetail({ id, go }: { id: string; go: Go }) {
  const { state, quests, defs, owned, menu, week, startChallenge } = useStore()
  const quest = quests.find((q) => q.id === id)
  const current = state.challenge?.week === week ? state.challenge : null
  const [difficulty, setDifficulty] = useState<QuestDifficulty>(
    current?.questId === id ? current.difficulty : 'normal',
  )
  const [party, setParty] = useState<string[]>(current?.questId === id ? current.party : [])

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
  const exerciseName = (slotId: string) => {
    const slot = SLOTS.find((s) => s.id === slotId)
    return slot ? exerciseOfSlot(slot, menu).name : '？'
  }
  const adv = advantageAttr(quest.attr)
  // このボスへの効きやすさの目安：攻撃力 × 相性 × 得意種目が弱点か × 特攻が弱点か
  const members = owned
    .flatMap((mon): (Member & { score: number; tags: string[] })[] => {
      const def = defs.find((d) => d.id === mon.defId)
      if (!def) return []
      const m = { mon, def }
      const tags: string[] = []
      const a = affinity(attrOf(m), quest.attr)
      if (a > 1) tags.push('相性◎')
      if (a < 1) tags.push('相性×')
      const fav = !!def.favoriteSlot && quest.weakSlots.includes(def.favoriteSlot)
      if (fav) tags.push('得意種目が弱点')
      const skill = !!def.skill && def.skill === quest.weakSkill
      if (skill) tags.push(CONFIG.skills[def.skill!])
      const score = powerOf(m) * a * (fav ? CONFIG.quest.favorite : 1) * (skill ? CONFIG.quest.skill : 1)
      return [{ ...m, score, tags }]
    })
    .sort((a, b) => b.score - a.score)
  const max = CONFIG.quest.partySize
  const clearedThisWeek = current?.cleared === true
  const switching = !!current && current.questId !== id && !current.cleared

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
            <span>{FORM_ATTR_LABEL[quest.attr]}</span>
          </li>
          <li>
            <span>適正（相性◎）</span>
            <span style={adv ? { color: ATTR_COLOR[adv] } : undefined}>{adv ? ATTR_LABEL[adv] : 'なし（無属性）'}</span>
          </li>
          <li>
            <span>弱点種目（ダメージ×{CONFIG.quest.weakSlot}）</span>
            <span>{quest.weakSlots.map(exerciseName).join('・') || 'なし'}</span>
          </li>
          <li>
            <span>弱点のやり方（特攻×{CONFIG.quest.skill}）</span>
            <span>{quest.weakSkill ? CONFIG.skills[quest.weakSkill] : 'なし'}</span>
          </li>
        </ul>
        <p className="muted small">
          筋トレのセットでは、その部位の属性のモンスター（と無属性）が攻撃します。ローラー・歩数・習慣は全員で攻撃。
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
          HP {quest.hp[difficulty].toLocaleString()}・ドロップ {boss?.name ?? '？'}＋{CONFIG.quest.difficulties[difficulty].plus}・
          {CONFIG.quest.difficulties[difficulty].gold}G
        </p>
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
                      <span className="small"> 攻撃力 {Math.round(powerOf(m) * 10) / 10}</span>
                      {m.tags.map((t) => (
                        <span key={t} className={`tag${t === '相性×' ? '' : ' keep'}`}>
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

      {clearedThisWeek ? (
        <p className="muted center">今週はもうクリアしました。月曜にまた挑戦できます。</p>
      ) : (
        <button
          className="btn primary wide"
          disabled={party.length === 0}
          onClick={() => {
            startChallenge(quest.id, difficulty, party)
            go({ name: 'quests' })
          }}
        >
          {switching ? '今の挑戦をやめて、これに挑戦する' : current?.questId === id ? 'この内容で挑戦し直す' : 'これに挑戦する'}
        </button>
      )}
      {(switching || current?.questId === id) && !clearedThisWeek && (
        <p className="warn small center">挑戦し直すと、それまでのダメージは0に戻ります。</p>
      )}
      <button className="btn small" onClick={() => go({ name: 'questForm', id: quest.id })}>
        このクエストを編集
      </button>
    </div>
  )
}
