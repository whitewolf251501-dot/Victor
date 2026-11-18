import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  IdentityContext,
  OwnerId,
  DeviceId,
  SessionId,
} from '@victor/shared';
import { DeviceRegistry } from './device-registry';
import { SessionManager } from './session-manager';

export interface AuthenticateRequestParams {
  authHeader?: string | null;
  cookieToken?: string | null;
  deviceId?: string | null;
  expectedOwnerId?: string | null;
}

export interface AuthResolution {
  authorized: boolean;
  identityContext?: IdentityContext;
  reason?: string;
  errorCode?: string;
}

export class AccessGuard {
  constructor(
    private readonly deviceRegistry: DeviceRegistry,
    private readonly sessionManager: SessionManager,
    private readonly supabase?: SupabaseClient
  ) {}

  /**
   * Universal ingress authentication: resolves either Bearer JWT or Cookie session,
   * verifies device trust state, and constructs an immutable IdentityContext.
   */
  async authenticateRequest(params: AuthenticateRequestParams): Promise<AuthResolution> {
    const { authHeader, cookieToken, deviceId, expectedOwnerId } = params;

    let token: string | null = null;
    let authMethod: 'session_jwt' | 'device_hmac' | 'token' = 'session_jwt';

    // 1. Extract token from Bearer header or cookie
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
      authMethod = token.startsWith('vses_') ? 'token' : 'session_jwt';
    } else if (cookieToken) {
      token = cookieToken.trim();
      authMethod = 'session_jwt';
    }

    if (!token) {
      return {
        authorized: false,
        reason: 'Missing authentication credentials (no Bearer token or session cookie).',
        errorCode: 'UNAUTHENTICATED',
      };
    }

    // 2. Device trust check if deviceId provided
    if (deviceId) {
      if (this.deviceRegistry.isDeviceRevoked(deviceId as DeviceId)) {
        return {
          authorized: false,
          reason: 'Access denied: The calling device has been revoked by the owner.',
          errorCode: 'DEVICE_REVOKED',
        };
      }
    }

    // 3. Validate token
    let ownerId: OwnerId | null = null;
    let sessionId: SessionId | null = null;

    if (token.startsWith('vses_')) {
      // Validate device session
      const sessionRes = await this.sessionManager.validateSession(token);
      if (!sessionRes.valid || !sessionRes.session) {
        return {
          authorized: false,
          reason: sessionRes.reason || 'Invalid or revoked session token.',
          errorCode: 'INVALID_SESSION',
        };
      }
      ownerId = sessionRes.session.ownerId;
      sessionId = sessionRes.session.sessionId;
    } else if (this.supabase) {
      // Validate with Supabase Auth
      try {
        const { data: { user }, error } = await this.supabase.auth.getUser(token);
        if (error || !user) {
          return {
            authorized: false,
            reason: 'Supabase authentication failed or token expired.',
            errorCode: 'INVALID_TOKEN',
          };
        }
        ownerId = user.id as OwnerId;
      } catch {
        return {
          authorized: false,
          reason: 'Authentication service unavailable.',
          errorCode: 'AUTH_ERROR',
        };
      }
    } else {
      // Mock / fallback for testing tokens
      if (token.startsWith('valid_owner_')) {
        ownerId = token.replace('valid_owner_', '') as OwnerId;
      } else {
        return {
          authorized: false,
          reason: 'Unrecognized authentication token.',
          errorCode: 'INVALID_TOKEN',
        };
      }
    }

    // 4. Forgery Protection: if caller provided an expectedOwnerId, verify match
    if (expectedOwnerId && expectedOwnerId !== ownerId) {
      return {
        authorized: false,
        reason: 'Security violation: Request target owner does not match authenticated identity.',
        errorCode: 'FORGED_OWNER_ID',
      };
    }

    const identityContext: IdentityContext = {
      ownerId,
      deviceId: deviceId ? (deviceId as DeviceId) : undefined,
      sessionId: sessionId ?? undefined,
      actorType: 'owner',
      scopes: ['*'],
      roles: ['owner'],
      authMethod,
      correlationId: randomUUID(),
      issuedAt: new Date().toISOString(),
    };

    return {
      authorized: true,
      identityContext,
    };
  }
}
