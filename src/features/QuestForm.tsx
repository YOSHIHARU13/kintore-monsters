import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { collabMates } from '../lib/series'
import { CONFIG } from '../config/gameConfig'
import { DAYS, FORM_ATTRS, FORM_ATTR_LABEL, SLOTS, exerciseOfSlot, type FormAttr } from '../data/exercises'
import { FIRST_NODE_ID } from '../data/evolutionTemplates'
import { QuestBanner } from '../components/QuestBanner'
import { DIFFICULTIES, GRADES, defaultBossHp, defaultHp, gradeOf, questGold, standardSessionDamage } from '../lib/quest'
import { allGimmicks, selectableGimmicks, abilityName, abilitySlots } from '../lib/gimmick'
import { ELEMENTS, ELEMENT_COLOR, ELEMENT_LABEL, advantageElements, elementInfo, ZERO_LABEL } from '../lib/element'
import { abilityTag, elementTag, ownedSupply, requirementsOf, tagLabel, comboTag, tagAbilities } from '../lib/formation'
import { CORE_LABEL } from '../lib/cores'
import { autoQuestSetup, basisRequirements, type Basis } from '../lib/questAuto'
import { ATTR_COLOR, type Go } from '../nav'
import { nodeAttr, type Element, type Quest, type QuestDifficulty, type QuestGrade, type Requirement } from '../types'

