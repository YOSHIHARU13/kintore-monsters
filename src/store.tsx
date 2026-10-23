import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { User } from 'firebase/auth'
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  where,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore'
import { db } from './lib/firebase'
import { CONFIG } from './config/gameConfig'
import { ATTRS, DAYS, SLOTS, type Attr, type FormAttr } from './data/exercises'
import { FIRST_NODE_ID, canChangeTemplate, getNode, getTemplate, pathTo } from './data/evolutionTemplates'
import { dateKey, prevDateKey, weekStartKey } from './lib/date'
import { fusionCost, isExpFull, jogressStones, materialKeys, missingMaterials, nextCost, planPour } from './lib/evolution'
import { habitGoldNow, stepsGold } from './lib/rewards'
import { isWeekCleared } from './lib/week'
import { compressImage } from './lib/imageCompress'
import { bossGradeOf, drawSure, isPickupRarity, isReady, pickFrom, pullsAffordable, rarityOf, rateTable, starsOf, type Pay } from './lib/gacha'
import { isJogressReady } from './lib/stats'
import { battleOf, type Battle, defaultBossHp, dropPlus, isStrict, questGold } from './lib/quest'
import { bossQuestSync } from './lib/questAuto'
import {
  BALL_KEY,
  CORE_KEYS,
  CORE_LABEL,
  DROP_ICON,
  STONE_LABEL,
  ballsOf,
  coresOf,
  dropLabel,
  dropOf,
  rollBonusStones,
  rollMaterialDrop,
  stonesOf,
  type CoreKey,
} from './lib/cores'
import { pendingRanks, rankClaimKey, rankReward } from './lib/rank'
import {
  bulkFeedTarget,
  canFeed,
  dropLuck,
  fusionGain,
  isLuckMax,
  luckAfter,
  luckBonus,
  luckMaxClaimKey,
  luckMaxReward,
  planBulkFeed,
  protectedIds,
} from './lib/fusion'
import { autoPartners } from './lib/partner'
import { finalAttrs, recommend } from './lib/coverage'
import { abilitySlots, allGimmicks, jogressGradeOf, selectableGimmicks } from './lib/gimmick'
import { boostActive } from './lib/boosters'
import type { GachaSchedule } from './lib/gachaSchedule'
import { canShinka, planJogressMove, planLuckUse, shinkaRecipe } from './lib/shinka'
import { availableEvents, claimKey } from './lib/events'
import { activeToday, currentStats, loginReady, loginReward, type Reward } from './lib/missions'
import { builtinMaterialQuests, builtinTempleQuests } from './lib/materials'
import { itemInfo, itemLabel, rollTempleItems } from './lib/custom'
import { seriesOf, type Period, type Periods } from './lib/series'
import { castleCleared, castleFloors, castleOpen } from './lib/castle'
import { kinkinCleared, kinkinFloors, kinkinOpen } from './lib/kinkin'
import { TOWER_VERSION, allTowers, towerOpen, towerCleared, towerMonth, type FixedFloor, type TowerFloor } from './lib/tower'
import { ELEMENTS, elementInfo, jogressElementOf } from './lib/element'
import { investedFor, isHidden, nodeAttr, type AttrExp, type BannerSlide, type BoosterKey, type Checkin, type Element, type Gacha, type Quest, type QuestDifficulty, type QuestGrade, type RarityKey, type ExpSource, type GameState, type MonsterDef, type OwnedMonster, type SetRecord, type Song } from './types'

const zeroExp = () => ({ trained: 0, bought: 0 })

function initialState(): GameState {
  return {
    gold: 0,
    coins: 0,
    eggs: CONFIG.shop.starterEggs,
    exp: { chestArms: zeroExp(), legs: zeroExp(), backShoulders: zeroExp() },
    lifetimeExp: { chestArms: 0, legs: 0, backShoulders: 0 },
    anyExp: 0,
    attendance: 0,
    lastAttendanceDate: null,
    totalSets: 0,
    beatCount: 0,
    weeklyClears: 0,
    lastClearWeek: null,
    habitStreak: 0,
    habitDate: null,
    habitMinutesToday: 0,
    bestHabitStreak: 0,
    habitLabel: null,
    habitMode: 'check',
    lastCheckinDate: null,
    dexFound: {},
    dexShiny: {},
    pity: {},
    activeMonsterId: null,
    partners: {},
    challenge: null,
    questClears: 0,
    clearedQuests: {},
    tower: null,
    boosters: {},
    boosts: {},
    freeClaims: {},
    claims: {},
    loginDays: 0,
    stats: null,
    cores: {},
    stones: {},
    coreMisses: {},
    orbScale: 1,
    redesign: 2,
  }
}

function toState(data: DocumentData): GameState {
  const init = initialState()
  return {
    ...init,
    ...data,
    exp: { ...init.exp, ...data.exp },
    lifetimeExp: { ...init.lifetimeExp, ...data.lifetimeExp },
  } as GameState
}

/** 朝の記録を読む。禁欲を記録していたころのデータも、習慣の記録として読む */
function toCheckin(data: DocumentData): Checkin {
  return {
    date: data.date,
    steps: data.steps ?? 0,
    habit: data.habit ?? data.abstained ?? false,
    habitLabel: data.habitLabel ?? (data.abstained !== undefined ? '禁欲' : ''),
    streak: data.streak ?? 0,
    stepsGold: data.stepsGold ?? 0,
    habitGold: data.habitGold ?? data.abstinenceGold ?? 0,
    ...(data.habitMinutes !== undefined ? { habitMinutes: data.habitMinutes } : {}),
    ts: data.ts ?? 0,
  }
}

export interface MonsterDefInput {
  id?: string
  name: string
  templateId: string
  attrs: Record<string, FormAttr> // nodeId → その形態の属性
  names: Record<string, string> // nodeId → その段階だけの名前
  files: Record<string, File> // nodeId → 新しくアップロードする画像
  recipe: string[] // 隠しモンスターのレシピ（2体の defId）。普通のモンスターは空
  gachas: string[] // 入るガチャのID（最大3つ。空なら「いつものガチャ」）
  rarity: RarityKey // レア度（ノーマル・レア・激レア）
  bossGrade?: QuestGrade // 降臨の格
  questOnly: boolean
  tower?: boolean // 試練の塔の報酬にする（降臨のときだけ）
  castleLord?: boolean // 零の孤城の城主にする（爆絶の降臨のときだけ）
  castleOnly?: boolean // 零の孤城の限定にする（降臨のときだけ）
  jogressPartner?: string // 金の獣神化（合体）の相手（激レアのときだけ）
  jogressBirthStars: number // 隠しモンスターが生まれるときの星
  jogressPlus: number // 隠しモンスターの素材に必要な＋
  fixedStars: number // 進化しない降臨モンスターの星
  element: Element | '' // 属性（無属性は空）
  favoriteSlot: string // 得意種目の枠ID（なしは空）
  series?: string // シリーズ（コラボ名）。空なら通常
  abilities: string[] // アビリティ（対応するギミック名）
}

export type QuestInput = Omit<Quest, 'id' | 'createdAt'> & { id?: string }

export interface HatchResult {
  def: MonsterDef
  monsterId: string
  shiny: boolean
  pity: boolean // 確定で引いた（ホシ玉・確定ガチャ）か
}

/** 落ちた素材（例：💠 炎の結晶 ×4） */
export interface ItemDrop {
  icon: string
  label: string
  count: number
  pity?: boolean // 天井で確定したか
}

export interface QuestReward {
  monsterId: string | null // 手に入ったボス（素材クエストでは null）
  defId: string | null // 手に入ったモンスターの種類（塔では塔限定モンスター）
  eggs: number // 試練の塔でもらえたトク玉
  towerFloor: number | null // 試練の塔（castle なら零の孤城、kinkin なら禁筋の獄）の何階をクリアしたか
  castle?: boolean
  kinkin?: boolean
  booster?: BoosterKey | null // 試練の塔でもらえたブースター
  boosted?: boolean // 討伐ブースターで2倍になったか
  drops: ItemDrop[] // 落ちた素材（素材クエストで何も落ちなければ、0個の行が1つ）
  gold: number // オーブ
  coins?: number // もらえた進化コイン
  luck?: number // 手に入ったボスの運
  byMember?: Record<string, number> // 出撃した子ごとのダメージ
  mvpId?: string | null
  total?: number // 与えたダメージの合計
}

export interface GachaInput {
  id?: string
  name: string
  shinyRate: number
  catchphrase: string
  theme: string
  featured: string[]
  slides: BannerSlide[]
  banner?: File
  removeBanner?: boolean // 画像をやめて自動バナーにする
  pickups?: string[] // ピックアップにするモンスター（レア以上）の defId。いつものガチャでは使わない // 新しいバナー画像
  schedule?: GachaSchedule // 開催（いつでも・日付・毎月）
}

function toGacha(id: string, data: DocumentData | undefined): Gacha {
  const builtin = id === CONFIG.gacha.defaultId
  return {
    id,
    name: data?.name?.trim() || (builtin ? CONFIG.gacha.defaultName : '名前のないガチャ'),
    bannerImageId: data?.bannerImageId ?? null,
    shinyRate: data?.shinyRate ?? CONFIG.shop.shinyRate,
    catchphrase: data?.catchphrase ?? '',
    theme: data?.theme ?? 'royal',
    featured: data?.featured ?? [],
    slides: data?.slides ?? [],
    createdAt: data?.createdAt ?? 0,
    builtin,
    ...(data?.schedule ? { schedule: data.schedule as GachaSchedule } : {}),
  }
}

