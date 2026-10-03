import type { DayKey } from './data/exercises'

export type View =
  | { name: 'home' }
  | { name: 'training'; day?: DayKey }
  | { name: 'set'; day: DayKey; slotId: string }
  | { name: 'menuEdit'; day: DayKey }
  | { name: 'cardio' }
  | { name: 'box' }
  | { name: 'monster'; id: string }
  | { name: 'shop' }
  | { name: 'dex' }
  | { name: 'monsterForm'; id?: string }

export type Go = (view: View) => void

export const ATTR_COLOR = {
  chestArms: '#ef476f',
  legs: '#06d6a0',
  backShoulders: '#4cc9f0',
  none: '#c9cbd6',
} as const
