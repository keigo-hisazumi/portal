// src/ を dist/ にコピーするだけのビルドスクリプト（外部依存なし）
// sites.json の書式も検証し、誤りがあればビルドを失敗させる

import { cp, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { validateConfig } from './validate-config.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const srcDir = `${root}src`;
const distDir = `${root}dist`;

const config = JSON.parse(await readFile(`${srcDir}/sites.json`, 'utf8'));
const errors = validateConfig(config);
if (errors.length > 0) {
  console.error('src/sites.json に誤りがあります:');
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

await rm(distDir, { recursive: true, force: true });
await cp(srcDir, distDir, { recursive: true });
console.log('dist/ を生成しました');
