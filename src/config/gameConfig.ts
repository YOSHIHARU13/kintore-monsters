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

  // 腹筋ローラー（ボーナス枠）。1日3セットまで
  bonus: {
    goldPerSet: 15,
  },

  // 朝の記録（前日の歩数と禁欲）
  morning: {
    stepsPerGold: 500, // この歩数ごとに1G（5000歩で10G＝禁欲1日目と同じ）
    maxSteps: 100_000, // 入力できる歩数の上限
    abstinenceGoldPerDay: 10, // 禁欲n日目は n × この値（1日目10G、2日目20G…）
    abstinenceMaxDays: 10, // ここで頭打ち（10日目以降は毎日100G）
  },

  // ショップ
  shop: {
    goldPerExp: 5, // 1EXPを買うのに必要なゴールド
    expBuyStep: 10, // EXP購入の±ボタン1回分
    boughtExpMaxRatio: 0.5, // 購入EXPで埋められるのは進化必要EXPのこの割合まで
    eggPrice: 300,
    starterEggs: 1, // 開始時にもらえるタマゴ
  },

  // 進化コスト（上から 1→2, 2→3, 3→4, 4→5）
  evolutionCosts: [
    { exp: 150, gold: 100 },
    { exp: 500, gold: 300 },
    { exp: 1200, gold: 750 },
    { exp: 2500, gold: 1500 },
  ],

  // 画像の圧縮
  image: {
    maxSidePx: 512,
    targetBytes: 100_000,
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
