import { REACTIONS } from './reactions';
import type { ReactionId } from './types';

export class ReactionPlayer {
  private readonly image: HTMLImageElement;
  private readonly video: HTMLVideoElement;

  constructor(image: HTMLImageElement, video: HTMLVideoElement) {
    this.image = image;
    this.video = video;
    this.video.muted = true;
    this.video.playsInline = true;
  }

  async preload(): Promise<void> {
    await loadImage(this.image, '/media/idle.jpg');
  }

  async play(reaction: ReactionId, timeoutMs = 10000): Promise<void> {
    const source = REACTIONS[reaction].src;
    this.video.pause();
    this.video.currentTime = 0;
    this.video.src = source;
    this.video.load();
    await waitForCanPlay(this.video, timeoutMs);
    this.image.hidden = true;
    this.video.hidden = false;
    try {
      await playWithGestureFallback(this.video);
    } catch {
      this.video.hidden = true;
      this.image.hidden = false;
      throw new Error('動画の再生がブラウザに許可されませんでした。もう一度タップして試してください。');
    }
    await waitForEndedOrTimeout(this.video, timeoutMs);
    this.video.pause();
    this.video.hidden = true;
    this.image.hidden = false;
  }

  stop(): void {
    this.video.pause();
    this.video.removeAttribute('src');
    this.video.load();
    this.video.hidden = true;
    this.image.hidden = false;
  }
}

function loadImage(image: HTMLImageElement, src: string): Promise<void> {
  image.src = src;
  if (image.complete) return Promise.resolve();
  return new Promise((resolve, reject) => { image.addEventListener('load', () => resolve(), { once: true }); image.addEventListener('error', () => reject(new Error('待機画像を読み込めませんでした。')), { once: true }); });
}

function waitForCanPlay(video: HTMLVideoElement, timeoutMs: number): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => { cleanup(); reject(new Error('動画の準備がタイムアウトしました。')); }, timeoutMs);
    const onReady = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error('動画を読み込めませんでした。')); };
    const cleanup = () => { window.clearTimeout(timer); video.removeEventListener('canplay', onReady); video.removeEventListener('error', onError); };
    video.addEventListener('canplay', onReady, { once: true });
    video.addEventListener('error', onError, { once: true });
  });
}

async function playWithGestureFallback(video: HTMLVideoElement): Promise<void> { await video.play(); }

function waitForEndedOrTimeout(video: HTMLVideoElement, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => { cleanup(); reject(new Error('動画の再生がタイムアウトしました。')); }, timeoutMs);
    const onEnded = () => { cleanup(); resolve(); };
    const cleanup = () => { window.clearTimeout(timer); video.removeEventListener('ended', onEnded); };
    video.addEventListener('ended', onEnded, { once: true });
  });
}
