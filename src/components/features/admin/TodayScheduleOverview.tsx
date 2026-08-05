'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarClock, Sparkles } from 'lucide-react';
import { useSchedule, usePiket } from '@/hooks/useSchedule';
import { toLocalMonth } from '@/lib/schedule/rotation';
import { toLocalDateString } from '@/lib/leaves';
import { ROLE_GROUP_LABEL, ROLE_ORDER } from '@/lib/schedule/roles';
import { getRoleLabel } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const SHIFT_GROUPS = [
  { key: '1', label: 'Shift 1', cls: 'bg-yellow-100 text-yellow-800' },
  { key: '2', label: 'Shift 2', cls: 'bg-sky-100 text-sky-800' },
  { key: 'libur', label: 'Libur', cls: 'bg-red-100 text-red-700' },
] as const;

interface Member {
  id: string;
  name: string;
  image: string | null;
}

/** Satu shift, isinya dipecah per role seperti pengelompokan grid jadwal. */
interface ShiftGroup {
  total: number;
  roles: { role: string; label: string; members: Member[] }[];
}

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
    const result: Record<string, ShiftGroup> = {
      '1': { total: 0, roles: [] },
      '2': { total: 0, roles: [] },
      libur: { total: 0, roles: [] },
    };
    // Peserta dari API sudah urut role lalu nama, jadi urutan anggota dibiarkan
    for (const u of sched?.users ?? []) {
      const shift = shiftToday.get(u.id);
      const group = shift ? result[shift] : undefined;
      if (!group) continue;
      let roleGroup = group.roles.find((r) => r.role === u.role);
      if (!roleGroup) {
        roleGroup = {
          role: u.role,
          label: ROLE_GROUP_LABEL[u.role] ?? getRoleLabel(u.role),
          members: [],
        };
        group.roles.push(roleGroup);
      }
      roleGroup.members.push({ id: u.id, name: u.name, image: u.image });
      group.total += 1;
    }
    // Urutan grup role mengikuti grid jadwal: Admin & CS → NOC → Teknisi
    for (const group of Object.values(result)) {
      group.roles.sort((a, b) => (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99));
    }
    return result;
  }, [sched, today]);

  const todayPiket = (piketData?.assignments ?? []).find((a) => a.date === today);
  const piketUser = piketData?.users.find((u) => u.id === todayPiket?.userId);

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
            <div
              key={g.key}
              className="flex flex-col gap-2 border-t border-border/60 pt-3 first:border-0 first:pt-0"
            >
              <div className="flex items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${g.cls}`}>{g.label}</span>
                <span className="text-xs text-text-secondary">{groups[g.key].total} orang</span>
              </div>
              {groups[g.key].roles.length === 0 ? (
                <p className="text-xs text-text-secondary">—</p>
              ) : (
                groups[g.key].roles.map((r) => (
                  <div key={r.role} className="flex flex-col gap-1 border-l-2 border-border pl-2.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                      {r.label}
                      <span className="ml-1 font-normal normal-case">({r.members.length})</span>
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {r.members.map((u) => (
                        <span
                          key={u.id}
                          className="inline-flex items-center gap-1.5 rounded-full bg-secondary py-0.5 pl-0.5 pr-2.5 text-xs text-text-primary"
                        >
                          <Avatar
                            src={u.image}
                            name={u.name}
                            className="h-5 w-5"
                            textClassName="text-[10px]"
                          />
                          {u.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
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
              <Avatar
                src={piketUser?.image}
                name={todayPiket.userName}
                className="h-11 w-11"
                textClassName="text-base"
                preview
              />
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
