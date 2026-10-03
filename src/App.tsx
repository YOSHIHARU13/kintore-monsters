import { useEffect, useState } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth } from './lib/firebase'
import { StoreProvider } from './store'
import { MusicProvider } from './music'
import type { View } from './nav'
import { Login } from './features/Login'
import { Home } from './features/Home'
import { Training } from './features/Training'
import { SetInput } from './features/SetInput'
import { MenuEdit } from './features/MenuEdit'
import { Cardio } from './features/Cardio'
import { Box } from './features/Box'
import { MonsterDetail } from './features/MonsterDetail'
import { Shop } from './features/Shop'
import { Dex } from './features/Dex'
import { MonsterForm } from './features/MonsterForm'
import { Settings } from './features/Settings'

const TABS: { label: string; icon: string; view: View; names: View['name'][] }[] = [
  { label: 'ホーム', icon: '🏠', view: { name: 'home' }, names: ['home', 'cardio'] },
  { label: 'トレーニング', icon: '💪', view: { name: 'training' }, names: ['training', 'set', 'menuEdit'] },
  { label: 'モンスター', icon: '🐣', view: { name: 'box' }, names: ['box', 'monster'] },
  { label: 'ショップ', icon: '🛒', view: { name: 'shop' }, names: ['shop'] },
  { label: '図鑑', icon: '📖', view: { name: 'dex' }, names: ['dex', 'monsterForm'] },
  { label: '設定', icon: '⚙️', view: { name: 'settings' }, names: ['settings'] },
]

function Screen({ view, go }: { view: View; go: (v: View) => void }) {
  switch (view.name) {
    case 'home':
      return <Home go={go} />
    case 'training':
      return <Training day={view.day} go={go} />
    case 'set':
      return <SetInput key={view.slotId} day={view.day} slotId={view.slotId} go={go} />
    case 'menuEdit':
      return <MenuEdit day={view.day} go={go} />
    case 'cardio':
      return <Cardio go={go} />
    case 'box':
      return <Box go={go} />
    case 'monster':
      return <MonsterDetail key={view.id} id={view.id} go={go} />
    case 'shop':
      return <Shop go={go} />
    case 'dex':
      return <Dex go={go} />
    case 'monsterForm':
      return <MonsterForm key={view.id ?? 'new'} id={view.id} go={go} />
    case 'settings':
      return <Settings />
  }
}

export function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [view, setView] = useState<View>({ name: 'home' })

  useEffect(() => onAuthStateChanged(auth, setUser), [])

  const go = (v: View) => {
    setView(v)
    window.scrollTo(0, 0)
  }

  if (user === undefined) {
    return (
      <div className="center-screen">
        <p>読み込み中…</p>
      </div>
    )
  }
  if (!user) return <Login />

  return (
    <StoreProvider user={user}>
      <MusicProvider>
        <main className="app">
          <Screen view={view} go={go} />
        </main>
      </MusicProvider>
      <nav className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab.label}
            className={tab.names.includes(view.name) ? 'on' : ''}
            onClick={() => go(tab.view)}
          >
            <span className="tab-icon">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>
    </StoreProvider>
  )
}
