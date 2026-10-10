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
import { forbidden, unauthorized } from './http';

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

export const authenticate = async (request: Request): Promise<AuthenticatedUser> => {
  const token = bearerToken(request);
  if (!token) throw unauthorized();

  const payload = await verifyToken(token, {
    secretKey: env.clerkSecretKey,
    ...(env.clerkJwtKey ? { jwtKey: env.clerkJwtKey } : {}),
  });

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
