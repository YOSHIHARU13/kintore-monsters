import { useState } from 'react'
import { useStore } from '../store'
import { CONFIG } from '../config/gameConfig'
import { DAYS, FORM_ATTRS, FORM_ATTR_LABEL, SLOTS, exerciseOfSlot, type FormAttr } from '../data/exercises'
import { FIRST_NODE_ID } from '../data/evolutionTemplates'
import { QuestBanner } from '../components/QuestBanner'
import { DIFFICULTIES, defaultHp, questGold, standardSessionDamage } from '../lib/quest'
import { allGimmicks } from '../lib/gimmick'
import { ATTR_COLOR, type Go } from '../nav'
import { nodeAttr, type Quest, type QuestDifficulty } from '../types'

/** クエストを作る・編集する。ボス・弱点・HPを決める */
export function QuestForm({ id, go }: { id?: string; go: Go }) {
  const { quests, defs, menu, saveQuest, deleteQuest } = useStore()
  const existing = id ? quests.find((q) => q.id === id) : undefined
  // ボスになれるのは「クエスト限定」のモンスター（いなければ全員から選べる）
  const bossChoices = defs.some((d) => d.questOnly) ? defs.filter((d) => d.questOnly) : defs
  const session = standardSessionDamage()

  const [name, setName] = useState(existing?.name ?? '')
  const [bossDefId, setBossDefId] = useState(existing?.bossDefId ?? bossChoices[0]?.id ?? '')
  const [attr, setAttr] = useState<FormAttr>(
    existing?.attr ?? (bossChoices[0] ? nodeAttr(bossChoices[0], FIRST_NODE_ID) : 'none'),
  )
  const [weakSlots, setWeakSlots] = useState<string[]>(existing?.weakSlots ?? [])
  const [gimmicks, setGimmicks] = useState<string[]>(existing?.gimmicks ?? [])
  const [newGimmick, setNewGimmick] = useState('')
  const [newAbility, setNewAbility] = useState('')
  const [customGimmicks, setCustomGimmicks] = useState<Record<string, string>>(existing?.customGimmicks ?? {})
  const gimmickNames = { ...allGimmicks(quests), ...customGimmicks }
  const [rank, setRank] = useState(existing?.rank ?? 1)
  const [hp, setHp] = useState<Record<QuestDifficulty, number>>(existing?.hp ?? defaultHp(existing?.rank ?? 1))
  const [catchphrase, setCatchphrase] = useState(existing?.catchphrase ?? '')
  const [theme, setTheme] = useState(existing?.theme ?? 'flame')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const boss = defs.find((d) => d.id === bossDefId)
  const draft: Quest = {
    id: existing?.id ?? 'new',
    name: name.trim() || '名前のないクエスト',
    bossDefId,
    attr,
    weakSlots,
    gimmicks,
    customGimmicks,
    hp,
    rank,
    catchphrase,
    theme,
    createdAt: existing?.createdAt ?? 0,
  }

  const save = () => {
    if (!name.trim()) return setError('クエストの名前を入力してください')
    if (!boss) return setError('ボスにするモンスターを選んでください')
    if (DIFFICULTIES.some((d) => !(hp[d] > 0))) return setError('HPは1以上にしてください')
    saveQuest({ id: existing?.id, name, bossDefId, attr, weakSlots, gimmicks, customGimmicks, hp, rank, catchphrase, theme })
    go({ name: 'quests' })
  }

  return (
    <div className="page">
      <button className="back" onClick={() => go({ name: 'quests' })}>
        ← クエストに戻る
      </button>
      <h1 className="title">{existing ? 'クエストの編集' : 'クエストを作る'}</h1>
      <QuestBanner quest={draft} boss={boss} />

      <section className="card">
        <label className="field">
          クエストの名前
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="例：脚竜の巣" />
        </label>
        <label className="field">
          キャッチコピー（省略可）
          <input value={catchphrase} onChange={(e) => setCatchphrase(e.target.value)} maxLength={24} placeholder="例：脚を鍛えた者だけが進める" />
        </label>
        <div className="field">
          テーマ色
          <div className="chips">
            {Object.entries(CONFIG.gacha.themes).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`chip theme-chip theme-${key}${theme === key ? ' on' : ''}`}
                onClick={() => setTheme(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="card">
        <h2>ボス</h2>
        {bossChoices.length === 0 ? (
          <p className="warn small">モンスターがいません。図鑑でボスにするモンスターを登録してください。</p>
        ) : (
          <label className="field">
            倒すと手に入るモンスター
            <select
              value={bossDefId}
              onChange={(e) => {
                setBossDefId(e.target.value)
                const d = defs.find((x) => x.id === e.target.value)
                if (d) setAttr(nodeAttr(d, FIRST_NODE_ID))
              }}
            >
              {bossChoices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {!defs.some((d) => d.questOnly) && (
          <p className="muted small">図鑑の登録画面で「クエスト限定」にしたモンスターは、ガチャに出なくなり、ここでだけ選べます。</p>
        )}
        <div className="field">
          ボスの属性（相性に使います）
          <div className="chips" role="group" aria-label="ボスの属性">
            {FORM_ATTRS.map((a) => (
              <button
                key={a}
                type="button"
                className={`chip${attr === a ? ' on' : ''}`}
                style={attr === a ? { borderColor: ATTR_COLOR[a], color: ATTR_COLOR[a] } : undefined}
                onClick={() => setAttr(a)}
              >
                {FORM_ATTR_LABEL[a]}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          弱点種目（{CONFIG.quest.maxWeakSlots}つまで・ダメージ×{CONFIG.quest.weakSlot}）
          <div className="chips">
            {SLOTS.map((slot) => {
              const on = weakSlots.includes(slot.id)
              return (
                <button
                  key={slot.id}
                  type="button"
                  className={`chip small${on ? ' on' : ''}`}
                  disabled={!on && weakSlots.length >= CONFIG.quest.maxWeakSlots}
                  onClick={() => setWeakSlots(on ? weakSlots.filter((s) => s !== slot.id) : [...weakSlots, slot.id])}
                >
                  {slot.day === 'bonus' ? '' : `${DAYS[slot.day].title}：`}
                  {exerciseOfSlot(slot, menu).name}
                </button>
              )
            })}
          </div>
        </div>
        <div className="field">
          ギミック（{CONFIG.gimmicks.maxPerBoss}つまで）：対応するアビリティがないモンスターは、1つにつき攻撃が
          {Math.round(CONFIG.gimmicks.penaltyPerGimmick * 100)}%減ります
          <div className="chips" role="group" aria-label="ギミック">
            {Object.keys(gimmickNames).map((g) => {
              const on = gimmicks.includes(g)
              return (
                <button
                  key={g}
                  type="button"
                  className={`chip${on ? ' on' : ''}`}
                  disabled={!on && gimmicks.length >= CONFIG.gimmicks.maxPerBoss}
                  onClick={() => setGimmicks(on ? gimmicks.filter((x) => x !== g) : [...gimmicks, g])}
                >
                  {g}
                </button>
              )
            })}
          </div>
          <span className="muted small">新しいギミックを作る（ギミック名と、それに対応するアビリティ名をセットで）</span>
          <span className="row wrap">
            <input
              value={newGimmick}
              onChange={(e) => setNewGimmick(e.target.value)}
              maxLength={8}
              placeholder="例：ゾーン"
              aria-label="新しいギミック"
            />
            <input
              value={newAbility}
              onChange={(e) => setNewAbility(e.target.value)}
              maxLength={12}
              placeholder="例：ゾーンブレイク"
              aria-label="対応するアビリティ"
            />
            <button
              type="button"
              className="btn small"
              disabled={!newGimmick.trim() || !newAbility.trim() || gimmicks.length >= CONFIG.gimmicks.maxPerBoss}
              onClick={() => {
                const g = newGimmick.trim()
                if (!(g in gimmickNames)) setCustomGimmicks({ ...customGimmicks, [g]: newAbility.trim() })
                if (!gimmicks.includes(g)) setGimmicks([...gimmicks, g])
                setNewGimmick('')
                setNewAbility('')
              }}
            >
              追加
            </button>
          </span>
        </div>
      </section>

      <section className="card">
        <h2>ボスの格とHP</h2>
        <div className="chips" role="group" aria-label="ボスの格">
          {CONFIG.quest.ranks.map((r, i) => (
            <button
              key={r.label}
              type="button"
              className={`chip${rank === i ? ' on' : ''}`}
              onClick={() => {
                setRank(i)
                setHp(defaultHp(i))
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
        <p className="muted small">格を選ぶと、初級・中級・上級のHPが入り直します（HPは手で書き換えてもOK）。格が高いほど報酬のGも増えます。</p>
        <p className="muted small">
          目安：攻撃力9,000くらい（ノーマルの★6）が6体（各属性2体）、相性・弱点なしで、1回のトレーニング（1部位5種目×3セット＋ローラー3セット）で約
          <strong>{session.toLocaleString()}</strong>ダメージ。相性・弱点・特攻を突いたり、2周目まで追い込んだりすると大きく増えます。
        </p>
        {DIFFICULTIES.map((d) => (
          <label key={d} className="field">
            {CONFIG.quest.difficulties[d].label}（ドロップ＋{CONFIG.quest.difficulties[d].plus}・{questGold({ rank }, d)}G）
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={hp[d]}
              onChange={(e) => setHp({ ...hp, [d]: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
              aria-label={`${CONFIG.quest.difficulties[d].label}のHP`}
            />
            <span className="muted small">1回ぶんの {Math.round((hp[d] / session) * 10) / 10}倍</span>
          </label>
        ))}
      </section>

      {error && <p className="error">{error}</p>}
      <button className="btn primary wide" onClick={save}>
        {existing ? '保存する' : 'クエストを作る'}
      </button>
      {existing && (
        <button
          className="btn ghost wide"
          onClick={() => {
            if (!confirmDelete) return setConfirmDelete(true)
            deleteQuest(existing.id)
            go({ name: 'quests' })
          }}
        >
          {confirmDelete ? '本当に消す' : 'このクエストを消す'}
        </button>
      )}
    </div>
  )
}
