import { FaceLandmarker, FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { MODEL_PATHS } from './config';
import type { FaceObservation, HandObservation, Observation, Point } from './types';

type VisionMode = 'cpu' | 'gpu';

export class VisionRunner {
  private hand: HandLandmarker | null = null;
  private face: FaceLandmarker | null = null;
  private busy = false;
  private mode: VisionMode = 'cpu';

  async init(): Promise<void> {
    const fileset = await FilesetResolver.forVisionTasks(MODEL_PATHS.wasmRoot);
    const preferred: VisionMode[] = ['gpu', 'cpu'];
    let lastError: unknown;
    for (const delegate of preferred) {
      try {
        this.hand = await HandLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_PATHS.hand, delegate: delegate.toUpperCase() as 'GPU' | 'CPU' },
          runningMode: 'VIDEO',
          numHands: 2,
          // Lowered from 0.6: on CPU delegate, a hand mid-wave is frequently motion-blurred
          // or at a grazing angle, so raw per-frame detections were too sparse to show Jev
          // an actual back-and-forth trajectory (2026-10-04 console diagnostics: rawHands
          // was 0 on most frames even while the user was actively waving).
          minHandDetectionConfidence: 0.4,
          minHandPresenceConfidence: 0.4,
          minTrackingConfidence: 0.4,
        });
        this.face = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_PATHS.face, delegate: delegate.toUpperCase() as 'GPU' | 'CPU' },
          runningMode: 'VIDEO',
          numFaces: 1,
          minFaceDetectionConfidence: 0.6,
          minFacePresenceConfidence: 0.6,
          minTrackingConfidence: 0.6,
          outputFaceBlendshapes: false,
        });
        this.mode = delegate;
        return;
      } catch (error) {
        lastError = error;
        this.close();
      }
    }
    throw lastError instanceof Error ? lastError : new Error('検出モデルを初期化できませんでした。');
  }

  get executionMode(): VisionMode { return this.mode; }
  get ready(): boolean { return Boolean(this.hand && this.face); }
  get isBusy(): boolean { return this.busy; }

  detect(video: HTMLVideoElement, timestamp: number): Observation | null {
    if (!this.hand || !this.face || this.busy || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return null;
    this.busy = true;
    try {
      const hands = this.hand.detectForVideo(video, timestamp);
      const faces = this.face.detectForVideo(video, timestamp);
      const width = video.videoWidth || 1;
      const height = video.videoHeight || 1;
      return {
        timestamp,
        videoWidth: width,
        videoHeight: height,
        hands: hands.landmarks.map((landmarks, index) => ({
          id: handId(hands.handednesses[index]?.[0]?.categoryName, index),
          wrist: { x: landmarks[0].x, y: landmarks[0].y },
          confidence: hands.handednesses[index]?.[0]?.score ?? 1,
        })),
        face: faceObservation(faces.faceLandmarks[0]),
      };
    } finally {
      this.busy = false;
    }
  }

  close(): void {
    this.hand?.close();
    this.face?.close();
    this.hand = null;
    this.face = null;
  }
}

function handId(category: string | undefined, index: number): number {
  if (category === 'Left') return 1;
  if (category === 'Right') return 2;
  return index + 1;
}

function faceObservation(landmarks: Array<{ x: number; y: number }> | undefined): FaceObservation | null {
  if (!landmarks || landmarks.length < 264) return null;
  let minY = 1;
  let maxY = 0;
  for (const point of landmarks) { minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y); }
  const rawLeft = landmarks[33];
  const rawRight = landmarks[263];
  const leftEye = mirrorAndClamp(rawRight);
  const rightEye = mirrorAndClamp(rawLeft);
  return { height: maxY - minY, leftEye, rightEye, confidence: 1 };
}

function mirrorAndClamp(point: Point): Point {
  return { x: Math.min(1, Math.max(0, 1 - point.x)), y: point.y };
}
