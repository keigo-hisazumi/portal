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
        // README の冒頭の説明文。null は未取得。description を上書きしているリポジトリは README を読まない
        summary: null,
        loadSummary: override.description === undefined,
        url: override.url ?? pagesUrl(repo, user),
        repoUrl: repo.html_url ?? `https://github.com/${user}/${repo.name}`,
        topics: override.topics ?? repo.topics ?? [],
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
    summary: null,
    loadSummary: false,
    url: entry.url,
    repoUrl: entry.repoUrl ?? null,
    topics: entry.topics ?? [],
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
 * キーワードでサイトを絞り込む（タイトル・説明・トピックの部分一致、大文字小文字は区別しない）
 * スペース区切りの複数キーワードはすべてを含むものだけを残す
 */
export function filterSites(sites, query) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return sites;
  return sites.filter((site) => {
    const haystack = [site.title, siteDescription(site), ...site.topics].join(' ').toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

/**
 * カードに表示する説明文
 * README の冒頭の説明文を優先し、無ければ設定ファイルかリポジトリの Description を使う
 */
export function siteDescription(site) {
  return (site.loadSummary && site.summary) || site.description;
}

// 説明文として長すぎる場合はこの文字数で切り詰める
const SUMMARY_MAX_LENGTH = 160;

/**
 * README の Markdown から、最初の見出し（`# タイトル`）直後の説明文を取り出す
 * バッジ・画像・箇条書き・表・コードブロック・「公開 URL: ...」の行は飛ばし、最初の段落だけを使う
 *
 * @param {string} markdown README の本文
 * @returns {string} 説明文（見つからなければ空文字）
 */
export function extractSummary(markdown) {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const titleIndex = lines.findIndex((line) => /^#\s/.test(line));

  let paragraph = [];
  let inCodeBlock = false;
  for (const line of lines.slice(titleIndex + 1)) {
    if (/^\s*(```|~~~)/.test(line)) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;
    // 次の見出しまでに説明文が無ければ諦める
    if (/^#{1,6}\s/.test(line)) break;

    if (line.trim() === '') {
      const text = toSummary(paragraph);
      if (text) return text;
      paragraph = [];
    } else if (!isNonProseLine(line)) {
      paragraph.push(line.trim());
    }
  }
  return toSummary(paragraph);
}

// 説明文に含めない行（バッジ・画像・HTML・箇条書き・番号付きリスト・引用・表・区切り線）
function isNonProseLine(line) {
  return /^\s*(\[?!\[|<|[-*+]\s|\d+[.)]\s|>|\||---|\*\*\*|___)/.test(line);
}

function toSummary(paragraph) {
  if (paragraph.length === 0) return '';
  const text = stripMarkdown(paragraph.join(' ')).replace(/\s+/g, ' ').trim();
  // 「公開 URL: https://...」のような行や URL だけの段落は説明文として扱わない
  if (/^(公開\s*URL|URL|デモ|demo)\s*[:：]/i.test(text) || /^<?https?:\/\/\S+>?$/.test(text)) return '';
  return text.length > SUMMARY_MAX_LENGTH ? `${text.slice(0, SUMMARY_MAX_LENGTH - 1)}…` : text;
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
