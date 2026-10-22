import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
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
import { fusionCost, isExpFull, nextCost, planPour } from './lib/evolution'
import { habitGoldNow, stepsGold } from './lib/rewards'
import { isWeekCleared } from './lib/week'
import { compressImage } from './lib/imageCompress'
import { draw, isPickupRarity, isPity, isReady, rarityOf, rateTable, starsOf } from './lib/gacha'
import { isJogressReady } from './lib/stats'
import { battleOf, dropPlus, isStrict, questGold } from './lib/quest'
import { rollBonusCore, rollCoreDrop } from './lib/cores'
import { bulkFeedTarget, canFeed, fusionGain, isLuckMax, luckAfter, luckBonus, planBulkFeed, protectedIds } from './lib/fusion'
import { autoPartners } from './lib/partner'
import { finalAttrs, recommend } from './lib/coverage'
import { abilitySlots, jogressGradeOf, selectableGimmicks } from './lib/gimmick'
import { boostActive } from './lib/boosters'
import { canShinka, shinkaFoods } from './lib/shinka'
import { availableEvents, claimKey } from './lib/events'
import { activeToday, currentStats, loginReady, loginReward, type Reward } from './lib/missions'
import { builtinMaterialQuests } from './lib/materials'
import type { Period, Periods } from './lib/series'
import { towerCleared, towerFloors, towerMonth, type TowerFloor } from './lib/tower'
import { elementInfo, jogressElementOf } from './lib/element'
import { investedFor, isHidden, nodeAttr, type AttrExp, type BannerSlide, type BoosterKey, type Checkin, type Element, type Gacha, type Quest, type QuestDifficulty, type RarityKey, type ExpSource, type GameState, type MonsterDef, type OwnedMonster, type SetRecord, type Song } from './types'

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
    coreMisses: {},
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
  rarity: RarityKey
  questOnly: boolean
  tower?: boolean // 試練の塔の報酬にする（降臨のときだけ）
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
  pity: boolean // 天井で確定したか
}

export interface QuestReward {
  monsterId: string | null // 手に入ったボス（素材クエストでは null）
  defId: string | null // 手に入ったモンスターの種類（塔では塔限定モンスター）
  eggs: number // 試練の塔でもらえた卵
  towerFloor: number | null // 試練の塔の何階をクリアしたか
  booster?: BoosterKey | null // 試練の塔でもらえたブースター
  boosted?: boolean // 討伐ブースターで2倍になったか
  cores: number // 落ちた核の数
  coreKey: FormAttr
  corePity: boolean // 天井で確定したか
  gold: number
  coins?: number // もらえた進化コイン
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
  /** 核をタマゴ1個と交換する */
  exchangeCores: (key: FormAttr) => void
  setSlot: (slotId: string, exerciseId: string) => void
  buyExp: (attr: Attr, amount: number) => void
  buyEgg: () => void
  buyBooster: (key: BoosterKey) => void
  useBooster: (key: BoosterKey) => void
  /** タマゴを孵す。選んだガチャから、確率どおりに1体（ダブりあり） */
  hatchEgg: (gachaId: string) => HatchResult | null
  /** まとめて引く（タマゴの数まで）。引けた分だけ返す */
  hatchMany: (gachaId: string, count: number) => HatchResult[]
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
  /** 同じモンスターをまとめて食べさせて運を上げる（タダ・最大99） */
  feedLuck: (monsterId: string, foodIds: string[]) => void
  bulkFeed: () => { kept: number; fed: number }
  /** ＋5の2体を合わせて隠しモンスターを生む。生まれた個体のID */
  jogress: (monsterId: string, partnerId: string, hiddenDefId: string) => string | null
  shinka: (monsterId: string, foodId: string) => boolean
  saveMonsterDef: (input: MonsterDefInput) => Promise<void>
  /** 属性・得意種目・アビリティを、足りないものでまとめて埋める（1体ずつ、前に埋めた分も数えて） */
  autoTuneDefs: (ids: string[]) => void
  loadImage: (imageId: string) => Promise<string | null>
  saveSongs: (songs: Song[]) => void
  saveSeriesPeriod: (series: string, period: Period | null) => void
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
  const [gachaDocs, setGachaDocs] = useState<Gacha[]>([])
  const [questDocs, setQuests] = useState<Quest[]>([])
  const [today, setToday] = useState(dateKey())
  const [weekSets, setWeekSets] = useState<SetRecord[]>([])
  const [yesterdayCheckin, setYesterdayCheckin] = useState<Checkin | null>(null)
  const [error, setError] = useState<string | null>(null)

