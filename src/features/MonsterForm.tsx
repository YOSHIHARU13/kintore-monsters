import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { FORM_ATTRS, FORM_ATTR_LABEL, type FormAttr } from '../data/exercises'
import { TEMPLATES, canChangeTemplate, getTemplate } from '../data/evolutionTemplates'
import { evolutionCost } from '../lib/evolution'
import { MonsterImage } from '../components/MonsterImage'
import { ATTR_COLOR, type Go } from '../nav'
import { CONFIG } from '../config/gameConfig'
import { isHidden } from '../types'

export function MonsterForm({ id, go }: { id?: string; go: Go }) {
  const { defs, gachas, saveMonsterDef } = useStore()
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
  const [inGachas, setInGachas] = useState<string[]>(existing?.gachas ?? [])
  const [common, setCommon] = useState(existing?.common === true)
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

  const stages = [...new Set(template.nodes.filter((n) => n.next.length > 0).map((n) => n.stage))]
  const hasBranch = template.nodes.some((n) => n.next.length > 1)

  const save = async () => {
    if (!name.trim()) {
      setError('名前を入力してください')
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
        common,
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
              <strong>{node.label}</strong>
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

      {recipe.length !== 2 && (
        <section className="card">
          <h2>入るガチャ（{CONFIG.gacha.maxPerMonster}つまで）</h2>
          <label className="row">
            <input type="checkbox" checked={common} onChange={(e) => setCommon(e.target.checked)} />
            ハズレ枠にする（どのガチャからも出る）
          </label>
          {!common && (
            <>
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
                どれも選ばなければ「{gachas[0].name}」に入ります。ガチャはショップで作れます。レア度はガチャの編集画面で決めます。
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
          隠しモンスターはタマゴからは生まれません。レシピの2体をどちらも最終形態の＋{CONFIG.fusion.maxPlus}
          まで育ててジョグレスさせると生まれます（{CONFIG.jogress.gold}G、2体はいなくなります）。同じモンスター2体でもOK。
        </p>
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

      {error && <p className="error">{error}</p>}
      <button className="btn primary wide" disabled={saving} onClick={save}>
        {saving ? '保存中…' : '保存する'}
      </button>
    </div>
  )
}
