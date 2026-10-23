import type { Attr, FormAttr, Slot } from './data/exercises'

export type Judge = 'beat' | 'keep' | 'normal'

/** ソシャゲの属性（相性に使う）。部位（胸腕・脚・背肩）とは別 */
export type Element = 'fire' | 'water' | 'wood' | 'light' | 'dark'

/** EXPの財布：属性ごとの財布か、万能EXP */
export type ExpSource = Attr | 'any'

export interface AttrExp {
  trained: number // 筋トレで稼いだEXP
  bought: number // ゴールドで買ったEXP
}

export type BoosterKey = 'habit' | 'exp' | 'quest'

export interface GameState {
  gold: number // オーブ（ガチャ・ブースター）。中の名前は gold のまま
  redesign?: number // 1 なら、降臨の格（bossGrade）を書き込んである
  hoshi?: number // ホシ玉の数（引くとレア以上が確定）
  normalCount?: number // 次のホシ玉までに出たノーマルの数
  questRules?: number // ボスクエストの条件を、この版のおまかせで作り直してある
  orbScale?: number // 1 ならオーブの単位（以前のゴールドの10分の1）に直してある
  coins: number // 進化コイン（進化・ジョグレス・EXPの購入）
  eggs: number // トク玉（1個でガチャ1回）。中の名前は eggs のまま
  exp: Record<Attr, AttrExp>
  lifetimeExp: Record<Attr, number>
  anyExp: number // 万能EXP（腹筋ローラーで稼ぐ。どの属性の進化にも注げる）
  lifetimeAnyExp?: number // これまでに稼いだ万能EXP（ランク用）
  attendance: number
  lastAttendanceDate: string | null
  totalSets: number
  beatCount: number
  weeklyClears: number // 今週のタスクを全部消した週の累計
  lastClearWeek: string | null // 最後に全消しした週（その週の月曜の日付）
  habitStreak: number // 習慣をやった日の連続日数
  habitDate: string | null // 最後に習慣を記録した日
  habitMinutesToday: number // habitDate の日に記録した分数の合計
  bestHabitStreak: number
  habitLabel: string | null // 習慣の名前（null なら初期の名前）
  habitMode: 'check' | 'minutes' // 習慣の記録のしかた：○× か 分数
  lastCheckinDate: string | null // 最後に朝の記録をつけた「前日」の日付
  dexFound: Record<string, string[]> // 合体・ジョグレスでいなくなった個体が見つけていた形態（defId → nodeId）
  dexShiny: Record<string, boolean> // 色違いを見つけたモンスター（defId）
  pity: Record<string, number> // ガチャごとの、激レアが出ないまま引いた回数（天井用）
  cores: Partial<Record<FormAttr, number>> // 進化素材：部位の核（胸腕・脚・背肩）。none は筋肉玉（以前の無垢の核）
  stones?: Partial<Record<Element, number>> // 進化素材：属性の結晶
  customItems?: Record<string, number> // カスタマイズアイテムの所持数（itemKey → 個数）
  sticks?: number // ワクワクステッキ（付け直すとき、前のアイテムを持ち物に戻せる）
  coreMisses: Record<string, number> // 素材クエストごとの、筋肉玉が続けて落ちなかった回数（天井用）
  activeMonsterId: string | null // 旧：育成中のモンスター（今は使っていない）
  partners: Record<string, string> // 種目の枠ID → 相棒のモンスター（OwnedMonster.id）
  challenge: Challenge | null // 今日挑戦しているクエスト
  questClears: number // クエストをクリアした回数
  clearedQuests: Record<string, number> // クエストごとのクリア回数（一覧の✓に使う）
  tower: { month: string; cleared: number } | null // 試練の塔：その月にクリアした階の数
  castle?: { month?: string; cleared: number } // 零の孤城：その月にクリアした階の数
  boosters: Partial<Record<BoosterKey, number>> // 持っているブースターの数
  boosts: { habit?: boolean; quest?: boolean; expSets?: number } // 使用中のブースター（EXPは残りセット数）
  freeClaims: Record<string, boolean> // 引いた無料ガチャ（'thursday:2026-10-22' のようなキー）
  claims: Record<string, boolean> // 受け取った報酬（ミッション・ログイン・図鑑・プレゼント）
  loginDays: number // ログインボーナスを受け取った日数
  stats: {
    date: string
    week: string
    dayQuestClears: number
    weekQuestClears: number
    weekStrictClears: number
    weekHabitMinutes: number
  } | null // ミッション用の今日・今週の記録
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
  element?: Element // 属性（なければ零属性）。ジョグレスは素材から決まる
  jogressElements?: Element[] // ジョグレスの属性（保存するときに素材から計算する）
  jogressSuper?: boolean // 同じ属性どうしのジョグレスなら超属性
  favoriteSlot?: string // 得意種目（種目の枠ID）
  series?: string // シリーズ（コラボ名）。空なら通常
  jogressBirthStars?: number // 隠しモンスターが生まれるときの星（素材はこの1つ下以上）
  jogressPlus?: number // 隠しモンスターの素材に必要な＋（なければ0）
  fixedStars?: number // 進化しない（1形態だけの）クエスト限定モンスターの星（なければ fixedStarsDefault）
  jogressGrade?: number // 素材のうち激レアの数（0〜2）。保存するときに計算する。強さとアビリティの数に効く
  questOnly?: boolean // クエスト限定（ガチャには出ない。クエストのボスとして倒すと手に入る）
  questTier?: 'bakuzetsu' | 'lastBoss' | null // 旧：降臨の格（今はレア度で決める。読み込んだときに直す）
  jogressPartner?: string // 金の獣神化（合体）の相手の激レア（defId）。絵は images.gold、名前は names.gold
  castleLord?: boolean // 零の孤城の城主（激レアの降臨のうち。最上階のボスになり、倒すともらえる）
  tower?: boolean // 試練の塔の報酬（降臨のうち。5階・10階で月替わりにもらえる）
  abilities?: string[] // アビリティ：対応するギミック名で持つ（例：'バリア' ならアーク）
  extraAbilities?: string[] // カスタマイズで足したアビリティ（読み込んだ個体に付くだけ。保存はしない）
  extraFavorite?: string // カスタマイズで足した得意種目（同上）
  partNow?: FormAttr // 持っている個体の今の部位（読み込んだ個体に付くだけ。保存はしない）
  tier?: RarityKey // レア度（ノーマル・レア・激レア）。なければ、以前の rarity から読み替える
  rarity?: string // 旧：以前のレア度（hazure・normal・uncommon・superRare・rare）。読むだけ
  bossGrade?: QuestGrade // 降臨の格（上級〜爆絶）。星・アビリティの数・攻撃力と、そのボスのクエストの格が決まる
  common?: boolean // 旧形式：ハズレ枠（レア度ができる前のデータ）
  createdAt: number
}

