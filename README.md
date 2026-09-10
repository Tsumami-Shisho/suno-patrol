# Suno Patrol

Sunoで「本当に見たい」アーティストだけを登録して、公式アプリやSafariへ素早く戻るための、スマートフォン優先の個人用PWAです。Suno専用の参照リンク集 + 巡回ランチャーとして使えます。曲の管理や再生はSuno公式側に任せ、Patrolへの登録負担を小さくする方針です。

## 主な機能

- アーティストの登録・編集・削除。URLだけのクイック登録、プロフィールURL/handle/メモ/タグ管理
- お気に入り、カテゴリ（複数選択）、名前・handle・メモ・タグ検索
- 手動順、名前順、最近開いた順、登録順の並び替え。手動順は↑↓ボタンで変更
- カードからSuno公式リンクを直接開く。iPhoneではSunoアプリまたはSafariへの遷移をOS/Suno側に任せる
- アーティスト詳細からSuno側でいいね・コメント・フォローを行うための参照導線
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

## 共有からクイック登録

AndroidなどManifestの`share_target`に対応する環境では、共有されたURLをSuno PatrolのURL登録として受け取れます。iPhoneではPWAを共有先に直接指定できないため、iOSショートカットで共有URLを次の形式へ渡す方法が安定します。

`https://tsumami-shisho.github.io/suno-patrol/#/quick-add?url=共有URL`

URL登録画面では表示名・カテゴリ・メモ・タグを後回しにできます。プロフィールURLの`@handle`は、外部通信なしで仮の表示名として使われます。自動取得やスクレイピングは行いません。

## JSON Backup

Settings → **バックアップを書き出す** で `suno-patrol-backup-YYYY-MM-DD.json` を保存できます。復元は **バックアップを読み込む** からJSONを選びます。読み込み時は現在のアーティスト・カテゴリをバックアップ内容で置き換えます。

## 開発方法

ビルドツールは不要です。ローカルサーバーのルートから `index.html` を配信してください（PWAのService Workerは `file://` では動かず、HTTPSまたはlocalhostが必要です）。例：

```bash
python -m http.server 8000
```

ブラウザで `http://localhost:8000/` を開きます。主なファイルは `index.html`、`style.css`、`app.js`、`manifest.json`、`sw.js` です。

## 今後拡張しやすいポイント

状態は`app.js`の単一データモデルにまとめています。iOSショートカットの配布、Inboxからの一括整理、巡回済みフラグ、公式リンクの遷移履歴などを追加する場合も、ここを起点に拡張できます。

## 公開URL

https://tsumami-shisho.github.io/suno-patrol/
