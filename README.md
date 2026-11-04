# Template

このリポジトリは新しいプロジェクト用のテンプレートです。AI アシスタント向けの指示書、Issue / PR テンプレート、CI/CD の雛形、エディタ設定、各種ドット・ガバナンスファイルを含みます。

## AI アシスタント運用方針

このテンプレートは **Claude をメインの AI アシスタント** として利用し、**GitHub Copilot をサブツール** として併用するワークフローを想定しています。開発ルールの **正本は [`AGENTS.md`](./AGENTS.md)** で、各ツール向けの指示書はそれを参照する構成です。

| ツール | ファイル | 役割 |
| --- | --- | --- |
| 汎用 AI エージェント | [`AGENTS.md`](./AGENTS.md) | **正本**。すべてのルールはここに集約 |
| Claude Code | [`CLAUDE.md`](./CLAUDE.md) | `AGENTS.md` を参照 |

## 含まれるもの

### AI 向け指示書

- `AGENTS.md` — **正本**（汎用 AI エージェント向け）
- `CLAUDE.md` — Claude Code 向け（`AGENTS.md` を参照）

### Issue / PR

- `.github/ISSUE_TEMPLATE/` — バグ報告 / 機能要望 / 質問テンプレート
- `.github/PULL_REQUEST_TEMPLATE.md` — PR テンプレート（日本語）
- `.github/CODEOWNERS` — レビュー自動アサイン
- `CONTRIBUTING.md` / `SECURITY.md` — 貢献ガイドとセキュリティポリシー

### CI/CD

- `.github/workflows/ci.yml` — PR 時の lint / typecheck / test / build（`package.json` がある場合のみ実行）
- `.github/workflows/actionlint.yml` — workflow 自体の Lint（公式バイナリをバージョン固定で実行。`.github/actionlint-matcher.json` でエラー行に注釈を付ける）
- `.github/workflows/markdownlint.yml` — Markdown の書き方チェック（ルールは `.markdownlint-cli2.jsonc`、内容は `AGENTS.md` の「Markdown の書き方」）
- `.github/workflows/codeql.yml` — セキュリティスキャン（workflow 定義は常に、JS/TS は ソースがある場合のみ解析）
- `.github/workflows/deploy.yml` — main への PR マージ時に GitHub Pages へデプロイ
- `.github/workflows/pr-preview.yml` — PR ごとのプレビュー環境（`pr-<番号>/`）を gh-pages にデプロイし、URL と QR コードをコメント
- `.github/workflows/release-drafter.yml` + `.github/release-drafter.yml` — main へのマージごとにリリースノート草案を更新（PR タイトルの Conventional Commits プレフィックスで分類）
- `.github/workflows/pr-title.yml` — PR タイトルが Conventional Commits 形式（例: `feat: 〜`）かを検証
- `.github/workflows/screenshot.yml` — PR スクリーンショット用 Playwright 雛形
- `.github/dependabot.yml` — 依存関係の自動更新

### 環境差異の吸収

- `.editorconfig` — エディタ間のインデント／改行統一
- `.markdownlint-cli2.jsonc` — Markdown の書き方ルール
- `.gitattributes` — テキスト/バイナリ・改行コードの正規化
- `.gitignore` — OS / 言語 / ビルド成果物
- `.vscode/extensions.json`, `.vscode/settings.json` — VSCode 推奨拡張・設定

### その他

- `LICENSE` — MIT

## 使い方

1. このテンプレートから新しいリポジトリを作成（GitHub の **Use this template** ボタン、または clone）。
2. `README.md` を `AGENTS.md` の「README の構成」に沿って書き換え、`CODEOWNERS`、`LICENSE` のプロジェクト名や著作権者を書き換える。
3. 言語/フレームワークが決まったら以下を有効化:
   - `.github/workflows/ci.yml` は `lint` / `type-check` / `build` の npm script を実行する（`lint` / `type-check` はスクリプトがなければスキップ、`build` は必須）。テストを追加したら Test ジョブのプレースホルダーを差し替える
   - `.github/workflows/codeql.yml` で JS/TS 以外の言語を解析する場合は detect ジョブの判定を追加
   - `.github/workflows/deploy.yml` / `pr-preview.yml` のベースパス変数名（既定は Vite の `VITE_BASE_PATH`）と `publish_dir` を確認
   - Vite の場合は `vite.config.ts` に `base: process.env.VITE_BASE_PATH ?? '/'` を追加する（未設定だと GitHub Pages 上でアセットが 404 になり画面が真っ白になる）
   - `.github/workflows/screenshot.yml` は Playwright 導入後、リポジトリ変数 `ENABLE_SCREENSHOT` を `true` に設定して有効化
   - `.github/dependabot.yml` の対応する `package-ecosystem` のコメントアウトを外す（typescript-eslint を使わない場合は typescript の `ignore` を削除）
4. **リポジトリ作成後の手動設定**（テンプレートに含められないため `README` で案内）:
   - `main` ブランチ保護ルールを設定（PR 必須、CI パス必須、force push 禁止）
   - GitHub Actions の権限を `Read and write` 許可（Release Drafter / GitHub Pages デプロイ / PR プレビュー用）
   - GitHub Pages のソースを `gh-pages` ブランチに設定（`deploy.yml` / `pr-preview.yml` を使う場合）
   - Secret スキャン / Dependabot Alerts を有効化

## VSCode 環境

VSCode をエディタとして使うワークフローを想定しています。`.vscode/extensions.json` に記載の拡張をインストールすると、Lint / Format / Spell check が即座に動きます。

## ライセンス

MIT
