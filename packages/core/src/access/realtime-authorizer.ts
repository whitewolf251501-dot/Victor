import type {
  IdentityContext,
  RealtimeSubscriptionResult,
} from '@victor/shared';

export class RealtimeAuthorizer {
  /**
   * Evaluates whether an authenticated client is permitted to subscribe to a realtime event topic/channel.
   * Completely prevents cross-owner and cross-device event leakage.
   */
  public static authorizeSubscription(
    channel: string,
    context: IdentityContext
  ): RealtimeSubscriptionResult {
    const clean = channel.trim();

    // 1. Wildcard channels are prohibited
    if (clean.includes('*') || clean.includes('#')) {
      return {
        authorized: false,
        reason: 'Wildcard subscriptions are forbidden on secure channels.',
      };
    }

    const parts = clean.split(':');
    const channelType = parts[0];

    // 2. Owner-scoped channels: owner:<ownerId> or owner:<ownerId>:<subtopic>
    if (channelType === 'owner') {
      const targetOwnerId = parts[1];
      if (!targetOwnerId || targetOwnerId !== context.ownerId) {
        return {
          authorized: false,
          reason: 'Forbidden: Cannot subscribe to another owner’s event channel.',
        };
      }
      return { authorized: true };
    }

    // 3. Device-scoped channels: device:<deviceId>
    if (channelType === 'device') {
      const targetDeviceId = parts[1];
      if (!context.deviceId || targetDeviceId !== context.deviceId) {
        return {
          authorized: false,
          reason: 'Forbidden: Cannot subscribe to another device’s event channel.',
        };
      }
      return { authorized: true };
    }

    // 4. Conversation-scoped channels: conversation:<ownerId>:<conversationId>
    if (channelType === 'conversation') {
      const targetOwnerId = parts[1];
      if (targetOwnerId && targetOwnerId !== context.ownerId) {
        return {
          authorized: false,
          reason: 'Forbidden: Cannot subscribe to another owner’s conversation events.',
        };
      }
      return { authorized: true };
    }

    // Unrecognized channel format
    return {
      authorized: false,
      reason: `Unknown or unauthorized channel format: '${channel}'.`,
    };
  }
}
