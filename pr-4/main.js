// ポータル画面の処理
// sites.json を読み込み、GitHub API から Pages を公開しているリポジトリを取得して一覧表示する
// 各サイトの説明文は、リポジトリの README の冒頭（`# タイトル` 直後の段落）から読み込む

import { buildSites, extractSummary, filterSites, siteDescription } from './sites.js';

// GitHub API の未認証リクエストは 1 時間あたり 60 回までのため、結果を一定時間キャッシュする
const CACHE_KEY = 'portal:repos:v2';
const CACHE_TTL_MS = 60 * 60 * 1000;
// 1 ページ 100 件 × 最大 3 ページ（300 リポジトリ）まで取得する
const PER_PAGE = 100;
const MAX_PAGES = 3;
// README から取り出した説明文のキャッシュ。リポジトリの pushed_at が変わるまで使い回す
const SUMMARY_CACHE_KEY = 'portal:summary:v1';

const listElement = document.getElementById('site-list');
const statusElement = document.getElementById('status');
const searchElement = document.getElementById('search');
const countElement = document.getElementById('count');
const emptyElement = document.getElementById('empty');
const template = document.getElementById('site-card');

let allSites = [];

main();

async function main() {
  try {
    const config = await loadConfig();
    const { repos, error } = await loadRepos(config.user);
    allSites = buildSites(repos, config);
    if (error) {
      showStatus(error);
    } else {
      hideStatus();
    }
    render();
    await loadSummaries(config.user);
    render();
  } catch (e) {
    console.error(e);
    showStatus('サイト一覧の読み込みに失敗しました。時間をおいて再読み込みしてください。');
  }
}

async function loadConfig() {
  const response = await fetch('./sites.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error(`sites.json の取得に失敗しました: ${response.status}`);
  return response.json();
}

/**
 * GitHub API からリポジトリ一覧を取得する
 * 失敗した場合は期限切れでもキャッシュを使い、それも無ければ空配列を返す
 */
async function loadRepos(user) {
  const cached = readCache(user);
  if (cached && Date.now() - cached.savedAt < CACHE_TTL_MS) {
    return { repos: cached.repos, error: null };
  }

  try {
    const repos = await fetchAllRepos(user);
    writeCache(user, repos);
    return { repos, error: null };
  } catch (e) {
    console.error(e);
    if (cached) {
      return { repos: cached.repos, error: 'GitHub から最新の一覧を取得できなかったため、前回取得した一覧を表示しています。' };
    }
    return { repos: [], error: 'GitHub から一覧を取得できませんでした（API の利用回数制限の可能性があります）。手動登録したサイトのみ表示しています。' };
  }
}

async function fetchAllRepos(user) {
  const repos = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `https://api.github.com/users/${encodeURIComponent(user)}/repos?type=owner&sort=pushed&per_page=${PER_PAGE}&page=${page}`;
    const response = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
    if (!response.ok) throw new Error(`GitHub API エラー: ${response.status}`);
    const data = await response.json();
    repos.push(...data);
    if (data.length < PER_PAGE) break;
  }
  return repos;
}

// キャッシュには表示に必要な項目だけを保存する（公開リポジトリの公開情報のみ）
function writeCache(user, repos) {
  const slim = repos.map((repo) => ({
    name: repo.name,
    description: repo.description,
    homepage: repo.homepage,
    html_url: repo.html_url,
    default_branch: repo.default_branch,
    has_pages: repo.has_pages,
    fork: repo.fork,
    archived: repo.archived,
    topics: repo.topics,
    pushed_at: repo.pushed_at,
  }));
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ user, savedAt: Date.now(), repos: slim }));
  } catch {
    // プライベートブラウズなどで保存できない場合は無視する
  }
}

function readCache(user) {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (cached.user !== user || !Array.isArray(cached.repos)) return null;
    return cached;
  } catch {
    return null;
  }
}

/**
 * README の冒頭から説明文を読み込む
 * raw.githubusercontent.com は GitHub API の利用回数制限の対象外なので、API の残り回数を消費しない
 */
