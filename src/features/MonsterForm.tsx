import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { ATTRS, DAYS, FORM_ATTRS, FORM_ATTR_LABEL, SLOTS, exerciseOfSlot, type FormAttr } from '../data/exercises'
import { TEMPLATES, canChangeTemplate, getTemplate } from '../data/evolutionTemplates'
import { evolutionCost } from '../lib/evolution'
import { MonsterImage } from '../components/MonsterImage'
import { ATTR_COLOR, type Go } from '../nav'
import { CONFIG } from '../config/gameConfig'
import { isHidden, type Element, type MonsterDef, type RarityKey } from '../types'
import { RARITY_KEYS, formLabel, rarityOf } from '../lib/gacha'
import { abilityName, abilitySlots, allGimmicks } from '../lib/gimmick'
import {
  abilitySupply,
  attrSupply,
  isShort,
  questFits,
  recommend,
  similarDefs,
  slotSupply,
  elementSupply,
  type Supply,
} from '../lib/coverage'
import { ELEMENTS, ELEMENT_COLOR, ELEMENT_LABEL, elementInfo, elementName, jogressElementOf } from '../lib/element'

export function MonsterForm({ id, go }: { id?: string; go: Go }) {
  const { defs, gachas, menu, quests, saveMonsterDef } = useStore()
  const existing = id ? defs.find((d) => d.id === id) : undefined
  // 登録済みのモンスターは、ツリーを変えられないか、分岐を増やす方向にだけ変えられる
  const selectable = TEMPLATES.filter((t) =>
    existing ? canChangeTemplate(existing.templateId, t.id) : !t.retired,
  )
  const [name, setName] = useState(existing?.name ?? '')
  const [templateId, setTemplateId] = useState(existing?.templateId ?? selectable[0].id)
  const [attrs, setAttrs] = useState<Record<string, FormAttr>>(existing?.attrs ?? {})
  const [names, setNames] = useState<Record<string, string>>(existing?.names ?? {})
  const [files, setFiles] = useState<Record<string, File>>({})
  const [birthStars, setBirthStars] = useState(existing?.jogressBirthStars ?? CONFIG.gacha.jogressDefaultBirth)
  const [fixedStars, setFixedStars] = useState(existing?.fixedStars ?? CONFIG.gacha.fixedStarsDefault)
  const [jogressPlus, setJogressPlus] = useState(existing?.jogressPlus ?? CONFIG.fusion.maxPlus)
  const [questOnly, setQuestOnly] = useState(existing?.questOnly === true)
  const [element, setElement] = useState<Element | ''>(existing?.element ?? '')
  const [favoriteSlot, setFavoriteSlot] = useState(existing?.favoriteSlot ?? '')
  const [abilities, setAbilities] = useState<string[]>(existing?.abilities ?? [])
  const [inGachas, setInGachas] = useState<string[]>(existing?.gachas ?? [])
  const [rarity, setRarity] = useState<RarityKey>(existing ? rarityOf(existing) : 'normal')
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
  const maxAbilities = abilitySlots({ recipe, rarity })
  const draftFull: MonsterDef = {
    ...draftDef,
    attrs: Object.fromEntries(template.nodes.map((n) => [n.id, attrOf(n.id)])),
    element: element || undefined,
    favoriteSlot: favoriteSlot || undefined,
    abilities,
    ...(recipe.length === 2
      ? { jogressElements: jogressElementOf(recipe, defs).elements, jogressSuper: jogressElementOf(recipe, defs).super }
      : {}),
  }
  const elSup = elementSupply(defs, quests, existing?.id)
  const attrSup = attrSupply(defs, quests, existing?.id)
  const fits = questFits(draftFull, quests, (g) => abilityName(g, gimmickNames))
  const similar = similarDefs(draftFull, defs)
  const supplyText = (sup: Supply) => `${sup.have}体${sup.need > 0 ? `／ボス${sup.need}` : ''}`
  const applyRecommend = () => {
    const rec = recommend(defs, quests, Object.keys(gimmickNames), maxAbilities, existing?.id)
    if (recipe.length !== 2) setElement(rec.element)
    setFavoriteSlot(rec.favoriteSlot)
    setAbilities(rec.abilities)
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
        favoriteSlot,
        abilities: abilities.slice(0, abilitySlots({ recipe, rarity })),
        questOnly: recipe.length !== 2 && questOnly,
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
      <h1 className="title">{existing ? 'モンスターの編集' : 'モンスターの登録'}</h1>

      <section className="card">
        <label className="field">
          <span>名前（段階ごとの名前を付けないときに使われます）</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="なまえ" />
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
          {stages
            .map((stage) => {
              const cost = evolutionCost(stage)
              return cost ? `${stage}→${stage + 1} ${cost.exp}EXP＋${cost.gold}G` : ''
            })
            .join('／')}
        </p>
      </section>

      <section className="card">
        <h2>各形態の属性・名前・画像</h2>
        <p className="small supply-row">
          部位の内訳（最終形態）：
          {ATTRS.map((a) => (
            <span key={a} className={`supply${isShort(attrSup[a]) ? ' short' : ''}`} style={{ color: ATTR_COLOR[a] }}>
              {FORM_ATTR_LABEL[a]} {supplyText(attrSup[a])}
              {isShort(attrSup[a]) && ' 不足'}
            </span>
          ))}
        </p>
        <p className="muted small">部位は「どの部位のセットで攻撃するか」と「どのEXPで育つか」を決めます。相性は下の属性で決まります。</p>
        <p className="muted small">
          その形態に進化するには、その形態の属性のEXPが必要です。「無」はどの筋トレのEXPでも育ちます。
          {hasBranch && '分岐先を別々の属性にすると、どのEXPを注いだかで進化先が変わります。'}
          あとからでも変更できます。
        </p>
        {template.nodes.map((node) => (
          <div key={node.id} className="image-row">
            {previews[node.id] ? (
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
              <input
                className="stage-name"
                value={names[node.id] ?? ''}
                onChange={(e) => setNames({ ...names, [node.id]: e.target.value })}
                maxLength={20}
                placeholder={name.trim() || 'この段階の名前'}
                aria-label={`${node.label}の名前`}
              />
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
            </div>
          </div>
        ))}
      </section>

      <section className="card">
        <h2>属性・得意種目・アビリティ</h2>
        <button type="button" className="btn small" onClick={applyRecommend}>
          ✨ 足りないもので埋める（属性・得意種目・アビリティ）
        </button>
        {recipe.length === 2 ? (
          <p className="small">
            属性：<strong>{elementName(elementInfo(draftFull))}</strong>
            <span className="muted small">（素材から決まります。同じ属性どうしなら超属性、違えば複合属性）</span>
          </p>
        ) : (
          <div className="field">
            属性（相性：炎→木→水→炎、光⇔闇）　数字は「持っているモンスター／相性◎になるボス」
            <div className="chips" role="group" aria-label="属性">
              <button type="button" className={`chip${element === '' ? ' on' : ''}`} onClick={() => setElement('')}>
                無属性
              </button>
              {ELEMENTS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className={`chip${element === e ? ' on' : ''}${isShort(elSup[e]) ? ' short' : ''}`}
                  style={element === e ? { borderColor: ELEMENT_COLOR[e], color: ELEMENT_COLOR[e] } : undefined}
                  onClick={() => setElement(e)}
                >
                  {ELEMENT_LABEL[e]} <span className="small">{supplyText(elSup[e])}</span>
                  {isShort(elSup[e]) && <span className="short-badge">不足</span>}
                </button>
              ))}
            </div>
          </div>
        )}
        <label className="field">
          得意種目（この種目の相棒にすると、EXPがさらに ×{CONFIG.partner.favorite}）
          <select value={favoriteSlot} onChange={(e) => setFavoriteSlot(e.target.value)}>
            <option value="">なし</option>
            {SLOTS.map((slot) => (
              <option key={slot.id} value={slot.id}>
                {slot.day === 'bonus' ? 'ボーナス：' : `${DAYS[slot.day].title}：`}
                {exerciseOfSlot(slot, menu).name}（{supplyText(slotSupply(slot.id, defs, quests, existing?.id))}）
                {isShort(slotSupply(slot.id, defs, quests, existing?.id)) ? ' 不足' : ''}
              </option>
            ))}
          </select>
        </label>
        <div className="field">
          アビリティ（{maxAbilities}個まで・レア度で決まる）　数字は「持っているモンスター／そのギミックのボス」
          <div className="chips" role="group" aria-label="アビリティ">
            {Object.keys(gimmickNames).map((g) => {
              const on = abilities.includes(g)
              const sup = abilitySupply(g, defs, quests, existing?.id)
              return (
                <button
                  key={g}
                  type="button"
                  className={`chip${on ? ' on' : ''}${isShort(sup) ? ' short' : ''}`}
                  disabled={!on && abilities.length >= maxAbilities}
                  onClick={() => setAbilities(on ? abilities.filter((x) => x !== g) : [...abilities, g])}
                >
                  {abilityName(g, gimmickNames)} <span className="small">{supplyText(sup)}</span>
                  {isShort(sup) && <span className="short-badge">不足</span>}
                </button>
              )
            })}
          </div>
          <span className="muted small">
            クエストのボスのギミック（例：バリア）に対応するアビリティ（バリアブレイカー）がないと、ギミック1つにつき攻撃が
            {Math.round(CONFIG.gimmicks.penaltyPerGimmick * 100)}%減ります。
          </span>
        </div>
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
                どれも選ばなければ「{gachas[0].name}」に入ります。ガチャはショップで作れます。
              </p>
            </>
          )}
        </section>
      )}

      <section className="card">
        <h2>隠しモンスター（ジョグレス）</h2>
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
          素材に激レアが入ると、アビリティが1つ増えて、攻撃力も上がります（激レア1体につき +
          {CONFIG.jogress.superRareBonus.toLocaleString()}）。
        </p>
        {recipe.length === 2 && (
          <>
            <div className="field">
              生まれるときの星（素材はどちらも★{birthStars - 1}以上が必要）
              <div className="chips" role="group" aria-label="生まれるときの星">
                {CONFIG.gacha.jogressBirthChoices.map((n) => (
                  <button key={n} type="button" className={`chip${birthStars === n ? ' on' : ''}`} onClick={() => setBirthStars(n)}>
                    ★{n}
                  </button>
                ))}
              </div>
              <span className="muted small">
                例：★2どうしで★3誕生 → ★4に進化。★3の＋5どうしで★4誕生、なども作れます。★4が最上位です。
              </span>
            </div>
            <div className="field">
              素材に必要な＋（＋1以上にすると、素材は最終形態まで育てる必要があります）
              <div className="chips" role="group" aria-label="素材に必要な＋">
                {Array.from({ length: CONFIG.fusion.maxPlus + 1 }, (_, n) => (
                  <button key={n} type="button" className={`chip${jogressPlus === n ? ' on' : ''}`} onClick={() => setJogressPlus(n)}>
                    ＋{n}
                  </button>
                ))}
              </div>
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
                      {reasons.filter((r) => r !== '相性×' && !r.endsWith('で弱体')).join('・')}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </section>
      )}
      {similar.length > 0 && (
        <p className="warn small">
          ⚠️ {similar.map((d) => d.name).join('・')} と同じ構成です（属性・得意種目・アビリティが全部同じ）。
        </p>
      )}

      {error && <p className="error">{error}</p>}
      <button className="btn primary wide" disabled={saving} onClick={save}>
        {saving ? '保存中…' : '保存する'}
      </button>
    </div>
  )
}
