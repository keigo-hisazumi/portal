// ローカル確認用の簡易静的サーバー（外部依存なし）
// 使い方: npm run dev（src/ を配信） / npm run preview（dist/ を配信）

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = process.argv[2] ?? 'src';
const root = fileURLToPath(new URL(`../${dir}/`, import.meta.url));
const port = Number(process.env.PORT ?? 8080);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  // ルート外のファイルを読ませないよう、正規化したパスがルート配下か確認する
  let filePath = normalize(join(root, pathname));
  if (!filePath.startsWith(root)) {
    response.writeHead(403).end();
    return;
  }
  try {
    if ((await stat(filePath)).isDirectory()) filePath = join(filePath, 'index.html');
    const body = await readFile(filePath);
    response.writeHead(200, { 'Content-Type': TYPES[extname(filePath)] ?? 'application/octet-stream' }).end(body);
  } catch {
    response.writeHead(404).end('Not Found');
  }
}).listen(port, () => {
  console.log(`http://localhost:${port}/ で ${dir}/ を配信しています`);
});
