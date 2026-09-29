import { handleSupportThread } from '../../../../handlers/support-thread.js';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request): Promise<Response> { return handleSupportThread(request, true); }
export async function POST(request: Request): Promise<Response> { return handleSupportThread(request, true); }
