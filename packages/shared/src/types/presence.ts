export type CompanionState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'success'
  | 'error'
  | 'offline';

export type CompanionMood =
  | 'neutral'
  | 'curious'
  | 'focused'
  | 'vigilant'
  | 'approving'
  | 'protective';

export type CompanionRenderMode = '2d_svg' | '3d_webgl' | 'audio_only';

export interface CompanionTransition {
  from: CompanionState;
  to: CompanionState;
  reason?: string;
  verifiedExecutionId?: string;
  timestamp: string;
}

export interface CompanionStateSnapshot {
  state: CompanionState;
  mood: CompanionMood;
  renderMode: CompanionRenderMode;
  lastVerifiedSuccessAt?: string;
  lastError?: string;
  updatedAt: string;
}
