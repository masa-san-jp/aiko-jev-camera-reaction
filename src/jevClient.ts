import { JEV_PROXY_URL } from './config';
import type { GestureState, ReactionId } from './types';

export interface JevJudgeResult {
  reaction: ReactionId | null;
  confidence: number;
}

function isReactionId(value: unknown): value is ReactionId {
  return value === 'wave-left' || value === 'wave-right' || value === 'look-into' || value === 'tilt-left' || value === 'tilt-right';
}

export async function judgeGesture(state: GestureState): Promise<JevJudgeResult> {
  const response = await fetch(JEV_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state }),
  });
  if (!response.ok) throw new Error('Jevとの通信に失敗しました。');
  const body = (await response.json()) as { reaction: unknown; confidence: unknown };
  const confidence = typeof body.confidence === 'number' ? body.confidence : 0;
  return { reaction: isReactionId(body.reaction) ? body.reaction : null, confidence };
}
