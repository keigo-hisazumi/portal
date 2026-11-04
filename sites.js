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
 * キーワードでサイトを絞り込む（タイトル・説明・トピックの部分一致、大文字小文字は区別しない）
 * スペース区切りの複数キーワードはすべてを含むものだけを残す
 */
export function filterSites(sites, query) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return sites;
  return sites.filter((site) => {
    const haystack = [site.title, site.description, ...site.topics].join(' ').toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

// overrides のキーをリポジトリ名の大文字小文字の違いに左右されないよう小文字にそろえる
function normalizeKeys(object) {
  return Object.fromEntries(Object.entries(object).map(([key, value]) => [key.toLowerCase(), value]));
}
