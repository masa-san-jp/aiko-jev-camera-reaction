import { describe, expect, it } from 'vitest';
import { GestureEngine } from '../src/gestures';
import type { Observation } from '../src/types';

function observation(timestamp: number, faceHeight = 0.3, x = 0.2, y = 0.4): Observation {
  return { timestamp, videoWidth: 640, videoHeight: 480, face: { height: faceHeight, leftEye: { x: 0.4, y: 0.45 }, rightEye: { x: 0.6, y: 0.45 }, confidence: 1 }, hands: [{ id: 1, wrist: { x, y }, confidence: 1 }] };
}

describe('GestureEngine', () => {
  it('calibrates on forty valid face samples', () => {
    const engine = new GestureEngine();
    for (let i = 0; i < 40; i++) engine.calibrate(observation(i * 50));
    expect(engine.calibrationProgress()).toBe(1);
    expect(engine.getBaseline()).toBeCloseTo(0.3);
  });

  it('reports no snapshot while the face is missing', () => {
    const engine = new GestureEngine();
    for (let i = 0; i < 40; i++) engine.calibrate(observation(i * 50));
    const noFace: Observation = { ...observation(2100), face: null };
    expect(engine.track(noFace)).toBeNull();
  });

  it('builds a mirrored hand trajectory and the face angle/height ratio for Jev to judge', () => {
    const engine = new GestureEngine();
    for (let i = 0; i < 40; i++) engine.calibrate(observation(i * 50));
    engine.track(observation(2100, 0.3, 0.2, 0.35));
    const snapshot = engine.track(observation(2260, 0.3, 0.35, 0.35));
    expect(snapshot).not.toBeNull();
    expect(snapshot?.hands).toHaveLength(1);
    expect(snapshot?.hands[0].id).toBe(1);
    // x is mirrored (1 - raw x) so it matches what the user sees in the camera preview.
    expect(snapshot?.hands[0].points.map((p) => p.x)).toEqual([0.8, 0.65]);
    expect(snapshot?.hands[0].points[1].t).toBe(0);
    expect(snapshot?.face?.heightRatio).toBeCloseTo(1);
  });

  it('drops hand points older than the trajectory window, keeping the rest', () => {
    const engine = new GestureEngine();
    for (let i = 0; i < 40; i++) engine.calibrate(observation(i * 50));
    // Steps of 200ms stay well under observationGapMs (700ms) so the buffer never resets;
    // only the sliding trajectoryWindowMs (1800ms) trims the oldest point(s).
    let snapshot = null;
    for (let i = 0; i < 11; i++) snapshot = engine.track(observation(2100 + i * 200, 0.3, 0.2, 0.35));
    expect(snapshot?.hands[0].points).toHaveLength(10);
    expect(snapshot?.hands[0].points[0].t).toBe(-1800);
  });

  it('reports face height ratio using the current baseline, e.g. a closer face reads above 1', () => {
    const engine = new GestureEngine();
    for (let i = 0; i < 40; i++) engine.calibrate(observation(i * 50));
    const snapshot = engine.track(observation(2100, 0.42, 0.2, 0.35));
    expect(snapshot?.face?.heightRatio).toBeCloseTo(1.4);
  });

  it('reports the eye-line tilt angle in degrees', () => {
    const engine = new GestureEngine();
    for (let i = 0; i < 40; i++) engine.calibrate(observation(i * 50));
    const tilted: Observation = { ...observation(2100), face: { height: 0.3, leftEye: { x: 0.4, y: 0.45 }, rightEye: { x: 0.6, y: 0.55 }, confidence: 1 } };
    const snapshot = engine.track(tilted);
    expect(snapshot?.face?.eyeAngleDegrees).toBeGreaterThan(0);
  });
});
