import { NextRequest, NextResponse } from 'next/server';
import { getApiSession, unauthorizedResponse } from '@/lib/auth/utils';
import { getStockOverview } from '@/lib/stock';
import { toLocalDateString } from '@/lib/leaves';
import { internalError } from '@/lib/http';

export const dynamic = 'force-dynamic';

/**
 * GET /api/stock/overview?from=yyyy-MM-dd&to=yyyy-MM-dd
 * Ringkasan dashboard stok. Default periode = bulan berjalan.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getApiSession(req);
    if (!session) return unauthorizedResponse();

    const params = req.nextUrl.searchParams;
    const now = new Date();
    const from = params.get('from') ?? toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1));
    const to = params.get('to') ?? toLocalDateString(now);

    const overview = await getStockOverview(from, to);
    return NextResponse.json(overview);
  } catch (error) {
    return internalError(error, 'GET /api/stock/overview');
  }
}
