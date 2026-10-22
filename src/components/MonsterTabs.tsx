import type { Go } from '../nav'

/** モンスタータブの中の切り替え（BOX／図鑑） */
export function MonsterTabs({ on, go }: { on: 'box' | 'dex'; go: Go }) {
  return (
    <div className="segmented" role="tablist">
      <button role="tab" aria-selected={on === 'box'} className={on === 'box' ? 'on' : ''} onClick={() => go({ name: 'box' })}>
        BOX
      </button>
      <button role="tab" aria-selected={on === 'dex'} className={on === 'dex' ? 'on' : ''} onClick={() => go({ name: 'dex' })}>
        図鑑
      </button>
    </div>
  )
}
