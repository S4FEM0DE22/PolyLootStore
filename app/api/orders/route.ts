import handler from '../../../handlers/orders.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  return handler.fetch(request);
}
