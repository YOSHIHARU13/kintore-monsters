import { FIRST_NODE_ID } from '../data/evolutionTemplates'
import type { Attr } from '../data/exercises'
import { BALL_LABEL, CORE_LABEL, STONE_LABEL } from './cores'
import { ELEMENT_LABEL } from './element'
import { ELEMENTS, elementInfo } from './element'
import { rarityOf } from './gacha'
import { DIFFICULTIES, defaultHp } from './quest'
import { autoQuestSetup } from './questAuto'
import { isHidden, nodeAttr, type Element, type MaterialDrop, type MonsterDef, type Quest, type QuestDifficulty, type Requirement } from '../types'

export const MATERIAL_PREFIX = 'mat-'

/** 部位の核のクエストを受け持つ属性（炎・水・木で1つずつ） */
const MUSCLE_ELEMENT: Record<Attr, Element> = { chestArms: 'fire', backShoulders: 'water', legs: 'wood' }

interface Slot {
  id: string
  name: string
  catchphrase: string
  element: Element
  drop: MaterialDrop
  attr?: Attr
  turn: number // 日替わりのずらし方
}

/**
 * いつでも遊べる素材クエスト：最初から10個用意しておく（作らなくていい）。
 * - 5属性のハズレが、それぞれ自分の属性の結晶を落とす
 * - 炎・水・木のハズレが、剛腕・背筋・健脚の核を落とす
 * - 光のハズレが進化コイン、闇のハズレが筋肉玉
 * 敵はその属性のハズレから日替わり。どれも初級・上級・究極があり、上ほど編成の条件がきつく、たくさん落ちる。
 * IDは以前のクエストと同じものを使う（クリア回数を引き継ぐ）
 */
export function builtinMaterialQuests(defs: MonsterDef[], today: string, gimmicks: string[] = []): Quest[] {
  const looks = defs.filter((d) => !isHidden(d) && !d.questOnly)
  const hazure = looks.filter((d) => rarityOf(d) === 'hazure')
  const day = Math.floor(Date.parse(`${today}T12:00:00Z`) / 86400000)
  // 同じ日に同じ敵が2つのクエストに並ばないよう、使った子は外す（ほかにいなければ仕方なく使う）
  const used = new Set<string>()
  const enemyFor = (e: Element, turn: number, attr?: Attr) => {
    const fresh = (list: MonsterDef[]) => list.filter((d) => !used.has(d.id))
    const sameEl = hazure.filter((d) => elementInfo(d).elements.includes(e))
    const samePart = attr ? sameEl.filter((d) => nodeAttr(d, FIRST_NODE_ID) === attr) : []
    const pool = [fresh(samePart), fresh(sameEl), samePart, sameEl, hazure, looks].find((p) => p.length > 0) ?? []
    const enemy = pool.length > 0 ? pool[(day + turn) % pool.length] : undefined
    if (enemy) used.add(enemy.id)
    return enemy
  }
  const slots: Slot[] = [
    ...ELEMENTS.map((e) => ({
      id: `${MATERIAL_PREFIX}stone-${e}`,
      name: `${STONE_LABEL(e)}の洞窟`,
      catchphrase: `${STONE_LABEL(e)}が眠る。進化に使う`,
      element: e,
      drop: 'stone' as const,
      turn: 0,
    })),
    ...(Object.keys(MUSCLE_ELEMENT) as Attr[]).map((attr) => ({
      id: `${MATERIAL_PREFIX}${attr}`,
      name: `${CORE_LABEL[attr]}の採掘場`,
      catchphrase: `${CORE_LABEL[attr]}を集めよう`,
      element: MUSCLE_ELEMENT[attr],
      drop: 'muscle' as const,
      attr,
      turn: 1,
    })),
    {
      id: `${MATERIAL_PREFIX}coins`,
      name: '🪙 コインの金庫',
      catchphrase: '進化コインがざくざく',
      element: 'light',
      drop: 'coins',
      turn: 1,
    },
    {
      id: `${MATERIAL_PREFIX}none`,
      name: `${BALL_LABEL}の祭壇`,
      catchphrase: '★3への進化に欠かせない、レアな玉',
      element: 'dark',
      drop: 'ball',
      turn: 1,
    },
  ]
  // 部位の核のクエストから先に敵を決める（部位が合うハズレは少ないので、先に取っておく）
  const enemies = new Map<string, MonsterDef | undefined>()
  for (const slot of [...slots.filter((x) => x.attr), ...slots.filter((x) => !x.attr)])
    enemies.set(slot.id, enemyFor(slot.element, slot.turn, slot.attr))
  return slots.map((slot) => {
    const enemy = enemies.get(slot.id)
    const requirementsBy: Partial<Record<QuestDifficulty, Requirement[]>> = {}
    const weakSlotsBy: Partial<Record<QuestDifficulty, string[]>> = {}
    for (const d of DIFFICULTIES) {
      const setup = enemy ? autoQuestSetup(enemy, 'kiwami', 'material', [], gimmicks, undefined, defs, false, d) : null
      requirementsBy[d] = setup?.requirements ?? []
      weakSlotsBy[d] = setup?.weakSlots ?? []
    }
    return {
      id: slot.id,
      name: slot.name,
      kind: 'material',
      builtin: true,
      drop: slot.drop,
      bossDefId: enemy?.id ?? '',
      attr: slot.attr ?? 'none',
      element: slot.element, // 落ちる結晶の属性（敵がいないときの代わりの子でも変えない）
      weakSlots: weakSlotsBy.normal ?? [],
      requirements: requirementsBy.normal ?? [],
      requirementsBy,
      weakSlotsBy,
      hp: defaultHp(1, 'material'),
      rank: 1,
      catchphrase: slot.catchphrase,
      theme: 'flame',
      createdAt: 0,
    } as Quest
  })
}

