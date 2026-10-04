# アイコがカメラに反応する

**これは Jev（TypeSafe AI）による判定の動作検証プロジェクトです。** 本番用途のプロダクトではなく、「ローカルで検出した数値データを渡したとき、Jevがどの程度安定してジェスチャーを判定できるか」を実際に動かして確かめるためのデモです。

iPad、スマートフォン、PCのブラウザで、カメラに映った動作にアイコが動画で応えます。手・顔のランドマーク検出（MediaPipe）は端末内だけで処理し、カメラ映像自体は外部に送りません。検出した顔の角度・距離は、どのジェスチャーかの判定のために **Jev** に送っています。Jevは画像・動画を直接扱えないため（テキスト/構造化データのみ対応）、この判定専用の数値データだけを渡しています。なお手振りの左右判定は、検証の過程でJevのChoice判定が左右非対称・不安定だったため、単純な座標計算に切り替えています（詳細は`functions/api/gesture.js`のコメント参照）。Jevを使っているのは首傾げ・覗き込みの判定のみです。

デモは https://aiko-jev-camera-reaction.pages.dev で公開しています（Cloudflare Pages）。iPadでこのURLを開くだけで動きます。

> 旧版は「Jev・外部推論APIを使わない」設計でしたが、2026-09-23の要望によりJev前提に作り直しました。当時の設計判断は [20260923-aiko-camera-reactions.md](20260923-aiko-camera-reactions.md) / [20260923-aiko-camera-implementation-plan.md](20260923-aiko-camera-implementation-plan.md) に記録として残しています（現状とは異なります）。

## 構成

- `src/`：フロントエンド（Vite静的サイト）。MediaPipeで手・顔を検出し、直近の軌跡を同一オリジンの`/api/gesture`へ問い合わせる
- `functions/api/gesture.js`：Cloudflare Pages Function。Jev APIキーを隠す中継役。手振りは座標計算のみで即判定し、それ以外（首傾げ・覗き込み・それ以外）はJevのChoiceプリミティブに渡して判定結果を返す

フロントエンドと中継APIは同じCloudflare Pagesプロジェクトから同一オリジンで配信されるため、CORSも別ホストの管理も不要です。Jev APIキーはCloudflare Pagesの環境変数（シークレット）としてのみ存在し、ブラウザには一切渡りません。反応動画はCloudflare R2（Rangeリクエスト対応、Safari/iOSの動画再生に必須）から配信しています。

## 開発

必要なものはNode.js 20以上、ffmpeg、ffprobe、[wrangler](https://developers.cloudflare.com/workers/wrangler/)（`npm i -g wrangler` または `npx wrangler`）です。

反応動画の元ソース（`wave-left.MP4` など5本、人物が映っているため非公開）とダウンロード済みモデルは`.gitignore`対象でこのリポジトリに含まれません。`npm run assets:prepare`を動かすには、プロジェクトルートに自分で5本の素材（`wave-left.MP4` / `wave-right.MP4` / `look-into.MP4` / `tilt-to-left.MP4` / `tilt-to-right.mov`）を用意してください。見た目だけ動かしたい場合は、この手順を飛ばして`npm run models:prepare`だけ実行し、R2上の動画（本番と同じ`MEDIA_BASE_URL`）を使う形でも確認できます。

```sh
npm install
npm run assets:prepare   # 自分の素材を用意した場合のみ
npm run models:prepare
npm run build
```

ローカルで`/api/gesture`を含めて確認する場合：

```sh
cp .dev.vars.example .dev.vars   # TYPESAFE_API_KEY を設定
wrangler pages dev dist --port 8788
```

フロントエンドの見た目だけ素早く確認したい場合は `npm run dev`（Vite）でも起動できますが、その場合 `/api/gesture` は応答しません（`wrangler pages dev` 経由でのみ動きます）。

カメラを使うにはHTTPS、またはlocalhostで開いてください。iPadから直接ローカルを開く場合、`localhost` はiPad自身を指すため使えません。デプロイ済みのCloudflare Pages URL（上記）を開いてください。動画だけを見る場合は初期画面の「動きを見る」を使えます。

## 検証

```sh
npm run typecheck
npm test
npm run build
npm run test:smoke
```

現在の自動検証は、キャリブレーションの状態遷移とJevへ渡すスナップショット（手の軌跡・顔の角度）の組み立て、ビルド後の配信アセットを確認します。ジェスチャーの最終判定自体はJev側で行うため、閾値の単体テストはありません。実機カメラ、GPU、権限、Safariの動画再生制限、Jevとの疎通は自動テストの代わりにならないため、[docs/device-validation.md](docs/device-validation.md) に機種ごとに記録します。

## 配信（Cloudflare Pages）

```sh
npm run build
wrangler pages secret put TYPESAFE_API_KEY --project-name aiko-jev-camera-reaction   # 初回のみ
wrangler pages deploy dist --project-name aiko-jev-camera-reaction --branch main
```

公開前に次を確認します。

- `/models/` のWASMと2つのモデルが同じ配信元から読める
- R2上の5本のMP4がH.264、音声なし、範囲リクエスト（206 Partial Content）対応で読める
- `typesafe.env.rtf`、`.dev.vars`、元動画、モデル準備用ファイルが配信物（`dist/`）にもリポジトリにも入っていない
- ブラウザから`/api/gesture`とR2以外にカメラ画像やランドマークが送られていない（`/api/gesture`へは手の軌跡・顔の角度の数値のみ、Jev APIキーはCloudflare Pages側にのみ存在）

iPadでの自動反応の実機確認結果は、機種・iPadOS・Safari・ビルドとあわせて[docs/device-validation.md](docs/device-validation.md)に記録してください。
