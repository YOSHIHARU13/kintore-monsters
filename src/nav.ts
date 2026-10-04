import type { Slot } from './data/exercises'

export type View =
  | { name: 'home' }
  | { name: 'training' }
  | { name: 'set'; slotId: string }
  | { name: 'menuEdit'; day: Slot['day'] }
  | { name: 'cardio' }
  | { name: 'box' }
  | { name: 'monster'; id: string }
  | { name: 'shop' }
  | { name: 'dex' }
  | { name: 'registry' }
  | { name: 'monsterForm'; id?: string }
  | { name: 'settings' }

export type Go = (view: View) => void

export const ATTR_COLOR = {
  chestArms: '#ef476f',
  legs: '#06d6a0',
  backShoulders: '#4cc9f0',
  none: '#c9cbd6',
} as const
