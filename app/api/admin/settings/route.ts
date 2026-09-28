// Admin session cookies are restricted to /api/admin; keep settings under it.
import handler from '../../../../handlers/settings.js';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request): Promise<Response> { return handler.fetch(request); }
