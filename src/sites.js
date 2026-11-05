// ポータルに表示するサイト一覧を組み立てる純粋関数群
// DOM やネットワークに依存しないため、Node.js のテストからも読み込める

/**
 * リポジトリの GitHub Pages の URL を求める
 * homepage に http(s) の URL が設定されていればそれを優先する（独自ドメイン対応）
 */
export function pagesUrl(repo, user) {
  if (typeof repo.homepage === 'string' && /^https?:\/\//.test(repo.homepage)) {
    return repo.homepage;
  }
  const host = `${user.toLowerCase()}.github.io`;
  if (repo.name.toLowerCase() === host) {
    return `https://${host}/`;
  }
  return `https://${host}/${repo.name}/`;
}

/**
 * GitHub API のリポジトリ一覧と設定ファイルからサイト一覧を作る
 *
 * @param {Array<object>} repos GitHub API（GET /users/{user}/repos）の結果
 * @param {object} config sites.json の内容
 * @returns {Array<object>} 表示順に並べたサイト一覧
 */
export function buildSites(repos, config) {
  const user = config.user;
  const exclude = new Set((config.exclude ?? []).map((name) => name.toLowerCase()));
  const overrides = normalizeKeys(config.overrides ?? {});

  const fromGitHub = repos
    .filter((repo) => repo.has_pages)
    .filter((repo) => config.includeForks || !repo.fork)
    .filter((repo) => config.includeArchived || !repo.archived)
    .filter((repo) => !exclude.has(repo.name.toLowerCase()))
    .map((repo) => {
      const override = overrides[repo.name.toLowerCase()] ?? {};
      return {
        id: `github:${repo.name}`,
        title: override.title ?? repo.name,
        description: override.description ?? repo.description ?? '',
        url: override.url ?? pagesUrl(repo, user),
        repoUrl: repo.html_url ?? `https://github.com/${user}/${repo.name}`,
        topics: override.topics ?? repo.topics ?? [],
        // features が null のものは README の「主な機能」から後で読み込む
        features: override.features ?? null,
        repoName: repo.name,
        defaultBranch: repo.default_branch ?? 'main',
        updatedAt: repo.pushed_at ?? repo.updated_at ?? null,
        order: typeof override.order === 'number' ? override.order : null,
        archived: Boolean(repo.archived),
        hidden: Boolean(override.hidden),
      };
    });

  const manual = (config.extra ?? []).map((entry, index) => ({
    id: `manual:${index}`,
    title: entry.title ?? entry.url,
    description: entry.description ?? '',
    url: entry.url,
    repoUrl: entry.repoUrl ?? null,
    topics: entry.topics ?? [],
    features: entry.features ?? [],
    repoName: null,
    defaultBranch: null,
    updatedAt: entry.updatedAt ?? null,
    order: typeof entry.order === 'number' ? entry.order : null,
    archived: false,
    hidden: Boolean(entry.hidden),
  }));

  return sortSites([...fromGitHub, ...manual].filter((site) => !site.hidden && site.url));
}

/**
 * 並び順: order 指定ありを昇順で先頭に、残りは更新日時の新しい順、同じならタイトル順
 */
export function sortSites(sites) {
  return [...sites].sort((a, b) => {
    if (a.order !== null || b.order !== null) {
      if (a.order === null) return 1;
      if (b.order === null) return -1;
      if (a.order !== b.order) return a.order - b.order;
    }
    const timeA = a.updatedAt ? Date.parse(a.updatedAt) : 0;
    const timeB = b.updatedAt ? Date.parse(b.updatedAt) : 0;
    if (timeA !== timeB) return timeB - timeA;
    return a.title.localeCompare(b.title, 'ja');
  });
}

/**
 * キーワードでサイトを絞り込む（タイトル・説明・トピック・機能の部分一致、大文字小文字は区別しない）
 * スペース区切りの複数キーワードはすべてを含むものだけを残す
 */
export function filterSites(sites, query) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return sites;
  return sites.filter((site) => {
    const haystack = [site.title, site.description, ...site.topics, ...(site.features ?? [])].join(' ').toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

/**
 * README の Markdown から「## 主な機能」見出し直下の箇条書きを取り出す
 * 入れ子の箇条書きは無視し、Markdown の装飾は取り除いてプレーンテキストにする
 *
 * @param {string} markdown README の本文
 * @returns {string[]} 機能の一覧（見出しが無ければ空配列）
 */
export function extractFeatures(markdown) {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const start = lines.findIndex((line) => /^##\s+主な機能\s*#*\s*$/.test(line));
  if (start === -1) return [];

  const features = [];
  let inCodeBlock = false;
  for (const line of lines.slice(start + 1)) {
    if (/^\s*(```|~~~)/.test(line)) inCodeBlock = !inCodeBlock;
    if (inCodeBlock) continue;
    // 同じレベル以上の次の見出しで終わり
    if (/^#{1,2}\s/.test(line)) break;
    const match = line.match(/^[-*+]\s+(.+)$/) ?? line.match(/^\d+[.)]\s+(.+)$/);
    if (match) {
      const text = stripMarkdown(match[1]);
      if (text) features.push(text);
    }
  }
  return features;
}

/**
 * インラインの Markdown 記法を取り除く（表示は textContent で行うため HTML は解釈しない）
 */
export function stripMarkdown(text) {
  return removeHtmlTags(text)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // 画像
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // リンク
    .replace(/`([^`]*)`/g, '$1') // インラインコード
    .replace(/(\*\*|__)(.+?)\1/g, '$2') // 太字
    .replace(/\*(.+?)\*/g, '$1') // 斜体（snake_case の _ を消さないよう * のみ対象）
    .replace(/~~(.+?)~~/g, '$1') // 取り消し線
    .replace(/^\[[ xX]\]\s+/, '') // チェックボックス
    .trim();
}

/**
 * HTML タグを取り除く
 * `<scr<script>ipt>` のように除去後に新しいタグができる入力に備え、変化がなくなるまで繰り返す
 */
function removeHtmlTags(text) {
  let previous;
  let current = text;
  do {
    previous = current;
    current = current.replace(/<[^<>]*>/g, '');
  } while (current !== previous);
  return current;
}

// overrides のキーをリポジトリ名の大文字小文字の違いに左右されないよう小文字にそろえる
function normalizeKeys(object) {
  return Object.fromEntries(Object.entries(object).map(([key, value]) => [key.toLowerCase(), value]));
}
