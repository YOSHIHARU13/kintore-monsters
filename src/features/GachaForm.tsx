import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { CONFIG } from '../config/gameConfig'
import { FIRST_NODE_ID } from '../data/evolutionTemplates'
import { MonsterImage } from '../components/MonsterImage'
import { GachaBanner } from '../components/GachaBanner'
import { isPickupRarity, percent, pickupCount, rarityOf, rateTable, tierRates } from '../lib/gacha'
import { Stars } from '../components/Stars'
import type { Go } from '../nav'
import { isHidden, monsterName, type Gacha } from '../types'

export function GachaForm({ id, go }: { id?: string; go: Go }) {
  const { gachas, defs, saveGacha, deleteGacha } = useStore()
  const existing = id ? gachas.find((g) => g.id === id) : undefined
  const [name, setName] = useState(existing?.name ?? '')
  const [shinyRate, setShinyRate] = useState(existing?.shinyRate ?? CONFIG.shop.shinyRate)
  const [banner, setBanner] = useState<File | null>(null)
  const builtin = existing?.builtin ?? false
  const draftId = existing?.id ?? 'new'
  // ピックアップにできるのはレア以上（ハズレとノーマルはどのガチャにも入っている）
  const candidates = defs.filter((d) => !isHidden(d) && isPickupRarity(rarityOf(d)))
  const [pickups, setPickups] = useState<string[]>(
    candidates.filter((d) => existing && d.gachas?.includes(existing.id)).map((d) => d.id),
  )
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
    createdAt: existing?.createdAt ?? 0,
    builtin: existing?.builtin ?? false,
  }
  // 選んでいるピックアップで中身と確率を計算し直す（保存前でも見られる）
  const draftDefs = builtin
    ? defs
    : defs.map((d) => {
        if (!candidates.includes(d)) return d
        const others = (d.gachas ?? []).filter((g) => g !== draftId)
        return { ...d, gachas: pickups.includes(d.id) ? [...others, draftId] : others }
      })
  const table = rateTable(draftId, draftDefs)
  const pickupNeed = Math.max(0, CONFIG.gacha.minPickups - pickupCount(table))

  const save = async () => {
    if (!name.trim()) {
      setError('ガチャの名前を入力してください')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await saveGacha({ id: existing?.id, name, shinyRate, banner: banner ?? undefined, pickups: builtin ? undefined : pickups })
      go({ name: 'shop' })
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

      {!builtin && (
        <section className="card">
          <h2>ピックアップ（レア以上・{pickups.length}体）</h2>
          <p className="muted small">
            このガチャの「顔」になるモンスターを選びます。{CONFIG.gacha.minPickups}体以上そろうとショップで引けます。1体が入れるガチャは
            {CONFIG.gacha.maxPerMonster}つまで。ハズレとノーマルはどのガチャにも自動で入ります。
          </p>
          {candidates.length === 0 && (
            <p className="warn small">レア以上のモンスターがいません。図鑑の登録画面でレア度を「レア」か「激レア」にしてください。</p>
          )}
          <ul className="choice-list">
            {candidates.map((d) => {
              const on = pickups.includes(d.id)
              const full = !on && (d.gachas ?? []).filter((g) => g !== draftId).length >= CONFIG.gacha.maxPerMonster
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    className={`choice${on ? ' on' : ''}`}
                    disabled={full}
                    onClick={() => setPickups(on ? pickups.filter((x) => x !== d.id) : [...pickups, d.id])}
                  >
                    <span className="monster-row">
                      <MonsterImage imageId={d.images[FIRST_NODE_ID]} size={40} />
                      <span>
                        {on ? '✓ ' : ''}
                        {monsterName(d, FIRST_NODE_ID)}
                        <br />
                        <Stars def={d} nodeId={FIRST_NODE_ID} />{' '}
                        <span className={`small rarity-${rarityOf(d)}`}>{CONFIG.gacha.rarities[rarityOf(d)].label}</span>
                        {full && <span className="muted small">（もう{CONFIG.gacha.maxPerMonster}つのガチャに入っています）</span>}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          {pickupNeed > 0 && <p className="warn small">あと{pickupNeed}体で、このガチャが引けるようになります。</p>}
        </section>
      )}

      <section className="card">
        <h2>中身と確率（全{table.length}種）</h2>
        {builtin && (
          <p className="muted small">
            ハズレとノーマル全員と、どのガチャにも入れていないレア以上が出ます。いつでも引けます。
          </p>
        )}
        {table.length === 0 && <p className="warn small">まだモンスターが入っていません。</p>}
        {tierRates(table).map(({ rarity, rate, count }) => (
          <div key={rarity}>
            <h3 className={`small rarity-title rarity-${rarity}`}>
              {CONFIG.gacha.rarities[rarity].label} 合計{percent(rate)}（{count}種）
            </h3>
            <ul className="mini-list">
              {table
                .filter((t) => t.rarity === rarity)
                .map(({ def, rate: r }) => (
                  <li key={def.id}>
                    <span className="monster-row">
                      <MonsterImage imageId={def.images[FIRST_NODE_ID]} size={40} />
                      {monsterName(def, FIRST_NODE_ID)}
                    </span>
                    <span className="tag">{percent(r)}</span>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </section>

      {error && <p className="error">{error}</p>}
      <button className="btn primary wide" disabled={saving} onClick={save}>
        {saving ? '保存中…' : existing ? '保存する' : 'ガチャを作る'}
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