/** 色違いを付けた名前（例：✨ショルベアー） */
export function plusName(def: MonsterDef, mon: OwnedMonster): string {
  // 獣神化していれば、獣神化の名前（金は合体の名前）
  const shinkaName = mon.shinka ? def.names?.[mon.shinkaGold ? 'gold' : 'shinka']?.trim() : ''
  return `${mon.shiny ? '✨' : ''}${shinkaName || monsterName(def, mon.nodeId)}`
}

export type RarityKey = 'normal' | 'rare' | 'superRare' // ノーマル・レア・激レア


/** バナーの型：上位1体のズーム・上位3体・上位5体・ほかのピックアップ一覧 */
export type BannerSlide = 'top1' | 'top3' | 'top5' | 'pickups'

export interface Gacha {
  id: string
  name: string
  bannerImageId: string | null
  shinyRate: number
  catchphrase: string // 自動バナーのキャッチコピー
  theme: string // 自動バナーのテーマ色
  featured: string[] // 自動バナーに出すモンスター（defId）。並び順が優先度。空ならピックアップから自動で
  slides: BannerSlide[] // バナーでスライドする型。空なら出せるものを全部
  createdAt: number
  builtin: boolean // 「いつものガチャ」（消せない）
}

export type QuestDifficulty = 'easy' | 'normal' | 'hard'

/** 素材クエストで落ちるもの：属性の結晶・部位の核・筋肉玉・進化コイン */
export type MaterialDrop = 'stone' | 'muscle' | 'ball' | 'coins' | 'custom' // custom：神殿のカスタマイズアイテム
export type QuestGrade = 'jokyu' | 'kiwami' | 'kyukyoku' | 'chozetsu' | 'chokyukyoku' | 'bakuzetsu'

/** クエストが求める人材の条件（タグ：'el:fire' のような属性か、'ab:バリア' のようなアビリティ） */
export interface Requirement {
  tag: string
  count: number
}

export interface Quest {
  id: string
  name: string // 空ならボスの名前を出す
  autoName?: boolean // 名前を付けていない（読み込むときに付く。保存はしない）
  bossSeries?: string // ボスのコラボ名（読み込むときに付く。保存はしない）
  builtin?: boolean // 最初から用意されている素材クエスト（編集・削除できない）
  drop?: MaterialDrop // 素材クエストで落ちるもの（なければ、ボスの部位の核。部位がなければ筋肉玉）
  kind?: 'boss' | 'material' // ボスクエスト（ボスが手に入る）か、素材クエスト（核が落ちる）か。なければボス
  bossDefId: string // ボス（倒すと手に入るモンスター。素材クエストでは見た目だけ）
  attr: FormAttr // ボスの部位（素材クエストで落ちる核の種類）
  element?: Element // ボスの属性（相性に使う。なければ零属性）
  weakSlots: string[] // 弱点種目（種目の枠ID）
  requirements?: Requirement[] // 求められる編成（6体の合計で満たす）
  requirementsBy?: Partial<Record<QuestDifficulty, Requirement[]>> // 難易度ごとの編成（最初からある素材クエスト）
  weakSlotsBy?: Partial<Record<QuestDifficulty, string[]>> // 難易度ごとの弱点種目
  gimmicks?: string[] // 旧：ギミック名（条件ができる前のクエスト。対応アビリティ2体の条件として読む）
  customGimmicks?: Record<string, string> // このクエストで作ったギミック → 対応するアビリティ名
  hp: Record<QuestDifficulty, number>
  rank?: number // 素材クエストの格（CONFIG.quest.ranks の番号。なければ「普通」）
  grade?: QuestGrade // ボスクエストの格（極・究極・超絶）。HPは hp.normal を使う
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
  luck?: number // 運（同じモンスターを食べさせると上がる。なければ1。99で運極）
  plusExp?: AttrExp // 次の＋に向けて注いだEXP
  plusFrom?: Partial<Record<ExpSource, AttrExp>> // 次の＋に向けて、どの財布から注いだか（返却用）
  shiny?: boolean // 色違い
  shinka?: boolean // 獣神化して★4になった
  shinkaGold?: boolean // 金の獣神化（相手の激レアと合体した）
  custom?: string // カスタマイズ枠に付けたアイテム（lib/custom の itemKey）
  customSlot?: string // 「得意種目の追加」で選んだ種目の枠ID
  locked?: boolean // ロック：まとめて合成・素材に使わない
  record?: { damage: number; quests: number; mvp: number; best: number } // 記録：通算ダメージ・出撃回数（倒した回数）・MVP回数・1回の最大ダメージ
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