async function loadSummaries(user) {
  // 旧バージョンの「主な機能」のキャッシュは使わないので消しておく
  try {
    localStorage.removeItem('portal:features:v1');
  } catch {
    // 無視する
  }

  const cache = readSummaryCache(user);
  const targets = allSites.filter((site) => site.loadSummary && site.repoName);

  await Promise.all(
    targets.map(async (site) => {
      const cached = cache[site.repoName];
      if (cached && cached.pushedAt === site.updatedAt) {
        site.summary = cached.summary;
        return;
      }
      try {
        site.summary = await fetchSummary(user, site.repoName, site.defaultBranch);
        cache[site.repoName] = { pushedAt: site.updatedAt, summary: site.summary };
      } catch (e) {
        console.error(e);
        // 取得に失敗した場合は古いキャッシュがあれば使い、次回また取得を試みる
        site.summary = cached?.summary ?? '';
      }
    }),
  );
  writeSummaryCache(user, cache);
}

async function fetchSummary(user, repoName, branch) {
  const url = `https://raw.githubusercontent.com/${encodeURIComponent(user)}/${encodeURIComponent(repoName)}/${encodeURIComponent(branch)}/README.md`;
  const response = await fetch(url);
  // README が無いリポジトリはリポジトリの Description を使う
  if (response.status === 404) return '';
  if (!response.ok) throw new Error(`README の取得に失敗しました（${repoName}）: ${response.status}`);
  return extractSummary(await response.text());
}

function readSummaryCache(user) {
  try {
    const cached = JSON.parse(localStorage.getItem(SUMMARY_CACHE_KEY) ?? 'null');
    if (cached?.user === user && cached.items && typeof cached.items === 'object') return cached.items;
  } catch {
    // 壊れたキャッシュは無視する
  }
  return {};
}

function writeSummaryCache(user, items) {
  try {
    localStorage.setItem(SUMMARY_CACHE_KEY, JSON.stringify({ user, items }));
  } catch {
    // プライベートブラウズなどで保存できない場合は無視する
  }
}

function render() {
  const sites = filterSites(allSites, searchElement.value);
  countElement.textContent = `${sites.length} 件`;
  listElement.replaceChildren(...sites.map(createCard));
  emptyElement.textContent = allSites.length === 0 ? '表示できるサイトがありません。' : '条件に一致するサイトはありません。';
  emptyElement.hidden = sites.length > 0;
}

// API 由来の文字列は textContent で設定し、HTML として解釈させない
function createCard(site) {
  const card = template.content.firstElementChild.cloneNode(true);

  const link = card.querySelector('.site-link');
  link.href = site.url;
  link.textContent = site.title;

  card.querySelector('.site-url').textContent = site.url.replace(/^https?:\/\//, '').replace(/\/$/, '');

  const description = card.querySelector('.site-description');
  const descriptionText = siteDescription(site);
  if (descriptionText) {
    description.textContent = descriptionText;
  } else {
    description.remove();
  }

  const topics = card.querySelector('.site-topics');
  if (site.topics.length > 0) {
    topics.replaceChildren(
      ...site.topics.map((topic) => {
        const item = document.createElement('li');
        item.textContent = topic;
        return item;
      }),
    );
  } else {
    topics.remove();
  }

  const meta = card.querySelector('.site-meta');
  const updated = card.querySelector('.site-updated');
  if (site.updatedAt) {
    updated.dateTime = site.updatedAt;
    updated.textContent = `更新: ${new Date(site.updatedAt).toLocaleDateString('ja-JP')}`;
  } else {
    updated.remove();
  }

  const repoLink = card.querySelector('.site-repo');
  if (site.repoUrl) {
    repoLink.href = site.repoUrl;
  } else {
    repoLink.remove();
  }

  if (!site.updatedAt && !site.repoUrl) meta.remove();
  return card;
}

function showStatus(message) {
  statusElement.textContent = message;
  statusElement.hidden = false;
}

function hideStatus() {
  statusElement.hidden = true;
}

searchElement.addEventListener('input', render);
