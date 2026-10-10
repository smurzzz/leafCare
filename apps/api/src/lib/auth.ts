/**
 * Clerk session verification for native clients.
 *
 * The Expo app sends `Authorization: Bearer <session JWT>` obtained from
 * `getToken()`. We verify it with Clerk's own verifier (no route can forget an
 * auth check) and expose the subject as the `clerk_user_id` every table is keyed
 * by. `sub` is never read from the request body.
 */

import { verifyToken } from '@clerk/nextjs/server';

import { env } from './env';
import { HttpError, forbidden, unauthorized } from './http';

export type AuthenticatedUser = {
  clerkUserId: string;
  sessionId: string | null;
};

const bearerToken = (request: Request): string | null => {
  const header = request.headers.get('authorization') ?? request.headers.get('Authorization');
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!token || scheme.toLowerCase() !== 'bearer') return null;
  return token.trim();
};

/**
 * TokenVerificationError reasons that describe *our* inability to verify rather
 * than a bad caller token. When Clerk's JWKS endpoint cannot be reached the
 * session is not necessarily invalid, so answering 401 would sign a working
 * user out over a transient outage.
 */
const INFRASTRUCTURE_REASONS = new Set([
  'jwk-remote-failed-to-load',
  'jwk-remote-invalid',
  'jwk-remote-missing',
  'jwk-local-missing',
  'jwk-failed-to-resolve',
]);

/** Clerk throws `TokenVerificationError`, which carries the machine reason. */
const verificationReason = (error: unknown): string | null => {
  if (typeof error === 'object' && error !== null && 'reason' in error) {
    const reason = (error as { reason?: unknown }).reason;
    if (typeof reason === 'string') return reason;
  }
  return null;
};

export const authenticate = async (request: Request): Promise<AuthenticatedUser> => {
  const token = bearerToken(request);
  if (!token) throw unauthorized();

  let payload: Awaited<ReturnType<typeof verifyToken>>;
  try {
    payload = await verifyToken(token, {
      secretKey: env.clerkSecretKey,
      ...(env.clerkJwtKey ? { jwtKey: env.clerkJwtKey } : {}),
    });
  } catch (error) {
    const reason = verificationReason(error);
    if (reason && INFRASTRUCTURE_REASONS.has(reason)) {
      console.error('[api] clerk verification unavailable', reason);
      throw new HttpError(503, 'CONFIG_ERROR', 'Cannot verify sessions right now');
    }
    // Expired, forged or wrong-instance tokens are the caller's problem, not a
    // server fault: the client must sign in again.
    console.warn('[api] rejected session token', reason ?? error);
    throw unauthorized();
  }

  const subject = typeof payload.sub === 'string' ? payload.sub : null;
  if (!subject) throw unauthorized('Session token is missing a subject');

  return {
    clerkUserId: subject,
    sessionId: typeof payload.sid === 'string' ? payload.sid : null,
  };
};

/** Any authenticated user may act on their own rows; nothing else. */
export const assertOwnership = (rowUserId: string, clerkUserId: string): void => {
  if (rowUserId !== clerkUserId) throw forbidden();
};

/** Guards the cron/reminder job endpoint. */
export const assertCronSecret = (request: Request): void => {
  const expected = env.cronSecret;
  if (!expected) return;
  const provided =
    request.headers.get('x-cron-secret') ??
    (request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null);
  if (provided !== expected) throw forbidden('Invalid job credentials');
};
