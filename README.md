# Portal

keigo-hisazumi が GitHub Pages で公開しているサイトを一覧できるポータルページです。GitHub Pages を有効にしたリポジトリを GitHub API から自動で取得するため、新しいサイトを公開すると何もしなくても一覧に追加されます。

公開 URL: <https://keigo-hisazumi.github.io/portal/>

## 主な機能

- GitHub Pages を公開しているリポジトリを自動で一覧表示
- 各サイトの説明・トピック・最終更新日・リポジトリへのリンクを表示
- キーワード（タイトル・説明・トピック）での絞り込み
- 設定ファイルでの表示名・説明の上書き、並び順の固定、非表示
- GitHub 以外で公開しているサイトの手動追加
- ライト / ダークモード対応、スマートフォン対応

## 一覧の管理

一覧は `src/sites.json` で管理します。通常は何も編集しなくても、GitHub Pages を有効にしたリポジトリが自動で表示されます。表示名を変えたい、並び順を固定したい、表示したくない、といった場合だけ `src/sites.json` を編集します。

```json
{
  "user": "keigo-hisazumi",
  "includeForks": false,
  "includeArchived": false,
  "exclude": ["portal"],
  "overrides": {
    "todo-app": { "title": "ToDo アプリ", "order": 1 },
    "experiment": { "hidden": true }
  },
  "extra": [
    { "title": "外部のサイト", "url": "https://example.com/", "description": "GitHub Pages 以外で公開" }
  ]
}
```

設定項目の詳細は [`docs/sites-config.md`](./docs/sites-config.md) を参照してください。リポジトリの説明（Description）・トピック（Topics）・Website 欄は GitHub のリポジトリ設定がそのまま反映されるため、まずはそちらを整えるのがおすすめです。

## 技術スタック

- HTML / CSS / JavaScript（ES Modules、フレームワークなし）
- GitHub REST API（ブラウザから直接取得）
- Node.js（ビルド・テスト・ローカル確認用のスクリプト、外部依存なし）
- GitHub Pages

## 開発

### 必要な環境

- Node.js 22 以上

### コマンド

```bash
npm ci            # 依存関係のインストール（外部依存はなし）
npm run dev       # src/ を http://localhost:8080/ で配信
npm run build     # sites.json を検証して dist/ を生成
npm run preview   # dist/ を http://localhost:8080/ で配信
npm test          # テストを実行
```

## ディレクトリ構成

```text
.
├── src/
│   ├── index.html          # ページの HTML
│   ├── styles.css          # スタイル
│   ├── main.js             # GitHub API の取得と画面の描画
│   ├── sites.js            # 一覧の組み立て・並べ替え・絞り込み（純粋関数）
│   └── sites.json          # 一覧の設定ファイル
├── scripts/
│   ├── build.mjs           # src/ を dist/ にコピーするビルドスクリプト
│   ├── validate-config.mjs # sites.json の書式チェック
│   └── serve.mjs           # ローカル確認用の静的サーバー
├── tests/                  # node:test によるテスト
└── docs/                   # 設定ファイルの詳細な説明
```

## デプロイ

main ブランチへの PR マージ時に GitHub Actions で `dist/` をビルドし、GitHub Pages（gh-pages ブランチ）へデプロイします。PR ごとのプレビューは `https://keigo-hisazumi.github.io/portal/pr-<番号>/` に公開されます。一覧の内容は閲覧時に GitHub API から取得するため、他のリポジトリで Pages を公開しただけなら再デプロイは不要です。

## 開発ルール

開発ルールは [`AGENTS.md`](./AGENTS.md) を参照してください。

## ライセンス

MIT License
