import handler from '../../../handlers/pay.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  return handler.fetch(request);
}
