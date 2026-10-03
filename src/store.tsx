import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { User } from 'firebase/auth'
import {
  collection,
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
import { DAYS, type Attr } from './data/exercises'
import { FIRST_NODE_ID, canChangeTemplate, getNode, getTemplate } from './data/evolutionTemplates'
import { dateKey } from './lib/date'
import { evolutionCost, isExpFull, planPour } from './lib/evolution'
import { cardioGold } from './lib/rewards'
import { compressImage } from './lib/imageCompress'
import { investedFor, nodeAttr, type Activity, type GameState, type MonsterDef, type OwnedMonster, type SetRecord } from './types'

const zeroExp = () => ({ trained: 0, bought: 0 })

function initialState(): GameState {
  return {
    gold: 0,
    stones: 0,
    eggs: CONFIG.shop.starterEggs,
    exp: { chestArms: zeroExp(), legs: zeroExp(), backShoulders: zeroExp() },
    lifetimeExp: { chestArms: 0, legs: 0, backShoulders: 0 },
    attendance: 0,
    lastAttendanceDate: null,
    totalSets: 0,
    beatCount: 0,
    activeMonsterId: null,
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

export interface MonsterDefInput {
  id?: string
  name: string
  templateId: string
  attrs: Record<string, Attr> // nodeId → その形態の属性
  names: Record<string, string> // nodeId → その段階だけの名前
  files: Record<string, File> // nodeId → 新しくアップロードする画像
}

interface Store {
  user: User
  state: GameState
  menu: Record<string, string>
  defs: MonsterDef[]
  owned: OwnedMonster[]
  today: string
  todaySets: SetRecord[]
  todayActivities: Activity[]
  getHistory: (exerciseId: string) => Promise<SetRecord[]>
  recordSet: (rec: Omit<SetRecord, 'id' | 'ts' | 'date'>, countsBeat: boolean) => SetRecord
  recordCardio: (kind: string, label: string, minutes: number) => void
  setSlot: (slotId: string, exerciseId: string) => void
  buyExp: (attr: Attr, amount: number) => void
  buyEgg: () => void
  hatchEgg: () => MonsterDef | null
  pourExp: (monsterId: string, toNodeId: string) => void
  evolve: (monsterId: string, toNodeId: string) => void
  setActive: (monsterId: string) => void
  saveMonsterDef: (input: MonsterDefInput) => Promise<void>
  loadImage: (imageId: string) => Promise<string | null>
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
  const [today, setToday] = useState(dateKey())
  const [todaySets, setTodaySets] = useState<SetRecord[]>([])
  const [todayActivities, setTodayActivities] = useState<Activity[]>([])
  const [error, setError] = useState<string | null>(null)

  const stateRef = useMemo(() => doc(db, base, 'meta', 'state'), [base])
  const menuRef = useMemo(() => doc(db, base, 'meta', 'menu'), [base])

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
              .map((d) => ({ ...(d.data() as Omit<OwnedMonster, 'id'>), id: d.id }))
              .sort((a, b) => a.obtainedAt - b.obtainedAt),
          ),
        fail,
      ),
    ]
    return () => unsubs.forEach((u) => u())
  }, [base, stateRef, menuRef, fail])

  useEffect(() => {
    const unsubs = [
      onSnapshot(
        query(collection(db, base, 'sets'), where('date', '==', today)),
        (snap) =>
          setTodaySets(
            snap.docs.map((d) => ({ ...(d.data() as Omit<SetRecord, 'id'>), id: d.id })).sort((a, b) => a.ts - b.ts),
          ),
        fail,
      ),
      onSnapshot(
        query(collection(db, base, 'activities'), where('date', '==', today)),
        (snap) =>
          setTodayActivities(
            snap.docs.map((d) => ({ ...(d.data() as Omit<Activity, 'id'>), id: d.id })).sort((a, b) => b.ts - a.ts),
          ),
        fail,
      ),
    ]
    return () => unsubs.forEach((u) => u())
  }, [base, today, fail])

  const store = useMemo<Store | null>(() => {
    if (!state) return null

    const getHistory: Store['getHistory'] = async (exerciseId) => {
      const snap = await getDocs(query(collection(db, base, 'sets'), where('exerciseId', '==', exerciseId)))
      return snap.docs.map((d) => ({ ...(d.data() as Omit<SetRecord, 'id'>), id: d.id }))
    }

    const recordSet: Store['recordSet'] = (rec, countsBeat) => {
      const ref = doc(collection(db, base, 'sets'))
      const full = { ...rec, ts: Date.now(), date: dateKey() }
      const attr = DAYS[rec.day].attr
      const update: DocumentData = { totalSets: increment(1) }
      if (state.lastAttendanceDate !== full.date) {
        update.attendance = increment(1)
        update.lastAttendanceDate = full.date
      }
      if (rec.exp > 0) {
        update[`exp.${attr}.trained`] = increment(rec.exp)
        update[`lifetimeExp.${attr}`] = increment(rec.exp)
      }
      if (rec.gold > 0) update.gold = increment(rec.gold)
      if (countsBeat) update.beatCount = increment(1)
      const batch = writeBatch(db)
      batch.set(ref, full)
      batch.update(stateRef, update)
      batch.commit().catch(fail)
      return { ...full, id: ref.id }
    }

    const recordCardio: Store['recordCardio'] = (kind, label, minutes) => {
      const gold = cardioGold(minutes)
      if (gold <= 0) return
      const batch = writeBatch(db)
      batch.set(doc(collection(db, base, 'activities')), {
        kind,
        label,
        minutes: Math.floor(minutes),
        gold,
        date: dateKey(),
        ts: Date.now(),
      })
      batch.update(stateRef, { gold: increment(gold) })
      batch.commit().catch(fail)
    }

    const setSlot: Store['setSlot'] = (slotId, exerciseId) => {
      setDoc(menuRef, { [slotId]: exerciseId }, { merge: true }).catch(fail)
    }

    const updateState = (update: DocumentData) => {
      const batch = writeBatch(db)
      batch.update(stateRef, update)
      batch.commit().catch(fail)
    }

    const buyExp: Store['buyExp'] = (attr, amount) => {
      const cost = amount * CONFIG.shop.goldPerExp
      if (amount <= 0 || state.gold < cost) return
      updateState({ gold: increment(-cost), [`exp.${attr}.bought`]: increment(amount) })
    }

    const unowned = defs.filter((d) => !owned.some((o) => o.id === d.id))

    const buyEgg: Store['buyEgg'] = () => {
      if (state.gold < CONFIG.shop.eggPrice || unowned.length - state.eggs <= 0) return
      updateState({ gold: increment(-CONFIG.shop.eggPrice), eggs: increment(1) })
    }

    const hatchEgg: Store['hatchEgg'] = () => {
      if (state.eggs <= 0 || unowned.length === 0) return null
      const def = unowned[Math.floor(Math.random() * unowned.length)]
      const batch = writeBatch(db)
      batch.set(doc(db, base, 'ownedMonsters', def.id), {
        nodeId: FIRST_NODE_ID,
        investedBy: {},
        obtainedAt: Date.now(),
      })
      const update: DocumentData = { eggs: increment(-1) }
      if (!state.activeMonsterId) update.activeMonsterId = def.id
      batch.update(stateRef, update)
      batch.commit().catch(fail)
      return def
    }

    const findMonster = (monsterId: string) => {
      const mon = owned.find((o) => o.id === monsterId)
      const def = defs.find((d) => d.id === monsterId)
      if (!mon || !def) return null
      const node = getNode(getTemplate(def.templateId), mon.nodeId)
      return { mon, def, node, cost: node.next.length > 0 ? evolutionCost(node.stage) : null }
    }

    // 進化先の形態の属性のEXPを注ぐ。分岐では、どの進化先に注ぐかで進化先が決まる
    const pourExp: Store['pourExp'] = (monsterId, toNodeId) => {
      const found = findMonster(monsterId)
      if (!found?.cost || !found.node.next.includes(toNodeId)) return
      const { mon, def, node, cost } = found
      const attr = nodeAttr(def, toNodeId)
      const pour = planPour(cost, investedFor(mon, toNodeId, node.next[0]), state.exp[attr])
      if (pour.trained + pour.bought <= 0) return
      const batch = writeBatch(db)
      batch.update(doc(db, base, 'ownedMonsters', monsterId), {
        [`investedBy.${toNodeId}.trained`]: increment(pour.trained),
        [`investedBy.${toNodeId}.bought`]: increment(pour.bought),
      })
      batch.update(stateRef, {
        [`exp.${attr}.trained`]: increment(-pour.trained),
        [`exp.${attr}.bought`]: increment(-pour.bought),
      })
      batch.commit().catch(fail)
    }

    const evolve: Store['evolve'] = (monsterId, toNodeId) => {
      const found = findMonster(monsterId)
      if (!found?.cost || !found.node.next.includes(toNodeId)) return
      const { mon, def, node, cost } = found
      if (!isExpFull(cost, investedFor(mon, toNodeId, node.next[0])) || state.gold < cost.gold) return
      // 選ばなかった進化先に注いでいたEXPは財布に返す
      const refund: Record<string, number> = {}
      for (const other of node.next.filter((n) => n !== toNodeId)) {
        const back = investedFor(mon, other, node.next[0])
        const attr = nodeAttr(def, other)
        refund[`exp.${attr}.trained`] = (refund[`exp.${attr}.trained`] ?? 0) + back.trained
        refund[`exp.${attr}.bought`] = (refund[`exp.${attr}.bought`] ?? 0) + back.bought
      }
      const update: DocumentData = { gold: increment(-cost.gold) }
      for (const [key, value] of Object.entries(refund)) if (value > 0) update[key] = increment(value)
      const batch = writeBatch(db)
      batch.update(doc(db, base, 'ownedMonsters', monsterId), {
        nodeId: toNodeId,
        investedBy: {},
        invested: zeroExp(),
      })
      batch.update(stateRef, update)
      batch.commit().catch(fail)
    }

    const setActive: Store['setActive'] = (monsterId) => updateState({ activeMonsterId: monsterId })

    const saveMonsterDef: Store['saveMonsterDef'] = async (input) => {
      const existing = input.id ? defs.find((d) => d.id === input.id) : undefined
      const defRef = existing ? doc(db, base, 'monsterDefs', existing.id) : doc(collection(db, base, 'monsterDefs'))
      const images: Record<string, string> = { ...(existing?.images ?? {}) }
      const batch = writeBatch(db)
      for (const [nodeId, file] of Object.entries(input.files)) {
        const data = await compressImage(file)
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
        createdAt: existing?.createdAt ?? Date.now(),
      })
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

    return {
      user,
      state,
      menu,
      defs,
      owned,
      today,
      todaySets,
      todayActivities,
      getHistory,
      recordSet,
      recordCardio,
      setSlot,
      buyExp,
      buyEgg,
      hatchEgg,
      pourExp,
      evolve,
      setActive,
      saveMonsterDef,
      loadImage,
    }
  }, [user, base, state, menu, defs, owned, today, todaySets, todayActivities, stateRef, menuRef, fail])

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