/** クエストを作る・編集する。ボス・弱点・HPを決める */
export function QuestForm({ id, go }: { id?: string; go: Go }) {
  const { quests, defs, owned, menu, saveQuest, deleteQuest } = useStore()
  const [stars, setStars] = useState<string[]>([])
  const [basisKind, setBasisKind] = useState<'hero' | 'gimmicks' | 'elements'>('hero')
  const [pickedGimmicks, setPickedGimmicks] = useState<string[]>([])
  const [pickedElements, setPickedElements] = useState<Element[]>([])
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
  const [customGimmicks, setCustomGimmicks] = useState<Record<string, string>>(existing?.customGimmicks ?? {})
  const gimmickNames = { ...allGimmicks(quests), ...customGimmicks }
  const allAbilities = [...new Set([...selectableGimmicks(quests), ...Object.keys(customGimmicks)])]
  // 選んだもと（刺さるキャラ・ギミック・属性）
  const heroDefs = defs.filter((d) => stars.includes(d.id))
  const basis: Basis | null =
    basisKind === 'hero'
      ? heroDefs.length > 0
        ? { kind: 'hero', heroes: heroDefs }
        : null
      : basisKind === 'gimmicks'
        ? pickedGimmicks.length > 0
          ? { kind: 'gimmicks', gimmicks: pickedGimmicks }
          : null
        : pickedElements.length > 0
          ? { kind: 'elements', elements: pickedElements }
          : null
  // 属性から作るときに足す、ほかのクエストであまり使われていないアビリティ
  const elementHolders = defs.filter((d) => !d.questOnly && elementInfo(d).elements.some((e) => pickedElements.includes(e)))
  const leastUsed = allAbilities
    .filter((g) => elementHolders.some((d) => (d.abilities ?? []).slice(0, abilitySlots(d)).includes(g)))
    .map((g) => ({ g, n: quests.filter((q) => q.id !== existing?.id && requirementsOf(q).some((r) => tagAbilities(r.tag).includes(g))).length }))
    .sort((a, b) => a.n - b.n)[0]?.g
  const [kind, setKind] = useState<'boss' | 'material'>(existing?.kind ?? 'boss')
  const [rank, setRank] = useState(existing?.rank ?? 1)
  const [grade, setGrade] = useState<QuestGrade>(existing ? gradeOf(existing) : 'kyukyoku')
  const [bossHp, setBossHp] = useState(existing?.hp.normal ?? defaultBossHp(existing ? gradeOf(existing) : 'kyukyoku'))
  const [hp, setHp] = useState<Record<QuestDifficulty, number>>(existing?.hp ?? defaultHp(existing?.rank ?? 1, existing?.kind))
  const [catchphrase, setCatchphrase] = useState(existing?.catchphrase ?? '')
  const [theme] = useState(existing?.theme ?? 'flame')
  // おまかせ：ボスと格から、編成の条件と弱点種目を自動で決める（手で変えたら止まる）
  const [auto, setAuto] = useState(!existing)
  const [heroId, setHeroId] = useState<string | undefined>()
  const fillAuto = () => {
    const b = defs.find((d) => d.id === bossDefId)
    if (!b) return
    const r = autoQuestSetup(b, grade, kind, quests, selectableGimmicks(quests), existing?.id, defs)
    setRequirements(r.requirements)
    setWeakSlots(r.weakSlots)
    setHeroId(r.heroId)
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
            ? 'ボスを倒すと、そのボスのモンスターが手に入ります（上級ほど＋が付く）。ときどきボスの属性の結晶も落ちます。'
            : `HPはボスクエストの半分くらい。${attr === 'none' ? '筋肉玉' : CORE_LABEL[attr]}が落ちます（数はくじで決まります）。`}
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
              {element ? ELEMENT_LABEL[element] : ZERO_LABEL}
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
          ボスの部位（素材クエストで落ちる核の種類。無なら筋肉玉）
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
          おまかせ：ボスに有利な属性（零属性のボスは属性の種類）と、アビリティの持ち物検査。格が上がるほど数も種類も増えます。コラボのボスは、同じコラボの子が活躍する条件になります。弱点種目はボスの部位から。手で変えるとおまかせは止まります。
        </p>
        {auto && heroId && (
          <p className="small">
            🎯 刺さるキャラ：
            {boss && collabMates(boss, defs).length > 0
              ? `${collabMates(boss, defs).slice(0, 3).map((d) => d.name).join('・')}（同じコラボ）`
              : defs.find((d) => d.id === heroId)?.name}
          </p>
        )}
        <p className="muted small">
          出撃する6体の合計で満たす条件です。ちょうどそろうと編成倍率×1.0（普通にその日のメニューで倒せる）、何もないと×
          {CONFIG.formation.base}、超えた分は1つにつき+{CONFIG.formation.perExtra}。超属性は2、複合属性は両方に1ずつ数えます。
        </p>
        <div className="field basis">
          条件を何から作る？（選ぶと、格に合った数で条件ができます）
          <div className="segmented small-seg" role="tablist" aria-label="条件の作り方">
            {(
              [
                ['hero', '🎯 刺さるキャラ（3体まで）'],
                ['gimmicks', '🧩 スキルを接待'],
                ['elements', '🎨 属性'],
              ] as const
            ).map(([k, label]) => (
              <button key={k} className={basisKind === k ? 'on' : ''} onClick={() => setBasisKind(k)}>
                {label}
              </button>
            ))}
          </div>
          {basisKind === 'hero' && boss && collabMates(boss, defs).length > 0 && (
            <button type="button" className="btn small ghost" onClick={() => setStars(collabMates(boss, defs).slice(0, 3).map((d) => d.id))}>
              🤝 同じコラボの子を選ぶ（{collabMates(boss, defs).slice(0, 3).map((d) => d.name).join('・')}）
            </button>
          )}
          {basisKind === 'hero' && (
            <div className="chips" role="group" aria-label="活躍させたいモンスター">
              {defs
                .filter((d) => !d.questOnly)
                .map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    className={`chip small${stars.includes(d.id) ? ' on' : ''}`}
                    disabled={!stars.includes(d.id) && stars.length >= 3}
                    onClick={() => setStars(stars.includes(d.id) ? stars.filter((x) => x !== d.id) : [...stars, d.id])}
                  >
                    {d.name}
                  </button>
                ))}
            </div>
          )}
          {basisKind === 'gimmicks' && (
            <div className="chips" role="group" aria-label="接待するスキル">
              {allAbilities.map((g) => {
                const on = pickedGimmicks.includes(g)
                return (
                  <button
                    key={g}
                    type="button"
                    className={`chip small${on ? ' on' : ''}`}
                    disabled={!on && pickedGimmicks.length >= 2}
                    onClick={() => setPickedGimmicks(on ? pickedGimmicks.filter((x) => x !== g) : [...pickedGimmicks, g])}
                  >
                    {abilityName(g, gimmickNames)}
                  </button>
                )
              })}
            </div>
          )}
          {basisKind === 'elements' && (
            <div className="chips" role="group" aria-label="求める属性">
              {ELEMENTS.map((e) => {
                const on = pickedElements.includes(e)
                return (
                  <button
                    key={e}
                    type="button"
                    className={`chip small${on ? ' on' : ''}`}
                    style={on ? { borderColor: ELEMENT_COLOR[e], color: ELEMENT_COLOR[e] } : undefined}
                    disabled={!on && pickedElements.length >= 2}
                    onClick={() => setPickedElements(on ? pickedElements.filter((x) => x !== e) : [...pickedElements, e])}
                  >
                    {ELEMENT_LABEL[e]}
                  </button>
                )
              })}
            </div>
          )}
          <button type="button" className="btn small" disabled={!basis} onClick={() => basis && editRequirements(basisRequirements(basis, grade, boss, leastUsed))}>
            {basisKind === 'hero' ? `選んだ${stars.length || ''}体が刺さる条件にする` : basisKind === 'gimmicks' ? 'このスキルの条件にする' : 'この属性の条件にする'}
          </button>
          <span className="muted small">
            ガチャのキャラがまだいなくても、スキルや属性から作っておけます。あとで作ったキャラは、モンスター登録の「🎯 このクエスト用にする」で合わせられます。
          </span>
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
          {[
            ...ELEMENTS.map(elementTag),
            ...allAbilities.map(abilityTag),
            // 2つのアビリティを両方もつ
            ...allAbilities.flatMap((g, i) => allAbilities.slice(i + 1).map((h) => comboTag(g, h))),
          ]
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
        <span className="muted small">新しいスキルを作る（短くて抽象的な名前がおすすめ）</span>
        <span className="row wrap">
          <input value={newGimmick} onChange={(e) => setNewGimmick(e.target.value)} maxLength={8} placeholder="例：ゼニス" aria-label="新しいスキル" />
          <button
            type="button"
            className="btn small"
            disabled={!newGimmick.trim() || requirements.length >= CONFIG.formation.maxRequirements}
            onClick={() => {
              const g = newGimmick.trim()
              if (!(g in gimmickNames)) setCustomGimmicks({ ...customGimmicks, [g]: g })
              if (!requirements.some((r) => r.tag === abilityTag(g))) editRequirements([...requirements, { tag: abilityTag(g), count: 2 }])
              setNewGimmick('')
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
            {CONFIG.quest.grades[grade].label}：報酬 {CONFIG.quest.grades[grade].gold}オーブ・ボス
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
          <p className="muted small">格を選ぶと、初級・上級・究極のHPが入り直します（HPは手で書き換えてもOK）。</p>
          {DIFFICULTIES.map((d) => (
            <label key={d} className="field">
              {CONFIG.quest.difficulties[d].label}（{questGold({ rank, kind }, d)}オーブ）
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
