// src/sites.json の書式を検証する
// 戻り値はエラーメッセージの配列（空なら問題なし）

const OVERRIDE_KEYS = new Set(['title', 'description', 'url', 'topics', 'order', 'hidden']);
const EXTRA_KEYS = new Set(['title', 'description', 'url', 'repoUrl', 'topics', 'updatedAt', 'order', 'hidden']);

export function validateConfig(config) {
  const errors = [];
  if (typeof config !== 'object' || config === null) return ['ルートはオブジェクトにしてください'];

  if (typeof config.user !== 'string' || config.user === '') errors.push('user に GitHub のユーザー名を指定してください');
  for (const key of ['includeForks', 'includeArchived']) {
    if (key in config && typeof config[key] !== 'boolean') errors.push(`${key} は true / false で指定してください`);
  }
  if ('exclude' in config && !isStringArray(config.exclude)) errors.push('exclude は文字列の配列にしてください');

  if ('overrides' in config) {
    if (!isPlainObject(config.overrides)) {
      errors.push('overrides はリポジトリ名をキーにしたオブジェクトにしてください');
    } else {
      for (const [name, override] of Object.entries(config.overrides)) {
        errors.push(...validateEntry(override, `overrides.${name}`, OVERRIDE_KEYS));
      }
    }
  }

  if ('extra' in config) {
    if (!Array.isArray(config.extra)) {
      errors.push('extra は配列にしてください');
    } else {
      config.extra.forEach((entry, index) => {
        const path = `extra[${index}]`;
        errors.push(...validateEntry(entry, path, EXTRA_KEYS));
        if (isPlainObject(entry) && typeof entry.url !== 'string') errors.push(`${path}.url は必須です`);
      });
    }
  }
  return errors;
}

function validateEntry(entry, path, allowedKeys) {
  if (!isPlainObject(entry)) return [`${path} はオブジェクトにしてください`];
  const errors = [];
  for (const key of Object.keys(entry)) {
    if (!allowedKeys.has(key)) errors.push(`${path}.${key} は使えないキーです（${[...allowedKeys].join(', ')}）`);
  }
  for (const key of ['title', 'description', 'repoUrl', 'updatedAt']) {
    if (key in entry && typeof entry[key] !== 'string') errors.push(`${path}.${key} は文字列にしてください`);
  }
  for (const key of ['url', 'repoUrl']) {
    if (typeof entry[key] === 'string' && !/^https?:\/\//.test(entry[key])) errors.push(`${path}.${key} は http(s):// で始まる URL にしてください`);
  }
  if ('topics' in entry && !isStringArray(entry.topics)) errors.push(`${path}.topics は文字列の配列にしてください`);
  if ('order' in entry && typeof entry.order !== 'number') errors.push(`${path}.order は数値にしてください`);
  if ('hidden' in entry && typeof entry.hidden !== 'boolean') errors.push(`${path}.hidden は true / false で指定してください`);
  return errors;
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}
