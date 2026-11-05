# Portal

keigo-hisazumi が GitHub Pages で公開しているサイトを一覧できるポータルページです。

**公開 URL**: <https://keigo-hisazumi.github.io/portal/>

## 主な機能

- GitHub Pages を公開しているリポジトリを GitHub API から自動で一覧表示（新しいサイトを公開すると何もしなくても追加）
- 各サイトの説明・トピック・最終更新日・リポジトリへのリンクを表示
- 各リポジトリの README の冒頭の説明文を読み込み、サイトの簡単な説明として表示
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

## 説明文の表示

各サイトのカードには、そのリポジトリの `README.md` で最初の見出し（`# タイトル`）の直後に書いた段落を、サイトの説明として表示します。README を更新するだけで反映されるため、ポータル側の編集は不要です。

```markdown
# ToDo

シンプルなタスク管理アプリです。オフラインでも使えます。

**公開 URL**: <https://keigo-hisazumi.github.io/todo/>
```

- 説明文は 1 行・60 字前後で書き、データの保存先・ビルド・ホスティングには触れません（書き方は [`AGENTS.md`](./AGENTS.md) の「README の構成」）
- バッジ・画像・箇条書き・コードブロック・「公開 URL: 〜」の行は説明文に含めません
- 160 文字を超える場合は切り詰めて表示します
- README に説明文が無い場合は、リポジトリの Description を表示します
- ポータル側で説明を変えたい場合は `src/sites.json` の `overrides` で `description` を指定します（README より優先されます）
- README は `raw.githubusercontent.com` から取得するため、GitHub API の利用回数を消費しません。取得結果はブラウザに保存し、リポジトリに push があったときだけ取得し直します

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
│   ├── main.js             # GitHub API・README の取得と画面の描画
│   ├── sites.js            # 一覧の組み立て・並べ替え・絞り込み・README の解析（純粋関数）
│   └── sites.json          # 一覧の設定ファイル
├── scripts/
│   ├── build.mjs           # src/ を dist/ にコピーするビルドスクリプト
│   ├── validate-config.mjs # sites.json の書式チェック
│   └── serve.mjs           # ローカル確認用の静的サーバー
├── tests/                  # node:test によるテスト
└── docs/                   # 設定ファイルの詳細な説明
```

## デプロイ

main ブランチへの PR マージ時に GitHub Actions で `dist/` をビルドし、GitHub Pages（gh-pages ブランチ）へデプロイします。PR ごとのプレビューは `https://keigo-hisazumi.github.io/portal/pr-<番号>/` に公開されます。一覧の内容と説明文は閲覧時に GitHub から取得するため、他のリポジトリで Pages を公開したり README を更新したりしただけなら再デプロイは不要です。

## 開発ルール

開発ルールは [`AGENTS.md`](./AGENTS.md) を参照してください。

## ライセンス

MIT License