  const stateRef = useMemo(() => doc(db, base, 'meta', 'state'), [base])
  const menuRef = useMemo(() => doc(db, base, 'meta', 'menu'), [base])
  const musicRef = useMemo(() => doc(db, base, 'meta', 'music'), [base])
  const seriesRef = useMemo(() => doc(db, base, 'meta', 'series'), [base])

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
          } else if (!snap.metadata.fromCache) {
            // サーバーにも存在しないと確認できたときだけ初期データを作る（別端末のデータを上書きしないため）
            setDoc(stateRef, initialState()).catch(fail)
          }
        },
        fail,
      ),
      onSnapshot(menuRef, (snap) => setMenu((snap.data() as Record<string, string>) ?? {}), fail),
      onSnapshot(musicRef, (snap) => setSongs((snap.data()?.songs as Song[] | undefined) ?? []), fail),
      onSnapshot(seriesRef, (snap) => setSeriesPeriods((snap.data()?.periods as Periods | undefined) ?? {}), fail),
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
  }, [base, stateRef, menuRef, musicRef, seriesRef, fail])

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
        return boss ? { ...q, name, autoName, element: elementInfo(boss).elements[0] } : { ...q, name, autoName }
      }).concat(builtinMaterialQuests(defs, today)),
    [questDocs, defs, today],
  )
  const yesterday = useMemo(() => prevDateKey(today), [today])
  const tower = useMemo(() => towerFloors(towerMonth(today), defs, selectableGimmicks(quests)), [today, defs, quests])


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
      if (rec.exp > 0 && rec.day === 'bonus') update.anyExp = increment(rec.exp)
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

    const buyEgg: Store['buyEgg'] = () => {
      if (state.gold < CONFIG.shop.eggPrice || !defs.some((d) => !isHidden(d))) return
      updateState({ gold: increment(-CONFIG.shop.eggPrice), eggs: increment(1) })
    }

    // count 回まとめて引く。1回ずつ天井の回数を数え直し、1つの書き込みにまとめる
    const hatchMany: Store['hatchMany'] = (gachaId, count) => pull(gachaId, Math.min(count, state.eggs), {})

    /** 無料ガチャのイベント：卵を使わずに引く（その日1回だけ） */
    const freePull: Store['freePull'] = (eventId, gachaId) => {
      const today = dateKey()
      const ev = availableEvents(state, today).find((e) => e.id === eventId)
      if (!ev || !activeToday(state, todaySets, today, yesterday)) return []
      return pull(gachaId, ev.pulls, { free: true, guaranteed: ev.guaranteed, claim: claimKey(ev, today) })
    }

    const pull = (gachaId: string, times: number, opts: { free?: boolean; guaranteed?: boolean; claim?: string }) => {
      const gacha = gachas.find((g) => g.id === gachaId)
      if (!gacha || times <= 0) return []
      // 隠しモンスターはタマゴからは生まれない（rateTable が外す）
      const table = rateTable(gacha.id, defs)
      if (!isReady(gacha, table)) return []
      const batch = writeBatch(db)
      const update: DocumentData = {}
      let pulls = state.pity[gacha.id] ?? 0
      const results: HatchResult[] = []
      for (let i = 0; i < times; i++) {
        // 確定ガチャの1回目は、激レアの中から
        const sure = opts.guaranteed && i === 0 && table.some((t) => t.rarity === CONFIG.gacha.pity.rarity)
        const pity = sure || isPity(pulls, table)
        const def = draw(table, sure ? CONFIG.gacha.pity.pulls : pulls, Math.random())
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
        if (shiny) update[`dexShiny.${def.id}`] = true
        pulls = rarityOf(def) === CONFIG.gacha.pity.rarity ? 0 : pulls + 1
        results.push({ def, monsterId: ref.id, shiny, pity })
      }
      if (!opts.free) update.eggs = increment(-results.length)
      if (opts.claim) update[`freeClaims.${opts.claim}`] = true
      update[`pity.${gacha.id}`] = pulls
      batch.update(stateRef, update)
      batch.commit().catch(fail)
      return results
    }

    const hatchEgg: Store['hatchEgg'] = (gachaId) => hatchMany(gachaId, 1)[0] ?? null

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
      if (!isExpFull(cost, investedFor(mon, toNodeId, node.next[0])) || (state.coins ?? 0) < cost.coins) return
      const coreKey = nodeAttr(def, toNodeId)
      if ((state.cores[coreKey] ?? 0) < (cost.cores ?? 0)) return
      // 選ばなかった進化先に注いでいたEXPは、元の財布に返す
      const update: DocumentData = { coins: increment(-cost.coins) }
      if (cost.cores) update[`cores.${coreKey}`] = increment(-cost.cores)
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
      const plans = planBulkFeed(owned, defs, protectedIds(state, dateKey()), starsOf, bulkFeedTarget)
      if (plans.length === 0) return { kept: 0, fed: 0 }
      const update: DocumentData = {}
      const batch = writeBatch(db)
      const foods = plans.flatMap((p) => p.foodIds).map(findMonster).filter((f) => !!f)
      consume(update, foods)
      for (const p of plans) batch.update(doc(db, base, 'ownedMonsters', p.keeperId), { luck: p.luck })
      for (const f of foods) batch.delete(doc(db, base, 'ownedMonsters', f.mon.id))
      if (Object.keys(update).length > 0) batch.update(stateRef, update)
      batch.commit().catch(fail)
      return { kept: plans.length, fed: foods.length }
    }

    const feedLuck: Store['feedLuck'] = (monsterId, foodIds) => {
      const found = findMonster(monsterId)
      if (!found || isLuckMax(found.mon)) return
      const foods = foodIds
        .filter((f) => f !== monsterId)
        .map(findMonster)
        .filter((f): f is NonNullable<typeof f> => !!f && f.mon.defId === found.mon.defId)
      if (foods.length === 0) return
      // 1体ずつ足していく（最大99）
      const luck = foods.reduce((sum, f) => luckAfter({ luck: sum }, f.mon), found.mon.luck ?? 1)
      const update: DocumentData = {}
      consume(update, foods)
      const batch = writeBatch(db)
      batch.update(doc(db, base, 'ownedMonsters', monsterId), { luck })
      for (const f of foods) batch.delete(doc(db, base, 'ownedMonsters', f.mon.id))
      if (Object.keys(update).length > 0) batch.update(stateRef, update)
      batch.commit().catch(fail)
    }

    // レシピの2体（どちらも最終形態の＋5）を合わせて、隠しモンスターを生む。2体はいなくなる
    /** 神化：最終形態の激レアに、同じ属性の降臨モンスターを1体食べさせて★4にする */
    const shinka: Store['shinka'] = (monsterId, foodId) => {
      const found = findMonster(monsterId)
      const food = findMonster(foodId)
      if (!found || !food || monsterId === foodId || !canShinka(found.mon, found.def)) return false
      if (!shinkaFoods(found.def, [food.mon], defs, new Set()).length) return false
      if ((state.coins ?? 0) < CONFIG.shinka.coins) return false
      const update: DocumentData = { coins: increment(-CONFIG.shinka.coins) }
      consume(update, [food])
      const batch = writeBatch(db)
      batch.update(doc(db, base, 'ownedMonsters', monsterId), { shinka: true })
      batch.delete(doc(db, base, 'ownedMonsters', foodId))
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
      if ((state.coins ?? 0) < CONFIG.jogress.coins || (state.cores.none ?? 0) < CONFIG.jogress.cores) return null
      const shiny = false // 色違いはなくなった
      const ref = doc(collection(db, base, 'ownedMonsters'))
      const update: DocumentData = { coins: increment(-CONFIG.jogress.coins), 'cores.none': increment(-CONFIG.jogress.cores) }
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
      batch.set(defRef, {
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
        rarity: input.rarity,
        common: false,
        element: input.element || null,
        favoriteSlot: input.favoriteSlot,
        series: input.series?.trim() || null,
        questOnly: input.questOnly,
        tower: input.questOnly && input.tower === true,
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
      })
      // このモンスターを素材にする隠しモンスターの格を計算し直す（レア度を変えたとき）
      const updated = defs.map((d) =>
        d.id === defRef.id ? { ...d, rarity: input.rarity, element: input.element || undefined } : d,
      )
      for (const hidden of defs.filter((d) => isHidden(d) && d.recipe!.includes(defRef.id))) {
        const el = jogressElementOf(hidden.recipe!, updated)
        batch.update(doc(db, base, 'monsterDefs', hidden.id), {
          jogressGrade: jogressGradeOf(hidden.recipe!, updated),
          jogressElements: el.elements,
          jogressSuper: el.super,
        })
      }
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
        if (!def.element) tuned.element = rec.element
        if (!def.rarity && !def.common) tuned.rarity = 'normal'
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
      const { id, ...data } = input
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
        // 試練の塔は、次の階だけ挑戦できる
        const floor = tower.find((f) => f.quest.id === questId)
        if (!floor || floor.floor !== towerCleared(state, towerMonth(dateKey())) + 1) return
      }
      const ids = party.filter((p) => owned.some((o) => o.id === p)).slice(0, CONFIG.quest.partySize)
      updateState({ challenge: { date: dateKey(), questId, difficulty, party: ids, startTs: Date.now() } })
    }

    const quitChallenge: Store['quitChallenge'] = () => {
      if (state.challenge) updateState({ challenge: null })
    }

    const claimQuest: Store['claimQuest'] = () => {
      const battle = battleOf(
        state.challenge,
        dateKey(),
        [...quests, ...tower.map((f) => f.quest)],
        defs,
        owned,
        weekSets,
        () => '',
      )
      if (!battle?.defeated) return null
      const towerFloor = tower.find((f) => f.quest.id === battle.quest.id)
      if (towerFloor)
        return claimTower(
          towerFloor,
          battle.party.map((m) => m.mon),
        )
      const c = battle.challenge
      const material = battle.quest.kind === 'material'
      const bonus = luckBonus(battle.party.map((m) => m.mon))
      const boost = state.boosts?.quest ? 2 : 1
      const gold = Math.round(questGold(battle.quest, c.difficulty) * bonus.goldRate * boost)
      const coreKey = battle.quest.attr
      const coinQuest = material && battle.quest.drop === 'coins'
      const coins = Math.round(
        (coinQuest ? CONFIG.coins.quest[c.difficulty] : questGold(battle.quest, c.difficulty)) * bonus.goldRate * boost,
      )
      const batch = writeBatch(db)
      const update: DocumentData = {
        ...(boost > 1 ? { 'boosts.quest': false } : {}),
        gold: increment(gold),
        coins: increment(coins),
        questClears: increment(1),
        [`clearedQuests.${battle.quest.id}`]: increment(1),
        challenge: null,
      }
      bumpStats(update, { quest: 1, strict: isStrict(battle.quest) ? 1 : 0 })
      let monsterId: string | null = null
      let cores = 0
      let corePity = false
      if (coinQuest) {
        // コインの金庫：核の代わりに、たくさんの進化コイン
      } else if (material) {
        // 素材クエスト：核が落ちる（毎回ではない。続けて落ちないと確定）
        const drop = rollCoreDrop(c.difficulty, state.coreMisses[battle.quest.id] ?? 0, Math.random, bonus.coreRate)
        cores = drop.count
        corePity = drop.pity
        update[`coreMisses.${battle.quest.id}`] = cores > 0 ? 0 : increment(1)
      } else {
        const boss = battle.boss
        if (!boss) return null
        const shiny = false // 色違いはなくなった
        const ref = doc(collection(db, base, 'ownedMonsters'))
        batch.set(ref, {
          defId: boss.id,
          nodeId: FIRST_NODE_ID,
          investedBy: {},
          investedFrom: {},
          plus: dropPlus(battle.quest),
          shiny,
          obtainedAt: Date.now(),
        })
        if (shiny) update[`dexShiny.${boss.id}`] = true
        monsterId = ref.id
        cores = rollBonusCore(Math.random)
      }
      cores *= boost
      if (cores > 0) update[`cores.${coreKey}`] = increment(cores)
      batch.update(stateRef, update)
      batch.commit().catch(fail)
      return {
        boosted: boost > 1,
        coins,
        monsterId,
        defId: battle.boss?.id ?? null,
        cores,
        coreKey,
        corePity,
        gold,
        eggs: 0,
        towerFloor: null,
      }
    }

    /** 試練の塔の報酬：G・卵・核・塔限定モンスター。クリアした階を進める */
    const claimTower = (floor: TowerFloor, party: OwnedMonster[]): QuestReward | null => {
      const month = towerMonth(dateKey())
      if (floor.floor !== towerCleared(state, month) + 1) return null
      const bonus = luckBonus(party)
      const boost = state.boosts?.quest ? 2 : 1
      const gold = Math.round(floor.reward.gold * bonus.goldRate * boost)
      const coins = gold // 進化コインもGと同じだけ
      const cores = floor.reward.cores * boost
      const batch = writeBatch(db)
      const update: DocumentData = {
        ...(boost > 1 ? { 'boosts.quest': false } : {}),
        gold: increment(gold),
        questClears: increment(1),
        tower: { month, cleared: floor.floor },
        coins: increment(coins),
        challenge: null,
      }
      bumpStats(update, { quest: 1, strict: isStrict(floor.quest) ? 1 : 0 })
      if (floor.reward.eggs > 0) update.eggs = increment(floor.reward.eggs)
      if (cores > 0) update[`cores.${floor.quest.attr}`] = increment(cores)
      if (floor.reward.booster) update[`boosters.${floor.reward.booster}`] = increment(1)
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
        cores,
        coins,
        coreKey: floor.quest.attr,
        booster: floor.reward.booster,
        boosted: boost > 1,
        corePity: false,
        gold,
        eggs: floor.reward.eggs,
        towerFloor: floor.floor,
      }
    }

    const exchangeCores: Store['exchangeCores'] = (key) => {
      const need = CONFIG.cores.eggExchange
      if ((state.cores[key] ?? 0) < need) return
      updateState({ [`cores.${key}`]: increment(-need), eggs: increment(1) })
    }

    const saveSongs: Store['saveSongs'] = (next) => {
      setDoc(musicRef, { songs: next }).catch(fail)
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
      setHabitMode,
      setPartner,
      autoSetPartners,
      setSlot,
      buyExp,
      buyEgg,
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
      gachas,
      saveGacha,
      quests,
      tower,
      week,
      saveQuest,
      deleteQuest,
      startChallenge,
      quitChallenge,
      claimQuest,
      exchangeCores,
      deleteGacha,
    }
  }, [user, base, state, menu, defs, owned, songs, seriesPeriods, gachas, quests, tower, today, yesterday, yesterdayCheckin, week, weekSets, todaySets, stateRef, menuRef, musicRef, seriesRef, fail])

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
