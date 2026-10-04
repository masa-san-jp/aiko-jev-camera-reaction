import { GESTURE_CONFIG } from './config';
import type { FaceObservation, GestureState, HandObservation, Observation, Point } from './types';

interface HandTrack { points: Array<{ timestamp: number; x: number; y: number }>; }

/**
 * Tracks calibration and recent hand/face motion. It no longer decides which gesture
 * happened — that judgment call is delegated to Jev (see jevClient.ts). This class just
 * keeps a rolling buffer and packages it into a state snapshot for the judge to read.
 */
export class GestureEngine {
  private readonly faceSamples: number[] = [];
  private readonly hands = new Map<number, HandTrack>();
  private baseline: number | null = null;
  private faceMissingSince: number | null = null;
  private lastTimestamp: number | null = null;

  reset(): void {
    this.faceSamples.length = 0;
    this.hands.clear();
    this.baseline = null;
    this.faceMissingSince = null;
    this.lastTimestamp = null;
  }

  calibrationProgress(): number { return Math.min(1, this.faceSamples.length / 40); }
  getBaseline(): number | null { return this.baseline; }

  calibrate(observation: Observation): number {
    this.lastTimestamp = observation.timestamp;
    const face = validFace(observation.face);
    if (face) {
      this.faceSamples.push(face.height);
      if (this.faceSamples.length >= 40) {
        const sorted = [...this.faceSamples].sort((a, b) => a - b);
        this.baseline = sorted[Math.floor(sorted.length / 2)];
      }
    }
    return this.calibrationProgress();
  }

  /** Updates the rolling hand/face buffers and returns the current snapshot for Jev to judge. */
  track(observation: Observation): GestureState | null {
    const now = observation.timestamp;
    if (this.lastTimestamp !== null && now - this.lastTimestamp > GESTURE_CONFIG.observationGapMs) this.hands.clear();
    this.lastTimestamp = now;

    // Hand tracking must not depend on the face still being visible this frame — a raised,
    // waving hand routinely crosses in front of or near the face and knocks face detection
    // out for a frame or two, which used to wipe the entire snapshot (hands included) and
    // made waves nearly undetectable.
    const face = validFace(observation.face);
    if (face) {
      this.faceMissingSince = null;
    } else {
      this.faceMissingSince ??= now;
      if (now - this.faceMissingSince >= GESTURE_CONFIG.faceLostMs) {
        this.baseline = null;
        this.faceSamples.length = 0;
      }
    }

    for (const hand of observation.hands) {
      const track = this.hands.get(hand.id) ?? { points: [] };
      track.points.push({ timestamp: now, x: mirrorX(hand.wrist.x), y: hand.wrist.y });
      while (track.points.length && now - track.points[0].timestamp > GESTURE_CONFIG.trajectoryWindowMs) track.points.shift();
      this.hands.set(hand.id, track);
    }
    this.clearStaleHands(now);

    const hands = [...this.hands.entries()]
      .filter(([, track]) => track.points.length >= 2)
      .map(([id, track]) => ({
        id,
        points: track.points.map((point) => ({ t: Math.round(point.timestamp - now), x: round(point.x), y: round(point.y) })),
      }));

    if (!face && hands.length === 0) return null;

    return {
      hands,
      face: face && this.baseline !== null ? { heightRatio: round(face.height / this.baseline), eyeAngleDegrees: round(angleDegrees(face.leftEye, face.rightEye)) } : null,
    };
  }

  private clearStaleHands(now: number): void {
    for (const [id, track] of this.hands) {
      if (!track.points.length || now - track.points[track.points.length - 1].timestamp > GESTURE_CONFIG.observationGapMs) this.hands.delete(id);
    }
  }
}

function validFace(face: FaceObservation | null): FaceObservation | null {
  return face && face.height >= GESTURE_CONFIG.faceMinHeight && face.confidence >= 0.6 ? face : null;
}

function mirrorX(x: number): number { return 1 - x; }

function angleDegrees(left: Point, right: Point): number {
  return Math.atan2(right.y - left.y, right.x - left.x) * 180 / Math.PI;
}

function round(value: number): number { return Math.round(value * 1000) / 1000; }
