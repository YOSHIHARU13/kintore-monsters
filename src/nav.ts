import type { Slot } from './data/exercises'

export type View =
  | { name: 'home' }
  | { name: 'training' }
  | { name: 'set'; slotId: string }
  | { name: 'menuEdit'; day: Slot['day'] }
  | { name: 'partner'; slotId: string }
  | { name: 'morning' }
  | { name: 'box' }
  | { name: 'monster'; id: string }
  | { name: 'profile'; defId: string; from?: 'dex' | 'shop' }
  | { name: 'shop' }
  | { name: 'gachaForm'; id?: string }
  | { name: 'quests'; category?: QuestCategory }
  | { name: 'quest'; id: string }
  | { name: 'tower' }
  | { name: 'castle' }
  | { name: 'kinkin' }
  | { name: 'missions' }
  | { name: 'questForm'; id?: string }
  | { name: 'dex' }
  | { name: 'registry' }
  | { name: 'monsterForm'; id?: string; preset?: 'gacha' | 'quest' }
  | { name: 'settings' }
  | { name: 'more' }
  | { name: 'items' }
  | { name: 'customItems' }
  | { name: 'gachaAdmin' }
  | { name: 'questAdmin' }
  | { name: 'collabAdmin' }
  | { name: 'bossAdmin' }

/** クエストの入口（ボスのクエスト・素材・神殿・書庫。孤城と塔は別の画面） */
export type QuestCategory = 'boss' | 'material' | 'temple' | 'archive'

export type Go = (view: View) => void

export const ATTR_COLOR = {
  chestArms: '#ef476f',
  legs: '#06d6a0',
  backShoulders: '#4cc9f0',
  none: '#c9cbd6',
} as const