/**
 * 神殿：5属性ぶん、最初から用意しておく。カスタマイズアイテムが落ちる。
 * 敵はその属性のノーマル（いなければハズレ）から日替わり。難易度は「時の間」（上級なみ）と「修羅場」（究極なみ）
 */
export function builtinTempleQuests(defs: MonsterDef[], today: string, gimmicks: string[] = []): Quest[] {
  const looks = defs.filter((d) => !isHidden(d) && !d.questOnly)
  const day = Math.floor(Date.parse(`${today}T12:00:00Z`) / 86400000)
  return ELEMENTS.map((e) => {
    const sameEl = looks.filter((d) => elementInfo(d).elements.includes(e))
    const pool = [sameEl.filter((d) => rarityOf(d) === 'normal'), sameEl, looks].find((p) => p.length > 0) ?? []
    const enemy = pool.length > 0 ? pool[day % pool.length] : undefined
    const requirementsBy: Partial<Record<QuestDifficulty, Requirement[]>> = {}
    const weakSlotsBy: Partial<Record<QuestDifficulty, string[]>> = {}
    for (const d of ['normal', 'hard'] as const) {
      const setup = enemy ? autoQuestSetup(enemy, 'kiwami', 'material', [], gimmicks, undefined, defs, false, d) : null
      requirementsBy[d] = setup?.requirements ?? []
      weakSlotsBy[d] = setup?.weakSlots ?? []
    }
    return {
      id: `${MATERIAL_PREFIX}temple-${e}`,
      name: `🏛 ${ELEMENT_LABEL[e]}の神殿`,
      kind: 'material',
      builtin: true,
      drop: 'custom',
      bossDefId: enemy?.id ?? '',
      attr: 'none',
      element: e,
      weakSlots: weakSlotsBy.normal ?? [],
      requirements: requirementsBy.normal ?? [],
      requirementsBy,
      weakSlotsBy,
      hp: defaultHp(1, 'material'),
      rank: 1,
      catchphrase: 'カスタマイズアイテムが眠る神殿',
      theme: 'royal',
      createdAt: 0,
    } as Quest
  })
}
