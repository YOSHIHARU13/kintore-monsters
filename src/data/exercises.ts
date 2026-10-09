import { CONFIG } from '../config/gameConfig'

export type Attr = 'chestArms' | 'legs' | 'backShoulders'
// 部位のキー。曜日固定だったころの名残で mon / wed / fri のまま（保存済みの記録がこのキーを使っている）
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
export const DAYS: Record<DayKey, { title: string; attr: Attr }> = {
  mon: { title: '胸腕', attr: 'chestArms' },
  wed: { title: '脚', attr: 'legs' },
  fri: { title: '背肩', attr: 'backShoulders' },
}

export interface Exercise {
  id: string
  name: string
  weighted: boolean // ダンベルを使う種目か（falseは自重）
  next?: string // 難易度を上げた上位バリエーション
  dumbbells?: 1 | 2 // 一度に持つダンベルの数（省略時は2個＝両手に1個ずつ）。重さは常に1個ぶんで記録する
  perSide?: boolean // 左右を片側ずつ行う種目か。回数は片側ぶんで数える
  how: string // やり方の簡単な説明
}

const list: Exercise[] = [
  // 胸腕
  {
    id: 'pushup', name: 'プッシュアップ', weighted: false, next: 'pushupBar',
    how: 'バーを使わず、床に手をついて行う腕立て伏せ。手は肩幅より少し広く、体を一直線に保ったまま胸を床すれすれまで下ろす。',
  },
  {
    id: 'pushupBar', name: 'プッシュアップ（バーで深く）', weighted: false, next: 'pushupFeetUp',
    how: 'プッシュアップバーを握って行う腕立て伏せ。バーの高さのぶん、胸を深く下ろす。',
  },
  {
    id: 'pushupFeetUp', name: 'プッシュアップ（足を台に乗せる）', weighted: false, next: 'pushupOneLeg',
    how: '足を椅子や台に乗せて行う腕立て伏せ。バーは引き続き使う。胸の上のほうに効く。',
  },
  {
    id: 'pushupOneLeg', name: 'プッシュアップ（片足上げ）', weighted: false,
    how: '片足を床から浮かせたまま行う腕立て伏せ。浮かせる足はセットごとに替える。バーは引き続き使う。',
  },
  {
    id: 'floorPress', name: 'ダンベルフロアプレス', weighted: true, next: 'floorPressSlow',
    how: '床に仰向けになり、両手のダンベルを胸の上へ押し上げる。肘が床に軽く触れるまで下ろす。',
  },
  {
    id: 'floorPressSlow', name: 'フロアプレス（3秒で下ろす）', weighted: true, next: 'floorPressOneArm',
    how: 'フロアプレスを、3秒かけてゆっくり下ろす。上げるときは普通の速さでOK。',
  },
  {
    id: 'floorPressOneArm', name: '片手フロアプレス', weighted: true, dumbbells: 1, perSide: true,
    how: '床に仰向けで、片手だけダンベルを持って押し上げる。体がねじれないようお腹に力を入れる。',
  },
  {
    id: 'floorPressClose', name: 'ナローフロアプレス', weighted: true,
    how: '脇を締め、ダンベル同士を近づけたまま行うフロアプレス。二の腕の裏側に効く。',
  },
  {
    id: 'fly', name: 'ダンベルフライ', weighted: true, next: 'flySlow',
    how: '床に仰向けで、肘を軽く曲げたまま腕を左右に開き、胸の上で閉じる。胸を開く・寄せる動き。',
  },
  {
    id: 'flySlow', name: 'ダンベルフライ（3秒で下ろす）', weighted: true,
    how: 'ダンベルフライを、3秒かけてゆっくり開く。',
  },
  {
    id: 'squeezePress', name: 'スクイーズプレス', weighted: true,
    how: '仰向けで、ダンベル同士を胸の上で強く押しつけ合ったまま上下させる。胸の内側に効く。',
  },
  {
    id: 'curl', name: 'ダンベルカール', weighted: true, next: 'curlSlow',
    how: '立って手のひらを前に向け、肘の位置を動かさずにダンベルを肩まで巻き上げる。力こぶの種目。',
  },
  {
    id: 'curlSlow', name: 'ダンベルカール（3秒で下ろす）', weighted: true, next: 'concentrationCurl',
    how: 'ダンベルカールを、3秒かけてゆっくり下ろす。',
  },
  {
    id: 'concentrationCurl', name: 'コンセントレーションカール', weighted: true, dumbbells: 1, perSide: true,
    how: '椅子に座り、肘を太ももの内側に当てて固定し、片手でダンベルを巻き上げる。',
  },
  {
    id: 'hammerCurl', name: 'ハンマーカール', weighted: true,
    how: '手のひらを内側（親指が上）に向けたまま、ダンベルを肩まで巻き上げる。',
  },
  // ここから2種目は肘を深く曲げたところに負荷がかかり、肘への負担が大きいので枠の候補から外してある（過去の記録用に定義だけ残す）
  {
    id: 'ohExtension', name: 'オーバーヘッドエクステンション', weighted: true, dumbbells: 1, next: 'ohExtensionOneArm',
    how: 'ダンベル1個を両手で持って頭の上に上げ、肘を曲げて頭の後ろへ下ろし、伸ばして戻す。二の腕の裏側。腰を反らさない（椅子に座って行うと腰が楽）。',
  },
  {
    id: 'ohExtensionOneArm', name: '片手オーバーヘッドエクステンション', weighted: true, dumbbells: 1, perSide: true,
    how: '片手でダンベルを頭の上に上げ、肘を曲げて頭の後ろへ下ろし、伸ばして戻す。',
  },
  // ここから下は枠の候補
  {
    id: 'kickback', name: 'キックバック', weighted: true, dumbbells: 1, next: 'kickbackPause', perSide: true,
    how: '片手を椅子などについて前かがみになり、肘を体の横に固定したまま、腕を後ろへゆっくり伸ばす。勢いをつけず、軽めの重さで。二の腕の裏側。',
  },
  {
    id: 'kickbackPause', name: 'キックバック（伸ばして2秒止める）', weighted: true, dumbbells: 1, perSide: true,
    how: 'キックバックで、腕を伸ばしたところで2秒止めてから戻す。重さを増やさずに効かせられる。',
  },
  {
    id: 'lyingExtension', name: 'ライイングエクステンション', weighted: true,
    how: '仰向けで両手にダンベルを持って腕を真上に伸ばし、肘の位置を動かさずに頭の横まで下ろして戻す。肘を深く曲げるので、肘に不安があるときは選ばない。',
  },
  // 脚
  {
    id: 'bulgarian', name: 'ブルガリアンスクワット', weighted: true, next: 'bulgarianSlow', perSide: true,
    how: '後ろ足の甲を椅子に乗せ、前足1本でしゃがんで立つ。両手にダンベル。前足のお尻と太ももに効く。',
  },
  {
    id: 'bulgarianSlow', name: 'ブルガリアンスクワット（3秒で下ろす）', weighted: true, perSide: true,
    how: 'ブルガリアンスクワットを、3秒かけてゆっくりしゃがむ。',
  },
  {
    id: 'reverseLunge', name: 'リバースランジ', weighted: true, perSide: true,
    how: '立った状態から片足を大きく後ろに引いてしゃがみ、元に戻る。両手にダンベル。',
  },
  {
    id: 'goblet', name: 'ゴブレットスクワット', weighted: true, dumbbells: 1,
    how: 'ダンベル1個を胸の前で抱え、太ももが床と平行になるまでしゃがんで立つ。',
  },
  {
    id: 'gobletSlow', name: 'ゴブレットスクワット（3秒で下ろす）', weighted: true, dumbbells: 1, next: 'gobletPause',
    how: 'ダンベル1個を胸の前で抱え、3秒かけてゆっくりしゃがんで立つ。',
  },
  {
    id: 'gobletPause', name: 'ゴブレットスクワット（3秒で下ろし、底で2秒止める）', weighted: true, dumbbells: 1,
    how: 'ゴブレットスクワットを3秒かけてしゃがみ、いちばん下で2秒止めてから立つ。',
  },
  {
    id: 'hipLift', name: 'ヒップリフト', weighted: true, dumbbells: 1, next: 'hipLiftFeetUp',
    how: '仰向けでひざを立て、ダンベル1個を腰骨の上に乗せて手で支え、お尻を持ち上げて下ろす。上で腰を反らさず、お尻を締める。お尻と太ももの裏。',
  },
  {
    id: 'hipLiftFeetUp', name: 'ヒップリフト（足を椅子に乗せる）', weighted: true, dumbbells: 1, next: 'hipLiftOneLeg',
    how: '仰向けでかかとを椅子に乗せ、ダンベル1個を腰骨の上で支えて、お尻を持ち上げて下ろす。太ももの裏に強く効く。',
  },
  {
    id: 'hipLiftOneLeg', name: '片脚ヒップリフト', weighted: true, dumbbells: 1, perSide: true,
    how: '仰向けで片ひざを立て、反対の脚は伸ばして浮かせたまま、お尻を持ち上げて下ろす。ダンベル1個を腰骨の上で支える。腰が左右に傾かないようにする。',
  },
  // ここから2種目は腰への負担が大きいので枠の候補から外してある（過去の記録用に定義だけ残す）
  {
    id: 'rdl', name: 'ルーマニアンデッドリフト', weighted: true, next: 'rdlOneLeg',
    how: '両手にダンベルを持ち、背すじを伸ばしたままお尻を後ろに引いて上体を倒し、戻す。太ももの裏とお尻。',
  },
  {
    id: 'rdlOneLeg', name: '片脚ルーマニアンデッドリフト', weighted: true, dumbbells: 1, perSide: true,
    how: '片足で立ち、片手にダンベルを持って、反対の足を後ろに伸ばしながら上体を倒して戻す。空いた手は壁に添えてOK。',
  },
  {
    id: 'calfBoth', name: '両脚カーフレイズ', weighted: true,
    how: '両足で立ち、かかとをできるだけ高く上げてゆっくり下ろす。ふくらはぎの種目。',
  },
  {
    id: 'calfOneLeg', name: '片脚カーフレイズ', weighted: true, dumbbells: 1, next: 'calfOneLegStep', perSide: true,
    how: '片足で立ち、片手にダンベルを持って、かかとをできるだけ高く上げてゆっくり下ろす。空いた手は壁に添えてOK。',
  },
  {
    id: 'calfOneLegStep', name: '片脚カーフレイズ（段差で深く）', weighted: true, dumbbells: 1, perSide: true,
    how: '段差につま先だけ乗せて片足で立ち、かかとを段より下まで下ろしてから高く上げる。',
  },
  // 背肩
  {
    id: 'oneHandRow', name: 'ワンハンドロウ', weighted: true, dumbbells: 1, next: 'oneHandRowPause', perSide: true,
    how: '片手と片ひざを椅子などについて前かがみになり、反対の手のダンベルを脇腹へ引き上げる。背中の種目。',
  },
  {
    id: 'oneHandRowPause', name: 'ワンハンドロウ（引ききって2秒止める）', weighted: true, dumbbells: 1, perSide: true,
    how: 'ワンハンドロウで、引ききったところで2秒止めてから下ろす。',
  },
  {
    id: 'wideRow', name: 'ワンハンドロウ（肘を開いて引く）', weighted: true, dumbbells: 1, next: 'wideRowPause', perSide: true,
    how: '片手と片ひざを椅子などについて体を支え、反対の手のダンベルを、肘を横に張り出しながら胸の横へ引き上げる。背中の上部と肩の後ろ。',
  },
  {
    id: 'wideRowPause', name: 'ワンハンドロウ（肘を開いて引き、2秒止める）', weighted: true, dumbbells: 1, perSide: true,
    how: '肘を開いて引くワンハンドロウで、引ききったところで2秒止めてから下ろす。',
  },
  {
    id: 'sideLyingReverseFly', name: '寝ながらリバースフライ', weighted: true, dumbbells: 1, next: 'sideLyingReverseFlyPause', perSide: true,
    how: '床に横向きに寝て、上の手にダンベルを持つ。肘を軽く曲げたまま、腕を胸の前から真上まで開いて下ろす。肩の後ろ側と背中の上部。',
  },
  {
    id: 'sideLyingReverseFlyPause', name: '寝ながらリバースフライ（上で2秒止める）', weighted: true, dumbbells: 1, perSide: true,
    how: '寝ながらリバースフライで、腕が真上にきたところで2秒止める。',
  },
  // ここから4種目は支えなしの前かがみで腰への負担が大きいので枠の候補から外してある（過去の記録用に定義だけ残す）
  {
    id: 'bentOverRow', name: 'ベントオーバーロウ', weighted: true, next: 'bentOverRowReverse',
    how: '立って上体を前に倒し、両手のダンベルを同時におへその横へ引き上げる。背すじは丸めない。',
  },
  {
    id: 'bentOverRowReverse', name: 'ベントオーバーロウ（逆手）', weighted: true,
    how: '手のひらを前に向けた逆手で行うベントオーバーロウ。背中の下のほうと力こぶにも効く。',
  },
  {
    id: 'reverseFly', name: 'リバースフライ', weighted: true, next: 'reverseFlyPause',
    how: '上体を前に倒し、肘を軽く曲げたまま両腕を横へ開く。肩の後ろ側と背中の上部に効く。',
  },
  {
    id: 'reverseFlyPause', name: 'リバースフライ（上で2秒止める）', weighted: true,
    how: 'リバースフライで、腕を開ききったところで2秒止める。',
  },
  // ここから下は枠の候補
  {
    id: 'shoulderPress', name: 'ショルダープレス', weighted: true, next: 'arnoldPress',
    how: 'ダンベルを両肩の横に構え、頭の上へまっすぐ押し上げる。肩の種目。腰を反らさない（椅子に座って行うと腰が楽）。',
  },
  {
    id: 'arnoldPress', name: 'アーノルドプレス', weighted: true, next: 'shoulderPressOneArm',
    how: '手のひらを自分に向けて顔の前に構え、手首を外へ回しながら頭の上へ押し上げる。',
  },
  {
    id: 'shoulderPressOneArm', name: '片手ショルダープレス', weighted: true, dumbbells: 1, perSide: true,
    how: '片手だけでダンベルを頭の上へ押し上げる。体が横に傾かないようにする。',
  },
  {
    id: 'sideRaise', name: 'サイドレイズ', weighted: true, next: 'sideRaiseSlow',
    how: '立って両腕を体の横から肩の高さまで上げる。肘は軽く曲げ、肩をすくめない。肩の横側。',
  },
  {
    id: 'sideRaiseSlow', name: 'サイドレイズ（3秒で下ろす）', weighted: true,
    how: 'サイドレイズを、3秒かけてゆっくり下ろす。',
  },
  {
    id: 'frontRaise', name: 'フロントレイズ', weighted: true,
    how: '立って両腕を体の前から肩の高さまで上げて下ろす。肩の前側。',
  },
  // ボーナス：腹筋ローラー
  {
    id: 'abKnee', name: '腹筋ローラー（膝つき）', weighted: false, next: 'abWall',
    how: 'ひざをついてローラーを前へ転がし、無理のない範囲で体を伸ばして戻る。腰は反らさない。',
  },
  {
    id: 'abWall', name: '腹筋ローラー（壁で止める）', weighted: false, // 腰を守るため、ここから先の上位種目は提案しない
    how: 'ひざつきで、壁に当たって止まる距離まで転がして戻る。壁から少しずつ離れていく。',
  },
  {
    id: 'abKneeFull', name: '腹筋ローラー（膝つきで最大まで）', weighted: false,
    how: 'ひざつきで、体が床すれすれになるまで伸ばしきってから戻る。腰が反りやすいので、腰に不安があるときは選ばない。',
  },
  // 立ちコロは腰が反りやすいので枠の候補から外してある（過去の記録用に定義だけ残す）
  {
    id: 'abStanding', name: '腹筋ローラー（立ちコロ）', weighted: false,
    how: '立った状態からローラーを前へ転がして戻る。いちばん難しい形。',
  },
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
  { id: 'mon5', day: 'mon', candidates: ['kickback', 'kickbackPause', 'lyingExtension'] },
  { id: 'wed1', day: 'wed', candidates: ['bulgarian', 'bulgarianSlow', 'reverseLunge'] },
  { id: 'wed2', day: 'wed', candidates: ['gobletSlow', 'gobletPause', 'goblet'] },
  { id: 'wed3', day: 'wed', candidates: ['hipLift', 'hipLiftFeetUp', 'hipLiftOneLeg'] },
  { id: 'wed4', day: 'wed', candidates: ['calfOneLeg', 'calfOneLegStep', 'calfBoth'] },
  { id: 'fri1', day: 'fri', candidates: ['oneHandRow', 'oneHandRowPause'] },
  { id: 'fri2', day: 'fri', candidates: ['wideRow', 'wideRowPause'] },
  { id: 'fri3', day: 'fri', candidates: ['sideLyingReverseFly', 'sideLyingReverseFlyPause'] },
  { id: 'fri4', day: 'fri', candidates: ['shoulderPress', 'arnoldPress', 'shoulderPressOneArm'] },
  { id: 'fri5', day: 'fri', candidates: ['sideRaise', 'sideRaiseSlow', 'frontRaise'] },
  { id: 'bonus', day: 'bonus', candidates: ['abKnee', 'abWall', 'abKneeFull'] },
]

export const BONUS_SLOT = SLOTS.find((s) => s.day === 'bonus')!

/** 今週のタスクになる枠（ボーナス枠以外） */
export const TASK_SLOTS = SLOTS.filter((s) => s.day !== 'bonus')

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

/** ダンベルを何個使うかの表示。自重種目は null */
export function dumbbellText(ex: Exercise): string | null {
  if (!ex.weighted) return null
  return ex.dumbbells === 1 ? 'ダンベル1個' : 'ダンベル2個（両手に1個ずつ）'
}

export function rangeText(exerciseId: string): string {
  const { min, max } = repRange(exerciseId)
  const text = min === null ? `上限${max}回` : `${min}〜${max}回`
  return EXERCISES[exerciseId]?.perSide ? `左右各${text}` : text
}
