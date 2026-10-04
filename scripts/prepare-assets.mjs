import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const root = process.cwd();
const output = join(root, 'public', 'media');
mkdirSync(output, { recursive: true });

const assets = [
  ['wave-left.MP4', 'wave-left.mp4'],
  ['wave-right.MP4', 'wave-right.mp4'],
  ['look-into.MP4', 'look-into.mp4'],
  ['tilt-to-left.MP4', 'tilt-left.mp4'],
  ['tilt-to-right.mov', 'tilt-right.mp4'],
];

for (const [source, target] of assets) {
  const input = join(root, source);
  const destination = join(output, target);
  if (!existsSync(input)) throw new Error(`素材がありません: ${source}`);
  // 1.5x playback speed: the source footage reads as sluggish at real-time pace (2026-10-04 feedback).
  const speed = 1.5;
  execFileSync('ffmpeg', [
    '-y', '-i', input,
    '-map', '0:v:0', '-map_metadata', '-1',
    '-vf', `setpts=PTS/${speed},format=yuv420p`, '-c:v', 'libx264', '-profile:v', 'main', '-level', '3.1', '-pix_fmt', 'yuv420p', '-color_range', 'mpeg',
    '-movflags', '+faststart', '-an', destination,
  ], { stdio: 'inherit' });
}

const idle = join(output, 'idle.jpg');
execFileSync('ffmpeg', [
  '-y', '-ss', '0', '-i', join(root, 'wave-left.MP4'), '-frames:v', '1', '-update', '1', '-q:v', '3', idle,
], { stdio: 'inherit' });

console.log(`Prepared ${assets.length} reaction videos and idle image in ${dirname(idle)}`);