interface Store {
  user: User
  state: GameState
  menu: Record<string, string>
  defs: MonsterDef[]
  owned: OwnedMonster[]
  songs: Song[]
  seriesPeriods: Periods // コラボの開催期間
  gachas: Gacha[] // 先頭が「いつものガチャ」、あとは作った順
  quests: Quest[] // 作った順
  tower: TowerFloor[] // 今月の試練の塔（1階から）
  castle: TowerFloor[] // 零の孤城（1階から）
  kinkin: TowerFloor[] // 禁筋の獄（1階から）
  week: string // 今週の月曜の日付
  today: string
  weekSets: SetRecord[] // 今週（月曜はじまり）のセット記録
  todaySets: SetRecord[]
  yesterday: string // 朝の記録の対象日
  yesterdayCheckin: Checkin | null // 前日分の朝の記録（まだなら null）
  getHistory: (exerciseId: string) => Promise<SetRecord[]>
  /** セットを記録する。このセットで今週のタスクを全部消したら weekCleared が true */
  recordSet: (
    rec: Omit<SetRecord, 'id' | 'ts' | 'date'>,
    countsBeat: boolean,
  ) => { record: SetRecord; weekCleared: boolean; boosted: boolean }
  /** 前日の歩数と習慣を記録する。1日1回だけ */
  /** habit は○×のときの結果、minutes は分数で記録するときの分数 */
  recordMorning: (steps: number) => Checkin | null
  /** 習慣をその場で記録する（分数。○×なら0）。もらえたゴールド（記録できなければ null） */
  recordHabit: (minutes: number) => number | null
  setHabitLabel: (label: string) => void
  /** 2つ目の習慣を選ぶ（null でなし） */
  setHabit2Kind: (kind: string | null) => void
  /** 2つ目の習慣を記録する（良いことは text を書く）。もらえたオーブ（記録できなければ null） */
  recordHabit2: (text?: string) => number | null
  /** 「昨日あった良いこと」の日記（新しい順・最近の分） */
  journal: { id: string; date: string; text: string; ts: number }[]
  setHabitMode: (mode: GameState['habitMode']) => void
  /** 種目の枠に相棒をセットする（null で外す）。同じモンスターは1つの枠にしか入れない */
  setPartner: (slotId: string, monsterId: string | null) => void
  /** 全部の種目に、相棒をおまかせでセットする */
  autoSetPartners: () => void
  saveQuest: (input: QuestInput) => void
  deleteQuest: (id: string) => void
  /** クエストに出撃する（挑戦中のものがあれば、やめて選び直す）。その日のうちに倒す */
  startChallenge: (questId: string, difficulty: QuestDifficulty, party: string[]) => void
  quitChallenge: () => void
  /** 討伐の報酬を受け取る */
  claimQuest: () => QuestReward | null
  /** 余った結晶か核をトク玉1個と交換する */
  exchangeMaterial: (kind: 'stone' | 'muscle', key: string) => void
  /**
   * カスタマイズ枠にアイテムを付ける（favoriteSlot は「得意種目の追加」で選んだ種目）。
   * 前に付けていたアイテムは消える。useStick なら、ワクワクステッキを1本使って前のアイテムを持ち物に戻す
   */
  attachCustom: (monsterId: string, itemKey: string, favoriteSlot?: string, useStick?: boolean) => void
  /** ワクワクステッキを使って、付けているアイテムを外して持ち物に戻す */
  removeCustom: (monsterId: string) => void
  /** 登録一覧でまとめて変える：属性・レア度・降臨の格・シリーズ（決めた項目だけ） */
  bulkUpdateDefs: (ids: string[], patch: { element?: Element | null; tier?: RarityKey; bossGrade?: QuestGrade; series?: string }) => void
  /** ロックする・外す（ロックした子は、まとめて合成・素材に使わない） */
  toggleLock: (monsterId: string) => void
  /** ボスクエストの条件を、今の版のおまかせで作り直したことを記録する */
  markQuestRules: (version: number) => void
  /** たまっているランクアップ報酬をまとめて受け取る。受け取ったトク玉の数 */
  claimRanks: () => number
  setSlot: (slotId: string, exerciseId: string) => void
  buyExp: (attr: Attr, amount: number) => void

  buyBooster: (key: BoosterKey) => void
  useBooster: (key: BoosterKey) => void
  /** ガチャを1回引く。トク玉1個か、オーブ5個（pay）。選んだガチャから、確率どおりに1体（ダブりあり） */
  hatchEgg: (gachaId: string, pay?: Pay) => HatchResult | null
  /** まとめて引く（持っているぶんまで）。引けた分だけ返す */
  hatchMany: (gachaId: string, count: number, pay?: Pay) => HatchResult[]
  freePull: (eventId: string, gachaId: string) => HatchResult[]
  claimReward: (key: string, reward: Reward, boosters?: BoosterKey[]) => boolean
  claimLogin: () => Reward | null
  /** ガチャを作る・編集する。保存したガチャのID */
  saveGacha: (input: GachaInput) => Promise<string>
  /** ガチャを消す（入っていたモンスターはそのガチャから外れる）。「いつものガチャ」は消せない */
  deleteGacha: (id: string) => void
  pourExp: (monsterId: string, toNodeId: string, from: ExpSource) => void
  evolve: (monsterId: string, toNodeId: string) => void
  /** 最終形態のモンスターに、次の＋に向けてEXPを注ぐ */
  pourPlusExp: (monsterId: string, from: ExpSource) => void
  /** foodId のモンスターを monsterId（最終形態）に食べさせて＋1にする（同じモンスター同士だけ） */
  fuse: (monsterId: string, foodId: string) => void
  /** 同じモンスターをまとめて食べさせて運を上げる（タダ・最大99）。運極になったらもらえたトク玉の数 */
  feedLuck: (monsterId: string, foodIds: string[]) => number
  /** ダブりをまとめて食べさせる。luckMax は新しく運極になった数、eggs はその報酬のトク玉 */
  bulkFeed: () => { kept: number; fed: number; luckMax: number; eggs: number }
  /** ＋5の2体を合わせて隠しモンスターを生む。生まれた個体のID */
  jogress: (monsterId: string, partnerId: string, hiddenDefId: string) => string | null
  /**
   * 獣神化（★4）：レシピの降臨の運を使う。gold なら、相手の激レア（最終形態）1体も素材にして金の獣神化に。
   * 素材の運が余ったら、その子は運を減らしてBOXに残る
   */
  shinka: (monsterId: string, gold?: boolean) => boolean
  saveMonsterDef: (input: MonsterDefInput) => Promise<void>
  /** 属性・得意種目・アビリティを、足りないものでまとめて埋める（1体ずつ、前に埋めた分も数えて） */
  autoTuneDefs: (ids: string[]) => void
  loadImage: (imageId: string) => Promise<string | null>
  saveSongs: (songs: Song[]) => void
  saveSeriesPeriod: (series: string, period: Period | null) => void
  /** コラボ名をまとめて変える（そのコラボの子全員と、開催期間も） */
  renameSeries: (from: string, to: string) => void
  towerFixed: FixedFloor[] | null // 保存した塔（毎月これを使う）
  fixTower: (floors: FixedFloor[] | null) => void
}

const StoreContext = createContext<Store | null>(null)

export function useStore(): Store {
  const store = useContext(StoreContext)
  if (!store) throw new Error('StoreProvider の外で useStore が呼ばれました')
  return store
}

const imageCache = new Map<string, Promise<string | null>>()

