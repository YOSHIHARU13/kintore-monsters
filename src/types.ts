import type { Attr, FormAttr, Slot } from './data/exercises'

export type Judge = 'beat' | 'keep' | 'normal'

/** EXPの財布：属性ごとの財布か、万能EXP */
export type ExpSource = Attr | 'any'

export interface AttrExp {
  trained: number // 筋トレで稼いだEXP
  bought: number // ゴールドで買ったEXP
}

export interface GameState {
  gold: number
  eggs: number
  exp: Record<Attr, AttrExp>
  lifetimeExp: Record<Attr, number>
  anyExp: number // 万能EXP（腹筋ローラーで稼ぐ。どの属性の進化にも注げる）
  attendance: number
  lastAttendanceDate: string | null
  totalSets: number
  beatCount: number
  weeklyClears: number // 今週のタスクを全部消した週の累計
  lastClearWeek: string | null // 最後に全消しした週（その週の月曜の日付）
  habitStreak: number // 朝の記録で習慣を守れた日の連続日数
  bestHabitStreak: number
  habitLabel: string | null // 習慣の名前（null なら初期の名前）
  habitMode: 'check' | 'minutes' // 習慣の記録のしかた：○× か 分数
  lastCheckinDate: string | null // 最後に朝の記録をつけた「前日」の日付
  dexFound: Record<string, string[]> // 合体・ジョグレスでいなくなった個体が見つけていた形態（defId → nodeId）
  dexShiny: Record<string, boolean> // 色違いを見つけたモンスター（defId）
  pity: Record<string, number> // ガチャごとの、激レアが出ないまま引いた回数（天井用）
  activeMonsterId: string | null // 旧：育成中のモンスター（今は使っていない）
  partners: Record<string, string> // 種目の枠ID → 相棒のモンスター（OwnedMonster.id）
  challenge: Challenge | null // 今日挑戦しているクエスト
  questClears: number // クエストをクリアした回数
}

export interface SetRecord {
  id: string
  exerciseId: string
  slotId: string
  day: Slot['day'] // 枠の部位
  date: string // YYYY-MM-DD
  ts: number
  setNo: number // その日のうちで、その種目の何セット目か
  weightKg: number // 自重種目は0
  weightUp?: boolean // 前回より重いダンベルでやったか（重量アップ特攻）
  extra?: boolean // 2周目のセットか（追い込み特攻）
  reps: number
  target: number | null
  judge: Judge
  eligible: boolean // EXP・ゴールド・前回超えカウントの対象か
  exp: number
  gold: number
}

/** 朝の記録。ドキュメントIDは記録した「前日」の日付 */
export interface Checkin {
  date: string // 記録の対象日（前日）
  steps: number
  habit: boolean // 前日、習慣を守れたか（分数なら1分以上）
  habitLabel: string
  habitMinutes?: number // 分数で記録したときの分数
  streak: number // この日を含めた習慣の連続日数（守れなかった日は0）
  stepsGold: number
  habitGold: number
  ts: number
}

export interface Song {
  id: string // Sunoの曲ID
  title: string
}

export interface MonsterDef {
  id: string
  name: string
  attr: FormAttr // 第1段階の属性
  templateId: string
  attrs?: Record<string, FormAttr> // nodeId → その形態の属性（なければ attr を使う）
  images: Record<string, string> // nodeId → 画像ドキュメントID
  names?: Record<string, string> // nodeId → その段階だけの名前（なければ name を使う）
  recipe?: string[] // 隠しモンスターのレシピ（2体の defId）。あればタマゴからは生まれず、ジョグレスでだけ生まれる
  gachas?: string[] // 入っているガチャのID（最大3つ）。なければ「いつものガチャ」
  favoriteSlot?: string // 得意種目（種目の枠ID）
  jogressBirthStars?: number // 隠しモンスターが生まれるときの星（素材はこの1つ下以上）
  jogressPlus?: number // 隠しモンスターの素材に必要な＋（なければ最大）
  questOnly?: boolean // クエスト限定（ガチャには出ない。クエストのボスとして倒すと手に入る）
  skill?: string // 特攻スキル（CONFIG.skills のキー）
  rarity?: RarityKey // レア度（なければノーマル）
  common?: boolean // 旧形式：ハズレ枠（レア度ができる前のデータ）
  createdAt: number
}

