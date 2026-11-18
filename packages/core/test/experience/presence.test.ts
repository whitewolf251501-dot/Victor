import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CompanionStateController,
  UnverifiedSuccessError,
  InvalidCompanionTransitionError,
} from '../../src/presence/companion-state-controller';

describe('System 8: CompanionStateController Specification Suite', () => {
  it('AC-04 - Enforces no unverified success claims (rejects success without verifiedExecutionId)', () => {
    const controller = new CompanionStateController('thinking');

    // Attempting to claim success without verified execution evidence throws UnverifiedSuccessError
    assert.throws(
      () => controller.transition('success'),
      (err: any) => {
        assert(err instanceof UnverifiedSuccessError);
        assert.match(err.message, /without verifiedExecutionId evidence/);
        return true;
      }
    );

    // Valid transition with verified execution evidence succeeds
    const snapshot = controller.transition('success', {
      verifiedExecutionId: 'exec-12345',
      reason: 'Capability executed and certified by VTE',
    });

    assert.equal(snapshot.state, 'success');
    assert.equal(snapshot.mood, 'approving');
    assert(snapshot.lastVerifiedSuccessAt !== undefined);
  });

  it('AC-03 - Enforces valid voice/chat companion state transitions and rejects illegal jumps', () => {
    const controller = new CompanionStateController('idle');

    // idle -> listening -> thinking -> speaking -> idle
    let snap = controller.transition('listening');
    assert.equal(snap.state, 'listening');
    assert.equal(snap.mood, 'curious');

    snap = controller.transition('thinking');
    assert.equal(snap.state, 'thinking');
    assert.equal(snap.mood, 'focused');

    snap = controller.transition('speaking');
    assert.equal(snap.state, 'speaking');

    snap = controller.transition('idle');
    assert.equal(snap.state, 'idle');
    assert.equal(snap.mood, 'neutral');

    // Illegal jump: idle directly to speaking
    assert.throws(
      () => controller.transition('speaking'),
      (err: any) => err instanceof InvalidCompanionTransitionError
    );
  });

  it('AC-02 & AC-08 - Handles network loss and reconnection gracefully', () => {
    const controller = new CompanionStateController('idle');

    // Network disconnect
    const offlineSnap = controller.handleNetworkDisconnect();
    assert.equal(offlineSnap.state, 'offline');

    // Network restored
    const reconnectedSnap = controller.handleNetworkReconnect();
    assert.equal(reconnectedSnap.state, 'idle');
  });

  it('AC-09 - Maintains render mode configuration for 2D vs 3D fallback', () => {
    const controller = new CompanionStateController('idle', '2d_svg');
    assert.equal(controller.getRenderMode(), '2d_svg');

    controller.setRenderMode('3d_webgl');
    assert.equal(controller.getRenderMode(), '3d_webgl');

    // Fallback back to 2D
    controller.setRenderMode('2d_svg');
    assert.equal(controller.getRenderMode(), '2d_svg');
  });

  it('AC-10 - Records complete immutable transition audit history', () => {
    const controller = new CompanionStateController('idle');
    controller.transition('listening');
    controller.transition('thinking');
    controller.transition('error', { error: 'Network timeout' });

    const history = controller.getHistory();
    assert.equal(history.length, 3);
    assert.equal(history[0].from, 'idle');
    assert.equal(history[0].to, 'listening');
    assert.equal(history[2].to, 'error');
    assert.equal(history[2].reason, 'Network timeout');
  });
});
