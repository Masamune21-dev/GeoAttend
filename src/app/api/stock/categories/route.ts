import { NextRequest, NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { stockCategories, stockItems } from '@/lib/db/schema';
import { getApiSession, unauthorizedResponse } from '@/lib/auth/utils';
import { CreateStockCategorySchema, type StockCategoryResponse } from '@/types/api';
import { errorJson, internalError, isUniqueViolation, validationError } from '@/lib/http';

export const dynamic = 'force-dynamic';

/** GET /api/stock/categories — daftar kategori + jumlah barang aktif. */
export async function GET(req: NextRequest) {
  try {
    const session = await getApiSession(req);
    if (!session) return unauthorizedResponse();

    const rows = await db
      .select({
        id: stockCategories.id,
        name: stockCategories.name,
        sortOrder: stockCategories.sortOrder,
        itemCount: sql<number>`count(${stockItems.id})::int`,
      })
      .from(stockCategories)
      .leftJoin(
        stockItems,
        and(eq(stockItems.categoryId, stockCategories.id), eq(stockItems.isActive, true))
      )
      .groupBy(stockCategories.id)
      .orderBy(stockCategories.sortOrder, stockCategories.name);

    return NextResponse.json({ data: rows as StockCategoryResponse[] });
  } catch (error) {
    return internalError(error, 'GET /api/stock/categories');
  }
}

/** POST /api/stock/categories — tambah kategori. */
export async function POST(req: NextRequest) {
  try {
    const session = await getApiSession(req);
    if (!session) return unauthorizedResponse();

    const parsed = CreateStockCategorySchema.safeParse(await req.json());
    if (!parsed.success) return validationError(parsed.error.flatten());
    const input = parsed.data;

    let sortOrder = input.sortOrder;
    if (sortOrder === undefined) {
      const [max] = await db
        .select({ v: sql<number>`coalesce(max(${stockCategories.sortOrder}), -1)::int` })
        .from(stockCategories);
      sortOrder = Number(max?.v ?? -1) + 1;
    }

    try {
      const [row] = await db
        .insert(stockCategories)
        .values({ name: input.name.trim(), sortOrder })
        .returning();
      return NextResponse.json(
        { ...row, itemCount: 0 } satisfies StockCategoryResponse,
        { status: 201 }
      );
    } catch (err) {
      if (isUniqueViolation(err)) return errorJson('DUPLICATE', 'Nama kategori sudah ada', 409);
      throw err;
    }
  } catch (error) {
    return internalError(error, 'POST /api/stock/categories');
  }
}
