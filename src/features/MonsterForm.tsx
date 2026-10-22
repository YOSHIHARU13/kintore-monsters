import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import { allSeries } from '../lib/series'
import { ATTRS, DAYS, FORM_ATTRS, FORM_ATTR_LABEL, SLOTS, exerciseOfSlot, type FormAttr } from '../data/exercises'
import { FIRST_NODE_ID, TEMPLATES, canChangeTemplate, getTemplate } from '../data/evolutionTemplates'
import { nextCost } from '../lib/evolution'
import { MonsterImage } from '../components/MonsterImage'
import { ATTR_COLOR, type Go } from '../nav'
import { CONFIG } from '../config/gameConfig'
import { isHidden, type Element, type MonsterDef, type RarityKey } from '../types'
import { RARITY_KEYS, formLabel, rarityOf } from '../lib/gacha'
import { abilityName, abilitySlots, allGimmicks, selectableGimmicks } from '../lib/gimmick'
import {
  abilitySupply,
  attrSupply,
  isShort,
  questFits,
  recommend,
  similarDefs,
  slotSupply,
  elementSupply,
  finalAttrs,
  type Supply,
} from '../lib/coverage'
import { ELEMENTS, ELEMENT_COLOR, ELEMENT_LABEL, elementInfo, elementName, jogressElementOf } from '../lib/element'
import { requirementsOf } from '../lib/formation'

