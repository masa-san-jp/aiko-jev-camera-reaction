import { MEDIA_BASE_URL } from './config';
import type { ReactionId } from './types';

export const REACTIONS: Record<ReactionId, { label: string; src: string }> = {
  'wave-left': { label: '手を振る（左）', src: `${MEDIA_BASE_URL}/wave-left.mp4` },
  'wave-right': { label: '手を振る（右）', src: `${MEDIA_BASE_URL}/wave-right.mp4` },
  'look-into': { label: '覗き込む', src: `${MEDIA_BASE_URL}/look-into.mp4` },
  'tilt-left': { label: '首を傾げる（左）', src: `${MEDIA_BASE_URL}/tilt-left.mp4` },
  'tilt-right': { label: '首を傾げる（右）', src: `${MEDIA_BASE_URL}/tilt-right.mp4` },
};

export const REACTION_ORDER: ReactionId[] = ['wave-left', 'wave-right', 'look-into', 'tilt-left', 'tilt-right'];
