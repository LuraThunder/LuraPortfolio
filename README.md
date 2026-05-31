# Quickbrown Portfolio

Adobe Portfolio に依存しない、Quickbrown ポートフォリオサイトの静的版です。

## 使っているもの

- Astro
- ローカル画像: `public/assets/`
- サイト設定: `src/data/site.json`
- 作品データ: `src/data/projects.json`
- GitHub Pages 用の自動デプロイ: `.github/workflows/deploy.yml`

## 確認コマンド

```powershell
npm install
npm run build
npm run verify
```

ビルドと生成結果チェックをまとめて実行する場合:

```powershell
npm run deploy:check
```

ビルド済みの `dist/` だけを確認する場合は、watch しない静的サーバーを使えます。

```powershell
npm run serve -- --host 127.0.0.1 --port 4321
```

確認後は、起動した `node` プロセスを停止してください。開発用の `npm run dev` は必要な時だけ使い、起動したまま放置しないでください。

## 作品を更新する

1. 画像を `public/assets/projects/<slug>/` に追加します。
2. `src/data/projects.json` の対象作品を編集します。
3. `cover` には一覧カード用画像、`gallery` には詳細ページ用画像を指定します。
4. 一覧の表示順は `projects.json` の配列順です。
5. `npm run build` と `npm run verify` で生成結果を確認します。

新しい作品を追加する場合は、既存の作品オブジェクトをコピーして `slug`、`title`、`year`、`description`、`body`、画像パスを差し替えます。`slug` がそのままURLになります。

## About / Contact を更新する

- About本文: `src/data/site.json` の `aboutBody`
- About画像: `public/assets/about/` に画像を置き、`site.json` の `aboutImage` を変更
- メールアドレス: `site.json` の `contactEmail`
- X/Twitterリンク: `site.json` の `twitterUrl`
- OG画像: `site.json` の `ogImage`

Contactページはフォーム送信ではなく、`mailto:` で `quickbrown9999@gmail.com` 宛てのメール作成を開きます。

## フォント

オリジナルの見た目に寄せるため、`src/styles/global.css` で Typekit の `gmsj` / `vcsm` と同じフォントURLを参照しています。Adobe依存を完全にゼロにする場合は、ライセンス済みの `Adelle` と `Proxima Nova` を自前ホストに置き、`@font-face` のURLを差し替えてください。

## GitHub Pages で公開する

このリポジトリは、`main` ブランチへ push すると GitHub Actions が自動で以下を実行するように準備済みです。

1. `npm ci`
2. `npm run build`
3. `npm run verify`
4. `dist/` を GitHub Pages へデプロイ

同一URLである `quickbrown.net` を使うため、`public/CNAME` に `quickbrown.net` を入れています。Astro の `public/` はビルド時に `dist/` へコピーされます。

### 初回だけ必要なGitHub側の作業

1. GitHubで新しいリポジトリを作成します。
2. このローカルリポジトリに remote を追加します。

```powershell
git branch -M main
git remote add origin https://github.com/<your-account>/<repo-name>.git
git add .
git commit -m "Prepare GitHub Pages deployment"
git push -u origin main
```

3. GitHub のリポジトリ画面で `Settings` → `Pages` を開きます。
4. `Build and deployment` の source を `GitHub Actions` にします。
5. `Custom domain` に `quickbrown.net` を設定します。
6. Actions の初回デプロイ完了後、問題なければ `Enforce HTTPS` を有効にします。

GitHub Pages は GitHub Free でも public repository なら利用できます。private repository でPagesを使う場合は、契約プランの条件を確認してください。

### DNSを切り替える

DNS切り替えは、ローカル版とGitHub Pagesの表示確認が済んでから行ってください。GitHub公式ドキュメントでは、apex domain の `quickbrown.net` は以下の `A` レコード、またはDNS事業者が対応していれば `ALIAS` / `ANAME` で GitHub Pages のデフォルトドメインへ向ける方式が案内されています。

`A` レコードを使う場合:

```text
@  A  185.199.108.153
@  A  185.199.109.153
@  A  185.199.110.153
@  A  185.199.111.153
```

`www.quickbrown.net` も使う場合:

```text
www  CNAME  <your-account>.github.io
```

DNS反映には最大24時間程度かかることがあります。GitHub側に custom domain を設定する前にDNSだけを向けると、サブドメイン乗っ取りリスクがあるため、GitHub Pages の設定を先に済ませてください。

### 以後の更新手順

1. 画像や `src/data/projects.json` を編集します。
2. `npm run deploy:check` を実行します。
3. 問題なければ commit して `main` に push します。
4. GitHub Actions が通ると `quickbrown.net` が更新されます。

## Adobe Portfolio から再取り込みする

公開中のAdobe Portfolioサイトをもう一度読み込み、画像とJSONを作り直す場合:

```powershell
npm run import:adobe
```

このコマンドは `src/data/site.json`、`src/data/projects.json`、`public/assets/` を更新します。手作業で編集した内容がある場合は、実行前にGitで差分を確認してください。

## 別の公開先を使う場合

GitHub Pages以外でも、Cloudflare Pages、Netlify、Vercel などで `npm run build` の出力先 `dist/` を公開すれば運用できます。Git pushで自動更新したい場合は、各サービスでこのリポジトリを接続し、build command を `npm run build`、publish directory を `dist` に設定してください。
