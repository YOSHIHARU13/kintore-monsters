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
import { Morning } from './features/Morning'
import { Box } from './features/Box'
import { MonsterDetail } from './features/MonsterDetail'
import { Shop } from './features/Shop'
import { GachaForm } from './features/GachaForm'
import { Dex } from './features/Dex'
import { MonsterRegistry } from './features/MonsterRegistry'
import { MonsterForm } from './features/MonsterForm'
import { Settings } from './features/Settings'
import { PartnerPick } from './features/PartnerPick'
import { TopBar } from './components/TopBar'
import { Quests } from './features/Quests'
import { Tower } from './features/Tower'
import { Castle } from './features/Castle'
import { Missions } from './features/Missions'
import { QuestDetail } from './features/QuestDetail'
import { QuestForm } from './features/QuestForm'
import { More } from './features/More'
import { Items } from './features/Items'
import { CustomItems } from './features/CustomItems'

const TABS: { label: string; icon: string; view: View; names: View['name'][] }[] = [
  { label: 'ホーム', icon: '🏠', view: { name: 'home' }, names: ['home', 'morning', 'missions'] },
  { label: 'トレーニング', icon: '💪', view: { name: 'training' }, names: ['training', 'set', 'menuEdit', 'partner'] },
  { label: 'モンスター', icon: '🐣', view: { name: 'box' }, names: ['box', 'monster', 'dex'] },
  { label: 'ショップ', icon: '🛒', view: { name: 'shop' }, names: ['shop', 'gachaForm'] },
  { label: 'クエスト', icon: '⚔️', view: { name: 'quests' }, names: ['quests', 'quest', 'questForm', 'tower', 'castle'] },
  { label: 'その他', icon: '☰', view: { name: 'more' }, names: ['more', 'items', 'customItems', 'settings', 'registry', 'monsterForm'] },
]

function Screen({ view, go }: { view: View; go: (v: View) => void }) {
  switch (view.name) {
    case 'home':
      return <Home go={go} />
    case 'training':
      return <Training go={go} />
    case 'set':
      return <SetInput key={view.slotId} slotId={view.slotId} go={go} />
    case 'menuEdit':
      return <MenuEdit day={view.day} go={go} />
    case 'partner':
      return <PartnerPick slotId={view.slotId} go={go} />
    case 'morning':
      return <Morning go={go} />
    case 'box':
      return <Box go={go} />
    case 'monster':
      return <MonsterDetail key={view.id} id={view.id} go={go} />
    case 'shop':
      return <Shop go={go} />
    case 'quests':
      return <Quests go={go} />
    case 'quest':
      return <QuestDetail key={view.id} id={view.id} go={go} />
    case 'tower':
      return <Tower go={go} />
    case 'castle':
      return <Castle go={go} />
    case 'missions':
      return <Missions go={go} />
    case 'questForm':
      return <QuestForm key={view.id ?? 'new'} id={view.id} go={go} />
    case 'gachaForm':
      return <GachaForm key={view.id ?? 'new'} id={view.id} go={go} />
    case 'dex':
      return <Dex go={go} />
    case 'registry':
      return <MonsterRegistry go={go} />
    case 'monsterForm':
      return <MonsterForm key={view.id ?? `new-${view.preset ?? ''}`} id={view.id} preset={view.preset} go={go} />
    case 'settings':
      return <Settings go={go} />
    case 'more':
      return <More go={go} />
    case 'items':
      return <Items go={go} />
    case 'customItems':
      return <CustomItems go={go} />
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
        <TopBar go={go} />
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