/** 合体の＋と色違いを付けた名前（例：✨ショルベアー＋3） */
export function plusName(def: MonsterDef, mon: OwnedMonster): string {
  const name = `${mon.shiny ? '✨' : ''}${monsterName(def, mon.nodeId)}`
  return mon.plus ? `${name}＋${mon.plus}` : name
}

export type RarityKey = 'hazure' | 'normal' | 'rare' | 'superRare'

export interface Gacha {
  id: string
  name: string
  bannerImageId: string | null
  shinyRate: number
  catchphrase: string // 自動バナーのキャッチコピー
  theme: string // 自動バナーのテーマ色
  featured: string[] // 自動バナーに出すモンスター（defId）。空ならピックアップから自動で
  createdAt: number
  builtin: boolean // 「いつものガチャ」（消せない）
}

export type QuestDifficulty = 'easy' | 'normal' | 'hard'

export interface Quest {
  id: string
  name: string
  bossDefId: string // ボス（倒すと手に入るモンスター）
  attr: FormAttr // ボスの属性（相性に使う）
  weakSlots: string[] // 弱点種目（種目の枠ID）
  weakSkill: string // 弱点のやり方（CONFIG.skills のキー。なしは空）
  hp: Record<QuestDifficulty, number>
  rank?: number // ボスの格（CONFIG.quest.ranks の番号。なければ「普通」）
  catchphrase: string
  theme: string
  createdAt: number
}

export interface Challenge {
  date: string // 出撃した日。日付が変わったら失敗
  questId: string
  difficulty: QuestDifficulty
  party: string[] // 出撃したモンスター（OwnedMonster.id）
  startTs: number // この時刻からのセットがダメージになる
}

/** ジョグレスで生まれる隠しモンスターか */
export function isHidden(def: MonsterDef): boolean {
  return (def.recipe?.length ?? 0) === 2
}

/** その段階での名前。段階ごとの名前が未設定なら全体の名前 */
export function monsterName(def: MonsterDef, nodeId: string): string {
  return def.names?.[nodeId]?.trim() || def.name
}

export interface OwnedMonster {
  id: string // この1体のID（同じモンスターを何体でも持てる）
  defId: string // どのモンスター（MonsterDef）か
  nodeId: string
  investedBy?: Record<string, AttrExp> // 進化先のnodeId → その進化に向けて注いだEXP
  investedFrom?: Record<string, Partial<Record<ExpSource, AttrExp>>> // 進化先 → どの財布から注いだか（返却用）
  invested?: AttrExp // 旧形式（通常ルートに注いだEXP）
  plus?: number // 合体で上げた＋の数（0〜最大）
  plusExp?: AttrExp // 次の＋に向けて注いだEXP
  plusFrom?: Partial<Record<ExpSource, AttrExp>> // 次の＋に向けて、どの財布から注いだか（返却用）
  shiny?: boolean // 色違い
  obtainedAt: number
}

/** その形態の属性。形態ごとの属性が未設定ならモンスター全体の属性 */
export function nodeAttr(def: MonsterDef, nodeId: string): FormAttr {
  return def.attrs?.[nodeId] ?? def.attr
}

/** 進化先 targetId に向けて注いだEXP。旧形式の分は通常ルート（firstNextId）に数える */
export function investedFor(mon: OwnedMonster, targetId: string, firstNextId: string | undefined): AttrExp {
  const now = mon.investedBy?.[targetId]
  const legacy = targetId === firstNextId ? mon.invested : undefined
  return {
    trained: (now?.trained ?? 0) + (legacy?.trained ?? 0),
    bought: (now?.bought ?? 0) + (legacy?.bought ?? 0),
  }
}
