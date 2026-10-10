import { environmentReport } from '@/lib/env';
import { handle, json, preflight } from '@/lib/http';

export const dynamic = 'force-dynamic';

export const OPTIONS = (request: Request) => preflight(request);

/**
 * GET /api/health — public. Reports which integrations are configured so the
 * Expo app can show a useful "finish setup" state instead of failing silently.
 */
export const GET = handle(async () =>
  json({
    ok: true,
    service: 'leafcare-api',
    integrations: environmentReport(),
    timestamp: new Date().toISOString(),
  }),
);
