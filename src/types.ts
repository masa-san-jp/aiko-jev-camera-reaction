export type ReactionId = 'wave-left' | 'wave-right' | 'look-into' | 'tilt-left' | 'tilt-right';

export type AppState = 'idle' | 'loading' | 'calibrating' | 'ready' | 'playing' | 'cooldown' | 'paused' | 'error';

export interface Point { x: number; y: number; }

export interface FaceObservation {
  height: number;
  leftEye: Point;
  rightEye: Point;
  confidence: number;
}

export interface HandObservation {
  id: number;
  wrist: Point;
  confidence: number;
}

export interface Observation {
  timestamp: number;
  videoWidth: number;
  videoHeight: number;
  face: FaceObservation | null;
  hands: HandObservation[];
}

export interface GestureConfig {
  faceMinHeight: number;
  observationGapMs: number;
  faceLostMs: number;
  trajectoryWindowMs: number;
  judgeIntervalMs: number;
  judgeConfidence: number;
  cooldownMs: number;
}

export interface HandTrajectoryPoint { t: number; x: number; y: number; }

export interface HandTrajectory { id: number; points: HandTrajectoryPoint[]; }

export interface GestureState {
  hands: HandTrajectory[];
  face: { heightRatio: number; eyeAngleDegrees: number } | null;
}
