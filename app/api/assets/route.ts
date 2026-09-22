import handler from '../../../handlers/assets.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  return handler.fetch(request);
}
