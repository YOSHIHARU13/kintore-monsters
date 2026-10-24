import { useState } from 'react'
import { monArt } from '../lib/art'
import { useStore } from '../store'
import { BONUS_SLOTS, DAYS, DAY_KEYS, dumbbellText, exerciseOfSlot, rangeText, slotsOfDay, type Slot } from '../data/exercises'
import { CONFIG } from '../config/gameConfig'
import { partProgress, slotDone, weekCount } from '../lib/week'
import { ATTR_COLOR, type Go } from '../nav'
import { MusicButtons } from '../music'
import { MonsterImage } from '../components/MonsterImage'
import { BattleBar, useBattle } from '../components/BattleBar'
import { partnerOf, rateText } from '../lib/partner'
import { setHit } from '../lib/quest'

type Order = 'todo' | 'damage'

/** 種目の一覧（クエストから出撃して来る）。未クリア優先か、出撃中ならダメージ優先（今のボスに効く順）で並べられる */
export function Training({ go }: { go: Go }) {
  const { menu, weekSets, todaySets, songs, state, owned, defs, autoSetPartners } = useStore()
  const [partnerFlash, setPartnerFlash] = useState(false)
  const [order, setOrder] = useState<Order>('todo')
  const progress = partProgress(weekSets)
  // 出撃中なら、ボスに効く種目に印をつける（ボスの部位は×1.3、中でも弱点種目は×2.6）
  const battle = useBattle()
  const q = CONFIG.quest
  const hitMark = (slot: Slot): string | null => {
    if (!battle || slot.day === 'bonus') return null
    const bossPart = battle.quest.attr !== 'none' && DAYS[slot.day].attr === battle.quest.attr
    const weak = battle.quest.weakSlots.includes(slot.id)
    if (weak) return `🎯弱点 ×${Math.round((bossPart ? q.bossPart : 1) * q.weakSlot * 10) / 10}`
    return bossPart ? `⚔️ボスの部位 ×${q.bossPart}` : null
  }

  // タスクの枠は今週こなしたセット数、ボーナス枠は今日こなしたセット数
  const slotButton = (slot: Slot) => {
    const ex = exerciseOfSlot(slot, menu)
    const isBonus = slot.day === 'bonus'
    const done = isBonus
      ? Math.min(CONFIG.sets.perExercise, todaySets.filter((s) => s.slotId === slot.id).length)
      : slotDone(weekSets, slot.id)
    const complete = done >= CONFIG.sets.perExercise
    const extraDone = isBonus ? 0 : weekCount(weekSets, slot.id) - CONFIG.sets.perExercise
    const partner = partnerOf(slot.id, state.partners, owned, defs)
    return (
      <li key={slot.id} className="slot-with-partner">
        <button
          className="partner-btn"
          onClick={() => go({ name: 'partner', slotId: slot.id })}
          aria-label={`${ex.name}の相棒`}
        >
          {partner ? (
            <>
              <MonsterImage {...monArt(partner.def, partner.mon)} size={40} plus={partner.mon.plus} />
              <span className="small bonus-reward">{rateText(partner.rate)}</span>
            </>
          ) : (
            <span className="small muted">相棒
              <br />＋</span>
          )}
        </button>
        <button className={`slot${complete ? ' complete' : ''}`} onClick={() => go({ name: 'set', slotId: slot.id })}>
          <div>
            <strong>{ex.name}</strong>
            {hitMark(slot) && <span className={`hit-mark${battle?.quest.weakSlots.includes(slot.id) ? ' weak' : ''}`}>{hitMark(slot)}</span>}
            <div className="muted small">
              {rangeText(ex.id)}
              {ex.weighted ? `・${dumbbellText(ex)}` : ''}
            </div>
            <div className="muted small how">{ex.how}</div>
            {complete && !isBonus && extraDone > 0 && <div className="small bonus-reward">追加 {extraDone}セット</div>}
          </div>
          <span className="slot-count">
            {complete ? '✓ ' : ''}
            {done}/{CONFIG.sets.perExercise}
          </span>
        </button>
      </li>
    )
  }

  const doneOf = (slot: Slot) =>
    slot.day === 'bonus' ? todaySets.filter((s) => s.slotId === slot.id).length : slotDone(weekSets, slot.id)
  // 未クリア優先：その部位の中で、まだ終わっていない種目が先
  const todoFirst = (slots: Slot[]) =>
    [...slots].sort((a, b) => Number(doneOf(a) >= CONFIG.sets.perExercise) - Number(doneOf(b) >= CONFIG.sets.perExercise))
  // ダメージ優先：今のボスに1セットで与えるダメージの順（全部の部位・全身枠をまとめて）
  const damageOf = (slot: Slot) =>
    battle ? setHit({ slotId: slot.id, day: slot.day, eligible: true }, battle.quest, battle.party, '').damage : 0
  const byDamage = [...DAY_KEYS.flatMap((d) => slotsOfDay(d)), ...BONUS_SLOTS].sort((a, b) => damageOf(b) - damageOf(a))

  return (
    <div className="page">
      <button className="back" onClick={() => go({ name: 'quests' })}>
        ← クエストに戻る
      </button>
      <MusicButtons />
      <BattleBar go={go} />
      {battle && (
        <div className="segmented" role="tablist" aria-label="並べ方">
          <button className={order === 'todo' ? 'on' : ''} onClick={() => setOrder('todo')}>
            未クリア優先
          </button>
          <button className={order === 'damage' ? 'on' : ''} onClick={() => setOrder('damage')}>
            ダメージ優先
          </button>
        </div>
      )}
      {songs.length === 0 && (
        <button className="btn small" onClick={() => go({ name: 'settings' })}>
          🎵 トレーニング中に流す曲を設定する
        </button>
      )}
      {owned.length > 0 && (
        <button
          className="btn wide"
          onClick={() => {
            autoSetPartners()
            setPartnerFlash(true)
          }}
        >
          🤝 相棒をおまかせでセット（全部の種目にいちばん強い組み合わせ）
        </button>
      )}
      {partnerFlash && <div className="result keep">相棒をセットしました</div>}
      <p className="muted small">
        今週のタスクです。どの日に、どの種目からやってもOK。1種目は{CONFIG.sets.perExercise}セットで完了、月曜にリセットされます。
        終わった種目も、余力があれば何セットでも追加できます（EXPもダメージもそのまま入ります）。
      </p>

      {battle && order === 'damage' && (
        <section className="card">
          <h2>今のボスに効く順</h2>
          <p className="muted small">1セットで与えるダメージが大きい順（弱点・ボスの部位・相棒の得意種目も込み）</p>
          <ul className="slot-list">{byDamage.map(slotButton)}</ul>
        </section>
      )}

      {!(battle && order === 'damage') && DAY_KEYS.map((day) => (
        <section className="card" key={day}>
          <div className="part-head">
            <h2 style={{ color: ATTR_COLOR[DAYS[day].attr] }}>{DAYS[day].title}</h2>
            <span className="muted small">
              残り{progress[day].total - progress[day].done}セット
            </span>
            <button className="btn small" onClick={() => go({ name: 'menuEdit', day })}>
              種目を差し替える
            </button>
          </div>
          <ul className="slot-list">{todoFirst(slotsOfDay(day)).map(slotButton)}</ul>
        </section>
      ))}

      {!(battle && order === 'damage') && <section className="card">
        <div className="part-head">
          <h2>全身枠</h2>
          <span className="muted small">タスク外・どの部位でもない</span>
          <button className="btn small" onClick={() => go({ name: 'menuEdit', day: 'bonus' })}>
            種目を差し替える
          </button>
        </div>
        <ul className="slot-list">{BONUS_SLOTS.map(slotButton)}</ul>
        <p className="bonus-reward">
          1セットごとに 万能EXP +{CONFIG.bonus.anyExpPerSet}（何セットでも）＋ オーブ +{CONFIG.bonus.goldPerSet}（全身枠ぜんぶで1日
          {CONFIG.sets.perExercise}セットまで）
        </p>
        <p className="muted small">
          万能EXPは、どの属性の進化にも注げます。全身枠は誰の得意種目にもならず、出撃中は全員で同じだけ攻撃します。
        </p>
        <p className="muted small">だるい日は1セットだけでもOK。それも出席1回に数えます。</p>
      </section>}
    </div>
  )
}
