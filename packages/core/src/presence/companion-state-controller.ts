import type {
  CompanionState,
  CompanionMood,
  CompanionRenderMode,
  CompanionTransition,
  CompanionStateSnapshot,
} from '@victor/shared';

export class UnverifiedSuccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnverifiedSuccessError';
  }
}

export class InvalidCompanionTransitionError extends Error {
  constructor(message: string, public readonly from: CompanionState, public readonly to: CompanionState) {
    super(message);
    this.name = 'InvalidCompanionTransitionError';
  }
}

const ALLOWED_COMPANION_TRANSITIONS: Record<CompanionState, readonly CompanionState[]> = {
  idle: ['listening', 'thinking', 'offline'],
  listening: ['thinking', 'idle', 'error', 'offline'],
  thinking: ['speaking', 'success', 'error', 'offline'],
  speaking: ['idle', 'error', 'offline'],
  success: ['idle', 'speaking', 'offline'],
  error: ['idle', 'offline'],
  offline: ['idle'],
};

export class CompanionStateController {
  private currentState: CompanionState = 'idle';
  private currentMood: CompanionMood = 'neutral';
  private renderMode: CompanionRenderMode = '2d_svg';
  private lastVerifiedSuccessAt?: string;
  private lastError?: string;
  private readonly history: CompanionTransition[] = [];

  constructor(initialState: CompanionState = 'idle', initialRenderMode: CompanionRenderMode = '2d_svg') {
    this.currentState = initialState;
    this.renderMode = initialRenderMode;
  }

  public getState(): CompanionState {
    return this.currentState;
  }

  public getMood(): CompanionMood {
    return this.currentMood;
  }

  public getRenderMode(): CompanionRenderMode {
    return this.renderMode;
  }

  public setRenderMode(mode: CompanionRenderMode): void {
    this.renderMode = mode;
  }

  public transition(
    to: CompanionState,
    options?: { reason?: string; verifiedExecutionId?: string; error?: string }
  ): CompanionStateSnapshot {
    if (this.currentState === to) {
      return this.getSnapshot();
    }

    const allowed = ALLOWED_COMPANION_TRANSITIONS[this.currentState] ?? [];
    if (!allowed.includes(to)) {
      throw new InvalidCompanionTransitionError(
        `Invalid companion transition from '${this.currentState}' to '${to}'`,
        this.currentState,
        to
      );
    }

    // AC-04 Invariant: Character states never claim an action succeeded without evidence
    if (to === 'success' && !options?.verifiedExecutionId) {
      throw new UnverifiedSuccessError(
        'Cannot transition companion to "success" state without verifiedExecutionId evidence'
      );
    }

    const transitionRecord: CompanionTransition = {
      from: this.currentState,
      to,
      reason: options?.reason ?? options?.error,
      verifiedExecutionId: options?.verifiedExecutionId,
      timestamp: new Date().toISOString(),
    };

    this.history.push(transitionRecord);
    this.currentState = to;

    if (to === 'success') {
      this.lastVerifiedSuccessAt = transitionRecord.timestamp;
      this.currentMood = 'approving';
    } else if (to === 'error') {
      this.lastError = options?.error ?? options?.reason ?? 'Unknown companion error';
      this.currentMood = 'vigilant';
    } else if (to === 'listening') {
      this.currentMood = 'curious';
    } else if (to === 'thinking') {
      this.currentMood = 'focused';
    } else if (to === 'idle') {
      this.currentMood = 'neutral';
    }

    return this.getSnapshot();
  }

  public handleNetworkDisconnect(): CompanionStateSnapshot {
    return this.transition('offline', { reason: 'Network connectivity lost' });
  }

  public handleNetworkReconnect(): CompanionStateSnapshot {
    if (this.currentState === 'offline') {
      return this.transition('idle', { reason: 'Network connectivity restored' });
    }
    return this.getSnapshot();
  }

  public getSnapshot(): CompanionStateSnapshot {
    return {
      state: this.currentState,
      mood: this.currentMood,
      renderMode: this.renderMode,
      lastVerifiedSuccessAt: this.lastVerifiedSuccessAt,
      lastError: this.lastError,
      updatedAt: new Date().toISOString(),
    };
  }

  public getHistory(): readonly CompanionTransition[] {
    return [...this.history];
  }
}
