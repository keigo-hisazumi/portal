import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildSites, extractFeatures, filterSites, pagesUrl, stripMarkdown } from '../src/sites.js';
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

test('buildSites: features は overrides / extra の指定を使い、無ければ README から読み込む対象（null）にする', () => {
  const sites = buildSites([repo('auto'), repo('manual', { default_branch: 'master' })], {
    user: USER,
    overrides: { manual: { features: ['手動の機能'] } },
    extra: [{ title: '外部', url: 'https://example.com/', features: ['外部の機能'] }],
  });
  const byTitle = Object.fromEntries(sites.map((s) => [s.title, s]));
  assert.equal(byTitle.auto.features, null);
  assert.equal(byTitle.auto.defaultBranch, 'main');
  assert.deepEqual(byTitle.manual.features, ['手動の機能']);
  assert.equal(byTitle.manual.defaultBranch, 'master');
  assert.deepEqual(byTitle['外部'].features, ['外部の機能']);
});

test('filterSites: 機能説明も検索対象にする', () => {
  const sites = buildSites([repo('a'), repo('b')], { user: USER, overrides: { a: { features: ['CSV 出力'] } } });
  assert.deepEqual(filterSites(sites, 'csv').map((s) => s.title), ['a']);
});

test('extractFeatures: 「## 主な機能」直下の箇条書きを取り出す', () => {
  const markdown = [
    '# アプリ',
    '',
    '説明文',
    '',
    '## 主な機能',
    '',
    '- タスクの **追加** と `削除`',
    '* [リンク](https://example.com) 付きの項目',
    '  - 入れ子は無視する',
    '- snake_case の名前はそのまま',
    '',
    '### 補足',
    '',
    '- 小見出しの下の箇条書きも含める',
    '',
    '## 技術スタック',
    '',
    '- React',
  ].join('\r\n');
  assert.deepEqual(extractFeatures(markdown), [
    'タスクの 追加 と 削除',
    'リンク 付きの項目',
    'snake_case の名前はそのまま',
    '小見出しの下の箇条書きも含める',
  ]);
});

test('extractFeatures: 番号付きリストにも対応し、コードブロック内は無視する', () => {
  const markdown = ['## 主な機能', '', '1. 一つ目', '2) 二つ目', '', '```text', '## 見出しではない', '- 箇条書きではない', '```', '- 三つ目'].join('\n');
  assert.deepEqual(extractFeatures(markdown), ['一つ目', '二つ目', '三つ目']);
});

test('extractFeatures: 見出しが無ければ空配列を返す', () => {
  assert.deepEqual(extractFeatures('# アプリ\n\n- 箇条書き\n'), []);
});

test('stripMarkdown: HTML タグや画像を取り除く', () => {
  assert.equal(stripMarkdown('<img src=x onerror=alert(1)>![図](a.png) ~~旧~~ *新*'), '図 旧 新');
  assert.equal(stripMarkdown('[x] 完了済み'), '完了済み');
});

test('validateConfig: リポジトリの src/sites.json は正しい書式になっている', async () => {
  const config = JSON.parse(await readFile(new URL('../src/sites.json', import.meta.url), 'utf8'));
  assert.deepEqual(validateConfig(config), []);
});

test('validateConfig: 誤った書式を検出する', () => {
  const errors = validateConfig({
    user: '',
    exclude: 'portal',
    overrides: { app: { titel: 'typo', order: '1', features: '機能' } },
    extra: [{ title: 'URL なし' }, { url: 'javascript:alert(1)' }],
  });
  assert.ok(errors.some((e) => e.includes('user')));
  assert.ok(errors.some((e) => e.includes('exclude')));
  assert.ok(errors.some((e) => e.includes('overrides.app.titel')));
  assert.ok(errors.some((e) => e.includes('overrides.app.order')));
  assert.ok(errors.some((e) => e.includes('overrides.app.features')));
  assert.ok(errors.some((e) => e.includes('extra[0].url は必須')));
  assert.ok(errors.some((e) => e.includes('extra[1].url は http(s)')));
});
