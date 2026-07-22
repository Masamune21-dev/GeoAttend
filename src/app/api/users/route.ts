import { NextRequest, NextResponse } from 'next/server';
import { asc, ilike, or, eq, and, sql, type SQL } from 'drizzle-orm';
import { APIError } from 'better-auth/api';
import { db } from '@/lib/db';
import { user } from '@/lib/db/schema';
import { auth } from '@/lib/auth';
import {
  getApiSession,
  isAdmin,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/lib/auth/utils';
import { CreateUserSchema } from '@/types/api';

export const dynamic = 'force-dynamic';

/** GET /api/users?search=&role= — daftar pengguna (admin saja). */
export async function GET(req: NextRequest) {
  try {
    const session = await getApiSession(req);
    if (!session) return unauthorizedResponse();
    if (!isAdmin(session)) return forbiddenResponse();

    const params = req.nextUrl.searchParams;
    const search = params.get('search');
    const role = params.get('role');

    const conditions: SQL[] = [];
    if (search) {
      const cond = or(ilike(user.name, `%${search}%`), ilike(user.email, `%${search}%`));
      if (cond) conditions.push(cond);
    }
    if (role && ['administrator', 'admin', 'noc', 'teknisi', 'employee'].includes(role)) {
      conditions.push(eq(user.role, role));
    }

    const rows = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        image: user.image,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      // Administrator paling atas, lalu urutan role kerja, lalu nama A-Z
      .orderBy(
        sql`CASE ${user.role}
          WHEN 'administrator' THEN 0
          WHEN 'admin' THEN 1
          WHEN 'noc' THEN 2
          WHEN 'teknisi' THEN 3
          ELSE 4
        END`,
        asc(user.name)
      )
      .limit(200);

    return NextResponse.json({
      data: rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('GET /api/users error:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan sistem', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}

/**
 * POST /api/users — administrator membuat akun pengguna baru langsung
 * (tanpa lewat halaman register).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getApiSession(req);
    if (!session) return unauthorizedResponse();
    if (!isAdmin(session)) return forbiddenResponse();

    const body = await req.json();
    const parsed = CreateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'Data tidak valid',
          details: parsed.error.flatten(),
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const input = parsed.data;

    // Buat user + password hash via Better Auth (tanpa mengganggu session admin)
    try {
      await auth.api.signUpEmail({
        body: {
          name: input.name,
          email: input.email,
          password: input.password,
        },
      });
    } catch (error) {
      if (error instanceof APIError) {
        const code = (error.body as { code?: string } | undefined)?.code;
        if (code === 'USER_ALREADY_EXISTS') {
          return NextResponse.json(
            { code, message: 'Email sudah terdaftar', timestamp: new Date().toISOString() },
            { status: 409 }
          );
        }
        return NextResponse.json(
          { code: code ?? 'AUTH_ERROR', message: error.message, timestamp: new Date().toISOString() },
          { status: 400 }
        );
      }
      throw error;
    }

    // Set role sesuai pilihan administrator
    const updated = await db
      .update(user)
      .set({ role: input.role, updatedAt: new Date() })
      .where(eq(user.email, input.email))
      .returning({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        image: user.image,
      });

    return NextResponse.json(updated[0], { status: 201 });
  } catch (error) {
    console.error('POST /api/users error:', error);
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan sistem', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
