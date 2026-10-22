import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { CONFIG } from '../config/gameConfig'
import { DAYS, FORM_ATTRS, FORM_ATTR_LABEL, SLOTS, exerciseOfSlot, type FormAttr } from '../data/exercises'
import { FIRST_NODE_ID } from '../data/evolutionTemplates'
import { QuestBanner } from '../components/QuestBanner'
import { DIFFICULTIES, GRADES, defaultBossHp, defaultHp, gradeOf, questGold, standardSessionDamage } from '../lib/quest'
import { allGimmicks, selectableGimmicks } from '../lib/gimmick'
import { ELEMENTS, ELEMENT_COLOR, ELEMENT_LABEL, advantageElements, elementInfo } from '../lib/element'
import { abilityTag, elementTag, ownedSupply, requirementsFromMonsters, requirementsOf, tagLabel } from '../lib/formation'
import { CORE_LABEL } from '../lib/cores'
import { autoQuestSetup } from '../lib/questAuto'
import { ATTR_COLOR, type Go } from '../nav'
import { nodeAttr, type Element, type Quest, type QuestDifficulty, type QuestGrade, type Requirement } from '../types'

/** クエストを作る・編集する。ボス・弱点・HPを決める */
export function QuestForm({ id, go }: { id?: string; go: Go }) {
  const { quests, defs, owned, menu, saveQuest, deleteQuest } = useStore()
  const [stars, setStars] = useState<string[]>([])
  const existing = id ? quests.find((q) => q.id === id) : undefined
  // ボスになれるのは「クエスト限定」のモンスター（いなければ全員から選べる）
  const bossChoices = defs.some((d) => d.questOnly) ? defs.filter((d) => d.questOnly) : defs
  const session = standardSessionDamage()

  const [name, setName] = useState(existing && !existing.autoName ? existing.name : '')
  const [bossDefId, setBossDefId] = useState(existing?.bossDefId ?? bossChoices[0]?.id ?? '')
  const [attr, setAttr] = useState<FormAttr>(
    existing?.attr ?? (bossChoices[0] ? nodeAttr(bossChoices[0], FIRST_NODE_ID) : 'none'),
  )
  const bossDef = defs.find((d) => d.id === bossDefId)
  const element: Element | undefined = bossDef ? elementInfo(bossDef).elements[0] : undefined
  const [weakSlots, setWeakSlots] = useState<string[]>(existing?.weakSlots ?? [])
  const [requirements, setRequirements] = useState<Requirement[]>(existing ? requirementsOf(existing) : [])
  const [newGimmick, setNewGimmick] = useState('')
  const [newAbility, setNewAbility] = useState('')
  const [customGimmicks, setCustomGimmicks] = useState<Record<string, string>>(existing?.customGimmicks ?? {})
  const gimmickNames = { ...allGimmicks(quests), ...customGimmicks }
  const [kind, setKind] = useState<'boss' | 'material'>(existing?.kind ?? 'boss')
  const [rank, setRank] = useState(existing?.rank ?? 1)
  const [grade, setGrade] = useState<QuestGrade>(existing ? gradeOf(existing) : 'kyukyoku')
  const [bossHp, setBossHp] = useState(existing?.hp.normal ?? defaultBossHp(existing ? gradeOf(existing) : 'kyukyoku'))
  const [hp, setHp] = useState<Record<QuestDifficulty, number>>(existing?.hp ?? defaultHp(existing?.rank ?? 1, existing?.kind))
  const [catchphrase, setCatchphrase] = useState(existing?.catchphrase ?? '')
  const [theme] = useState(existing?.theme ?? 'flame')
  // おまかせ：ボスと格から、編成の条件と弱点種目を自動で決める（手で変えたら止まる）
  const [auto, setAuto] = useState(!existing)
  const fillAuto = () => {
    const b = defs.find((d) => d.id === bossDefId)
    if (!b) return
    const r = autoQuestSetup(b, grade, kind, quests, selectableGimmicks(quests), existing?.id)
    setRequirements(r.requirements)
    setWeakSlots(r.weakSlots)
  }
  useEffect(() => {
    if (auto) fillAuto()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, bossDefId, grade, kind])
  const editRequirements = (next: Requirement[]) => {
    setAuto(false)
    setRequirements(next)
  }
  const editWeakSlots = (next: string[]) => {
    setAuto(false)
    setWeakSlots(next)
  }
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const boss = defs.find((d) => d.id === bossDefId)
  const draft: Quest = {
    id: existing?.id ?? 'new',
    name: name.trim() || boss?.name || '名前のないクエスト',
    bossDefId,
    attr,
    element,
    weakSlots,
    kind,
    requirements,
    customGimmicks,
    hp: kind === 'boss' ? { easy: bossHp, normal: bossHp, hard: bossHp } : hp,
    rank,
    grade,
    catchphrase,
    theme,
    createdAt: existing?.createdAt ?? 0,
  }

  const save = () => {
    if (!boss) return setError('ボスにするモンスターを選んでください')
    if (DIFFICULTIES.some((d) => !(draft.hp[d] > 0))) return setError('HPは1以上にしてください')
    saveQuest({ id: existing?.id, name, kind, bossDefId, attr, element, weakSlots, requirements, customGimmicks, hp: draft.hp, rank, grade, catchphrase, theme })
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
          クエストの名前（省略可・空ならボスの名前）
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder={boss?.name ?? '例：脚竜の巣'} />
        </label>
        <label className="field">
          キャッチコピー（省略可）
          <input value={catchphrase} onChange={(e) => setCatchphrase(e.target.value)} maxLength={24} placeholder="例：脚を鍛えた者だけが進める" />
        </label>
        <p className="muted small">バナーの色は、求められる編成の最初の属性の色になります。</p>
      </section>

      <section className="card">
        <h2>種類</h2>
        <div className="chips" role="group" aria-label="クエストの種類">
          {(['boss', 'material'] as const).map((k) => (
            <button
              key={k}
              type="button"
              className={`chip${kind === k ? ' on' : ''}`}
              onClick={() => {
                setKind(k)
                setHp(defaultHp(rank, k))
              }}
            >
              {k === 'boss' ? '⚔️ ボスクエスト' : '💎 素材クエスト'}
            </button>
          ))}
        </div>
        <p className="muted small">
          {kind === 'boss'
            ? 'ボスを倒すと、そのボスのモンスターが手に入ります（上級ほど＋が付く）。たまに核も落ちます。'
            : `HPはボスクエストの半分くらい。ボスの属性の核（${CORE_LABEL[attr]}）が落ちます（毎回ではありません）。`}
        </p>
      </section>

      <section className="card">
        <h2>{kind === 'boss' ? 'ボス' : '敵'}</h2>
        {bossChoices.length === 0 ? (
          <p className="warn small">モンスターがいません。図鑑でボスにするモンスターを登録してください。</p>
        ) : (
          <label className="field">
            {kind === 'boss' ? '倒すと手に入るモンスター' : '敵の見た目（手には入りません）'}
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
          <span>
            ボスの属性：
            <strong style={element ? { color: ELEMENT_COLOR[element] } : undefined}>
              {element ? ELEMENT_LABEL[element] : '無属性'}
            </strong>
            （ボスのモンスターと同じ）
          </span>
          {element && (
            <span className="muted small">
              適正（有利な属性）：{advantageElements(element).map((e) => ELEMENT_LABEL[e]).join('・')}
            </span>
          )}
        </div>
        <div className="field">
          ボスの部位（素材クエストで落ちる核の種類）
          <div className="chips" role="group" aria-label="ボスの部位">
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
        <details className="field">
          <summary>弱点種目（なくてもOK・{CONFIG.quest.maxWeakSlots}つまで・ダメージ×{CONFIG.quest.weakSlot}）</summary>
          <div className="chips">
            {SLOTS.map((slot) => {
              const on = weakSlots.includes(slot.id)
              return (
                <button
                  key={slot.id}
                  type="button"
                  className={`chip small${on ? ' on' : ''}`}
                  disabled={!on && weakSlots.length >= CONFIG.quest.maxWeakSlots}
                  onClick={() => editWeakSlots(on ? weakSlots.filter((s) => s !== slot.id) : [...weakSlots, slot.id])}
                >
                  {slot.day === 'bonus' ? '' : `${DAYS[slot.day].title}：`}
                  {exerciseOfSlot(slot, menu).name}
                </button>
              )
            })}
          </div>
        </details>
      </section>

      <section className="card">
        <h2>求められる編成</h2>
        <button
          type="button"
          className={`btn small${auto ? ' primary' : ''}`}
          onClick={() => {
            setAuto(true)
            fillAuto()
          }}
        >
          ✨ おまかせで決める{auto ? '（おまかせ中）' : ''}
        </button>
        <p className="muted small">
          おまかせ：ボスの属性に有利な属性と、ほかのクエストであまり使っていないアビリティを、格に合わせた数で求めます。弱点種目もボスの部位から決めます。手で変えるとおまかせは止まります。
        </p>
        <p className="muted small">
          出撃する6体の合計で満たす条件です。ちょうどそろうと編成倍率×1.0（普通にその日のメニューで倒せる）、何もないと×
          {CONFIG.formation.base}、超えた分は1つにつき+{CONFIG.formation.perExtra}。超属性は2、複合属性は両方に1ずつ数えます。
        </p>
        <div className="field">
          🎯 このモンスターが活躍するクエストにする（3体まで選んで「条件を作る」）
          <div className="chips" role="group" aria-label="活躍させたいモンスター">
            {defs.map((d) => {
              const on = stars.includes(d.id)
              return (
                <button
                  key={d.id}
                  type="button"
                  className={`chip small${on ? ' on' : ''}`}
                  disabled={!on && stars.length >= 3}
                  onClick={() => setStars(on ? stars.filter((x) => x !== d.id) : [...stars, d.id])}
                >
                  {d.name}
                </button>
              )
            })}
          </div>
          <button
            type="button"
            className="btn small"
            disabled={stars.length === 0}
            onClick={() => {
              editRequirements(requirementsFromMonsters(defs.filter((d) => stars.includes(d.id))))
            }}
          >
            選んだモンスターの属性・アビリティで条件を作る
          </button>
        </div>
        {requirements.length === 0 && <p className="muted small">まだ条件がありません（いつでも×1.0）。下から足してください。</p>}
        <ul className="mini-list">
          {requirements.map((r, i) => (
            <li key={r.tag}>
              <span>
                {tagLabel(r.tag, gimmickNames)}
                <br />
                <span className={`small ${ownedSupply(r.tag, owned, defs) < r.count ? 'warn' : 'muted'}`}>
                  持っている {ownedSupply(r.tag, owned, defs)}
                  {ownedSupply(r.tag, owned, defs) < r.count && '（今の手持ちだと×1.0に届かない）'}
                </span>
              </span>
              <span className="row">
                <button
                  type="button"
                  className="btn small"
                  disabled={r.count <= 1}
                  onClick={() => editRequirements(requirements.map((x, j) => (j === i ? { ...x, count: x.count - 1 } : x)))}
                  aria-label={`${tagLabel(r.tag, gimmickNames)}を減らす`}
                >
                  −
                </button>
                <strong className="num">{r.count}</strong>
                <button
                  type="button"
                  className="btn small"
                  disabled={r.count >= CONFIG.quest.partySize * 2}
                  onClick={() => editRequirements(requirements.map((x, j) => (j === i ? { ...x, count: x.count + 1 } : x)))}
                  aria-label={`${tagLabel(r.tag, gimmickNames)}を増やす`}
                >
                  ＋
                </button>
                <button
                  type="button"
                  className="btn small ghost"
                  onClick={() => editRequirements(requirements.filter((_, j) => j !== i))}
                  aria-label={`${tagLabel(r.tag, gimmickNames)}を消す`}
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
        <div className="chips" role="group" aria-label="条件を足す">
          {[...ELEMENTS.map(elementTag), ...[...new Set([...selectableGimmicks(quests), ...Object.keys(customGimmicks)])].map(abilityTag)]
            .filter((tag) => !requirements.some((r) => r.tag === tag))
            .map((tag) => (
              <button
                key={tag}
                type="button"
                className="chip small"
                disabled={requirements.length >= CONFIG.formation.maxRequirements}
                onClick={() => editRequirements([...requirements, { tag, count: tag.startsWith('el:') ? 3 : 2 }])}
              >
                ＋{tagLabel(tag, gimmickNames)}
              </button>
            ))}
        </div>
        <span className="muted small">新しいアビリティを作る（ギミック名と、アビリティ名をセットで）</span>
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
            disabled={!newGimmick.trim() || !newAbility.trim() || requirements.length >= CONFIG.formation.maxRequirements}
            onClick={() => {
              const g = newGimmick.trim()
              if (!(g in gimmickNames)) setCustomGimmicks({ ...customGimmicks, [g]: newAbility.trim() })
              if (!requirements.some((r) => r.tag === abilityTag(g))) editRequirements([...requirements, { tag: abilityTag(g), count: 2 }])
              setNewGimmick('')
              setNewAbility('')
            }}
          >
            追加
          </button>
        </span>
      </section>

      {kind === 'boss' ? (
        <section className="card">
          <h2>格とHP</h2>
          <div className="chips" role="group" aria-label="クエストの格">
            {GRADES.map((g) => (
              <button
                key={g}
                type="button"
                className={`chip grade-chip grade-${g}${grade === g ? ' on' : ''}`}
                onClick={() => {
                  setGrade(g)
                  setBossHp(defaultBossHp(g))
                }}
              >
                {CONFIG.quest.grades[g].label}
              </button>
            ))}
          </div>
          <p className="muted small">
            {CONFIG.quest.grades[grade].label}：報酬 {CONFIG.quest.grades[grade].gold}G・ボス
            {CONFIG.quest.grades[grade].plus > 0 ? `＋${CONFIG.quest.grades[grade].plus}` : ''}がドロップ。格を選ぶとHPが入り直します（手で書き換えてもOK）。
          </p>
          <label className="field">
            HP（編成がちょうどそろっていて、1回のトレーニングで約{session.toLocaleString()}ダメージが目安）
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={bossHp}
              onChange={(e) => setBossHp(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
              aria-label="HP"
            />
            <span className="muted small">1回ぶんの {Math.round((bossHp / session) * 10) / 10}倍</span>
          </label>
        </section>
      ) : (
        <section className="card">
          <h2>格とHP</h2>
          <div className="chips" role="group" aria-label="ボスの格">
            {CONFIG.quest.ranks.map((r, i) => (
              <button
                key={r.label}
                type="button"
                className={`chip${rank === i ? ' on' : ''}`}
                onClick={() => {
                  setRank(i)
                  setHp(defaultHp(i, kind))
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
          <p className="muted small">格を選ぶと、初級・中級・上級のHPが入り直します（HPは手で書き換えてもOK）。</p>
          {DIFFICULTIES.map((d) => (
            <label key={d} className="field">
              {CONFIG.quest.difficulties[d].label}（{questGold({ rank, kind }, d)}G）
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={hp[d]}
                onChange={(e) => setHp({ ...hp, [d]: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                aria-label={`${CONFIG.quest.difficulties[d].label}のHP`}
              />
            </label>
          ))}
        </section>
      )}

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
