import { NextRequest, NextResponse } from 'next/server';
import { asc, ilike, or, eq, and, sql, type SQL } from 'drizzle-orm';
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
    const email = input.email.toLowerCase();

    // Buat user + credential account (hash password) langsung lewat internal
    // adapter Better Auth. Sengaja TIDAK lewat auth.api.signUpEmail agar:
    //  - tidak butuh kode pendaftaran (ini pembuatan internal oleh admin),
    //  - bebas efek samping autoSignIn (pembuatan session/cookie sisi server
    //    yang bisa gagal & menyisakan user tanpa kredensial),
    //  - dijamin membuat baris account 'credential' berisi password — tanpa
    //    baris ini, akun tak akan pernah bisa dipakai login.
    const ctx = await auth.$context;

    const existing = await ctx.internalAdapter.findUserByEmail(email);
    if (existing?.user) {
      return NextResponse.json(
        { code: 'USER_ALREADY_EXISTS', message: 'Email sudah terdaftar', timestamp: new Date().toISOString() },
        { status: 409 }
      );
    }

    const hashedPassword = await ctx.password.hash(input.password);

    let createdUser;
    try {
      createdUser = await ctx.internalAdapter.createUser({
        name: input.name,
        email,
        emailVerified: false,
      });
    } catch (error) {
      // Balapan unik email (dua permintaan bersamaan)
      if ((error as { code?: string }).code === '23505') {
        return NextResponse.json(
          { code: 'USER_ALREADY_EXISTS', message: 'Email sudah terdaftar', timestamp: new Date().toISOString() },
          { status: 409 }
        );
      }
      throw error;
    }

    try {
      await ctx.internalAdapter.linkAccount({
        userId: createdUser.id,
        providerId: 'credential',
        accountId: createdUser.id,
        password: hashedPassword,
      });
    } catch (error) {
      // Jangan tinggalkan user tanpa kredensial (akun hantu yang tak bisa login)
      await db.delete(user).where(eq(user.id, createdUser.id));
      throw error;
    }

    // Set role sesuai pilihan administrator (cocokkan lewat id, bukan email —
    // email tersimpan lowercase sehingga pencocokan email mentah bisa meleset)
    const updated = await db
      .update(user)
      .set({ role: input.role, updatedAt: new Date() })
      .where(eq(user.id, createdUser.id))
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
