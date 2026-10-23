import type { Go, View } from '../nav'

const ENTRIES: { icon: string; label: string; hint: string; view: View }[] = [
  { icon: '📦', label: '所持アイテム', hint: '結晶・核・筋肉玉の数と、トク玉への交換', view: { name: 'items' } },
  { icon: '🛠', label: 'カスタマイズアイテム', hint: '神殿で集めたアイテムと、付けている子', view: { name: 'customItems' } },
  { icon: '✏️', label: 'モンスターの登録・編集', hint: '新しいモンスターを作る・直す', view: { name: 'registry' } },
  { icon: '⚙️', label: '設定', hint: '習慣の名前・曲・ログアウト', view: { name: 'settings' } },
]

/** その他：毎日は使わないメニューをまとめる */
export function More({ go }: { go: Go }) {
  return (
    <div className="page">
      <h1 className="title">その他</h1>
      <section className="card">
        <ul className="choice-list">
          {ENTRIES.map((e) => (
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
      </section>
    </div>
  )
}
