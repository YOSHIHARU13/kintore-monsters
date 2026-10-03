import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { ATTRS, ATTR_LABEL, type Attr } from '../data/exercises'
import { TEMPLATES, getTemplate } from '../data/evolutionTemplates'
import { evolutionCost } from '../lib/evolution'
import { MonsterImage } from '../components/MonsterImage'
import type { Go } from '../nav'

export function MonsterForm({ id, go }: { id?: string; go: Go }) {
  const { defs, saveMonsterDef } = useStore()
  const existing = id ? defs.find((d) => d.id === id) : undefined
  const [name, setName] = useState(existing?.name ?? '')
  const [attr, setAttr] = useState<Attr>(existing?.attr ?? 'chestArms')
  const [templateId, setTemplateId] = useState(existing?.templateId ?? TEMPLATES[0].id)
  const [names, setNames] = useState<Record<string, string>>(existing?.names ?? {})
  const [files, setFiles] = useState<Record<string, File>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const template = getTemplate(templateId)
  const previews = useMemo(
    () => Object.fromEntries(Object.entries(files).map(([nodeId, file]) => [nodeId, URL.createObjectURL(file)])),
    [files],
  )

  const stages = [...new Set(template.nodes.filter((n) => n.next.length > 0).map((n) => n.stage))]

  const save = async () => {
    if (!name.trim()) {
      setError('名前を入力してください')
      return
    }
    setSaving(true)
    setError(null)
    try {
      // 選んだテンプレに存在しない段階の画像は送らない
      const validFiles = Object.fromEntries(
        Object.entries(files).filter(([nodeId]) => template.nodes.some((n) => n.id === nodeId)),
      )
      const validNames = Object.fromEntries(
        template.nodes.map((n) => [n.id, (names[n.id] ?? '').trim()] as const).filter(([, v]) => v !== ''),
      )
      await saveMonsterDef({
        id: existing?.id,
        name: name.trim(),
        attr,
        templateId,
        names: validNames,
        files: validFiles,
      })
      go({ name: 'dex' })
    } catch (e) {
      console.error(e)
      setError('保存できませんでした。画像を変えてもう一度試してください。')
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <button className="back" onClick={() => go({ name: 'dex' })}>
        ← 図鑑に戻る
      </button>
      <h1 className="title">{existing ? 'モンスターの編集' : 'モンスターの登録'}</h1>

      <section className="card">
        <label className="field">
          <span>名前（段階ごとの名前を付けないときに使われます）</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="なまえ" />
        </label>

        <div className="field">
          <span>属性{existing ? '（変更できません）' : ''}</span>
          <div className="chips">
            {ATTRS.map((a) => (
              <button
                key={a}
                className={`chip${a === attr ? ' on' : ''}`}
                disabled={!!existing}
                onClick={() => setAttr(a)}
              >
                {ATTR_LABEL[a]}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span>進化ツリー{existing ? '（変更できません）' : ''}</span>
          <select value={templateId} disabled={!!existing} onChange={(e) => setTemplateId(e.target.value)}>
            {TEMPLATES.map((t) => (
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
        <h2>各段階の名前と画像</h2>
        <p className="muted small">
          あとからでも追加・変更できます。名前が空の段階は上の名前、画像が未登録の段階はシルエットで表示されます。
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
