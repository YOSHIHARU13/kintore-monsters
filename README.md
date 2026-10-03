# 筋トレモンスター

筋トレの記録でモンスターを育てる、自分専用のスマホ用Webアプリ。

- 公開先: https://workout-rpg.web.app （Firebase Hosting / プロジェクト `workout-rpg`）
- 構成: React + TypeScript + Vite、Firebase Authentication（Google）、Firestore

## 数値の調整

報酬・進化コスト・回数範囲などの数値は、すべて `src/config/gameConfig.ts` にあります。

- 種目と差し替え候補: `src/data/exercises.ts`
- 進化ツリーの形: `src/data/evolutionTemplates.ts`

## コマンド

```
npm run dev      # 手元で動かす
npm test         # 自動テスト
npm run build    # 公開用に組み立てる
firebase deploy  # 公開する（build のあとに実行）
```
