import { CONFIG } from '../config/gameConfig'

export type Attr = 'chestArms' | 'legs' | 'backShoulders'
export type DayKey = 'mon' | 'wed' | 'fri'

export const ATTRS: Attr[] = ['chestArms', 'legs', 'backShoulders']
export const ATTR_LABEL: Record<Attr, string> = {
  chestArms: '胸腕',
  legs: '脚',
  backShoulders: '背肩',
}

// モンスターの形態の属性。'none'（無属性）はどの属性のEXPでも育つ
export type FormAttr = Attr | 'none'
export const FORM_ATTRS: FormAttr[] = [...ATTRS, 'none']
export const FORM_ATTR_LABEL: Record<FormAttr, string> = { ...ATTR_LABEL, none: '無' }

export const DAY_KEYS: DayKey[] = ['mon', 'wed', 'fri']
export const DAYS: Record<DayKey, { label: string; title: string; attr: Attr; weekday: number }> = {
  mon: { label: '月', title: '胸腕', attr: 'chestArms', weekday: 1 },
  wed: { label: '水', title: '脚', attr: 'legs', weekday: 3 },
  fri: { label: '金', title: '背肩', attr: 'backShoulders', weekday: 5 },
}

export interface Exercise {
  id: string
  name: string
  weighted: boolean // ダンベルを使う種目か（falseは自重）
  next?: string // 難易度を上げた上位バリエーション
}

const list: Exercise[] = [
  // 月：胸腕
  { id: 'pushup', name: 'プッシュアップ', weighted: false, next: 'pushupBar' },
  { id: 'pushupBar', name: 'プッシュアップ（バーで深く）', weighted: false, next: 'pushupFeetUp' },
  { id: 'pushupFeetUp', name: 'プッシュアップ（足を台に乗せる）', weighted: false, next: 'pushupOneLeg' },
  { id: 'pushupOneLeg', name: 'プッシュアップ（片足上げ）', weighted: false },
  { id: 'floorPress', name: 'ダンベルフロアプレス', weighted: true, next: 'floorPressSlow' },
  { id: 'floorPressSlow', name: 'フロアプレス（3秒で下ろす）', weighted: true, next: 'floorPressOneArm' },
  { id: 'floorPressOneArm', name: '片手フロアプレス', weighted: true },
  { id: 'floorPressClose', name: 'ナローフロアプレス', weighted: true },
  { id: 'fly', name: 'ダンベルフライ', weighted: true, next: 'flySlow' },
  { id: 'flySlow', name: 'ダンベルフライ（3秒で下ろす）', weighted: true },
  { id: 'squeezePress', name: 'スクイーズプレス', weighted: true },
  { id: 'curl', name: 'ダンベルカール', weighted: true, next: 'curlSlow' },
  { id: 'curlSlow', name: 'ダンベルカール（3秒で下ろす）', weighted: true, next: 'concentrationCurl' },
  { id: 'concentrationCurl', name: 'コンセントレーションカール', weighted: true },
  { id: 'hammerCurl', name: 'ハンマーカール', weighted: true },
  { id: 'ohExtension', name: 'オーバーヘッドエクステンション', weighted: true, next: 'ohExtensionOneArm' },
  { id: 'ohExtensionOneArm', name: '片手オーバーヘッドエクステンション', weighted: true },
  { id: 'lyingExtension', name: 'ライイングエクステンション', weighted: true },
  { id: 'kickback', name: 'キックバック', weighted: true },
  // 水：脚
  { id: 'bulgarian', name: 'ブルガリアンスクワット', weighted: true, next: 'bulgarianSlow' },
  { id: 'bulgarianSlow', name: 'ブルガリアンスクワット（3秒で下ろす）', weighted: true },
  { id: 'reverseLunge', name: 'リバースランジ', weighted: true },
  { id: 'goblet', name: 'ゴブレットスクワット', weighted: true },
  { id: 'gobletSlow', name: 'ゴブレットスクワット（3秒で下ろす）', weighted: true, next: 'gobletPause' },
  { id: 'gobletPause', name: 'ゴブレットスクワット（3秒で下ろし、底で2秒止める）', weighted: true },
  { id: 'rdl', name: 'ルーマニアンデッドリフト', weighted: true, next: 'rdlOneLeg' },
  { id: 'rdlOneLeg', name: '片脚ルーマニアンデッドリフト', weighted: true },
  { id: 'calfBoth', name: '両脚カーフレイズ', weighted: true },
  { id: 'calfOneLeg', name: '片脚カーフレイズ', weighted: true, next: 'calfOneLegStep' },
  { id: 'calfOneLegStep', name: '片脚カーフレイズ（段差で深く）', weighted: true },
  // 金：背肩
  { id: 'oneHandRow', name: 'ワンハンドロウ', weighted: true, next: 'oneHandRowPause' },
  { id: 'oneHandRowPause', name: 'ワンハンドロウ（引ききって2秒止める）', weighted: true },
  { id: 'bentOverRow', name: 'ベントオーバーロウ', weighted: true, next: 'bentOverRowReverse' },
  { id: 'bentOverRowReverse', name: 'ベントオーバーロウ（逆手）', weighted: true },
  { id: 'reverseFly', name: 'リバースフライ', weighted: true, next: 'reverseFlyPause' },
  { id: 'reverseFlyPause', name: 'リバースフライ（上で2秒止める）', weighted: true },
  { id: 'shoulderPress', name: 'ショルダープレス', weighted: true, next: 'arnoldPress' },
  { id: 'arnoldPress', name: 'アーノルドプレス', weighted: true, next: 'shoulderPressOneArm' },
  { id: 'shoulderPressOneArm', name: '片手ショルダープレス', weighted: true },
  { id: 'sideRaise', name: 'サイドレイズ', weighted: true, next: 'sideRaiseSlow' },
  { id: 'sideRaiseSlow', name: 'サイドレイズ（3秒で下ろす）', weighted: true },
  { id: 'frontRaise', name: 'フロントレイズ', weighted: true },
  // ボーナス：腹筋ローラー
  { id: 'abKnee', name: '腹筋ローラー（膝つき）', weighted: false, next: 'abWall' },
  { id: 'abWall', name: '腹筋ローラー（壁で止める）', weighted: false, next: 'abKneeFull' },
  { id: 'abKneeFull', name: '腹筋ローラー（膝つきで最大まで）', weighted: false, next: 'abStanding' },
  { id: 'abStanding', name: '腹筋ローラー（立ちコロ）', weighted: false },
]

