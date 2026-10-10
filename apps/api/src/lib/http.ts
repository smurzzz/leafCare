/**
 * Tiny HTTP helpers shared by every route handler: typed errors, JSON shaping,
 * body parsing and the CORS rules from docs/security.md.
 */

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { MissingEnvironmentError, env } from './env';

export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'BAD_REQUEST'
  | 'UPSTREAM_ERROR'
  | 'SERVER_ERROR'
  | 'CONFIG_ERROR';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const unauthorized = (message = 'Sign in to continue') =>
  new HttpError(401, 'UNAUTHORIZED', message);

export const notFound = (message = 'Not found') => new HttpError(404, 'NOT_FOUND', message);

export const badRequest = (message: string, details?: unknown) =>
  new HttpError(400, 'BAD_REQUEST', message, details);

export const forbidden = (message = 'Not allowed') => new HttpError(403, 'FORBIDDEN', message);

const NO_STORE = 'private, no-store, max-age=0';

/** Every response is private: all payloads are scoped to one signed-in user. */
export const json = <T>(body: T, init?: { status?: number; headers?: Record<string, string> }) =>
  NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: {
      'Cache-Control': NO_STORE,
      ...init?.headers,
    },
  });

export const noContent = () =>
  new NextResponse(null, { status: 204, headers: { 'Cache-Control': NO_STORE } });

const corsHeaders = (origin: string | null): Record<string, string> => {
  const allowed = env.appOrigin;
  if (!allowed || !origin) return {};
  const allowedOrigins = allowed.split(',').map((value) => value.trim());
  if (!allowedOrigins.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type,X-Request-Id',
    Vary: 'Origin',
  };
};

/** Wraps a handler so thrown errors become the docs/api.md error envelope. */
export const handle = (
  handler: (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>,
) => {
  return async (
    request: Request,
    context: { params: Promise<Record<string, string>> },
  ): Promise<Response> => {
    const extra = corsHeaders(request.headers.get('origin'));
    try {
      const response = await handler(request, context);
      for (const [key, value] of Object.entries(extra)) response.headers.set(key, value);
      return response;
    } catch (error) {
      if (error instanceof ZodError) {
        return json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'The request payload was invalid',
              details: error.issues,
            },
          },
          { status: 400, headers: extra },
        );
      }
      if (error instanceof MissingEnvironmentError) {
        return json(
          { error: { code: 'CONFIG_ERROR', message: error.message } },
          { status: 503, headers: extra },
        );
      }
      if (error instanceof HttpError) {
        return json(
          { error: { code: error.code, message: error.message, details: error.details } },
          { status: error.status, headers: extra },
        );
      }
      console.error('[api] unhandled error', error);
      return json(
        { error: { code: 'SERVER_ERROR', message: 'Something went wrong on our side' } },
        { status: 500, headers: extra },
      );
    }
  };
};

export const preflight = (request: Request): Response => {
  const extra = corsHeaders(request.headers.get('origin'));
  return new Response(null, { status: 204, headers: extra });
};

/** Parses and validates a JSON body, mapping failures to a 400. */
export const readJson = async <T>(
  request: Request,
  parse: (value: unknown) => T,
): Promise<T> => {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    throw badRequest('Expected a JSON body');
  }
  return parse(payload);
};

export type UploadedImage = {
  bytes: Uint8Array;
  base64: string;
  contentType: string;
  filename: string;
  size: number;
};

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/heif']);
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const extensionFor = (contentType: string): string => {
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('heic') || contentType.includes('heif')) return 'heic';
  return 'jpg';
};

const normalizeContentType = (value: string | undefined): string => {
  const raw = (value ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  if (raw === 'image/jpg') return 'image/jpeg';
  return raw;
};

/** Validates a single uploaded image file (max 8MB, jpeg/png/heic). */
export const uploadedImageFromFile = async (file: File): Promise<UploadedImage> => {
  const normalizedType = normalizeContentType(file.type) || 'image/jpeg';
  if (!ALLOWED_IMAGE_TYPES.has(normalizedType)) {
    throw badRequest('Only JPEG, PNG or HEIC images are supported');
  }
  if (file.size > MAX_UPLOAD_BYTES) throw badRequest('Images must be 8MB or smaller');

  const buffer = new Uint8Array(await file.arrayBuffer());
  return {
    bytes: buffer,
    base64: Buffer.from(buffer).toString('base64'),
    contentType: normalizedType,
    filename: file.name || `upload.${extensionFor(normalizedType)}`,
    size: file.size,
  };
};

/** Validates the `image` field of a multipart body (max 8MB, jpeg/png/heic). */
export const readImageUpload = async (request: Request): Promise<UploadedImage> => {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    throw badRequest('Expected multipart/form-data with an `image` field');
  }
  const form = await request.formData();
  const file = form.get('image');
  if (!(file instanceof File)) throw badRequest('Missing `image` file field');
  return uploadedImageFromFile(file);
};

export const extensionForContentType = extensionFor;

/** A UUID we can trust as a storage path segment or a database key. */
export const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export const requireUuid = (value: string, label = 'id'): string => {
  if (!isUuid(value)) throw badRequest(`Invalid ${label}`);
  return value;
};
