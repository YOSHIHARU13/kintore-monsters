import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { CONFIG } from '../config/gameConfig'
import { FIRST_NODE_ID } from '../data/evolutionTemplates'
import { MonsterImage } from '../components/MonsterImage'
import { GachaBanner } from '../components/GachaBanner'
import { percent, rateTable } from '../lib/gacha'
import type { Go } from '../nav'
import { monsterName, type Gacha, type RarityKey } from '../types'

const RARITY_KEYS = Object.keys(CONFIG.gacha.rarities) as RarityKey[]

export function GachaForm({ id, go }: { id?: string; go: Go }) {
  const { gachas, defs, saveGacha, deleteGacha } = useStore()
  const existing = id ? gachas.find((g) => g.id === id) : undefined
  const [name, setName] = useState(existing?.name ?? '')
  const [shinyRate, setShinyRate] = useState(existing?.shinyRate ?? CONFIG.shop.shinyRate)
  const [rarity, setRarity] = useState<Record<string, RarityKey>>(existing?.rarity ?? {})
  const [banner, setBanner] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const preview = useMemo(() => (banner ? URL.createObjectURL(banner) : undefined), [banner])
  // 編集中の内容で確率を計算し直す
  const draft: Gacha = {
    id: existing?.id ?? 'new',
    name: name.trim() || '名前のないガチャ',
    bannerImageId: existing?.bannerImageId ?? null,
    shinyRate,
    rarity,
    createdAt: existing?.createdAt ?? 0,
    builtin: existing?.builtin ?? false,
  }
  const table = existing ? rateTable(draft, defs) : []

  const save = async () => {
    if (!name.trim()) {
      setError('ガチャの名前を入力してください')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const savedId = await saveGacha({ id: existing?.id, name, shinyRate, rarity, banner: banner ?? undefined })
      go(existing ? { name: 'shop' } : { name: 'gachaForm', id: savedId })
    } catch (e) {
      console.error(e)
      setError('保存できませんでした。画像を変えてもう一度試してください。')
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <button className="back" onClick={() => go({ name: 'shop' })}>
        ← ショップに戻る
      </button>
      <h1 className="title">{existing ? 'ガチャの編集' : 'ガチャを作る'}</h1>

      <section className="card">
        <GachaBanner gacha={draft} count={table.length} preview={preview} />
        <label className="field">
          ガチャの名前
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="例：脚ムキムキ祭り" />
        </label>
        <label className="btn small file-btn">
          バナー画像を選ぶ（横長がおすすめ）
          <input type="file" accept="image/*" onChange={(e) => setBanner(e.target.files?.[0] ?? null)} />
        </label>
        <div className="field">
          ✨色違いの確率
          <div className="chips">
            {CONFIG.gacha.shinyRateChoices.map((r) => (
              <button
                key={r}
                type="button"
                className={`chip${Math.abs(r - shinyRate) < 1e-9 ? ' on' : ''}`}
                onClick={() => setShinyRate(r)}
              >
                1/{Math.round(1 / r)}
              </button>
            ))}
          </div>
        </div>
      </section>

      {existing && (
        <section className="card">
          <h2>中身とレア度（全{table.length}種）</h2>
          <p className="muted small">
            モンスターをこのガチャに入れる・外すのは、図鑑の登録画面で選びます（1体につき{CONFIG.gacha.maxPerMonster}
            つまで）。レア度ごとの出やすさは ノーマル{CONFIG.gacha.rarities.normal.weight}：レア
            {CONFIG.gacha.rarities.rare.weight}：激レア{CONFIG.gacha.rarities.superRare.weight}。ハズレ枠はどのガチャからも出ます。
          </p>
          {table.length === 0 && <p className="warn small">まだモンスターが入っていません。</p>}
          <ul className="choice-list">
            {table.map(({ def, rarity: r, rate }) => (
              <li key={def.id} className="rarity-row">
                <span className="monster-row">
                  <MonsterImage imageId={def.images[FIRST_NODE_ID]} size={40} />
                  <span>
                    {monsterName(def, FIRST_NODE_ID)}
                    {def.common && <span className="muted small">（ハズレ枠）</span>}
                    <br />
                    <span className="muted small">{percent(rate)}</span>
                  </span>
                </span>
                <span className="chips">
                  {RARITY_KEYS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      className={`chip small${r === k ? ' on' : ''}`}
                      onClick={() => setRarity({ ...rarity, [def.id]: k })}
                    >
                      {CONFIG.gacha.rarities[k].label}
                    </button>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && <p className="error">{error}</p>}
      <button className="btn primary wide" disabled={saving} onClick={save}>
        {saving ? '保存中…' : existing ? '保存する' : '作って、中身を決める'}
      </button>

      {existing && !existing.builtin && (
        <button
          className="btn ghost wide"
          onClick={() => {
            if (!confirmDelete) return setConfirmDelete(true)
            deleteGacha(existing.id)
            go({ name: 'shop' })
          }}
        >
          {confirmDelete ? '本当に消す（モンスターはこのガチャから外れます）' : 'このガチャを消す'}
        </button>
      )}
    </div>
  )
}
