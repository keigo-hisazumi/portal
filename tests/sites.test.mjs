import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildSites, filterSites, pagesUrl } from '../src/sites.js';
import { validateConfig } from '../scripts/validate-config.mjs';

const USER = 'keigo-hisazumi';

function repo(name, fields = {}) {
  return {
    name,
    description: null,
    homepage: null,
    html_url: `https://github.com/${USER}/${name}`,
    has_pages: true,
    fork: false,
    archived: false,
    topics: [],
    pushed_at: '2026-01-01T00:00:00Z',
    ...fields,
  };
}

test('pagesUrl: 通常のリポジトリはユーザーサイト配下のパスになる', () => {
  assert.equal(pagesUrl(repo('todo'), USER), 'https://keigo-hisazumi.github.io/todo/');
});

test('pagesUrl: <user>.github.io リポジトリはルートになる', () => {
  assert.equal(pagesUrl(repo('Keigo-Hisazumi.github.io'), USER), 'https://keigo-hisazumi.github.io/');
});

test('pagesUrl: homepage が設定されていれば優先する', () => {
  assert.equal(pagesUrl(repo('blog', { homepage: 'https://example.com/' }), USER), 'https://example.com/');
  assert.equal(pagesUrl(repo('blog', { homepage: 'example.com' }), USER), 'https://keigo-hisazumi.github.io/blog/');
});

test('buildSites: Pages 無効・fork・archived・exclude を除外する', () => {
  const repos = [
    repo('app'),
    repo('no-pages', { has_pages: false }),
    repo('forked', { fork: true }),
    repo('old', { archived: true }),
    repo('Portal'),
  ];
  const sites = buildSites(repos, { user: USER, exclude: ['portal'] });
  assert.deepEqual(sites.map((s) => s.title), ['app']);
});

test('buildSites: includeForks / includeArchived で含められる', () => {
  const repos = [repo('forked', { fork: true }), repo('old', { archived: true })];
  const sites = buildSites(repos, { user: USER, includeForks: true, includeArchived: true });
  assert.equal(sites.length, 2);
});

test('buildSites: overrides でタイトル等を上書きし、hidden で非表示にできる', () => {
  const repos = [repo('app', { description: '元の説明', topics: ['a'] }), repo('secret')];
  const sites = buildSites(repos, {
    user: USER,
    overrides: { APP: { title: 'アプリ', description: '新しい説明' }, secret: { hidden: true } },
  });
  assert.equal(sites.length, 1);
  assert.equal(sites[0].title, 'アプリ');
  assert.equal(sites[0].description, '新しい説明');
  assert.deepEqual(sites[0].topics, ['a']);
});

test('buildSites: extra で GitHub 以外のサイトを追加できる', () => {
  const sites = buildSites([], { user: USER, extra: [{ title: '外部', url: 'https://example.com/' }] });
  assert.equal(sites.length, 1);
  assert.equal(sites[0].url, 'https://example.com/');
  assert.equal(sites[0].repoUrl, null);
});

test('buildSites: order 指定を先頭に、それ以外は更新日時の新しい順に並べる', () => {
  const repos = [
    repo('older', { pushed_at: '2025-01-01T00:00:00Z' }),
    repo('newer', { pushed_at: '2026-06-01T00:00:00Z' }),
    repo('pinned2', { pushed_at: '2020-01-01T00:00:00Z' }),
    repo('pinned1', { pushed_at: '2020-01-01T00:00:00Z' }),
  ];
  const sites = buildSites(repos, {
    user: USER,
    overrides: { pinned1: { order: 1 }, pinned2: { order: 2 } },
  });
  assert.deepEqual(sites.map((s) => s.title), ['pinned1', 'pinned2', 'newer', 'older']);
});

test('filterSites: タイトル・説明・トピックを大文字小文字を区別せず AND 検索する', () => {
  const sites = buildSites(
    [repo('Todo', { description: 'タスク管理', topics: ['pwa'] }), repo('Blog', { topics: ['markdown'] })],
    { user: USER },
  );
  assert.deepEqual(filterSites(sites, 'todo').map((s) => s.title), ['Todo']);
  assert.deepEqual(filterSites(sites, 'PWA タスク').map((s) => s.title), ['Todo']);
  assert.deepEqual(filterSites(sites, 'markdown').map((s) => s.title), ['Blog']);
  assert.equal(filterSites(sites, '  ').length, 2);
});

test('validateConfig: リポジトリの src/sites.json は正しい書式になっている', async () => {
  const config = JSON.parse(await readFile(new URL('../src/sites.json', import.meta.url), 'utf8'));
  assert.deepEqual(validateConfig(config), []);
});

test('validateConfig: 誤った書式を検出する', () => {
  const errors = validateConfig({
    user: '',
    exclude: 'portal',
    overrides: { app: { titel: 'typo', order: '1' } },
    extra: [{ title: 'URL なし' }, { url: 'javascript:alert(1)' }],
  });
  assert.ok(errors.some((e) => e.includes('user')));
  assert.ok(errors.some((e) => e.includes('exclude')));
  assert.ok(errors.some((e) => e.includes('overrides.app.titel')));
  assert.ok(errors.some((e) => e.includes('overrides.app.order')));
  assert.ok(errors.some((e) => e.includes('extra[0].url は必須')));
  assert.ok(errors.some((e) => e.includes('extra[1].url は http(s)')));
});
