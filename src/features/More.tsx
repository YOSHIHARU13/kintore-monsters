import type { Go, View } from '../nav'
import { LifespanCard } from '../components/Lifespan'

type Entry = { icon: string; label: string; hint: string; view: View }

const ENTRIES: Entry[] = [
  { icon: '📦', label: '所持アイテム', hint: '結晶・核・筋肉玉の数と、トク玉への交換', view: { name: 'items' } },
  { icon: '🛠', label: 'カスタマイズアイテム', hint: '神殿で集めたアイテムと、付けている子', view: { name: 'customItems' } },
  { icon: '⚙️', label: '設定', hint: '習慣の名前・曲・ログアウト', view: { name: 'settings' } },
]

/** 作る・直すためのメニュー（遊ぶときは使わない） */
const DEV_ENTRIES: Entry[] = [
  { icon: '✏️', label: 'モンスターの登録・編集', hint: '新しいモンスターを作る・直す・まとめておまかせ', view: { name: 'registry' } },
  { icon: '🎰', label: 'ガチャの管理', hint: 'ガチャを作る・編集する', view: { name: 'gachaAdmin' } },
  { icon: '⚔️', label: 'クエストの管理', hint: '作る・まとめて作る・条件の作り直し', view: { name: 'questAdmin' } },
  { icon: '🤝', label: 'コラボの管理', hint: 'コラボ名をまとめて変える・開催期間', view: { name: 'collabAdmin' } },
  { icon: '🏯', label: '高難度のボス', hint: '試練の塔・禁筋の獄・零の孤城のボスの確認と編集', view: { name: 'bossAdmin' } },
]

/** その他：毎日は使わないメニューと、作る側のメニューをまとめる */
export function More({ go }: { go: Go }) {
  const list = (entries: Entry[]) => (
    <ul className="choice-list">
      {entries.map((e) => (
        <li key={e.label}>
          <button className="choice more-entry" onClick={() => go(e.view)}>
            <span className="more-icon">{e.icon}</span>
            <span className="more-body">
              <strong>{e.label}</strong>
              <span className="small muted">{e.hint}</span>
            </span>
            <span>›</span>
          </button>
        </li>
      ))}
    </ul>
  )
  return (
    <div className="page">
      <h1 className="title">その他</h1>
      <section className="card">{list(ENTRIES)}</section>
      <section className="card">
        <h2>🔧 つくる（開発者メニュー）</h2>
        {list(DEV_ENTRIES)}
      </section>
      <LifespanCard go={go} />
    </div>
  )
}