export const EXERCISES: Record<string, Exercise> = Object.fromEntries(list.map((e) => [e.id, e]))

export interface Slot {
  id: string
  day: DayKey | 'bonus'
  candidates: string[] // 先頭が初期種目
}

export const SLOTS: Slot[] = [
  { id: 'mon1', day: 'mon', candidates: ['pushup', 'pushupBar', 'pushupFeetUp', 'pushupOneLeg'] },
  { id: 'mon2', day: 'mon', candidates: ['floorPress', 'floorPressSlow', 'floorPressOneArm', 'floorPressClose'] },
  { id: 'mon3', day: 'mon', candidates: ['fly', 'flySlow', 'squeezePress'] },
  { id: 'mon4', day: 'mon', candidates: ['curl', 'curlSlow', 'concentrationCurl', 'hammerCurl'] },
  { id: 'mon5', day: 'mon', candidates: ['ohExtension', 'ohExtensionOneArm', 'lyingExtension', 'kickback'] },
  { id: 'wed1', day: 'wed', candidates: ['bulgarian', 'bulgarianSlow', 'reverseLunge'] },
  { id: 'wed2', day: 'wed', candidates: ['gobletSlow', 'gobletPause', 'goblet'] },
  { id: 'wed3', day: 'wed', candidates: ['rdl', 'rdlOneLeg'] },
  { id: 'wed4', day: 'wed', candidates: ['calfOneLeg', 'calfOneLegStep', 'calfBoth'] },
  { id: 'fri1', day: 'fri', candidates: ['oneHandRow', 'oneHandRowPause'] },
  { id: 'fri2', day: 'fri', candidates: ['bentOverRow', 'bentOverRowReverse'] },
  { id: 'fri3', day: 'fri', candidates: ['reverseFly', 'reverseFlyPause'] },
  { id: 'fri4', day: 'fri', candidates: ['shoulderPress', 'arnoldPress', 'shoulderPressOneArm'] },
  { id: 'fri5', day: 'fri', candidates: ['sideRaise', 'sideRaiseSlow', 'frontRaise'] },
  { id: 'bonus', day: 'bonus', candidates: ['abKnee', 'abWall', 'abKneeFull', 'abStanding'] },
]

export const BONUS_SLOT = SLOTS.find((s) => s.day === 'bonus')!

export function slotsOfDay(day: DayKey): Slot[] {
  return SLOTS.filter((s) => s.day === day)
}

/** その枠で今選ばれている種目（差し替えていなければ初期種目） */
export function exerciseOfSlot(slot: Slot, menu: Record<string, string>): Exercise {
  const id = menu[slot.id]
  return EXERCISES[id && slot.candidates.includes(id) ? id : slot.candidates[0]]
}

export function repRange(exerciseId: string): { min: number | null; max: number } {
  const [min, max] = CONFIG.repRanges[exerciseId]
  return { min, max }
}

export function rangeText(exerciseId: string): string {
  const { min, max } = repRange(exerciseId)
  return min === null ? `上限${max}回` : `${min}〜${max}回`
}

/** 今日が月水金ならその曜日キー、それ以外は null */
export function dayKeyOfDate(d: Date): DayKey | null {
  return DAY_KEYS.find((k) => DAYS[k].weekday === d.getDay()) ?? null
}
