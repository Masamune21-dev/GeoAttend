'use client';

import { useQuery } from '@tanstack/react-query';
import { startOfDay } from 'date-fns';
import Link from 'next/link';
import { ArrowRight, Inbox } from 'lucide-react';
import { useAttendanceList } from '@/hooks/useAttendance';
import type { UserProfile } from '@/types/api';
import { StatsOverview } from '@/components/features/admin/StatsOverview';
import { ExportButton } from '@/components/features/admin/ExportButton';
import { AttendanceCard } from '@/components/features/attendance/AttendanceCard';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminOverviewPage() {
  const { data: attendanceData, isLoading: attendanceLoading } = useAttendanceList({
    from: startOfDay(new Date()).toISOString(),
    limit: 100,
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users', ''],
    queryFn: async (): Promise<{ data: UserProfile[] }> => {
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error('Gagal memuat pengguna');
      return res.json();
    },
  });

  const records = attendanceData?.data ?? [];
  const withinCount = records.filter((r) => r.isWithinGeofence).length;

  if (attendanceLoading || usersLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <StatsOverview
        totalUsers={usersData?.data.length ?? 0}
        todayCount={records.length}
        withinCount={withinCount}
        outsideCount={records.length - withinCount}
      />

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-text-primary">Absensi Terbaru Hari Ini</h2>
          <div className="flex items-center gap-2">
            <ExportButton records={records} />
            <Link
              href="/admin/live-map"
              className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Peta Live <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>

        {records.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-subtle">
              <Inbox className="h-7 w-7 text-primary" aria-hidden="true" />
            </span>
            <p className="text-sm text-text-secondary">Belum ada absensi hari ini</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {records.slice(0, 10).map((record) => (
              <AttendanceCard key={record.id} record={record} showUserName />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
