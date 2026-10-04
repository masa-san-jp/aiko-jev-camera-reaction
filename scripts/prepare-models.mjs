import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const modelDir = join(root, 'public', 'models');
const wasmDir = join(modelDir, 'wasm');
mkdirSync(wasmDir, { recursive: true });

const models = {
  'hand_landmarker.task': 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
  'face_landmarker.task': 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
};

for (const [name, url] of Object.entries(models)) {
  const destination = join(modelDir, name);
  if (!existsSync(destination)) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`モデル取得に失敗しました: ${response.status} ${url}`);
    writeFileSync(destination, Buffer.from(await response.arrayBuffer()));
  }
}

const wasmSource = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
if (existsSync(wasmSource)) {
  const { cpSync } = await import('node:fs');
  cpSync(wasmSource, wasmDir, { recursive: true, force: true });
}

const manifest = { generatedAt: new Date().toISOString(), models: {} };
for (const name of Object.keys(models)) {
  const bytes = readFileSync(join(modelDir, name));
  manifest.models[name] = { url: models[name], sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length };
}
writeFileSync(join(root, 'assets-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('Prepared MediaPipe models and wasm runtime.');
