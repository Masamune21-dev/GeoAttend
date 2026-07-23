'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarClock, Sparkles } from 'lucide-react';
import { useSchedule, usePiket } from '@/hooks/useSchedule';
import { toLocalMonth } from '@/lib/schedule/rotation';
import { toLocalDateString } from '@/lib/leaves';
import { getInitials } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const SHIFT_GROUPS = [
  { key: '1', label: 'Shift 1', cls: 'bg-yellow-100 text-yellow-800' },
  { key: '2', label: 'Shift 2', cls: 'bg-sky-100 text-sky-800' },
  { key: 'libur', label: 'Libur', cls: 'bg-red-100 text-red-700' },
] as const;

/** Ringkasan jadwal shift & piket HARI INI untuk pemantauan admin. */
export function TodayScheduleOverview() {
  const today = toLocalDateString(new Date());
  const month = toLocalMonth(new Date());
  const { data: sched } = useSchedule(month);
  const { data: piketData } = usePiket(month);

  const groups = useMemo(() => {
    const shiftToday = new Map<string, string>();
    for (const e of sched?.entries ?? []) {
      if (e.date === today) shiftToday.set(e.userId, e.shift);
    }
    const result: Record<string, { id: string; name: string }[]> = { '1': [], '2': [], libur: [] };
    for (const u of sched?.users ?? []) {
      const s = shiftToday.get(u.id);
      if (s && result[s]) result[s].push({ id: u.id, name: u.name });
    }
    return result;
  }, [sched, today]);

  const todayPiket = (piketData?.assignments ?? []).find((a) => a.date === today);

  return (
    <section className="grid gap-4 md:grid-cols-2">
      {/* Jadwal shift hari ini */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4 text-primary" aria-hidden="true" />
              Jadwal Shift Hari Ini
            </CardTitle>
            <Link
              href="/admin/schedule"
              className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Kelola <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {SHIFT_GROUPS.map((g) => (
            <div key={g.key}>
              <div className="mb-1.5 flex items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${g.cls}`}>{g.label}</span>
                <span className="text-xs text-text-secondary">{groups[g.key].length} orang</span>
              </div>
              {groups[g.key].length === 0 ? (
                <p className="text-xs text-text-secondary">—</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {groups[g.key].map((u) => (
                    <span
                      key={u.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-secondary py-0.5 pl-0.5 pr-2.5 text-xs text-text-primary"
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-white">
                        {getInitials(u.name)}
                      </span>
                      {u.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Piket hari ini */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
              Piket Hari Ini
            </CardTitle>
            <Link
              href="/admin/schedule"
              className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Atur <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {todayPiket ? (
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-base font-semibold text-white">
                {getInitials(todayPiket.userName)}
              </span>
              <div className="flex flex-col gap-1">
                <p className="font-medium text-text-primary">{todayPiket.userName}</p>
                {todayPiket.done ? (
                  <Badge variant="success">Sudah piket</Badge>
                ) : (
                  <Badge variant="warning">Belum piket</Badge>
                )}
              </div>
            </div>
          ) : (
            <p className="py-2 text-sm text-text-secondary">Belum ada jadwal piket hari ini</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
