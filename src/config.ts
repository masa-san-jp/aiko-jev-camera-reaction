import type { GestureConfig } from './types';

export const GESTURE_CONFIG: GestureConfig = {
  faceMinHeight: 0.15,
  // Generous: slow on-device inference (CPU-only delegate on many phones/tablets) can leave
  // 300ms+ between processed frames, which used to wipe the wave-tracking buffer before it
  // ever built up a usable trajectory.
  observationGapMs: 700,
  faceLostMs: 2000,
  // Widened from 1100: raw hand detections are sparse on CPU delegate (per-frame hits,
  // not continuous), so a longer window gives more time to accumulate enough points to
  // show an actual back-and-forth swing instead of 1-2 isolated points.
  trajectoryWindowMs: 1800,
  judgeIntervalMs: 400,
  // Lowered from 0.5: real wave attempts (2026-10-04 console diagnostics) scored
  // confidence 0.38-0.55 fairly consistently, so 0.5 was silently dropping genuine waves.
  judgeConfidence: 0.4,
  cooldownMs: 250,
};

export const MODEL_PATHS = {
  wasmRoot: '/models/wasm',
  hand: '/models/hand_landmarker.task',
  face: '/models/face_landmarker.task',
};

// Cloudflare Pages' static asset server doesn't honor HTTP Range requests (always
// returns the full 200 response), which breaks <video> playback on Safari/iOS —
// it requires 206 Partial Content to load MP4s reliably. R2's public bucket serving
// supports Range requests correctly, so the reaction videos live there instead.
export const MEDIA_BASE_URL = (import.meta.env.VITE_MEDIA_BASE_URL as string | undefined) ?? 'https://pub-5dd3075dfa684d448014cb659e2ca870.r2.dev';

// Defaults to a same-origin path: Cloudflare Pages serves functions/api/gesture.js
// at /api/gesture next to the static site, so no cross-origin request is needed.
// Override only if the gesture-judging endpoint is hosted elsewhere.
export const JEV_PROXY_URL = (import.meta.env.VITE_JEV_PROXY_URL as string | undefined) ?? '/api/gesture';
