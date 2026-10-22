import { useState } from 'react'
import { useStore } from '../store'
import { BONUS_SLOT, DAYS, DAY_KEYS, dumbbellText, exerciseOfSlot, rangeText, slotsOfDay, type Slot } from '../data/exercises'
import { CONFIG } from '../config/gameConfig'
import { partProgress, slotDone, weekCount } from '../lib/week'
import { ATTR_COLOR, type Go } from '../nav'
import { MusicButtons } from '../music'
import { MonsterImage } from '../components/MonsterImage'
import { BattleBar } from '../components/BattleBar'
import { partnerOf, rateText } from '../lib/partner'

export function Training({ go }: { go: Go }) {
  const { menu, weekSets, todaySets, songs, state, owned, defs, autoSetPartners } = useStore()
  const [partnerFlash, setPartnerFlash] = useState(false)
  const progress = partProgress(weekSets)

  // タスクの枠は今週こなしたセット数、ボーナス枠は今日こなしたセット数
  const slotButton = (slot: Slot) => {
    const ex = exerciseOfSlot(slot, menu)
    const isBonus = slot.day === 'bonus'
    const done = isBonus
      ? Math.min(CONFIG.sets.perExercise, todaySets.filter((s) => s.slotId === slot.id).length)
      : slotDone(weekSets, slot.id)
    const complete = done >= CONFIG.sets.perExercise
    const extraDone = isBonus ? 0 : Math.min(CONFIG.sets.perExercise, weekCount(weekSets, slot.id) - CONFIG.sets.perExercise)
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
              <MonsterImage imageId={partner.def.images[partner.mon.nodeId]} size={40} plus={partner.mon.plus} />
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
            <div className="muted small">
              {rangeText(ex.id)}
              {ex.weighted ? `・${dumbbellText(ex)}` : ''}
            </div>
            <div className="muted small how">{ex.how}</div>
            {complete && !isBonus && (
              <div className="small bonus-reward">
                2周目 {Math.max(0, extraDone)}/{CONFIG.sets.perExercise}（EXP{Math.round(CONFIG.sets.extraExpRatio * 100)}%）
              </div>
            )}
          </div>
          <span className="slot-count">
            {complete ? '✓ ' : ''}
            {done}/{CONFIG.sets.perExercise}
          </span>
        </button>
      </li>
    )
  }

  return (
    <div className="page">
      <MusicButtons />
      <BattleBar go={go} />
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
        終わった種目は、余力があれば2周目（もう{CONFIG.sets.perExercise}セット、EXP{Math.round(CONFIG.sets.extraExpRatio * 100)}%）もできます。
      </p>

      {DAY_KEYS.map((day) => (
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
          <ul className="slot-list">{slotsOfDay(day).map(slotButton)}</ul>
        </section>
      ))}

      <section className="card">
        <div className="part-head">
          <h2>ボーナス枠</h2>
          <span className="muted small">タスク外・1日{CONFIG.sets.perExercise}セットまで</span>
          <button className="btn small" onClick={() => go({ name: 'menuEdit', day: 'bonus' })}>
            種目を差し替える
          </button>
        </div>
        <ul className="slot-list">{slotButton(BONUS_SLOT)}</ul>
        <p className="bonus-reward">
          1セットごとに +{CONFIG.bonus.goldPerSet}G ＆ 万能EXP +{CONFIG.bonus.anyExpPerSet}
        </p>
        <p className="muted small">
          万能EXPは、どの属性の進化にも注げます。報酬が出るのは1日{CONFIG.sets.perExercise}セットまでで、日付が変わるとまた
          {CONFIG.sets.perExercise}セットできます（毎日やれば1日 +{CONFIG.bonus.goldPerSet * CONFIG.sets.perExercise}G ＆ 万能EXP +
          {CONFIG.bonus.anyExpPerSet * CONFIG.sets.perExercise}）。
        </p>
        <p className="muted small">だるい日は1セットだけでもOK。それも出席1回に数えます。</p>
      </section>
    </div>
  )
}
