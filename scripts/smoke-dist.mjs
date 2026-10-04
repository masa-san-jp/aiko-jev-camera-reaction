import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = join(process.cwd(), 'dist');
const required = [
  'index.html',
  'media/idle.jpg',
  'models/hand_landmarker.task',
  'models/face_landmarker.task',
  'models/wasm/vision_wasm_internal.wasm',
];

if (!existsSync(root)) throw new Error('dist/がありません。先にnpm run buildを実行してください。');
for (const path of required) {
  const full = join(root, path);
  if (!existsSync(full) || statSync(full).size === 0) throw new Error(`配信必須ファイルがありません: ${path}`);
}
const forbidden = ['typesafe.env.rtf', '.dev.vars', '.env', 'wave-left.MP4', 'tilt-to-right.mov'];
for (const path of forbidden) if (existsSync(join(root, path))) throw new Error(`配信してはいけないファイルがあります: ${path}`);

const html = readFileSync(join(root, 'index.html'), 'utf8');
if (!html.includes('/src/main.ts') && !html.includes('/assets/')) throw new Error('ビルド済みHTMLにアプリのエントリがありません。');

// Cloudflare Pages ignores Range requests for static assets, which breaks <video>
// playback on Safari/iOS, so reaction videos are served from R2 instead (see
// src/config.ts MEDIA_BASE_URL). Confirm the built bundle actually points there,
// not at the same-origin /media/ path Pages can't serve them from reliably.
const assetsDir = join(root, 'assets');
const bundleHasR2Url = readdirSync(assetsDir)
  .filter((name) => name.endsWith('.js'))
  .some((name) => readFileSync(join(assetsDir, name), 'utf8').includes('.r2.dev'));
if (!bundleHasR2Url) throw new Error('ビルド済みJSが動画配信元(R2)のURLを含んでいません。');

console.log(`dist smoke check passed (${required.length} required assets, video source confirmed on R2)`);