export function StoreProvider({ user, children }: { user: User; children: ReactNode }) {
  const base = `users/${user.uid}`
  const [state, setState] = useState<GameState | null>(null)
  const [menu, setMenu] = useState<Record<string, string>>({})
  const [defs, setDefs] = useState<MonsterDef[]>([])
  const [owned, setOwned] = useState<OwnedMonster[]>([])
  const [songs, setSongs] = useState<Song[]>([])
  const [seriesPeriods, setSeriesPeriods] = useState<Periods>({})
  const [towerFixed, setTowerFixed] = useState<FixedFloor[] | null>(null)
  const [gachaDocs, setGachaDocs] = useState<Gacha[]>([])
  const [questDocs, setQuests] = useState<Quest[]>([])
  const [today, setToday] = useState(dateKey())
  const [weekSets, setWeekSets] = useState<SetRecord[]>([])
  const [yesterdayCheckin, setYesterdayCheckin] = useState<Checkin | null>(null)
  const [journal, setJournal] = useState<{ id: string; date: string; text: string; ts: number }[]>([])
  const [error, setError] = useState<string | null>(null)

  const stateRef = useMemo(() => doc(db, base, 'meta', 'state'), [base])
  const menuRef = useMemo(() => doc(db, base, 'meta', 'menu'), [base])
  const musicRef = useMemo(() => doc(db, base, 'meta', 'music'), [base])
  const seriesRef = useMemo(() => doc(db, base, 'meta', 'series'), [base])
  const towerRef = useMemo(() => doc(db, base, 'meta', 'tower'), [base])

  const fail = useCallback((e: unknown) => {
    console.error(e)
    setError('保存に失敗しました。通信状態を確認してください。')
  }, [])

  // 日付が変わったら「今日」を更新する
  useEffect(() => {
    const tick = () => setToday(dateKey())
    const timer = setInterval(tick, 60_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])

  useEffect(() => {
    const unsubs = [
      onSnapshot(
        stateRef,
        { includeMetadataChanges: true },
        (snap) => {
          if (snap.exists()) {
            setState(toState(snap.data()))
            // ゴールドをオーブにしたとき、単位を10分の1にした（ガチャ1回 50G → 5オーブ）。前のデータは1回だけ割る
            if (snap.data().orbScale !== 1 && !snap.metadata.fromCache) {
              runTransaction(db, async (tx) => {
                const cur = await tx.get(stateRef)
                if (!cur.exists() || cur.data().orbScale === 1) return
                tx.update(stateRef, { gold: Math.floor((cur.data().gold ?? 0) / 10), orbScale: 1 })
              }).catch(fail)
            }
          } else if (!snap.metadata.fromCache) {
            // サーバーにも存在しないと確認できたときだけ初期データを作る（別端末のデータを上書きしないため）
            setDoc(stateRef, initialState()).catch(fail)
          }
        },
        fail,
      ),
      onSnapshot(menuRef, (snap) => setMenu((snap.data() as Record<string, string>) ?? {}), fail),
      onSnapshot(
        // 日記は最近30日ぶん
        query(collection(db, base, 'journal'), where('date', '>=', dateKey(new Date(Date.now() - 30 * 86400000)))),
        (snap) =>
          setJournal(
            snap.docs
              .map((d) => ({ ...(d.data() as { date: string; text: string; ts: number }), id: d.id }))
              .sort((a, b) => b.ts - a.ts),
          ),
        fail,
      ),
      onSnapshot(musicRef, (snap) => setSongs((snap.data()?.songs as Song[] | undefined) ?? []), fail),
      onSnapshot(seriesRef, (snap) => setSeriesPeriods((snap.data()?.periods as Periods | undefined) ?? {}), fail),
      onSnapshot(
        towerRef,
        (snap) =>
          setTowerFixed(snap.data()?.version === TOWER_VERSION ? ((snap.data()?.floors as FixedFloor[] | undefined) ?? null) : null),
        fail,
      ),
      onSnapshot(
        collection(db, base, 'quests'),
        (snap) =>
          setQuests(
            snap.docs
              .map((d) => ({ ...(d.data() as Omit<Quest, 'id'>), id: d.id }))
              .sort((a, b) => a.createdAt - b.createdAt),
          ),
        fail,
      ),
      onSnapshot(
        collection(db, base, 'gachas'),
        (snap) => setGachaDocs(snap.docs.map((d) => toGacha(d.id, d.data()))),
        fail,
      ),
      onSnapshot(
        collection(db, base, 'monsterDefs'),
        (snap) =>
          setDefs(
            snap.docs
              .map((d) => ({ ...(d.data() as Omit<MonsterDef, 'id'>), id: d.id }))
              .sort((a, b) => a.createdAt - b.createdAt),
          ),
        fail,
      ),
      onSnapshot(
        collection(db, base, 'ownedMonsters'),
        (snap) =>
          setOwned(
            snap.docs
              // ダブりなしだったころのデータは、ドキュメントIDがそのままモンスターのID
              .map((d) => ({ defId: d.id, ...(d.data() as Omit<OwnedMonster, 'id' | 'defId'>), id: d.id }))
              .sort((a, b) => a.obtainedAt - b.obtainedAt),
          ),
        fail,
      ),
    ]
    return () => unsubs.forEach((u) => u())
  }, [base, stateRef, menuRef, musicRef, seriesRef, towerRef, fail])

  // 作り直し（2026-10）のデータの引っ越し（1回だけ）：降臨の格を書き込む。
  // 格は、今あるボスクエストの格から（なければ以前のレア度から）。レア度は読むときに読み替えるので書き換えない
  const migrated = useRef(false)
  useEffect(() => {
    if (!state || (state.redesign ?? 0) >= 1 || defs.length === 0 || migrated.current) return
    migrated.current = true
    const batch = writeBatch(db)
    for (const d of defs.filter((x) => x.questOnly && !isHidden(x) && !x.bossGrade)) {
      const quest = questDocs.find((q) => q.kind !== 'material' && q.bossDefId === d.id && q.grade)
      // 激レアの降臨は、前の作り直しで「爆絶級」にした子。それ以外は今のクエストの格を引き継ぐ
      const grade = d.questTier || d.rarity === 'superRare' ? 'bakuzetsu' : (quest?.grade ?? bossGradeOf(d))
      const lord = d.questTier === 'lastBoss' || d.castleLord
      batch.update(doc(db, base, 'monsterDefs', d.id), { bossGrade: grade, ...(lord ? { castleLord: true } : {}), questTier: null })
      // ボスクエストの格も、降臨の格に合わせる
      const sync = bossQuestSync({ ...d, bossGrade: grade, castleLord: lord }, questDocs, selectableGimmicks(questDocs), defs, defaultBossHp)
      if (sync?.id) batch.update(doc(db, base, 'quests', sync.id), sync.data)
    }
    batch.update(stateRef, { redesign: 1 })
    batch.commit().catch(fail)
  }, [state, defs, questDocs, base, stateRef, fail])

  // 以前のジョグレスの子を、1体目の激レアの「金の獣神化」に引っ越す（1回だけ）
  const movedJogress = useRef(false)
  useEffect(() => {
    // 持っている子を読み込む前に動くと、生まれた子が行き場をなくすので、読み込んでから
    if (!state || state.redesign !== 1 || defs.length === 0 || owned.length === 0 || movedJogress.current) return
    movedJogress.current = true
    const plan = planJogressMove(defs, owned)
    const batch = writeBatch(db)
    for (const d of plan.defs) batch.update(doc(db, base, 'monsterDefs', d.id), d.data)
    for (const o of plan.owned) batch.update(doc(db, base, 'ownedMonsters', o.id), o.data)
    for (const id of plan.remove) batch.delete(doc(db, base, 'monsterDefs', id))
    batch.update(stateRef, { redesign: 2 })
    batch.commit().catch(fail)
  }, [state, defs, owned, base, stateRef, fail])

  // 「いつものガチャ」は、保存していなくても必ずある
  const gachas = useMemo(() => {
    const builtin = gachaDocs.find((g) => g.builtin) ?? toGacha(CONFIG.gacha.defaultId, undefined)
    const others = gachaDocs.filter((g) => !g.builtin).sort((a, b) => a.createdAt - b.createdAt)
    return [builtin, ...others]
  }, [gachaDocs])

  const week = useMemo(() => weekStartKey(new Date(`${today}T12:00:00`)), [today])
  const todaySets = useMemo(() => weekSets.filter((s) => s.date === today), [weekSets, today])

  // 週が変わったら（月曜になったら）今週のタスクは空から始まる
  useEffect(() => {
    setWeekSets([])
    return onSnapshot(
      query(collection(db, base, 'sets'), where('date', '>=', week)),
      (snap) =>
        setWeekSets(
          snap.docs.map((d) => ({ ...(d.data() as Omit<SetRecord, 'id'>), id: d.id })).sort((a, b) => a.ts - b.ts),
        ),
      fail,
    )
  }, [base, week, fail])

  // ボスの属性は、いつもボスのモンスターの属性と同じ（モンスターの属性を変えればクエストも変わる）
  const quests = useMemo(
    () =>
      questDocs.map((q): Quest => {
        const boss = defs.find((d) => d.id === q.bossDefId)
        const autoName = !q.name?.trim()
        const name = autoName ? (boss?.name ?? '名前のないクエスト') : q.name
        return boss
          ? { ...q, name, autoName, element: elementInfo(boss).elements[0], bossSeries: seriesOf(boss) }
          : { ...q, name, autoName }
      }).concat([
        ...builtinMaterialQuests(defs, today, selectableGimmicks(questDocs)),
        ...builtinTempleQuests(defs, today, selectableGimmicks(questDocs)),
      ]),
    [questDocs, defs, today],
  )
  const yesterday = useMemo(() => prevDateKey(today), [today])
  const tower = useMemo(
    // 超絶10体ごとに1つの塔。ここでは全部の塔の階を1つの並びにする（floor.tower が何番目の塔か）
    () => allTowers(towerMonth(today), defs, selectableGimmicks(quests), quests, towerFixed).flat(),
    [today, defs, quests, towerFixed],
  )
  const castle = useMemo(() => castleFloors(defs, selectableGimmicks(quests), quests), [defs, quests])
  const kinkin = useMemo(() => kinkinFloors(defs, selectableGimmicks(quests), quests), [defs, quests])


  useEffect(() => {
    setYesterdayCheckin(null)
    return onSnapshot(
      doc(db, base, 'checkins', yesterday),
      (snap) => setYesterdayCheckin(snap.exists() ? toCheckin(snap.data()) : null),
      fail,
    )
  }, [base, yesterday, fail])

  const store = useMemo<Store | null>(() => {
    if (!state) return null

    const getHistory: Store['getHistory'] = async (exerciseId) => {
      const snap = await getDocs(query(collection(db, base, 'sets'), where('exerciseId', '==', exerciseId)))
      return snap.docs.map((d) => ({ ...(d.data() as Omit<SetRecord, 'id'>), id: d.id }))
    }

    const recordSet: Store['recordSet'] = (input, countsBeat) => {
      const ref = doc(collection(db, base, 'sets'))
      // 筋トレブースター使用中：EXPが2倍（残りセット数を1つ減らす）
      const boosted = input.exp > 0 && (state.boosts?.expSets ?? 0) > 0
      const rec = boosted ? { ...input, exp: input.exp * 2 } : input
      const full = { ...rec, ts: Date.now(), date: dateKey() }
      const update: DocumentData = { totalSets: increment(1) }
      if (boosted) update['boosts.expSets'] = increment(-1)
      if (state.lastAttendanceDate !== full.date) {
        update.attendance = increment(1)
        update.lastAttendanceDate = full.date
      }
      // EXPは、その種目の部位の属性に入る
      if (rec.exp > 0 && rec.day !== 'bonus') {
        const attr = DAYS[rec.day].attr
        update[`exp.${attr}.trained`] = increment(rec.exp)
        update[`lifetimeExp.${attr}`] = increment(rec.exp)
      }
      // ボーナス枠（腹筋ローラー）のEXPは万能EXPに入る
      if (rec.exp > 0 && rec.day === 'bonus') {
        update.anyExp = increment(rec.exp)
        update.lifetimeAnyExp = increment(rec.exp)
      }
      if (rec.gold > 0) update.gold = increment(rec.gold)
      if (countsBeat) update.beatCount = increment(1)
      // このセットで今週のタスクを全部消したら、全消しボーナス（同じ週に2回は渡さない）
      const thisWeek = weekStartKey()
      const before = thisWeek === week ? weekSets : []
      const weekCleared =
        state.lastClearWeek !== thisWeek && !isWeekCleared(before) && isWeekCleared([...before, full])
      if (weekCleared) {
        update.gold = increment(rec.gold + CONFIG.weekly.clearGold)
        update.weeklyClears = increment(1)
        update.lastClearWeek = thisWeek
      }
      const batch = writeBatch(db)
      batch.set(ref, full)
      batch.update(stateRef, update)
      batch.commit().catch(fail)
      return { record: { ...full, id: ref.id }, weekCleared, boosted }
    }

    const recordMorning: Store['recordMorning'] = (steps) => {
      if (state.lastCheckinDate === yesterday || yesterdayCheckin) return null
      const record: Checkin = {
        date: yesterday,
        steps: Math.floor(Math.max(0, steps)),
        habit: false,
        habitLabel: '',
        streak: 0,
        stepsGold: stepsGold(steps),
        habitGold: 0,
        ts: Date.now(),
      }
      const batch = writeBatch(db)
      batch.set(doc(db, base, 'checkins', yesterday), record)
      batch.update(stateRef, { gold: increment(record.stepsGold), lastCheckinDate: yesterday })
      batch.commit().catch(fail)
      return record
    }

    const recordHabit: Store['recordHabit'] = (minutes) => {
      const now = dateKey()
      const byMinutes = state.habitMode === 'minutes'
      const mins = Math.max(0, Math.floor(minutes))
      if (byMinutes ? mins < 1 : state.habitDate === now) return null
      const gold = habitGoldNow(state, now, mins)
      // その日の最初の記録で連続日数を数える（前日にもやっていれば続く）
      const first = state.habitDate !== now
      const streak = first ? (state.habitDate === prevDateKey(now) ? state.habitStreak + 1 : 1) : state.habitStreak
      const update: DocumentData = {
        habitDate: now,
        habitMinutesToday: first ? mins : increment(mins),
        habitStreak: streak,
        bestHabitStreak: Math.max(state.bestHabitStreak, streak),
      }
      bumpStats(update, { habit: byMinutes ? mins : 0 })
      if (gold > 0) update.gold = increment(gold)
      if (gold > 0 && state.boosts?.habit) update['boosts.habit'] = false
      updateState(update)
      return gold
    }

    const setHabitLabel: Store['setHabitLabel'] = (label) => updateState({ habitLabel: label.trim() || null })

    const setHabit2Kind: Store['setHabit2Kind'] = (kind) =>
      updateState({ habit2: { kind, date: state.habit2?.date ?? null, count: state.habit2?.count ?? 0 } })

    const recordHabit2: Store['recordHabit2'] = (text) => {
      const kind = state.habit2?.kind
      const h = kind ? CONFIG.morning.habit2[kind] : undefined
      if (!kind || !h) return null
      const now = dateKey()
      const count = state.habit2?.date === now ? state.habit2.count : 0
      if (count >= h.max) return null
      if (kind === 'goodThings' && !text?.trim()) return null
      const batch = writeBatch(db)
      batch.update(stateRef, { habit2: { kind, date: now, count: count + 1 }, gold: increment(h.gold) })
      // 良いことは日記として残す
      if (kind === 'goodThings') batch.set(doc(collection(db, base, 'journal')), { date: now, text: text!.trim().slice(0, 140), ts: Date.now() })
      batch.commit().catch(fail)
      return h.gold
    }

    const setHabitMode: Store['setHabitMode'] = (mode) => updateState({ habitMode: mode })

    const autoSetPartners: Store['autoSetPartners'] = () => {
      updateState({ partners: autoPartners(SLOTS.map((s) => s.id), owned, defs) })
    }

    const setPartner: Store['setPartner'] = (slotId, monsterId) => {
      const update: DocumentData = {}
      // 同じモンスターがほかの枠にいたら外す
      for (const [slot, id] of Object.entries(state.partners)) {
        if (monsterId && id === monsterId && slot !== slotId) update[`partners.${slot}`] = deleteField()
      }
      update[`partners.${slotId}`] = monsterId ?? deleteField()
      updateState(update)
    }

    const setSlot: Store['setSlot'] = (slotId, exerciseId) => {
      setDoc(menuRef, { [slotId]: exerciseId }, { merge: true }).catch(fail)
    }

    const updateState = (update: DocumentData) => {
      const batch = writeBatch(db)
      batch.update(stateRef, update)
      batch.commit().catch(fail)
    }

    /** ミッション用の今日・今週の記録を進める（update にまとめて書く） */
    const bumpStats = (update: DocumentData, delta: { quest?: number; strict?: number; habit?: number }) => {
      const st = currentStats(state, dateKey(), weekStartKey())
      update.stats = {
        ...st,
        dayQuestClears: st.dayQuestClears + (delta.quest ?? 0),
        weekQuestClears: st.weekQuestClears + (delta.quest ?? 0),
        weekStrictClears: st.weekStrictClears + (delta.strict ?? 0),
        weekHabitMinutes: st.weekHabitMinutes + (delta.habit ?? 0),
      }
    }

    /** 報酬を受け取る（同じキーは1回だけ） */
    const addReward = (update: DocumentData, reward: Reward, boosters: BoosterKey[] = []) => {
      if (reward.eggs) update.eggs = increment(reward.eggs)
      if (reward.gold) update.gold = increment(reward.gold)
      if (reward.coins) update.coins = increment(reward.coins)
      if (reward.stones) for (const e of ELEMENTS) update[`stones.${e}`] = increment(reward.stones)
      if (reward.cores) for (const k of CORE_KEYS) update[`cores.${k}`] = increment(reward.cores)
      if (reward.balls) update[`cores.${BALL_KEY}`] = increment(reward.balls)
      for (const b of [...(reward.booster ? [reward.booster] : []), ...boosters]) update[`boosters.${b}`] = increment(1)
    }
    const claimReward: Store['claimReward'] = (key, reward, boosters) => {
      if (state.claims?.[key]) return false
      const update: DocumentData = { [`claims.${key}`]: true }
      addReward(update, reward, boosters)
      updateState(update)
      return true
    }

    /** ログインボーナス：1日1回 */
    const claimLogin: Store['claimLogin'] = () => {
      const key = `login:${dateKey()}`
      if (state.claims?.[key] || !loginReady(state, yesterday)) return null
      const { reward } = loginReward(state)
      const update: DocumentData = { [`claims.${key}`]: true, loginDays: increment(1) }
      addReward(update, reward)
      updateState(update)
      return reward
    }

    const buyExp: Store['buyExp'] = (attr, amount) => {
      const cost = amount * CONFIG.shop.coinsPerExp
      if (amount <= 0 || (state.coins ?? 0) < cost) return
      updateState({ coins: increment(-cost), [`exp.${attr}.bought`]: increment(amount) })
    }

    const buyBooster: Store['buyBooster'] = (key) => {
      const price = CONFIG.boosters[key].price
      if (state.gold < price) return
      updateState({ gold: increment(-price), [`boosters.${key}`]: increment(1) })
    }

    /** ブースターを使う。同じ種類が使用中なら重ねない */
    const useBooster: Store['useBooster'] = (key) => {
      if ((state.boosters?.[key] ?? 0) < 1 || boostActive(state, key)) return
      updateState({
        [`boosters.${key}`]: increment(-1),
        [`boosts.${key === 'exp' ? 'expSets' : key}`]: key === 'exp' ? CONFIG.boosters.exp.sets : true,
      })
    }

    // count 回まとめて引く（トク玉かオーブで、持っているぶんまで）。1回ずつ天井の回数を数え直し、1つの書き込みにまとめる
    const hatchMany: Store['hatchMany'] = (gachaId, count, pay = 'eggs') =>
      pull(gachaId, Math.min(count, pullsAffordable(state, pay)), { pay })

    /** 無料ガチャのイベント：トク玉もオーブも使わずに引く（その日1回だけ） */
    const freePull: Store['freePull'] = (eventId, gachaId) => {
      const today = dateKey()
      const ev = availableEvents(state, today).find((e) => e.id === eventId)
      if (!ev || !activeToday(state, todaySets, today, yesterday)) return []
      return pull(gachaId, ev.pulls, { free: true, guaranteed: ev.guaranteed, claim: claimKey(ev, today) })
    }

    const pull = (gachaId: string, times: number, opts: { free?: boolean; guaranteed?: boolean; claim?: string; pay?: Pay }) => {
      const gacha = gachas.find((g) => g.id === gachaId)
      if (!gacha || times <= 0) return []
      // 隠しモンスターはタマゴからは生まれない（rateTable が外す）
      const table = rateTable(gacha.id, defs)
      if (!isReady(gacha, table)) return []
      const batch = writeBatch(db)
      const update: DocumentData = {}
      const results: HatchResult[] = []
      // ホシ玉：ノーマルが累計 hoshi.normals 回出るたびに1個
      let normals = state.normalCount ?? 0
      let hoshi = 0
      for (let i = 0; i < times; i++) {
        // ホシ玉と、激レア確定ガチャの1回目は、レア以上が確定
        const sure = opts.pay === 'hoshi' || (opts.guaranteed && i === 0)
        const def = sure
          ? drawSure(table, Math.random(), opts.guaranteed ? 1 : CONFIG.gacha.hoshi.superRareRate)
          : pickFrom(table, Math.random())
        if (!def) break
        const shiny = false // 色違いはなくなった
        const ref = doc(collection(db, base, 'ownedMonsters'))
        batch.set(ref, {
          defId: def.id,
          nodeId: FIRST_NODE_ID,
          investedBy: {},
          investedFrom: {},
          shiny,
          luck: CONFIG.luck.gachaStart,
          obtainedAt: Date.now() + i, // まとめて引いても入手順がずれないように
        })
        if (rarityOf(def) === 'normal') {
          normals++
          if (normals >= CONFIG.gacha.hoshi.normals) {
            normals -= CONFIG.gacha.hoshi.normals
            hoshi++
          }
        }
        results.push({ def, monsterId: ref.id, shiny, pity: !!sure })
      }
      if (!opts.free && opts.pay === 'orbs') update.gold = increment(-results.length * CONFIG.shop.pullPrice)
      else if (!opts.free && opts.pay === 'hoshi') update.hoshi = increment(-results.length + hoshi)
      else if (!opts.free) update.eggs = increment(-results.length)
      if (hoshi > 0 && opts.pay !== 'hoshi') update.hoshi = increment(hoshi)
      if (opts.claim) update[`freeClaims.${opts.claim}`] = true
      update.normalCount = normals
      batch.update(stateRef, update)
      batch.commit().catch(fail)
      return results
    }

    const hatchEgg: Store['hatchEgg'] = (gachaId, pay) => hatchMany(gachaId, 1, pay)[0] ?? null

    const findMonster = (monsterId: string) => {
      const mon = owned.find((o) => o.id === monsterId)
      const def = mon && defs.find((d) => d.id === mon.defId)
      if (!mon || !def) return null
      const node = getNode(getTemplate(def.templateId), mon.nodeId)
      return { mon, def, node, cost: nextCost(getTemplate(def.templateId), node) }
    }

    // 進化先の形態の属性のEXPを注ぐ（無属性の進化先には、どの属性のEXPでも注げる。万能EXPはどこにでも注げる）
    const pourExp: Store['pourExp'] = (monsterId, toNodeId, from) => {
      const found = findMonster(monsterId)
      if (!found?.cost || !found.node.next.includes(toNodeId)) return
      const { mon, def, node, cost } = found
      const attr = nodeAttr(def, toNodeId)
      if (from !== 'any' && attr !== 'none' && attr !== from) return
      const pour = planPour(cost, investedFor(mon, toNodeId, node.next[0]), walletOf(from))
      if (pour.trained + pour.bought <= 0) return
      const batch = writeBatch(db)
      batch.update(doc(db, base, 'ownedMonsters', monsterId), {
        [`investedBy.${toNodeId}.trained`]: increment(pour.trained),
        [`investedBy.${toNodeId}.bought`]: increment(pour.bought),
        [`investedFrom.${toNodeId}.${from}.trained`]: increment(pour.trained),
        [`investedFrom.${toNodeId}.${from}.bought`]: increment(pour.bought),
      })
      batch.update(stateRef, spendFrom(from, pour))
      batch.commit().catch(fail)
    }

    const walletOf = (from: ExpSource): AttrExp => (from === 'any' ? { trained: state.anyExp, bought: 0 } : state.exp[from])

    const spendFrom = (from: ExpSource, pour: AttrExp): DocumentData =>
      from === 'any'
        ? { anyExp: increment(-pour.trained) }
        : { [`exp.${from}.trained`]: increment(-pour.trained), [`exp.${from}.bought`]: increment(-pour.bought) }

    // 最終形態の属性のEXP（無属性ならどの属性でも）か、万能EXPを、次の＋のゲージに注ぐ
    const pourPlusExp: Store['pourPlusExp'] = (monsterId, from) => {
      const found = findMonster(monsterId)
      if (!found || found.node.next.length > 0) return
      const { mon, def } = found
      const cost = fusionCost(mon.plus ?? 0)
      const attr = nodeAttr(def, mon.nodeId)
      if (!cost || (from !== 'any' && attr !== 'none' && attr !== from)) return
      const pour = planPour(cost, mon.plusExp ?? zeroExp(), walletOf(from))
      if (pour.trained + pour.bought <= 0) return
      const batch = writeBatch(db)
      batch.update(doc(db, base, 'ownedMonsters', monsterId), {
        'plusExp.trained': increment(pour.trained),
        'plusExp.bought': increment(pour.bought),
        [`plusFrom.${from}.trained`]: increment(pour.trained),
        [`plusFrom.${from}.bought`]: increment(pour.bought),
      })
      batch.update(stateRef, spendFrom(from, pour))
      batch.commit().catch(fail)
    }

    const evolve: Store['evolve'] = (monsterId, toNodeId) => {
      const found = findMonster(monsterId)
      if (!found?.cost || !found.node.next.includes(toNodeId)) return
      const { mon, def, node, cost } = found
      if (!isExpFull(cost, investedFor(mon, toNodeId, node.next[0]))) return
      if (missingMaterials(cost, def, toNodeId, state).length > 0) return
      const keys = materialKeys(def, toNodeId, state)
      // 選ばなかった進化先に注いでいたEXPは、元の財布に返す
      const update: DocumentData = { coins: increment(-cost.coins) }
      if (cost.stones) update[`stones.${keys.stone}`] = increment(-cost.stones)
      if (cost.muscle) update[`cores.${keys.muscle}`] = increment(-cost.muscle)
      if (cost.balls) update[`cores.${BALL_KEY}`] = increment(-cost.balls)
      const refund = newRefund()
      addRefund(refund, mon, def, node.next.filter((n) => n !== toNodeId))
      applyRefund(update, refund)
      const batch = writeBatch(db)
      batch.update(doc(db, base, 'ownedMonsters', monsterId), {
        nodeId: toNodeId,
        investedBy: {},
        investedFrom: {},
        invested: zeroExp(),
      })
      batch.update(stateRef, update)
      batch.commit().catch(fail)
    }

    // 最終形態に、同じモンスター（＋2）か同じ属性のモンスター（＋1）を食べさせる（段階は問わない。食べさせた側の＋も引き継ぐ）
    // 食べさせた側に注いでいたEXPは財布に返し、見つけていた形態は図鑑に残す
    const fuse: Store['fuse'] = (monsterId, foodId) => {
      const found = findMonster(monsterId)
      const food = findMonster(foodId)
      if (!found || !food || monsterId === foodId || !canFeed(found.def, food.def)) return
      if (found.node.next.length > 0) return
      const plus = found.mon.plus ?? 0
      const cost = fusionCost(plus)
      if (!cost || !isExpFull(cost, found.mon.plusExp ?? zeroExp()) || (state.coins ?? 0) < cost.coins) return
      const update: DocumentData = { coins: increment(-cost.coins) }
      consume(update, [food])
      const batch = writeBatch(db)
      batch.update(doc(db, base, 'ownedMonsters', monsterId), {
        plus: Math.min(CONFIG.fusion.maxPlus, plus + fusionGain(found.def, food.def, food.mon)),
        plusExp: zeroExp(),
        plusFrom: {},
      })
      batch.delete(doc(db, base, 'ownedMonsters', foodId))
      batch.update(stateRef, update)
      batch.commit().catch(fail)
    }

    // 同じモンスターを食べさせて運を上げる（段階は問わない・タダ）。食べさせた側のEXPは財布に戻し、図鑑の発見も残す
    /** ノーマル以下のダブりを、モンスターごとにいちばん育っている1体へまとめて食べさせる */
    const bulkFeed: Store['bulkFeed'] = () => {
      const plans = planBulkFeed(owned, defs, protectedIds(state, dateKey(), owned), starsOf, bulkFeedTarget)
      if (plans.length === 0) return { kept: 0, fed: 0, luckMax: 0, eggs: 0 }
      const update: DocumentData = {}
      const batch = writeBatch(db)
      const foods = plans.flatMap((p) => p.foodIds).map(findMonster).filter((f) => !!f)
      consume(update, foods)
      let luckMax = 0
      let eggs = 0
      for (const p of plans) {
        batch.update(doc(db, base, 'ownedMonsters', p.keeperId), { luck: p.luck })
        const keeper = findMonster(p.keeperId)
        const got = keeper ? luckMaxBonus(update, keeper.mon, keeper.def, p.luck) : 0
        if (got > 0) luckMax++
        eggs += got
      }
      if (eggs > 0) update.eggs = increment(eggs)
      for (const f of foods) batch.delete(doc(db, base, 'ownedMonsters', f.mon.id))
      if (Object.keys(update).length > 0) batch.update(stateRef, update)
      batch.commit().catch(fail)
      return { kept: plans.length, fed: foods.length, luckMax, eggs }
    }

    /** 運が99に届いたら、運極の報酬（1体につき1回）を update に書く。もらえるトク玉の数 */
    const luckMaxBonus = (update: DocumentData, mon: OwnedMonster, def: MonsterDef, luck: number): number => {
      // 同じモンスターの運極は1種類として数える（以前の1体ごとの記録も見る）
      if (isLuckMax(mon) || luck < CONFIG.luck.max || state.claims?.[luckMaxClaimKey(def.id)] || state.claims?.[`luckMax:${mon.id}`]) return 0
      if (owned.some((o) => o.defId === def.id && o.id !== mon.id && isLuckMax(o))) return 0
      update[`claims.${luckMaxClaimKey(def.id)}`] = true
      return luckMaxReward(def)
    }

    const feedLuck: Store['feedLuck'] = (monsterId, foodIds) => {
      const found = findMonster(monsterId)
      if (!found || isLuckMax(found.mon)) return 0
      const foods = foodIds
        .filter((f) => f !== monsterId)
        .map(findMonster)
        .filter((f): f is NonNullable<typeof f> => !!f && f.mon.defId === found.mon.defId)
      if (foods.length === 0) return 0
      // 1体ずつ足していく（最大99）
      const luck = foods.reduce((sum, f) => luckAfter({ luck: sum }, f.mon), found.mon.luck ?? 1)
      const update: DocumentData = {}
      consume(update, foods)
      const eggs = luckMaxBonus(update, found.mon, found.def, luck)
      if (eggs > 0) update.eggs = increment(eggs)
      const batch = writeBatch(db)
      batch.update(doc(db, base, 'ownedMonsters', monsterId), { luck })
      for (const f of foods) batch.delete(doc(db, base, 'ownedMonsters', f.mon.id))
      if (Object.keys(update).length > 0) batch.update(stateRef, update)
      batch.commit().catch(fail)
      return eggs
    }

    // レシピの2体（どちらも最終形態の＋5）を合わせて、隠しモンスターを生む。2体はいなくなる
    /** 神化：最終形態の激レアに、同じ属性の降臨モンスターを1体食べさせて★4にする */
    const shinka: Store['shinka'] = (monsterId, gold = false) => {
      const found = findMonster(monsterId)
      if (!found || !canShinka(found.mon, found.def)) return false
      if ((state.coins ?? 0) < CONFIG.shinka.coins) return false
      // 守る子（相棒・出撃中・この子自身）は素材にしない
      const keep = new Set([...protectedIds(state, dateKey(), owned), monsterId])
      const removeIds: string[] = []
      const luckUpdates: { id: string; luck: number }[] = []
      for (const item of shinkaRecipe(found.def, defs)) {
        const plan = planLuckUse(
          item.count * item.luck,
          owned.filter((o) => o.defId === item.defId && !keep.has(o.id)),
        )
        if (!plan) return false
        removeIds.push(...plan.remove)
        if (plan.keep) luckUpdates.push(plan.keep)
      }
      // 金：相手の激レアの最終形態を1体（運がいちばん低い子）
      if (gold) {
        const partnerDefId = found.def.jogressPartner
        const partner = owned
          .filter((o) => o.defId === partnerDefId && !keep.has(o.id) && !removeIds.includes(o.id))
          .map((o) => findMonster(o.id))
          .filter((f) => !!f && f.node.next.length === 0)
          .sort((x, y) => (x!.mon.luck ?? 1) - (y!.mon.luck ?? 1))[0]
        if (!partner) return false
        removeIds.push(partner.mon.id)
      }
      const gone = removeIds.map(findMonster).filter((f): f is NonNullable<typeof f> => !!f)
      const update: DocumentData = { coins: increment(-CONFIG.shinka.coins) }
      consume(update, gone)
      const batch = writeBatch(db)
      batch.update(doc(db, base, 'ownedMonsters', monsterId), { shinka: true, shinkaGold: gold })
      for (const f of gone) batch.delete(doc(db, base, 'ownedMonsters', f.mon.id))
      for (const k of luckUpdates) batch.update(doc(db, base, 'ownedMonsters', k.id), { luck: k.luck })
      batch.update(stateRef, update)
      batch.commit().catch(fail)
      return true
    }

    const jogress: Store['jogress'] = (monsterId, partnerId, hiddenDefId) => {
      const a = findMonster(monsterId)
      const b = findMonster(partnerId)
      const hidden = defs.find((d) => d.id === hiddenDefId)
      if (!a || !b || !hidden?.recipe || monsterId === partnerId) return null
      const pair = [a.mon.defId, b.mon.defId].sort().join()
      if ([...hidden.recipe].sort().join() !== pair) return null
      if (!isJogressReady(a.mon, a.def, hidden) || !isJogressReady(b.mon, b.def, hidden)) return null
      const stoneEls = jogressStones(a.def, b.def)
      const stoneNeed = (e: Element) => CONFIG.jogress.stones * stoneEls.filter((x) => x === e).length
      if ((state.coins ?? 0) < CONFIG.jogress.coins || ballsOf(state) < CONFIG.jogress.balls) return null
      if (stoneEls.some((e) => stonesOf(state, e) < stoneNeed(e))) return null
      const shiny = false // 色違いはなくなった
      const ref = doc(collection(db, base, 'ownedMonsters'))
      const update: DocumentData = {
        coins: increment(-CONFIG.jogress.coins),
        [`cores.${BALL_KEY}`]: increment(-CONFIG.jogress.balls),
      }
      for (const e of new Set(stoneEls)) update[`stones.${e}`] = increment(-stoneNeed(e))
      consume(update, [a, b])
      if (shiny) update[`dexShiny.${hidden.id}`] = true
      const batch = writeBatch(db)
      batch.set(ref, { defId: hidden.id, nodeId: FIRST_NODE_ID, investedBy: {}, investedFrom: {}, shiny, obtainedAt: Date.now() })
      batch.delete(doc(db, base, 'ownedMonsters', monsterId))
      batch.delete(doc(db, base, 'ownedMonsters', partnerId))
      batch.update(stateRef, update)
      batch.commit().catch(fail)
      return ref.id
    }

    /** いなくなる個体のEXPを財布に返し、見つけていた形態と色違いを図鑑に残すよう update に足す */
    const consume = (update: DocumentData, gone: NonNullable<ReturnType<typeof findMonster>>[]) => {
      const refund = newRefund()
      const found: Record<string, Set<string>> = {}
      for (const { mon, def, node } of gone) {
        addRefund(refund, mon, def, node.next)
        for (const src of [...ATTRS, 'any'] as const) {
          refund[src].trained += mon.plusFrom?.[src]?.trained ?? 0
          refund[src].bought += mon.plusFrom?.[src]?.bought ?? 0
        }
        found[def.id] ??= new Set()
        for (const n of pathTo(getTemplate(def.templateId), mon.nodeId)) found[def.id].add(n)
        if (mon.shiny) update[`dexShiny.${def.id}`] = true
      }
      applyRefund(update, refund)
      for (const [defId, nodes] of Object.entries(found)) update[`dexFound.${defId}`] = arrayUnion(...nodes)
      // いなくなる個体は相棒の枠から外す
      const goneIds = new Set(gone.map((g) => g.mon.id))
      for (const [slot, id] of Object.entries(state.partners)) {
        if (goneIds.has(id)) update[`partners.${slot}`] = deleteField()
      }
    }

    type Refund = Record<ExpSource, AttrExp>
    const newRefund = (): Refund => ({
      chestArms: zeroExp(),
      legs: zeroExp(),
      backShoulders: zeroExp(),
      any: zeroExp(),
    })

    const applyRefund = (update: DocumentData, refund: Refund) => {
      for (const attr of ATTRS) {
        for (const kind of ['trained', 'bought'] as const) {
          if (refund[attr][kind] > 0) update[`exp.${attr}.${kind}`] = increment(refund[attr][kind])
        }
      }
      // 万能EXPはすべて筋トレEXP扱い
      const any = refund.any.trained + refund.any.bought
      if (any > 0) update.anyExp = increment(any)
    }

    /** nodeIds の進化先に注いでいたEXPを、注いだ元の財布ごとに refund に足す */
    const addRefund = (refund: Refund, mon: OwnedMonster, def: MonsterDef, nodeIds: string[]) => {
      const add = (attr: ExpSource, exp: { trained?: number; bought?: number } | undefined) => {
        refund[attr].trained += exp?.trained ?? 0
        refund[attr].bought += exp?.bought ?? 0
      }
      const firstNext = getNode(getTemplate(def.templateId), mon.nodeId).next[0]
      for (const other of nodeIds) {
        const sources = mon.investedFrom?.[other]
        for (const attr of [...ATTRS, 'any'] as const) add(attr, sources?.[attr])
        // 旧形式のデータ（注いだ元の記録がない分）は、その進化先の属性の財布に返す
        const otherAttr = nodeAttr(def, other)
        if (other === firstNext && otherAttr !== 'none') add(otherAttr, mon.invested)
        if (otherAttr !== 'none') {
          for (const kind of ['trained', 'bought'] as const) {
            const recorded = [...ATTRS, 'any' as const].reduce((sum, attr) => sum + (sources?.[attr]?.[kind] ?? 0), 0)
            add(otherAttr, { [kind]: Math.max(0, (mon.investedBy?.[other]?.[kind] ?? 0) - recorded) })
          }
        }
      }
    }

    const saveMonsterDef: Store['saveMonsterDef'] = async (input) => {
      const existing = input.id ? defs.find((d) => d.id === input.id) : undefined
      const defRef = existing ? doc(db, base, 'monsterDefs', existing.id) : doc(collection(db, base, 'monsterDefs'))
      const images: Record<string, string> = { ...(existing?.images ?? {}) }
      const batch = writeBatch(db)
      for (const [nodeId, file] of Object.entries(input.files)) {
        const data = await compressImage(file, CONFIG.image.maxSidePx, '#ffffff') // 切り抜き画像も白背景に
        const imageRef = doc(collection(db, base, 'images'))
        batch.set(imageRef, { data, createdAt: Date.now() })
        imageCache.set(imageRef.id, Promise.resolve(data))
        if (images[nodeId]) batch.delete(doc(db, base, 'images', images[nodeId]))
        images[nodeId] = imageRef.id
      }
      const payload = {
        name: input.name,
        attr: input.attrs[FIRST_NODE_ID],
        attrs: input.attrs,
        templateId:
          existing && !canChangeTemplate(existing.templateId, input.templateId)
            ? existing.templateId
            : input.templateId,
        images,
        names: input.names,
        recipe: input.recipe,
        gachas: input.gachas.slice(0, CONFIG.gacha.maxPerMonster),
        tier: input.rarity,
        bossGrade: (input.questOnly && input.bossGrade) || null,
        element: input.element || null,
        favoriteSlot: input.favoriteSlot,
        series: input.series?.trim() || null,
        tags: [], // タグはなくなった（前に付けていたものは消す）
        questOnly: input.questOnly,
        tower: input.questOnly && input.tower === true,
        questTier: null, // 旧：降臨の格（今はレア度で決める）
        castleLord: input.questOnly && input.bossGrade === 'bakuzetsu' && input.castleLord === true,
        castleOnly: input.questOnly && input.castleOnly === true && input.castleLord !== true,
        jogressPartner: input.jogressPartner || null,
        fixedStars: input.fixedStars,
        abilities: input.abilities,
        ...(input.recipe.length === 2
          ? {
              jogressBirthStars: input.jogressBirthStars,
              jogressPlus: input.jogressPlus,
              jogressGrade: jogressGradeOf(input.recipe, defs),
              jogressElements: jogressElementOf(input.recipe, defs).elements,
              jogressSuper: jogressElementOf(input.recipe, defs).super,
            }
          : {}),
        createdAt: existing?.createdAt ?? Date.now(),
      }
      batch.set(defRef, payload)
      // このモンスターを素材にする隠しモンスターの格を計算し直す（レア度を変えたとき）
      const updated = defs.map((d) =>
        d.id === defRef.id ? { ...d, tier: input.rarity, element: input.element || undefined } : d,
      )
      for (const hidden of defs.filter((d) => isHidden(d) && d.recipe!.includes(defRef.id))) {
        const el = jogressElementOf(hidden.recipe!, updated)
        batch.update(doc(db, base, 'monsterDefs', hidden.id), {
          jogressGrade: jogressGradeOf(hidden.recipe!, updated),
          jogressElements: el.elements,
          jogressSuper: el.super,
        })
      }
      // 降臨なら、ボスクエストも自動で作る（格や部位を変えたら、クエストもついてくる。属性はボスから読むので自動）
      const saved = { ...payload, id: defRef.id, element: payload.element ?? undefined } as unknown as MonsterDef
      const sync = bossQuestSync(saved, questDocs, selectableGimmicks(questDocs), [...defs.filter((d) => d.id !== saved.id), saved], defaultBossHp)
      if (sync?.id) batch.update(doc(db, base, 'quests', sync.id), sync.data)
      else if (sync) batch.set(doc(collection(db, base, 'quests')), { ...sync.data, createdAt: Date.now() })
      batch.commit().catch(fail)
    }

    const autoTuneDefs: Store['autoTuneDefs'] = (ids) => {
      let working = [...defs]
      const batch = writeBatch(db)
      for (const id of ids) {
        const def = working.find((d) => d.id === id)
        if (!def || isHidden(def)) continue
        const parts = finalAttrs(def)
        const slotIds = SLOTS.filter((s) => s.day === 'bonus' || parts.includes('none') || parts.includes(DAYS[s.day].attr)).map(
          (s) => s.id,
        )
        // 決まっていないところだけ埋める（自分で決めたところは触らない）
        const own = elementInfo(def).elements[0]
        const rec = recommend(working, quests, selectableGimmicks(quests), abilitySlots(def), def.id, slotIds, own)
        const tuned: Partial<MonsterDef> = {}
        // 属性は自分で決める（おまかせでは決めない）
        if (!def.tier && !def.rarity && !def.common) tuned.tier = 'rare'
        if (!def.favoriteSlot && rec.favoriteSlot) tuned.favoriteSlot = rec.favoriteSlot
        const slots = abilitySlots({ ...def, ...tuned })
        if ((def.abilities ?? []).length === 0 && slots > 0) tuned.abilities = rec.abilities.slice(0, slots)
        if (Object.keys(tuned).length === 0) continue
        batch.update(doc(db, base, 'monsterDefs', id), tuned)
        working = working.map((d) => (d.id === id ? { ...d, ...tuned } : d))
      }
      batch.commit().catch(fail)
    }

    const loadImage: Store['loadImage'] = (imageId) => {
      let cached = imageCache.get(imageId)
      if (!cached) {
        cached = getDoc(doc(db, base, 'images', imageId))
          .then((snap) => (snap.data()?.data as string | undefined) ?? null)
          .catch(() => {
            imageCache.delete(imageId)
            return null
          })
        imageCache.set(imageId, cached)
      }
      return cached
    }

    const saveGacha: Store['saveGacha'] = async (input) => {
      const current = input.id ? gachas.find((g) => g.id === input.id) : undefined
      const ref = input.id ? doc(db, base, 'gachas', input.id) : doc(collection(db, base, 'gachas'))
      const batch = writeBatch(db)
      let bannerImageId = current?.bannerImageId ?? null
      if (input.banner) {
        const data = await compressImage(input.banner, CONFIG.image.bannerMaxSidePx)
        const imageRef = doc(collection(db, base, 'images'))
        batch.set(imageRef, { data, createdAt: Date.now() })
        imageCache.set(imageRef.id, Promise.resolve(data))
        if (bannerImageId) batch.delete(doc(db, base, 'images', bannerImageId))
        bannerImageId = imageRef.id
      } else if (input.removeBanner && bannerImageId) {
        batch.delete(doc(db, base, 'images', bannerImageId))
        bannerImageId = null
      }
      batch.set(ref, {
        name: input.name.trim(),
        bannerImageId,
        shinyRate: input.shinyRate,
        catchphrase: input.catchphrase.trim(),
        theme: input.theme,
        featured: input.featured.slice(0, CONFIG.gacha.bannerMonsters),
        slides: input.slides,
        schedule: input.schedule ?? null,
        createdAt: current?.createdAt || Date.now(),
      })
      // ピックアップの出し入れは、モンスターの「入るガチャ」に書く（1体につき最大3つまで）
      if (input.pickups && !current?.builtin) {
        for (const def of defs.filter((d) => !isHidden(d) && !d.questOnly && isPickupRarity(rarityOf(d)))) {
          const has = def.gachas?.includes(ref.id) ?? false
          const want = input.pickups.includes(def.id)
          if (want && !has && (def.gachas?.length ?? 0) < CONFIG.gacha.maxPerMonster) {
            batch.update(doc(db, base, 'monsterDefs', def.id), { gachas: arrayUnion(ref.id) })
          } else if (!want && has) {
            batch.update(doc(db, base, 'monsterDefs', def.id), { gachas: arrayRemove(ref.id) })
          }
        }
      }
      batch.commit().catch(fail)
      return ref.id
    }

    const deleteGacha: Store['deleteGacha'] = (id) => {
      const gacha = gachas.find((g) => g.id === id)
      if (!gacha || gacha.builtin) return
      const batch = writeBatch(db)
      batch.delete(doc(db, base, 'gachas', id))
      if (gacha.bannerImageId) batch.delete(doc(db, base, 'images', gacha.bannerImageId))
      for (const def of defs.filter((d) => d.gachas?.includes(id))) {
        batch.update(doc(db, base, 'monsterDefs', def.id), { gachas: arrayRemove(id) })
      }
      batch.commit().catch(fail)
    }

    const saveQuest: Store['saveQuest'] = (input) => {
      // 読み込むときに付けた項目は保存しない
      const { id, autoName: _a, builtin: _b, bossSeries: _s, ...data } = input
      const current = id ? quests.find((q) => q.id === id) : undefined
      const ref = id ? doc(db, base, 'quests', id) : doc(collection(db, base, 'quests'))
      setDoc(ref, {
        ...data,
        element: data.element ?? null,
        name: data.name.trim(),
        catchphrase: data.catchphrase.trim(),
        weakSlots: data.weakSlots.slice(0, CONFIG.quest.maxWeakSlots),
        createdAt: current?.createdAt ?? Date.now(),
      }).catch(fail)
    }

    const deleteQuest: Store['deleteQuest'] = (id) => {
      const batch = writeBatch(db)
      batch.delete(doc(db, base, 'quests', id))
      if (state.challenge?.questId === id) batch.update(stateRef, { challenge: null })
      batch.commit().catch(fail)
    }

    const startChallenge: Store['startChallenge'] = (questId, difficulty, party) => {
      if (!quests.some((q) => q.id === questId)) {
        // 試練の塔・零の孤城は、次の階だけ挑戦できる
        const floor = tower.find((f) => f.quest.id === questId)
        const castleFloor = castle.find((f) => f.quest.id === questId)
        const kinkinFloor = kinkin.find((f) => f.quest.id === questId)
        if (kinkinFloor && (!kinkinOpen(dateKey()) || kinkinFloor.floor !== kinkinCleared(state, towerMonth(dateKey())) + 1)) return
        // 開催している日だけ（塔は1〜15日、孤城は16日〜月末）
        if (floor && (!towerOpen(dateKey()) || floor.floor !== towerCleared(state, towerMonth(dateKey()), floor.tower ?? 0) + 1)) return
        if (castleFloor && (!castleOpen(dateKey()) || castleFloor.floor !== castleCleared(state, towerMonth(dateKey())) + 1)) return
        if (!floor && !castleFloor && !kinkinFloor) return
      }
      const ids = party.filter((p) => owned.some((o) => o.id === p)).slice(0, CONFIG.quest.partySize)
      updateState({ challenge: { date: dateKey(), questId, difficulty, party: ids, startTs: Date.now() } })
    }

    const quitChallenge: Store['quitChallenge'] = () => {
      if (state.challenge) updateState({ challenge: null })
    }

    /** 出撃した子の記録（通算ダメージ・出撃回数・MVP回数・1回の最大ダメージ）を batch に書く */
    const writeRecords = (batch: ReturnType<typeof writeBatch>, battle: Battle) => {
      for (const m of battle.party) {
        const d = Math.round(battle.byMember[m.mon.id] ?? 0)
        batch.update(doc(db, base, 'ownedMonsters', m.mon.id), {
          'record.damage': increment(d),
          'record.quests': increment(1),
          'record.mvp': increment(battle.mvpId === m.mon.id ? 1 : 0),
          'record.best': Math.max(m.mon.record?.best ?? 0, d),
        })
      }
    }

    const claimQuest: Store['claimQuest'] = () => {
      const battle = battleOf(
        state.challenge,
        dateKey(),
        [...quests, ...tower.map((f) => f.quest), ...castle.map((f) => f.quest), ...kinkin.map((f) => f.quest)],
        defs,
        owned,
        weekSets,
        () => '',
      )
      if (!battle?.defeated) return null
      const towerFloor = tower.find((f) => f.quest.id === battle.quest.id)
      if (towerFloor) return claimTower(towerFloor, battle, 'tower')
      const castleFloor = castle.find((f) => f.quest.id === battle.quest.id)
      if (castleFloor) return claimTower(castleFloor, battle, 'castle')
      const kinkinFloor = kinkin.find((f) => f.quest.id === battle.quest.id)
      if (kinkinFloor) return claimTower(kinkinFloor, battle, 'kinkin')
      const c = battle.challenge
      const material = battle.quest.kind === 'material'
      const bonus = luckBonus(battle.party.map((m) => m.mon))
      const boost = state.boosts?.quest ? 2 : 1
      const gold = Math.round(questGold(battle.quest, c.difficulty) * bonus.goldRate * boost)
      const kind = dropOf(battle.quest)
      const batch = writeBatch(db)
      writeRecords(batch, battle)
      const update: DocumentData = {
        ...(boost > 1 ? { 'boosts.quest': false } : {}),
        gold: increment(gold),
        questClears: increment(1),
        [`clearedQuests.${battle.quest.id}`]: increment(1),
        challenge: null,
      }
      bumpStats(update, { quest: 1, strict: isStrict(battle.quest) ? 1 : 0 })
      let monsterId: string | null = null
      let coins = 0
      const drops: ItemDrop[] = []
      if (kind === 'custom') {
        // 神殿：カスタマイズアイテム（運極がいると、くじが増える）
        const level = c.difficulty === 'hard' ? 'hard' : 'normal'
        const items = rollTempleItems(level, bonus.count, selectableGimmicks(questDocs), Math.random)
        const all = boost > 1 ? [...items, ...items] : items
        const counts: Record<string, number> = {}
        for (const k of all) counts[k] = (counts[k] ?? 0) + 1
        for (const [k, n] of Object.entries(counts)) {
          update[`customItems.${k}`] = increment(n)
          drops.push({ icon: '', label: itemLabel(k, allGimmicks(questDocs)), count: n })
        }
        if (all.length === 0) drops.push({ icon: '🏛', label: 'カスタマイズアイテム', count: 0 })
      } else if (material) {
        // 素材クエスト：くじを引いた数だけ落ちる（運極がいるとくじが増える）
        const misses = state.coreMisses[battle.quest.id] ?? 0
        const drop = rollMaterialDrop(kind, c.difficulty, bonus.count, kind === 'ball' ? misses : 0, Math.random)
        const count = drop.count * boost
        if (kind === 'ball') update[`coreMisses.${battle.quest.id}`] = drop.count > 0 ? 0 : increment(1)
        if (kind === 'coins') coins = count
        else if (count > 0) {
          if (kind === 'stone' && battle.quest.element) update[`stones.${battle.quest.element}`] = increment(count)
          if (kind === 'muscle' && battle.quest.attr !== 'none') update[`cores.${battle.quest.attr}`] = increment(count)
          const ball = kind === 'ball' || (kind === 'muscle' && battle.quest.attr === 'none')
          if (ball) update[`cores.${BALL_KEY}`] = increment(count)
        }
        drops.push({ icon: DROP_ICON[kind], label: dropLabel(battle.quest), count, pity: drop.pity })
      } else {
        const boss = battle.boss
        if (!boss) return null
        // ボスクエストは、オーブと同じだけ進化コインも
        coins = gold * CONFIG.coins.perOrb
        const shiny = false // 色違いはなくなった
        const ref = doc(collection(db, base, 'ownedMonsters'))
        batch.set(ref, {
          defId: boss.id,
          nodeId: FIRST_NODE_ID,
          investedBy: {},
          investedFrom: {},
          plus: dropPlus(battle.quest),
          luck: dropLuck(battle.party.map((m) => m.mon)),
          shiny,
          obtainedAt: Date.now(),
        })
        if (shiny) update[`dexShiny.${boss.id}`] = true
        monsterId = ref.id
        // おまけ：ボスの属性の結晶
        const stones = rollBonusStones(Math.random) * boost
        if (stones > 0 && battle.quest.element) {
          update[`stones.${battle.quest.element}`] = increment(stones)
          drops.push({ icon: DROP_ICON.stone, label: STONE_LABEL(battle.quest.element), count: stones })
        }
      }
      if (coins > 0) update.coins = increment(coins)
      batch.update(stateRef, update)
      batch.commit().catch(fail)
      return {
        boosted: boost > 1,
        coins,
        monsterId,
        defId: battle.boss?.id ?? null,
        drops,
        gold,
        eggs: 0,
        towerFloor: null,
        luck: monsterId ? dropLuck(battle.party.map((m) => m.mon)) : undefined,
        byMember: battle.byMember,
        mvpId: battle.mvpId,
        total: battle.damage,
      }
    }

    /** 試練の塔の報酬：オーブ・トク玉・核・塔限定モンスター。クリアした階を進める */
    const claimTower = (floor: TowerFloor, battle: Battle, kind: 'tower' | 'castle' | 'kinkin'): QuestReward | null => {
      const party = battle.party.map((m) => m.mon)
      const month = towerMonth(dateKey())
      const cleared =
        kind === 'castle'
          ? castleCleared(state, month)
          : kind === 'kinkin'
            ? kinkinCleared(state, month)
            : towerCleared(state, month, floor.tower ?? 0)
      if (floor.floor !== cleared + 1) return null
      const bonus = luckBonus(party)
      const boost = state.boosts?.quest ? 2 : 1
      const gold = Math.round(floor.reward.gold * bonus.goldRate * boost)
      const coins = gold * CONFIG.coins.perOrb
      const cores = floor.reward.cores * boost
      const batch = writeBatch(db)
      writeRecords(batch, battle)
      const update: DocumentData = {
        ...(boost > 1 ? { 'boosts.quest': false } : {}),
        gold: increment(gold),
        questClears: increment(1),
        ...(kind === 'castle'
          ? { castle: { month, cleared: floor.floor } }
          : kind === 'kinkin'
            ? { kinkin: { month, cleared: floor.floor } }
            : (floor.tower ?? 0) === 0
              ? { tower: { month, cleared: floor.floor } }
              : {
                  towerMore: {
                    month,
                    cleared: { ...(state.towerMore?.month === month ? state.towerMore.cleared : {}), [String(floor.tower)]: floor.floor },
                  },
                }),
        coins: increment(coins),
        challenge: null,
      }
      bumpStats(update, { quest: 1, strict: isStrict(floor.quest) ? 1 : 0 })
      if (floor.reward.eggs > 0) update.eggs = increment(floor.reward.eggs)
      const coreKey = floor.quest.attr === 'none' ? null : (floor.quest.attr as CoreKey)
      if (cores > 0 && coreKey) update[`cores.${coreKey}`] = increment(cores)
      if (floor.reward.booster) update[`boosters.${floor.reward.booster}`] = increment(1)
      if (floor.reward.sticks) update.sticks = increment(floor.reward.sticks)
      // 孤城：ブースター詰め合わせと、カスタマイズアイテム
      const pack: Record<string, number> = {}
      for (const b of floor.reward.boosters ?? []) pack[b] = (pack[b] ?? 0) + 1
      for (const [b, n] of Object.entries(pack)) update[`boosters.${b}`] = increment(n + (floor.reward.booster === b ? 1 : 0))
      if (floor.reward.custom) update[`customItems.${floor.reward.custom}`] = increment(1)
      if (floor.reward.balls) update[`cores.${BALL_KEY}`] = increment(floor.reward.balls)
      let monsterId: string | null = null
      if (floor.reward.monsterDefId) {
        const shiny = false // 色違いはなくなった
        const ref = doc(collection(db, base, 'ownedMonsters'))
        batch.set(ref, {
          defId: floor.reward.monsterDefId,
          nodeId: FIRST_NODE_ID,
          investedBy: {},
          investedFrom: {},
          plus: 0,
          luck: CONFIG.luck.prizeDrop, // 月に1回しか落ちないので、運は多め
          shiny,
          obtainedAt: Date.now(),
        })
        if (shiny) update[`dexShiny.${floor.reward.monsterDefId}`] = true
        monsterId = ref.id
      }
      batch.update(stateRef, update)
      batch.commit().catch(fail)
      return {
        monsterId,
        defId: floor.reward.monsterDefId,
        drops: [
          ...(cores > 0 && coreKey ? [{ icon: DROP_ICON.muscle, label: CORE_LABEL[coreKey], count: cores }] : []),
          ...(floor.reward.sticks ? [{ icon: '🪄', label: 'ワクワクステッキ', count: floor.reward.sticks }] : []),
          ...(floor.reward.balls ? [{ icon: '🟣', label: '筋肉玉', count: floor.reward.balls }] : []),
          ...Object.entries(pack).map(([b, n]) => ({ icon: CONFIG.boosters[b as BoosterKey].icon, label: CONFIG.boosters[b as BoosterKey].label, count: n })),
          ...(floor.reward.custom ? [{ icon: '', label: itemLabel(floor.reward.custom, allGimmicks(questDocs)), count: 1 }] : []),
        ],
        castle: kind === 'castle',
        kinkin: kind === 'kinkin',
        coins,
        booster: floor.reward.booster,
        boosted: boost > 1,
        gold,
        eggs: floor.reward.eggs,
        towerFloor: floor.floor,
        luck: monsterId ? CONFIG.luck.prizeDrop : undefined,
        byMember: battle.byMember,
        mvpId: battle.mvpId,
        total: battle.damage,
      }
    }

    const exchangeMaterial: Store['exchangeMaterial'] = (kind, key) => {
      const need = CONFIG.materials.eggExchange[kind]
      const have = kind === 'stone' ? stonesOf(state, key as Element) : coresOf(state, key as CoreKey)
      if (have < need) return
      updateState({ [`${kind === 'stone' ? 'stones' : 'cores'}.${key}`]: increment(-need), eggs: increment(1) })
    }

    const attachCustom: Store['attachCustom'] = (monsterId, itemKey, favoriteSlot, useStick) => {
      const mon = owned.find((o) => o.id === monsterId)
      if (!mon || (state.customItems?.[itemKey] ?? 0) < 1) return
      if (itemInfo(itemKey).kind === 'favorite' && !favoriteSlot) return
      const keep = !!useStick && !!mon.custom
      if (keep && (state.sticks ?? 0) < 1) return
      const update: DocumentData = { [`customItems.${itemKey}`]: increment(-1) }
      if (keep) {
        update.sticks = increment(-1)
        update[`customItems.${mon.custom}`] = increment(1)
      }
      const batch = writeBatch(db)
      batch.update(doc(db, base, 'ownedMonsters', monsterId), {
        custom: itemKey,
        customSlot: favoriteSlot ?? deleteField(),
      })
      batch.update(stateRef, update)
      batch.commit().catch(fail)
    }

    const removeCustom: Store['removeCustom'] = (monsterId) => {
      const mon = owned.find((o) => o.id === monsterId)
      if (!mon?.custom || (state.sticks ?? 0) < 1) return
      const batch = writeBatch(db)
      batch.update(doc(db, base, 'ownedMonsters', monsterId), { custom: deleteField(), customSlot: deleteField() })
      batch.update(stateRef, { sticks: increment(-1), [`customItems.${mon.custom}`]: increment(1) })
      batch.commit().catch(fail)
    }

    const bulkUpdateDefs: Store['bulkUpdateDefs'] = (ids, patch) => {
      const batch = writeBatch(db)
      let working = [...defs]
      for (const id of ids) {
        const def = working.find((d) => d.id === id)
        if (!def || isHidden(def)) continue
        const change: Partial<MonsterDef> = {}
        if (patch.element !== undefined) change.element = patch.element ?? undefined
        if (patch.tier && !def.questOnly) change.tier = patch.tier
        if (patch.bossGrade && def.questOnly) change.bossGrade = patch.bossGrade
        if (patch.series !== undefined) change.series = patch.series.trim()
        if (Object.keys(change).length === 0) continue
        batch.update(doc(db, base, 'monsterDefs', id), {
          ...change,
          ...(patch.element !== undefined ? { element: patch.element ?? null } : {}),
        })
        const updated = { ...def, ...change }
        working = working.map((d) => (d.id === id ? updated : d))
        // 降臨の格を変えたら、ボスクエストもついてくる
        const sync = bossQuestSync(updated, questDocs, selectableGimmicks(questDocs), working, defaultBossHp)
        if (sync?.id) batch.update(doc(db, base, 'quests', sync.id), sync.data)
        else if (sync) batch.set(doc(collection(db, base, 'quests')), { ...sync.data, createdAt: Date.now() })
      }
      batch.commit().catch(fail)
    }

    const toggleLock: Store['toggleLock'] = (monsterId) => {
      const mon = owned.find((o) => o.id === monsterId)
      if (!mon) return
      const batch = writeBatch(db)
      batch.update(doc(db, base, 'ownedMonsters', monsterId), { locked: !mon.locked })
      batch.commit().catch(fail)
    }

    const markQuestRules: Store['markQuestRules'] = (version) => updateState({ questRules: version })

    const claimRanks: Store['claimRanks'] = () => {
      const ranks = pendingRanks(state)
      if (ranks.length === 0) return 0
      const update: DocumentData = {}
      let eggs = 0
      for (const r of ranks) {
        update[`claims.${rankClaimKey(r)}`] = true
        eggs += rankReward(r).eggs ?? 0
      }
      if (eggs > 0) update.eggs = increment(eggs)
      updateState(update)
      return eggs
    }

    const saveSongs: Store['saveSongs'] = (next) => {
      setDoc(musicRef, { songs: next }).catch(fail)
    }

    const fixTower: Store['fixTower'] = (floors) => {
      setDoc(towerRef, { floors: floors ?? null, version: TOWER_VERSION }).catch(fail)
    }

    const renameSeries: Store['renameSeries'] = (from, to) => {
      const name = to.trim()
      if (!name || name === from) return
      const batch = writeBatch(db)
      for (const d of defs.filter((x) => (x.series?.trim() ?? '') === from)) {
        batch.update(doc(db, base, 'monsterDefs', d.id), { series: name })
      }
      // 開催期間も新しい名前へ移す（新しい名前にもう期間があれば、そちらを残す）
      const period = seriesPeriods[from]
      if (period || from in seriesPeriods) {
        batch.set(
          seriesRef,
          { periods: { [from]: deleteField(), ...(period && !seriesPeriods[name] ? { [name]: period } : {}) } },
          { merge: true },
        )
      }
      batch.commit().catch(fail)
    }

    const saveSeriesPeriod: Store['saveSeriesPeriod'] = (series, period) => {
      setDoc(seriesRef, { periods: { [series]: period ?? deleteField() } }, { merge: true }).catch(fail)
    }

    return {
      user,
      state,
      menu,
      defs,
      owned,
      songs,
      seriesPeriods,
      today,
      weekSets,
      todaySets,
      yesterday,
      yesterdayCheckin,
      getHistory,
      recordSet,
      recordMorning,
      recordHabit,
      setHabitLabel,
      setHabit2Kind,
      recordHabit2,
      journal,
      setHabitMode,
      setPartner,
      autoSetPartners,
      setSlot,
      buyExp,
      buyBooster,
      useBooster,
      hatchEgg,
      hatchMany,
      freePull,
      claimReward,
      claimLogin,
      pourExp,
      evolve,
      pourPlusExp,
      fuse,
      feedLuck,
      bulkFeed,
      jogress,
      shinka,
      saveMonsterDef,
      autoTuneDefs,
      loadImage,
      saveSongs,
      saveSeriesPeriod,
      renameSeries,
      towerFixed,
      fixTower,
      gachas,
      saveGacha,
      quests,
      tower,
      castle,
      kinkin,
      week,
      saveQuest,
      deleteQuest,
      startChallenge,
      quitChallenge,
      claimQuest,
      exchangeMaterial,
      attachCustom,
      removeCustom,
      markQuestRules,
      toggleLock,
      bulkUpdateDefs,
      claimRanks,
      deleteGacha,
    }
  }, [user, base, state, menu, journal, defs, owned, songs, seriesPeriods, towerFixed, gachas, quests, tower, castle, kinkin, today, yesterday, yesterdayCheckin, week, weekSets, todaySets, stateRef, menuRef, musicRef, seriesRef, towerRef, fail])

  if (!store) {
    return (
      <div className="center-screen">
        <p>データを読み込んでいます…</p>
        {error && <p className="error">{error}</p>}
      </div>
    )
  }

  return (
    <StoreContext.Provider value={store}>
      {children}
      {error && (
        <div className="toast error" onClick={() => setError(null)}>
          {error}
        </div>
      )}
    </StoreContext.Provider>
  )
}
