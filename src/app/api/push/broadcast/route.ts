import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { pushTokens } from '@/lib/db/schema';
import { forbiddenResponse, getApiSession, isAdmin, unauthorizedResponse } from '@/lib/auth/utils';
import { sendPushToUsers } from '@/lib/push';
import { BroadcastPushSchema, type BroadcastPushResponse } from '@/types/api';

export const dynamic = 'force-dynamic';

/**
 * POST /api/push/broadcast — kirim pengumuman ke perangkat karyawan.
 *
 * Administrator saja, dan sengaja TIDAK memakai `dispatchPush`: notifikasi lain
 * di aplikasi ini adalah efek samping dari aksi lain (pengajuan izin tetap
 * tersimpan meski push gagal), sedangkan di sini pengiriman ITU SENDIRI adalah
 * hasil yang diminta. Administrator harus tahu berapa yang benar-benar terkirim
 * sebelum menutup layar, jadi hasilnya ditunggu dan dilaporkan apa adanya.
 *
 * Tidak ada percobaan ulang otomatis. Notifikasi yang dikirim ulang diam-diam
 * muncul dua kali di HP karyawan; lebih baik administrator melihat angkanya
 * lalu memutuskan sendiri.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getApiSession(req);
    if (!session) return unauthorizedResponse();
    if (!isAdmin(session)) return forbiddenResponse();

    const parsed = BroadcastPushSchema.safeParse(await req.json());
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

    const { title, message, userIds } = parsed.data;

    // Daftar penerima selalu diambil ulang dari basis data, tidak dipercayakan
    // pada layar administrator: perangkat bisa terdaftar atau tercabut di antara
    // saat daftar dimuat dan tombol kirim ditekan.
    const registered = await db.selectDistinct({ userId: pushTokens.userId }).from(pushTokens);
    const registeredIds = new Set(registered.map((r) => r.userId));

    const targets =
      userIds && userIds.length > 0
        ? userIds.filter((id) => registeredIds.has(id))
        : Array.from(registeredIds);

    if (targets.length === 0) {
      return NextResponse.json(
        {
          code: 'NO_RECIPIENT',
          message: 'Tidak ada perangkat terdaftar yang cocok dengan pilihan Anda',
          timestamp: new Date().toISOString(),
        },
        { status: 422 }
      );
    }

    const result = await sendPushToUsers(targets, {
      title: title || undefined,
      body: message,
      data: { kind: 'broadcast' },
    });

    // Jejak akuntabilitas di journalctl — pengumuman ke seluruh karyawan tidak
    // boleh tidak bisa ditelusuri siapa pengirimnya.
    console.log(
      `[push] siaran oleh ${session.user.name} (${session.user.id}) ke ${targets.length} karyawan: ${JSON.stringify(message)}`
    );

    const data: BroadcastPushResponse = {
      sent: result.sent,
      removed: result.removed,
      targeted: targets.length,
    };

    return NextResponse.json({ data });
  } catch (error) {
    console.error('POST /api/push/broadcast error:', error);
    return NextResponse.json(
      {
        code: 'INTERNAL_ERROR',
        message: 'Terjadi kesalahan sistem',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
