import './styles.css';
import { CameraController } from './camera';
import { GESTURE_CONFIG } from './config';
import { GestureEngine } from './gestures';
import { judgeGesture } from './jevClient';
import { REACTION_ORDER, REACTIONS } from './reactions';
import { ReactionPlayer } from './player';
import type { AppState, GestureState, Observation, ReactionId } from './types';
import { VisionRunner } from './vision';

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('アプリのルートが見つかりません。');

app.innerHTML = `
  <section class="shell">
    <div class="stage-wrap">
      <div class="stage" aria-label="アイコの反応画面">
        <img id="idle-image" class="aiko-media" alt="待機中のアイコ" />
        <video id="reaction-video" class="aiko-media" playsinline muted hidden></video>
        <div class="camera-frame"><video id="camera-video" autoplay muted playsinline></video></div>
        <div id="error-box" class="error-overlay" hidden></div>
      </div>
    </div>
    <div class="actions"><button id="start-button" class="button primary">はじめる</button><button id="preview-button" class="button text-button">動きを見る</button></div>
    <section id="preview-panel" class="preview-panel" hidden><div class="preview-heading"><h2>手動プレビュー</h2><button id="close-preview" class="close-button" aria-label="プレビューを閉じる">閉じる</button></div><div id="preview-buttons" class="preview-buttons"></div></section>
  </section>`;

const idleImage = get<HTMLImageElement>('idle-image');
const reactionVideo = get<HTMLVideoElement>('reaction-video');
const cameraVideo = get<HTMLVideoElement>('camera-video');
const errorBox = get<HTMLElement>('error-box');
const startButton = get<HTMLButtonElement>('start-button');
const previewButton = get<HTMLButtonElement>('preview-button');
const previewPanel = get<HTMLElement>('preview-panel');
const previewButtons = get<HTMLElement>('preview-buttons');
const closePreview = get<HTMLButtonElement>('close-preview');

const camera = new CameraController(cameraVideo);
const vision = new VisionRunner();
const engine = new GestureEngine();
const player = new ReactionPlayer(idleImage, reactionVideo);
let state: AppState = 'idle';
let session = 0;
let raf = 0;
let lastInference = 0;
let lastJudge = 0;
let judging = false;
let inferenceInterval = 1000 / 30;

buildPreviewButtons();
void player.preload().catch((error) => setError(error));

startButton.addEventListener('click', () => { void start(); });
previewButton.addEventListener('click', () => { previewPanel.hidden = false; stop(); });
closePreview.addEventListener('click', () => { previewPanel.hidden = true; });
camera.onEnded = () => { if (state !== 'idle' && state !== 'playing') { state = 'error'; setError(new Error('カメラが停止しました。')); updateUI(); } };
document.addEventListener('visibilitychange', () => { if (document.hidden && state !== 'idle') pauseForBackground(); });
window.addEventListener('pagehide', () => { if (state !== 'idle') stop(); });

async function start(): Promise<void> {
  clearError();
  if (state === 'playing' || state === 'loading' || state === 'calibrating' || state === 'ready') return;
  const currentSession = ++session;
  state = 'loading';
  updateUI();
  try {
    // Start camera acquisition directly from the user gesture so Safari/iOS can show permission UI reliably.
    await camera.start();
    if (currentSession !== session) return;
    await Promise.all([player.preload(), vision.ready ? Promise.resolve() : vision.init()]);
    if (currentSession !== session) return;
    state = 'calibrating';
    engine.reset();
    updateUI();
    loop(currentSession);
  } catch (error) {
    if (currentSession !== session) return;
    camera.stop();
    state = 'error';
    setError(error);
    updateUI();
  }
}

function stop(): void {
  session += 1;
  cancelAnimationFrame(raf);
  camera.stop();
  vision.close();
  player.stop();
  engine.reset();
  state = 'idle';
  updateUI();
}

function pauseForBackground(): void {
  cancelAnimationFrame(raf);
  camera.stop();
  state = 'paused';
  updateUI();
}

function loop(currentSession: number): void {
  cancelAnimationFrame(raf);
  const tick = (time: number) => {
    if (currentSession !== session || state === 'idle' || state === 'error' || state === 'paused') return;
    if (state !== 'playing' && time - lastInference >= inferenceInterval && !vision.isBusy) {
      lastInference = time;
      try {
        const observation = vision.detect(cameraVideo, performance.now());
        if (observation) handleObservation(observation, currentSession, time);
      } catch (error) { setError(error); state = 'error'; updateUI(); return; }
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}

function handleObservation(observation: Observation, currentSession: number, time: number): void {
  // No progress UI is shown, so a lost face silently re-triggers calibration instead of stranding the user.
  const recalibrating = state === 'calibrating' || (state === 'ready' && engine.getBaseline() === null);
  if (recalibrating) {
    if (state === 'ready') state = 'calibrating';
    if (engine.calibrate(observation) >= 1) { state = 'ready'; updateUI(); }
    return;
  }
  if (state !== 'ready' || currentSession !== session) return;
  const snapshot = engine.track(observation);
  if (time - lastJudge >= GESTURE_CONFIG.judgeIntervalMs) {
    lastJudge = time;
    if (!judging && snapshot && hasSignal(snapshot)) void runJudge(snapshot, currentSession);
  }
}

function hasSignal(snapshot: GestureState): boolean {
  return snapshot.hands.length > 0 || snapshot.face !== null;
}

async function runJudge(snapshot: GestureState, currentSession: number): Promise<void> {
  judging = true;
  try {
    const result = await judgeGesture(snapshot);
    console.log('[aiko] jev result', result);
    if (currentSession !== session || state !== 'ready') return;
    if (result.reaction && result.confidence >= GESTURE_CONFIG.judgeConfidence) void playReaction(result.reaction, currentSession);
  } catch (error) {
    console.error(error);
  } finally {
    judging = false;
  }
}

async function playReaction(reaction: ReactionId, currentSession: number): Promise<void> {
  if (state !== 'ready' || currentSession !== session) return;
  state = 'playing';
  cancelAnimationFrame(raf);
  updateUI();
  try { await player.play(reaction); }
  catch (error) { setError(error); state = 'error'; updateUI(); return; }
  if (currentSession !== session) return;
  state = 'cooldown';
  updateUI();
  window.setTimeout(() => { if (currentSession === session && state === 'cooldown') { state = 'ready'; engine.reset(); updateUI(); loop(currentSession); } }, GESTURE_CONFIG.cooldownMs);
}

function buildPreviewButtons(): void {
  for (const reaction of REACTION_ORDER) {
    const button = document.createElement('button');
    button.className = 'preview-button';
    button.textContent = REACTIONS[reaction].label;
    button.addEventListener('click', () => { void player.play(reaction).catch((error) => setError(error)); });
    previewButtons.append(button);
  }
}

function updateUI(): void {
  startButton.hidden = !(state === 'idle' || state === 'paused');
}

function setError(error: unknown): void {
  console.error(error);
  errorBox.hidden = false;
  errorBox.textContent = 'うまく動きませんでした。画面を再読み込みしてください。';
}
function clearError(): void { errorBox.hidden = true; errorBox.textContent = ''; }
function get<T extends HTMLElement>(id: string): T { const node = document.getElementById(id); if (!node) throw new Error(`${id} が見つかりません。`); return node as T; }
