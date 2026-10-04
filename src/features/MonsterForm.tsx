import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { FORM_ATTRS, FORM_ATTR_LABEL, type FormAttr } from '../data/exercises'
import { TEMPLATES, canChangeTemplate, getTemplate } from '../data/evolutionTemplates'
import { evolutionCost } from '../lib/evolution'
import { MonsterImage } from '../components/MonsterImage'
import { ATTR_COLOR, type Go } from '../nav'

export function MonsterForm({ id, go }: { id?: string; go: Go }) {
  const { defs, saveMonsterDef } = useStore()
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

      {error && <p className="error">{error}</p>}
      <button className="btn primary wide" disabled={saving} onClick={save}>
        {saving ? '保存中…' : '保存する'}
      </button>
    </div>
  )
}
