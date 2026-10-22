import type { FreePullEvent } from '../lib/events'
// ============================================================
// ゲームの数値はすべてこのファイルにまとめてあります。
// バランスを調整したいときは、ここの数字だけを書き換えてください。
// ============================================================

export const CONFIG = {
  // ダンベルの重さ
  weight: {
    minKg: 1,
    maxKg: 10,
    stepKg: 1,
    defaultKg: 3, // 記録がまだない種目の初期重量
  },

  // セットのルール
  sets: {
    perExercise: 3, // 1種目あたりの基本セット数
    minIntervalSec: 30, // 同じ種目でこの秒数より短い間隔のセットはEXP対象外
    restSec: 90, // 休憩タイマーの目安
    // 2周目：基本セットを終えた種目は、同じ週にもう基本セット数まで追加でやれる（EXPはこの割合）
    // 1部位あたり週10〜20セットまでは、セットを増やすほど筋肉が育ちやすい。それ以上は回復が追いつかないので2周まで
    extraRounds: 1,
    extraExpRatio: 0.5,
  },

  // 今週のタスク（全種目×基本セット数）を全部消したときのボーナス
  weekly: {
    clearGold: 150,
  },

  // 重量アップ・上位種目の提案
  progression: {
    streak: 2, // 「基本セットがすべて回数上限」を何回連続で達成したら提案するか
  },

  // 目標回数の決め方
  target: {
    recentCount: 3, // 直近何回の平均を使うか
    plus: 1, // 平均に足す回数
    keepMargin: 1, // 目標からこの回数以内なら「キープ」
  },

  // 筋トレ1セットのEXP
  exp: {
    normal: 10,
    keep: 12,
    beat: 15,
  },

  // 腹筋ローラー（ボーナス枠）。1日3セットまで（日付が変わるとまた3セットできる）
  bonus: {
    goldPerSet: 15,
    anyExpPerSet: 10, // 万能EXP：どの属性の進化にも注げる
  },

  // 朝の記録（前日の歩数）と、習慣（その場で記録）
  morning: {
    stepsPerGold: 100, // この歩数ごとに1G（段階なし。5000歩で50G＝卵1個）
    maxSteps: 100_000, // 入力できる歩数の上限
    habitGold: 50, // 習慣ができた日のゴールド（○×で記録するとき）
    // 習慣を分数で記録するときの、1分あたりのゴールド。1回に続けた分数が長いほど高い（5分で50G＝卵1個）
    habitRates: [
      { from: 1, perMinute: 5 },
      { from: 5, perMinute: 10 },
    ],
    habitMaxMinutes: 30, // 分数で記録するとき、ゴールドが出るのは1日の合計でこの分数まで
    habitDefaultLabel: 'ベッドでスマホを見なかった', // 習慣の名前（設定で変えられる）
  },

  // ショップ
  shop: {
    goldPerExp: 5, // 1EXPを買うのに必要なゴールド
    expBuyStep: 10, // EXP購入の±ボタン1回分
    boughtExpMaxRatio: 0.5, // 購入EXPで埋められるのは進化必要EXPのこの割合まで
    eggPrice: 50, // 歩数5000歩・瞑想5分でちょうど1個
    shinyRate: 1 / 20, // タマゴから色違いが生まれる確率
    starterEggs: 1, // 開始時にもらえるタマゴ
  },

  // 攻撃力 = 星の数 × perStar ＋ レア度の上乗せ
  attack: {
    perStar: 3000,
  },

  // 種目の相棒：枠ごとに1体セットすると、その種目のEXPが増える
  // 倍率 = 1 + 攻撃力 × perAttack（得意種目の枠なら、さらに × favorite）
  partner: {
    perAttack: 0.05 / 3000, // 星1つぶん（攻撃力3000）で +5%
    favorite: 1.2,
  },

  // アビリティ：クエストの編成の条件になる。名前はギミック（バリア）→ アビリティ（バリアブレイカー）の組で持つ
  gimmicks: {
    // ギミック → それに対応するアビリティ。見た目に縛られない抽象的な名前にしてある
    // 選べるのは4種類だけ（多すぎると分かりにくいので）
    defaults: {
      バリア: 'バリアブレイカー',
      シールド: 'シールドクラッシャー',
      リジェネ: 'リジェネストッパー',
      ミラー: 'ミラーシャッター',
    } as Record<string, string>,
    // 以前あったもの（選べないが、付けてあるモンスターやクエストの表示用に名前だけ残す）
    legacy: {
      フィールド: 'フィールドジャマー',
      フォース: 'フォースキャンセラー',
      ウォール: 'ウォールバスター',
      オーラ: 'オーライーター',
    } as Record<string, string>,
    // 持てるアビリティの数（レア度の格）。ジョグレスは jogress
    slots: { hazure: 0, normal: 1, superRare: 2, jogress: 3 },
    questOnlyMax: 1, // 降臨（クエスト限定）は激レアでもアビリティはここまで（ガチャより弱く）
  },

  // クエスト：出撃したら、その日のうちに倒す勝負。出撃してからのセットがそのままダメージになる（何回でも挑戦できる）
  // ダメージになるのは報酬が出るセットだけ（各種目は週に2周まで、ローラーは1日3セットまで）
  quest: {
    // 1回ぶんのダメージ = 基本値 × 攻撃するモンスターの攻撃力 ÷ attackUnit × 補正
    attackUnit: 3000,
    setDamage: 2.5, // 筋トレ1セット（全員が攻撃。セットの部位と一致するモンスターは × partMatch）
    partMatch: 2,
    rollerDamage: 4, // 腹筋ローラー1セット（全員で攻撃）
    weakSlot: 2, // ボスの弱点種目のセット
    offElementChozetsu: 0.5, // 超絶では、ボスの属性に有利な属性を持たないモンスターの攻撃はこの倍率
    favorite: 1.5, // 攻撃したモンスターの得意種目のセット
    maxWeakSlots: 2,
    // ボスの格：初級・中級・上級のHPとGが、まとめてこの倍率になる
    ranks: [
      { label: '雑魚', hp: 0.5, gold: 0.5 },
      { label: '普通', hp: 1, gold: 1 },
      { label: '強敵', hp: 1.6, gold: 1.5 },
      { label: '凶悪', hp: 2.5, gold: 2.2 },
      { label: '極', hp: 4, gold: 3.5 },
    ],
    // ボスクエストの格：難易度は1つだけで、クエストそのものに格がある（素材クエストは初級〜上級のまま）
    // hpRatio：1回のトレーニングで与えるダメージの目安に対するHPの倍率
    grades: {
      jokyu: { label: '上級', hpRatio: 0.45, gold: 50, plus: 0 }, // 育ちきっていなくても倒せる入門
      kiwami: { label: '極', hpRatio: 0.9, gold: 80, plus: 0 },
      kyukyoku: { label: '究極', hpRatio: 1.5, gold: 150, plus: 0 },
      chozetsu: { label: '超絶', hpRatio: 2.5, gold: 300, plus: 1 },
      chokyukyoku: { label: '超究極', hpRatio: 2.5, gold: 300, plus: 1 }, // コラボ限定。強さと報酬は超絶と同じ
    },
    difficulties: {
      // hpRatio：1回のトレーニングで与えるダメージの目安に対するHPの倍率
      easy: { label: '初級', plus: 0, gold: 50, hpRatio: 0.9 },
      normal: { label: '中級', plus: 1, gold: 120, hpRatio: 1.5 },
      hard: { label: '上級', plus: 2, gold: 250, hpRatio: 2.5 },
    },
    partySize: 6, // 出撃できる数
  },
  // おまかせのクエスト：格ごとの条件（適正の属性の数・アビリティの種類と数・弱点種目の数）
  questAuto: {
    jokyu: { element: 1, abilities: 0, abilityCount: 0, weak: 1 },
    kiwami: { element: 2, abilities: 1, abilityCount: 1, weak: 1 },
    kyukyoku: { element: 3, abilities: 1, abilityCount: 2, weak: 1 },
    chozetsu: { element: 3, abilities: 2, abilityCount: 2, weak: 2 },
    chokyukyoku: { element: 3, abilities: 2, abilityCount: 2, weak: 2 },
    material: { element: 2, abilities: 0, abilityCount: 0, weak: 1 },
  },
  // 無料ガチャのイベント：その日のうちに、好きなガチャで引ける（卵は減らない）
  events: {
    freePulls: [
      { id: 'thursday', label: '木曜の無料10連', pulls: 10, weekday: 4 },
      { id: 'monthStart', label: '月初めの無料10連', pulls: 10, monthDay: 1 },
      { id: 'monthMid', label: '15日の激レア確定ガチャ', pulls: 1, monthDay: 15, guaranteed: true },
    ] as FreePullEvent[],
  },
  // ブースター：回数制の道具。使うと次の1回（EXPは次の数セット）だけ効く。期限なし
  boosters: {
    habit: { icon: '🧘', label: 'ブースター', price: 150, text: '次の記録のGが2倍、その日の上限もなし' },
    exp: { icon: '💪', label: '筋トレブースター', price: 300, text: '次の10セットのEXPが2倍', sets: 10 },
    quest: { icon: '⚔️', label: '討伐ブースター', price: 250, text: '次のクエスト報酬（Gと核）が2倍' },
  },
  // 試練の塔：毎月10階を自動で作る。下から1階ずつ挑戦し、各階の報酬は月に1回だけ
  tower: {
    floors: 10,
    // HP：1回のトレーニングで与えるダメージの目安に対する倍率
    hpRatio: [0.6, 0.8, 1.0, 1.2, 1.4, 1.7, 2.0, 2.3, 2.7, 3.2],
    gold: [100, 120, 150, 180, 220, 260, 300, 350, 400, 500],
    eggs: { 2: 1, 4: 1, 7: 1, 8: 1 } as Record<number, number>, // その階で卵
    cores: {} as Record<number, number>, // その階でボスの部位の核
    boosters: { 3: 'habit', 6: 'exp', 9: 'quest' } as Record<number, 'habit' | 'exp' | 'quest'>, // その階でブースター
    monsterFloors: [5, 10], // 塔限定モンスターがもらえる階
    eggsInsteadOfMonster: 2, // 塔限定モンスターが登録されていないときは卵
    elementReqFrom: 3, // この階から「適正の属性」の編成条件
    abilityReqFrom: 6, // この階からアビリティの編成条件
    twoWeakFrom: 6, // この階から弱点種目が2つ
    kyukyokuFrom: 4, // この階から究極
    chozetsuFrom: 8, // この階から超絶（適正の属性以外は半減）
  },

  // 編成：クエストの条件（炎が3、バリアブレイカーが3…）を出撃する6体の合計で満たす
  // 編成倍率 = base ＋（1 − base）× そろい具合 ＋ 条件を超えた数 × perExtra（上限 max）
  // 何もそろっていないと ×0.4、ちょうどそろうと ×1.0（普通にその日のメニューをやれば倒せる）
  formation: {
    base: 0.4,
    perExtra: 0.15,
    max: 2.5,
    maxRequirements: 6,
    elementIcon: { fire: '🔥', water: '💧', wood: '🌿', light: '✨', dark: '🌑' },
  },

  // 合体：最終形態に、同じモンスターか同じ属性のモンスター（段階は問わない）を食べさせると＋が上がる。＋が上がるほど枠が豪華になる
  // ＋ごとに、本体の属性のEXPを注いでゲージを満タンにしてから、ゴールドを払って食べさせる
  fusion: {
    maxPlus: 5,
    // 素材：同じ属性の別のモンスターで＋1（同じモンスターは運のほうに食べさせる）
    gain: { sameElement: 1 },
    costs: [
      { exp: 100, gold: 100 }, // ＋0→＋1
      { exp: 200, gold: 200 },
      { exp: 300, gold: 300 },
      { exp: 400, gold: 400 },
      { exp: 500, gold: 500 }, // ＋4→＋5
    ],
  },

  // 運：同じモンスターを食べさせると＋1（タダ）。最大99で「運極」
  // 運極のモンスターを出撃させると、1体につきクエスト報酬のGと、素材クエストの核の落ちやすさが上がる
  luck: {
    max: 99,
    gachaStart: 10, // ガチャから出た子は運10（10体当てれば運極）。クエストのドロップは運1
    goldBonus: 0.2, // 運極1体につき報酬G +20%
    coreBonus: 0.1, // 運極1体につき核が落ちる確率 +10%
  },

  // ジョグレス：レシピの2体を＋5（最終形態）まで育てて合わせると、隠しモンスターが生まれる
  jogress: {
    gold: 600,
    cores: 2, // 無垢の核
    superRareBonus: 1500, // 素材の激レア1体につき、攻撃力の上乗せ
  },

  // 進化素材「核」：素材クエストで落ちる（毎回ではない）。余ったらショップでタマゴと交換できる
  // 目安：★3まで育つのは週1体くらい（核2個）、素材クエストは週2回くらい → 週1.3個くらい落ちて、少し足りないくらい
  cores: {
    drop: {
      easy: { rate: 0.5, double: 0 },
      normal: { rate: 0.65, double: 0 },
      hard: { rate: 0.8, double: 0.25 },
    },
    pityMisses: 3, // この回数続けて落ちなかったら、次は必ず落ちる
    bossBonusRate: 0.15, // ボスクエストでも、たまに落ちる
    eggExchange: 3, // この数でタマゴ1個と交換
    materialHpRatio: 0.5, // 素材クエストのHPは、ボスクエストのこの割合
    materialGoldRatio: 0.5,
    builtinCatchphrase: 'いつでも挑める。核を集めよう',
  },

  // 進化コスト（上から 1→2, 2→3, 3→4, 4→5）
  // 1体をじっくりより、たくさん育てる：その部位の日のトレーニング1回（約180EXP）で★1→★3まで届く
  evolutionCosts: [
    { exp: 40, gold: 30, cores: 0 },
    { exp: 120, gold: 60, cores: 1 }, // ★2→★3 は、進化先の属性の核が要る
    { exp: 1200, gold: 750 },
    { exp: 2500, gold: 1500 },
  ],

  // 画像の圧縮
  image: {
    maxSidePx: 512,
    targetBytes: 100_000,
    bannerMaxSidePx: 1024, // ガチャのバナー画像
  },

  // ガチャ：いくつでも作れる。モンスターは最大3つのガチャに入れられる
  gacha: {
    maxPerMonster: 3,
    minPickups: 3,
    bannerMonsters: 5, // 自動バナーに出すモンスターの数（優先度の上位から）
    // 自動バナーのテーマ色
    themes: {
      flame: '炎',
      ocean: '海',
      forest: '森',
      royal: '王',
      night: '夜',
    }, // 作ったガチャは、レア以上（ピックアップ）がこの数そろうとショップで引ける
    defaultId: 'default', // どのガチャにも入れていないモンスターが入るガチャ（消せない）
    defaultName: 'いつものガチャ',
    // レア度ごとの確率（合計1）。同じレア度のモンスターで山分けする
    // ハズレとノーマルはどのガチャからも出る。激レアはそのガチャ限定（ガチャの「顔」）
    rarities: {
      hazure: { label: 'ハズレ', rate: 0.45, attackBonus: 0, everyGacha: true, hint: 'どのガチャからも出る。2段階で終わるような軽いやつ' },
      normal: { label: 'ノーマル', rate: 0.4, attackBonus: 1500, everyGacha: true, hint: 'どのガチャからも出る。3段階まで進化する普通のやつ' },
      superRare: {
        label: '激レア',
        rate: 0.15,
        attackBonus: 4500,
        everyGacha: false,
        hint: 'そのガチャ限定。ジョグレスの素材になる、いちばんかっこいいやつ',
      },
    },
    questOnlyAttackBonusMax: 3000, // 降臨（クエスト限定）の攻撃力の上乗せはここまで（ガチャの激レア4500より弱く）
    // 星は進化形態だけで決まる（レア度は関係ない）：1段目が★1、進化するたびに1つ増える（最大 maxStars）
    // ジョグレスの隠しモンスターは、レシピで決めた「生まれるときの星」から（決めていなければ jogressDefaultBirth）
    // レア度は星には出さず、攻撃力の上乗せ（attackBonus）にだけ効く。ジョグレスは jogressAttackBonus
    formStarBase: 0,
    maxStars: 4, // 星はここまで（ジョグレスの★4が最上位）
    jogressDefaultBirth: 4,
    jogressBirthChoices: [3, 4],
    jogressAttackBonus: 4500,
    fixedStarsDefault: 3, // 進化しない降臨モンスターの星（★1〜★3で選べる）
    fixedStarsChoices: [1, 2, 3],
    // 天井：同じガチャで、激レアが出ないままこの回数目を引くと激レア確定
    pity: { rarity: 'superRare' as const, pulls: 30 },
    shinyRateChoices: [1 / 50, 1 / 20, 1 / 10, 1 / 5], // ガチャごとに選べる色違いの確率
  },

  // 種目ごとの回数範囲 [下限, 上限]。下限 null は「上限だけ決まっている自重種目」
  repRanges: {
    // 胸腕
    pushup: [null, 20],
    pushupBar: [null, 20],
    pushupFeetUp: [null, 20],
    pushupOneLeg: [null, 15],
    floorPress: [8, 15],
    floorPressSlow: [8, 15],
    floorPressClose: [8, 15],
    floorPressOneArm: [8, 15],
    fly: [10, 15],
    flySlow: [10, 15],
    squeezePress: [10, 15],
    curl: [8, 15],
    hammerCurl: [8, 15],
    curlSlow: [8, 15],
    concentrationCurl: [8, 15],
    ohExtension: [10, 15],
    ohExtensionOneArm: [10, 15],
    lyingExtension: [10, 15],
    kickback: [10, 15],
    kickbackPause: [10, 15],
    // 脚
    bulgarian: [8, 15],
    bulgarianSlow: [8, 15],
    reverseLunge: [8, 15],
    gobletSlow: [8, 15],
    goblet: [8, 15],
    gobletPause: [8, 15],
    hipLift: [12, 20],
    hipLiftFeetUp: [12, 20],
    hipLiftOneLeg: [8, 15],
    rdl: [8, 15],
    rdlOneLeg: [8, 15],
    calfOneLeg: [12, 20],
    calfBoth: [12, 20],
    calfOneLegStep: [12, 20],
    // 背肩
    oneHandRow: [8, 15],
    oneHandRowPause: [8, 15],
    wideRow: [8, 15],
    wideRowPause: [8, 15],
    seatedRearRaise: [12, 20],
    seatedRearRaisePause: [12, 20],
    sideLyingReverseFly: [12, 20],
    sideLyingReverseFlyPause: [12, 20],
    bentOverRow: [8, 15],
    bentOverRowReverse: [8, 15],
    reverseFly: [12, 20],
    reverseFlyPause: [12, 20],
    shoulderPress: [8, 15],
    arnoldPress: [8, 15],
    shoulderPressOneArm: [8, 15],
    sideRaise: [12, 20],
    sideRaiseSlow: [12, 20],
    frontRaise: [12, 20],
    // ボーナス：腹筋ローラー
    abKnee: [null, 15],
    abWall: [null, 15],
    abKneeFull: [null, 15],
    abStanding: [null, 10],
  } as Record<string, [number | null, number]>,
}
