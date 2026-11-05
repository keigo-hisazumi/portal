# sites.json の設定項目

`src/sites.json` はポータルに表示するサイト一覧の設定ファイルです。書式は `npm run build` と `npm test` で検証され、誤りがあると CI が失敗します。

## 一覧が作られる流れ

1. ブラウザが `sites.json` を読み込む
2. GitHub API（`GET /users/{user}/repos`）から `user` のリポジトリ一覧を取得する
3. GitHub Pages が有効なリポジトリだけを残し、`includeForks` / `includeArchived` / `exclude` で絞り込む
4. `overrides` で表示内容を上書きし、`hidden: true` のものを除く
5. `extra` の手動登録サイトを加える
6. `order` を指定したものを昇順で先頭に、残りを最終更新日時の新しい順に並べる
7. `overrides` で `description` を指定していないリポジトリは、README の冒頭の説明文を読み込んで説明として表示する（無ければリポジトリの Description）

GitHub API の未認証リクエストは 1 IP あたり 1 時間 60 回までのため、取得結果はブラウザの localStorage に 1 時間キャッシュします。取得に失敗した場合は前回のキャッシュを表示し、キャッシュも無ければ `extra` のサイトだけを表示します。

README はデフォルトブランチの `README.md` を `raw.githubusercontent.com` から取得するため、GitHub API の利用回数は消費しません。読み込んだ説明文はリポジトリの最終 push 日時と一緒に localStorage に保存し、push があるまで使い回します。

README からの読み込みは次のように行います。

- 最初の `#` 見出しの直後から、次の見出しまでを対象にする（`#` 見出しが無ければ先頭から）
- バッジ・画像・HTML・箇条書き・番号付きリスト・引用・表・区切り線・コードブロックは飛ばし、最初の段落を説明文にする
- 「公開 URL: 〜」の段落や URL だけの段落は説明文として扱わない
- リンク・強調・インラインコードなどの記法は取り除き、160 文字を超える場合は切り詰める

## トップレベルの項目

| 項目 | 型 | 既定値 | 説明 |
| --- | --- | --- | --- |
| `user` | 文字列 | （必須） | リポジトリを取得する GitHub のユーザー名 |
| `includeForks` | 真偽値 | `false` | fork したリポジトリも表示するか |
| `includeArchived` | 真偽値 | `false` | アーカイブ済みのリポジトリも表示するか |
| `exclude` | 文字列の配列 | `[]` | 表示しないリポジトリ名（大文字小文字は区別しない） |
| `overrides` | オブジェクト | `{}` | リポジトリ名をキーにした表示内容の上書き |
| `extra` | 配列 | `[]` | GitHub Pages 以外のサイトの手動登録 |

## overrides に書ける項目

キーはリポジトリ名です（大文字小文字は区別しない）。指定しなかった項目は GitHub のリポジトリ情報がそのまま使われます。

| 項目 | 型 | 説明 |
| --- | --- | --- |
| `title` | 文字列 | 表示名（既定はリポジトリ名） |
| `description` | 文字列 | 説明（既定は README の冒頭の説明文、無ければリポジトリの Description） |
| `url` | 文字列 | サイトの URL（既定はリポジトリの Website 欄、無ければ `https://<user>.github.io/<repo>/`） |
| `topics` | 文字列の配列 | タグ（既定はリポジトリの Topics） |
| `order` | 数値 | 並び順。小さいほど先頭に表示 |
| `hidden` | 真偽値 | `true` で非表示 |

## extra に書ける項目

| 項目 | 型 | 説明 |
| --- | --- | --- |
| `url` | 文字列 | サイトの URL（必須、`http://` または `https://` で始まる） |
| `title` | 文字列 | 表示名（既定は URL） |
| `description` | 文字列 | 説明 |
| `repoUrl` | 文字列 | ソースコードの URL |
| `topics` | 文字列の配列 | タグ |
| `updatedAt` | 文字列 | 更新日時（ISO 8601 形式、例: `2026-11-01`） |
| `order` | 数値 | 並び順。小さいほど先頭に表示 |
| `hidden` | 真偽値 | `true` で非表示 |

## よくある操作

- 新しいサイトを追加する: そのリポジトリで GitHub Pages を有効にするだけで自動的に表示されます
- 説明を変える: リポジトリの README の冒頭の説明文を編集します。ポータルだけで変えたい場合は `overrides` で `description` を指定します
- タグを変える: リポジトリの About 欄（Topics）を編集するのがおすすめです。ポータルだけで変えたい場合は `overrides` で `topics` を指定します
- 一覧から外す: `exclude` にリポジトリ名を追加するか、`overrides` で `hidden: true` を指定します
- よく使うサイトを先頭に固定する: `overrides` で `order` を指定します
