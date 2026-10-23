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
  | { name: 'shop' }
  | { name: 'gachaForm'; id?: string }
  | { name: 'quests' }
  | { name: 'quest'; id: string }
  | { name: 'tower' }
  | { name: 'missions' }
  | { name: 'questForm'; id?: string }
  | { name: 'dex' }
  | { name: 'registry' }
  | { name: 'monsterForm'; id?: string; preset?: 'gacha' | 'quest' }
  | { name: 'settings' }
  | { name: 'more' }
  | { name: 'items' }

export type Go = (view: View) => void

export const ATTR_COLOR = {
  chestArms: '#ef476f',
  legs: '#06d6a0',
  backShoulders: '#4cc9f0',
  none: '#c9cbd6',
} as const
