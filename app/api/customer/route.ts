import handler from '../../../handlers/customer.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  return handler.fetch(request);
}

export async function POST(request: Request): Promise<Response> {
  return handler.fetch(request);
}