export function MonsterForm({ id, preset, go }: { id?: string; preset?: 'gacha' | 'quest'; go: Go }) {
  // 降臨用：クエスト限定・1形態だけ・★3・激レアで始める（名前と画像だけで登録できる）
  const questPreset = !id && preset === 'quest'
  const { defs, gachas, menu, quests, saveMonsterDef } = useStore()
  const existing = id ? defs.find((d) => d.id === id) : undefined
  // 登録済みのモンスターは、ツリーを変えられないか、分岐を増やす方向にだけ変えられる
  const selectable = TEMPLATES.filter((t) =>
    existing ? canChangeTemplate(existing.templateId, t.id) : !t.retired,
  )
  const [name, setName] = useState(existing?.name ?? '')
  const [series, setSeries] = useState(existing?.series ?? '')
  const [templateId, setTemplateId] = useState(existing?.templateId ?? (questPreset ? 'single' : selectable[0].id))
  const [attrs, setAttrs] = useState<Record<string, FormAttr>>(existing?.attrs ?? {})
  const [names, setNames] = useState<Record<string, string>>(existing?.names ?? {})
  const [files, setFiles] = useState<Record<string, File>>({})
  const [birthStars, setBirthStars] = useState(existing?.jogressBirthStars ?? CONFIG.gacha.jogressDefaultBirth)
  const [fixedStars, setFixedStars] = useState(existing?.fixedStars ?? CONFIG.gacha.fixedStarsDefault)
  const [jogressPlus] = useState(existing?.jogressPlus ?? 0)
  const [questOnly, setQuestOnly] = useState(existing?.questOnly === true || questPreset)
  const [tower, setTower] = useState(existing?.tower === true)
  const [element, setElement] = useState<Element | ''>(existing?.element ?? '')
  const [favoriteSlot, setFavoriteSlot] = useState(existing?.favoriteSlot ?? '')
  const [abilities, setAbilities] = useState<string[]>(existing?.abilities ?? [])
  const [inGachas, setInGachas] = useState<string[]>(existing?.gachas ?? [])
  const [rarity, setRarity] = useState<RarityKey>(existing ? rarityOf(existing) : questPreset ? 'superRare' : 'normal')
  const [recipe, setRecipe] = useState<string[]>(existing?.recipe?.length === 2 ? existing.recipe : [])
  // レシピに使えるのは、タマゴから生まれる普通のモンスター（自分以外）
  const parents = defs.filter((d) => d.id !== existing?.id && !isHidden(d))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const template = getTemplate(templateId)
  const attrOf = (nodeId: string): FormAttr => attrs[nodeId] ?? existing?.attr ?? 'chestArms'
  const previews = useMemo(
    () => Object.fromEntries(Object.entries(files).map(([nodeId, file]) => [nodeId, URL.createObjectURL(file)])),
    [files],
  )

  // 星の表示用：いま選んでいるレア度・ツリー・ジョグレスの設定で数える
  const draftDef = {
    id: existing?.id ?? 'new',
    name,
    attr: attrOf('n1'),
    templateId,
    images: {},
    rarity,
    recipe,
    jogressBirthStars: birthStars,
    fixedStars,
    createdAt: 0,
  }
  // 被りや不足を見るための集計（自分以外のモンスターと、作ってあるクエストから）
  const gimmickNames = allGimmicks(quests)
  const maxAbilities = abilitySlots({ recipe, rarity, questOnly })
  const draftFull: MonsterDef = {
    ...draftDef,
    attrs: Object.fromEntries(template.nodes.map((n) => [n.id, attrOf(n.id)])),
    element: element || undefined,
    favoriteSlot: favoriteSlot || undefined,
    abilities: abilities.slice(0, abilitySlots({ recipe, rarity, questOnly })),
    ...(recipe.length === 2
      ? { jogressElements: jogressElementOf(recipe, defs).elements, jogressSuper: jogressElementOf(recipe, defs).super }
      : {}),
  }
  const elSup = elementSupply(defs, quests, existing?.id)
  // 得意種目は、このモンスターの部位（最終形態）の種目とローラーから選ぶ。部位が「無」なら全部から
  const parts = finalAttrs(draftFull)
  const favoriteChoices = SLOTS.filter(
    (slot) => slot.day === 'bonus' || parts.includes('none') || parts.includes(DAYS[slot.day].attr),
  )
  const validFavorite = favoriteChoices.some((slot) => slot.id === favoriteSlot) ? favoriteSlot : ''
  const attrSup = attrSupply(defs, quests, existing?.id)
  const fits = questFits(draftFull, quests, gimmickNames)
  const similar = similarDefs(draftFull, defs)
  const supplyText = (sup: Supply) => `${sup.have}体${sup.need > 0 ? `／クエスト${sup.need}` : ''}`
  const applyRecommend = () => {
    const rec = recommend(
      defs,
      quests,
      selectableGimmicks(quests),
      maxAbilities,
      existing?.id,
      favoriteChoices.map((s) => s.id),
      element || undefined, // 属性が決まっていれば、その属性のまま考える（属性は変えない）
    )
    if (recipe.length !== 2 && !element) setElement(rec.element)
    setFavoriteSlot(rec.favoriteSlot)
    setAbilities(rec.abilities)
  }

  // 新しく登録するときは、足りないものを自動で選んでおく（自分で選んだら止める）
  const [auto, setAuto] = useState(!existing)
  const favoriteKey = favoriteChoices.map((s) => s.id).join()
  useEffect(() => {
    if (auto) applyRecommend()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, maxAbilities, favoriteKey, recipe.length, defs.length, quests.length])

  // 選んだクエストの条件に合わせる：属性はその条件の中でいちばん足りていないもの、アビリティは条件にあるもの
  const applyQuest = (questId: string) => {
    const quest = quests.find((q) => q.id === questId)
    if (!quest) return
    setAuto(false)
    const reqs = requirementsOf(quest)
    const elementReqs = reqs.filter((r) => r.tag.startsWith('el:'))
    if (recipe.length !== 2 && elementReqs.length > 0) {
      const gap = (tag: string) => {
        const sup = elSup[tag.slice(3) as Element]
        return (elementReqs.find((r) => r.tag === tag)?.count ?? 0) - sup.have
      }
      const best = [...elementReqs].sort((a, b) => gap(b.tag) - gap(a.tag))[0]
      setElement(best.tag.slice(3) as Element)
    }
    const abilityReqs = reqs.filter((r) => r.tag.startsWith('ab:')).map((r) => r.tag.slice(3))
    if (abilityReqs.length > 0) setAbilities(abilityReqs.slice(0, maxAbilities))
    // 弱点種目のうち、このモンスターの部位で選べるもの
    const weak = quest.weakSlots.find((w) => favoriteChoices.some((slot) => slot.id === w))
    if (weak) setFavoriteSlot(weak)
  }

  const stages = [...new Set(template.nodes.filter((n) => n.next.length > 0).map((n) => n.stage))]
  const hasBranch = template.nodes.some((n) => n.next.length > 1)

  const save = async () => {
    if (!name.trim()) {
      setError('名前を入力してください')
      return
    }
    if (templateId === 'single' && recipe.length !== 2 && !questOnly) {
      setError('「1形態だけ」は、隠しモンスター（ジョグレス）か、クエスト限定のモンスター専用です。下でどちらかをオンにしてください')
      return
    }
    if (recipe.length === 2 && recipe.some((r) => !parents.some((p) => p.id === r))) {
      setError('レシピのモンスターを2体選んでください')
      return
    }
    setSaving(true)
    setError(null)
    try {
      // 選んだテンプレに存在する段階の分だけを保存する
      const validFiles = Object.fromEntries(
        Object.entries(files).filter(([nodeId]) => template.nodes.some((n) => n.id === nodeId)),
      )
      const validNames = Object.fromEntries(
        template.nodes.map((n) => [n.id, (names[n.id] ?? '').trim()] as const).filter(([, v]) => v !== ''),
      )
      const validAttrs = Object.fromEntries(template.nodes.map((n) => [n.id, attrOf(n.id)] as const))
      await saveMonsterDef({
        id: existing?.id,
        name: name.trim(),
        templateId,
        attrs: validAttrs,
        names: validNames,
        files: validFiles,
        recipe,
        // 消したガチャのIDは残さない
        gachas: inGachas.filter((g) => gachas.some((x) => x.id === g && !x.builtin)),
        rarity,
        element,
        favoriteSlot: validFavorite,
        series,
        abilities: abilities.slice(0, abilitySlots({ recipe, rarity, questOnly })),
        questOnly: recipe.length !== 2 && questOnly,
        tower: recipe.length !== 2 && questOnly && tower,
        jogressBirthStars: birthStars,
        jogressPlus,
        fixedStars,
      })
      go({ name: 'registry' })
    } catch (e) {
      console.error(e)
      setError('保存できませんでした。画像を変えてもう一度試してください。')
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <button className="back" onClick={() => go({ name: 'registry' })}>
        ← 登録一覧に戻る
      </button>
      <h1 className="title">{existing ? 'モンスターの編集' : questPreset ? '降臨モンスターの登録' : 'モンスターの登録'}</h1>
      {questPreset && (
        <p className="muted small">
          クエスト限定・1形態だけ・★{CONFIG.gacha.fixedStarsDefault}・激レアで始めます。属性やアビリティはおまかせで埋まるので、名前と画像だけで登録できます。
        </p>
      )}

      <section className="card">
        <label className="field">
          <span>名前（段階ごとの名前を付けないときに使われます）</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="なまえ" />
        </label>
        <label className="field">
          <span>シリーズ（コラボ名・省略可。クエスト・BOX・図鑑をシリーズごとに分けて見られる）</span>
          <input value={series} onChange={(e) => setSeries(e.target.value)} maxLength={16} placeholder="空なら通常" list="series-list" />
          <datalist id="series-list">
            {allSeries(defs).map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>

        <label className="field">
          <span>
            進化ツリー
            {!existing ? '' : selectable.length > 1 ? '（分岐を3種に増やせます。増やすと戻せません）' : '（変更できません）'}
          </span>
          <select
            value={templateId}
            disabled={selectable.length <= 1}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            {selectable.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}：{t.description}
              </option>
            ))}
          </select>
        </label>

        <p className="muted small">
          進化コスト（自動）：
          {stages.length === 0 && '進化しません'}
          {[...new Map(template.nodes.filter((n) => n.next.length > 0).map((n) => [n.stage, n])).values()]
            .map((n) => {
              const cost = nextCost(template, n)
              const to = template.nodes.find((x) => x.id === n.next[0])!.stage
              return cost
                ? `★${n.stage}→★${to} ${cost.exp}EXP＋${cost.gold}G${cost.cores ? `＋核${cost.cores}` : ''}`
                : ''
            })
            .join('／')}
        </p>
      </section>

      <section className="card">
        <h2>各形態の画像と部位</h2>
        <p className="small supply-row">
          部位の内訳（最終形態）：
          {ATTRS.map((a) => (
            <span key={a} className={`supply${isShort(attrSup[a]) ? ' short' : ''}`} style={{ color: ATTR_COLOR[a] }}>
              {FORM_ATTR_LABEL[a]} {supplyText(attrSup[a])}
              {isShort(attrSup[a]) && ' 不足'}
            </span>
          ))}
        </p>
        <details className="muted small">
          <summary>部位について</summary>
          部位は「どのEXPで育つか」と「どの部位のセットで強く攻撃するか（一致で×2）」を決めます。「無」はどの筋トレのEXPでも育ちます。
          {hasBranch && '分岐先を別々の部位にすると、どのEXPを注いだかで進化先が変わります。'}
          クエストの編成の条件になるのは、属性とアビリティです。
        </details>
        {template.nodes.map((node) => (
          <div key={node.id} className="image-row">
            {template.awaken && node.id !== FIRST_NODE_ID ? (
              previews[FIRST_NODE_ID] ? (
                <div className={`awaken awaken-${Math.min(2, node.stage - 1)}`}>
                  <img className="monster-img" style={{ width: 80, height: 80 }} src={previews[FIRST_NODE_ID]} alt="" />
                </div>
              ) : (
                <MonsterImage imageId={existing?.images[FIRST_NODE_ID]} awaken={node.stage - 1} size={80} />
              )
            ) : previews[node.id] ? (
              <img className="monster-img" style={{ width: 80, height: 80 }} src={previews[node.id]} alt="" />
            ) : (
              <MonsterImage imageId={existing?.images[node.id]} size={80} />
            )}
            <div>
              <strong>{formLabel(draftDef, node.id)}</strong>
              <div className="chips" role="group" aria-label={`${node.label}の属性`}>
                {FORM_ATTRS.map((a) => {
                  const on = a === attrOf(node.id)
                  return (
                    <button
                      key={a}
                      type="button"
                      className={`chip${on ? ' on' : ''}`}
                      style={on ? { borderColor: ATTR_COLOR[a], color: ATTR_COLOR[a] } : undefined}
                      onClick={() => setAttrs({ ...attrs, [node.id]: a })}
                    >
                      {FORM_ATTR_LABEL[a]}
                    </button>
                  )
                })}
              </div>
              <details className="stage-name-fold" open={!!names[node.id]}>
                <summary className="muted small">この形態だけ名前を変える</summary>
                <input
                  className="stage-name"
                  value={names[node.id] ?? ''}
                  onChange={(e) => setNames({ ...names, [node.id]: e.target.value })}
                  maxLength={20}
                  placeholder={name.trim() || 'この段階の名前'}
                  aria-label={`${node.label}の名前`}
                />
              </details>
              {template.awaken && node.id !== FIRST_NODE_ID ? (
                <span className="muted small">絵は第1段階と同じ（覚醒して光る）</span>
              ) : (
              <label className="btn small file-btn">
                画像を選ぶ
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) setFiles({ ...files, [node.id]: file })
                  }}
                />
              </label>
              )}
            </div>
          </div>
        ))}
      </section>

      {recipe.length !== 2 && (
        <section className="card">
          <h2>レア度とガチャ</h2>
          <div className="chips" role="group" aria-label="レア度">
            {RARITY_KEYS.map((r) => (
              <button
                key={r}
                type="button"
                className={`chip rarity-${r}${rarity === r ? ' on' : ''}`}
                onClick={() => setRarity(r)}
              >
                {CONFIG.gacha.rarities[r].label}
              </button>
            ))}
          </div>
          <p className="muted small">{CONFIG.gacha.rarities[rarity].hint}</p>
          <label className="row">
            <input type="checkbox" checked={questOnly} onChange={(e) => setQuestOnly(e.target.checked)} />
            クエスト限定にする（ガチャには出ず、クエストのボスとして倒すと手に入る）
          </label>
          {questOnly && (
            <label className="row">
              <input type="checkbox" checked={tower} onChange={(e) => setTower(e.target.checked)} />
              🗼 試練の塔の報酬にする（5階・10階で、月替わりに順番にもらえる）
            </label>
          )}
          {questOnly && templateId === 'single' && (
            <div className="field">
              進化しないので、星を決めます
              <div className="chips" role="group" aria-label="進化しないモンスターの星">
                {CONFIG.gacha.fixedStarsChoices.map((n) => (
                  <button key={n} type="button" className={`chip${fixedStars === n ? ' on' : ''}`} onClick={() => setFixedStars(n)}>
                    ★{n}
                  </button>
                ))}
              </div>
            </div>
          )}
          {questOnly && templateId !== 'single' && (
            <p className="muted small">進化しない降臨モンスターにしたいときは、上の進化ツリーで「1形態だけ」を選んでください。</p>
          )}
          {!questOnly && !CONFIG.gacha.rarities[rarity].everyGacha && (
            <>
              <h3 className="small">入るガチャ（{CONFIG.gacha.maxPerMonster}つまで）</h3>
              <div className="chips">
                {gachas
                  .filter((g) => !g.builtin)
                  .map((g) => {
                    const on = inGachas.includes(g.id)
                    return (
                      <button
                        key={g.id}
                        type="button"
                        className={`chip${on ? ' on' : ''}`}
                        disabled={!on && inGachas.length >= CONFIG.gacha.maxPerMonster}
                        onClick={() => setInGachas(on ? inGachas.filter((x) => x !== g.id) : [...inGachas, g.id])}
                      >
                        {g.name}
                      </button>
                    )
                  })}
              </div>
              <p className="muted small">
                激レアは、選んだガチャのピックアップとして出ます。どれも選ばなければガチャには出ません。ガチャはショップで作れます。
              </p>
            </>
          )}
        </section>
      )}

      <section className="card">
        <h2>属性</h2>
        {auto && (
          <p className="small bonus-reward">
            ✨ おまかせ中：足りない属性・得意種目・アビリティを自動で選んでいます（自分で選ぶと止まります）
          </p>
        )}
        {recipe.length === 2 ? (
          <p className="small">
            属性：<strong>{elementName(elementInfo(draftFull))}</strong>
            <span className="muted small">（素材から決まります。同じ属性どうしなら超属性、違えば複合属性）</span>
          </p>
        ) : (
          <div className="field">
            属性　数字は「持っているモンスター／その属性を求めるクエスト」
            <div className="chips" role="group" aria-label="属性">
              <button type="button" className={`chip${element === '' ? ' on' : ''}`} onClick={() => {
                  setAuto(false)
                  setElement('')
                }}>
                無属性
              </button>
              {ELEMENTS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className={`chip${element === e ? ' on' : ''}${isShort(elSup[e]) ? ' short' : ''}`}
                  style={element === e ? { borderColor: ELEMENT_COLOR[e], color: ELEMENT_COLOR[e] } : undefined}
                  onClick={() => {
                    setAuto(false)
                    setElement(e)
                  }}
                >
                  {ELEMENT_LABEL[e]} <span className="small">{supplyText(elSup[e])}</span>
                  {isShort(elSup[e]) && <span className="short-badge">不足</span>}
                </button>
              ))}
            </div>
          </div>
        )}
        <details className="tuning" open={!!existing && (!!existing.favoriteSlot || (existing.abilities ?? []).length > 0)}>
          <summary>こだわり設定（あとからでOK）：得意種目・アビリティ</summary>
          <button type="button" className="btn small" onClick={applyRecommend}>
            ✨ 足りないもので埋める（得意種目・アビリティ。属性は空のときだけ）
          </button>
          {quests.some((q) => q.kind !== 'material') && (
            <label className="field">
              🎯 このクエスト用にする（そのクエストの条件に合わせて、属性・アビリティ・得意種目を選びます）
              <select value="" onChange={(e) => applyQuest(e.target.value)}>
                <option value="">クエストを選ぶ…</option>
                {quests
                  .filter((q) => q.kind !== 'material')
                  .map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
        <label className="field">
          得意種目（このモンスターの部位の種目から。相棒にするとEXPがさらに ×{CONFIG.partner.favorite}）
          <select
            value={validFavorite}
            onChange={(e) => {
              setAuto(false)
              setFavoriteSlot(e.target.value)
            }}
          >
            <option value="">なし</option>
            {favoriteChoices.map((slot) => (
              <option key={slot.id} value={slot.id}>
                {slot.day === 'bonus' ? 'ボーナス：' : `${DAYS[slot.day].title}：`}
                {exerciseOfSlot(slot, menu).name}（{supplyText(slotSupply(slot.id, defs, quests, existing?.id))}）
                {isShort(slotSupply(slot.id, defs, quests, existing?.id)) ? ' 不足' : ''}
              </option>
            ))}
          </select>
        </label>
        <div className="field">
          アビリティ（{maxAbilities}個まで）　数字は「持っているモンスター／それを求めるクエスト」
          <div className="chips" role="group" aria-label="アビリティ">
            {maxAbilities === 0 && <span className="muted small">このレア度ではアビリティを持てません。</span>}
            {maxAbilities > 0 && selectableGimmicks(quests).map((g) => {
              const on = abilities.includes(g)
              const sup = abilitySupply(g, defs, quests, existing?.id)
              return (
                <button
                  key={g}
                  type="button"
                  className={`chip${on ? ' on' : ''}${isShort(sup) ? ' short' : ''}`}
                  disabled={!on && abilities.length >= maxAbilities}
                  onClick={() => {
                    setAuto(false)
                    setAbilities(on ? abilities.filter((x) => x !== g) : [...abilities, g])
                  }}
                >
                  {abilityName(g, gimmickNames)} <span className="small">{supplyText(sup)}</span>
                  {isShort(sup) && <span className="short-badge">不足</span>}
                </button>
              )
            })}
          </div>
          <span className="muted small">
            クエストの「求められる編成」の条件になります。持てる数はレア度で決まります（ハズレ{CONFIG.gimmicks.slots.hazure}・ノーマル{CONFIG.gimmicks.slots.normal}、激レア
            {CONFIG.gimmicks.slots.superRare}、ジョグレス{CONFIG.gimmicks.slots.jogress}。降臨は激レアでも{CONFIG.gimmicks.questOnlyMax}）。
          </span>
        </div>
        </details>
      </section>



      {quests.length > 0 && (
        <section className="card">
          <h2>このモンスターが刺さるクエスト</h2>
          {fits.filter((f) => f.grade === '◎').length === 0 ? (
            <p className="muted small">今の設定だと、特に刺さるクエストはまだありません。</p>
          ) : (
            <ul className="mini-list">
              {fits
                .filter((f) => f.grade === '◎')
                .map(({ quest, reasons }) => (
                  <li key={quest.id}>
                    <span>
                      <strong className="fit fit-good">◎</strong> {quest.name}
                    </span>
                    <span className="muted small">
                      {reasons.join('・')}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </section>
      )}
      <details className="card fold" open={recipe.length === 2}>
        <summary>
          <h2>隠しモンスター（ジョグレス）</h2>
        </summary>
        <label className="row">
          <input
            type="checkbox"
            checked={recipe.length === 2}
            disabled={parents.length === 0}
            onChange={(e) => setRecipe(e.target.checked ? [parents[0].id, parents[0].id] : [])}
          />
          隠しモンスターにする
        </label>
        <p className="muted small">
          隠しモンスターはタマゴからは生まれません。レシピの2体がどちらも条件を満たしたら、ジョグレスで生まれます（
          {CONFIG.jogress.gold}G＋無垢の核×{CONFIG.jogress.cores}、2体はいなくなります）。同じモンスター2体でもOK。
          素材に激レアが入ると、攻撃力が上がります（激レア1体につき +
          {CONFIG.jogress.superRareBonus.toLocaleString()}）。
        </p>
        {recipe.length === 2 && (
          <>
            <div className="field">
              生まれるときの星（素材はどちらも最終形態で★{birthStars - 1}以上）
              <div className="chips" role="group" aria-label="生まれるときの星">
                {CONFIG.gacha.jogressBirthChoices.map((n) => (
                  <button key={n} type="button" className={`chip${birthStars === n ? ' on' : ''}`} onClick={() => setBirthStars(n)}>
                    ★{n}
                  </button>
                ))}
              </div>
              <span className="muted small">
                例：★3どうしで★4誕生。★4が最上位です。
              </span>
            </div>
          </>
        )}
        {recipe.length === 2 &&
          [0, 1].map((i) => (
            <label key={i} className="field">
              レシピ{i + 1}体目
              <select
                value={recipe[i]}
                onChange={(e) => setRecipe(recipe.map((r, j) => (j === i ? e.target.value : r)))}
              >
                {parents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
      </details>

      {similar.length > 0 && (
        <p className="warn small">
          ⚠️ {similar.map((d) => d.name).join('・')} と同じ構成です（属性・得意種目・アビリティが全部同じ）。
        </p>
      )}

      {error && <p className="error">{error}</p>}
      <div className="save-bar">
        <button className="btn primary wide" disabled={saving} onClick={save}>
          {saving ? '保存中…' : '保存する'}
        </button>
      </div>
    </div>
  )
}
