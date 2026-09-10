# Suno Patrol

Sunoで「本当に見たい」アーティストだけを登録して、プロフィールや登録曲へ素早く移動できる、スマートフォン優先の個人用PWAです。Suno専用のブックマーク管理 + 巡回ランチャー + 簡易プレイヤーとして使えます。

## 主な機能

- アーティストの登録・編集・削除、プロフィールURL/handle/アイコン/メモ/タグ管理
- お気に入り、カテゴリ（複数選択）、名前・handle・メモ・タグ検索
- 手動順、名前順、最近開いた順、登録順の並び替え。手動順は↑↓ボタンで変更
- アーティストごとの曲URL、曲名、メモ、タグ管理
- Sunoプロフィール/曲を外部ブラウザで開く
- Suno曲URLの形式を判定した公式埋め込み候補（`https://suno.com/embed/{曲ID}`）
- JSONバックアップの書き出し・置き換え読み込み
- Hash Routing、オフライン閲覧用Service Worker、PWAインストール対応

## データとプライバシー

データはサーバーへ送信せず、利用中のブラウザの `localStorage` に保存します。端末やブラウザを変える場合はSettingsからJSONバックアップを書き出してください。このアプリはSunoとは非公式・非提携の個人向けツールです。Sunoのスクレイピング、内部API解析、ログイン情報取得、自動Follow/Like/コメント、新曲自動巡回は行いません。

## インストール / GitHub Pages

1. このリポジトリのルートにある静的ファイルをGitHubへpushします。
2. GitHubの **Settings → Pages** で **Deploy from a branch** を選択します。
3. Branchを `main`、フォルダを `/ (root)` にして保存します。
4. 数分後に表示されるURLをiPhone Safariの共有メニューから「ホーム画面に追加」します。

ビルドは不要です。Repository Path配下でも動くよう、アセット参照は相対パスを使っています。Hash Routingなのでページを再読み込みしてもGitHub Pagesの404になりません。

## JSON Backup

Settings → **バックアップを書き出す** で `suno-patrol-backup-YYYY-MM-DD.json` を保存できます。復元は **バックアップを読み込む** からJSONを選びます。読み込み時は現在のアーティスト・曲・カテゴリをバックアップ内容で置き換えます。

## 開発方法

ビルドツールは不要です。ローカルサーバーのルートから `index.html` を配信してください（PWAのService Workerは `file://` では動かず、HTTPSまたはlocalhostが必要です）。例：

```bash
python -m http.server 8000
```

ブラウザで `http://localhost:8000/` を開きます。主なファイルは `index.html`、`style.css`、`app.js`、`manifest.json`、`sw.js` です。

## Suno Playerについて

外部APIや音声ファイルの直接取得は行いません。SunoドメインのURLで `/song/{id}` または `/embed/{id}` を抽出できる場合のみ、公式埋め込み形式のiframeを表示します。埋め込みが許可されないURL/環境ではエラーにせず、Sunoで開くリンクへフォールバックします。Suno側の仕様変更により埋め込み可否が変わる可能性があります。

## 今後拡張しやすいポイント

状態は`app.js`の単一データモデルにまとめています。手動ドラッグ並び替え、カテゴリの編集、複数バックアップのマージ、プレイヤー状態の保持、ブラウザ間同期などを追加する場合も、ここを起点に拡張できます。

## 公開URL

https://tsumami-shisho.github.io/suno-patrol/
