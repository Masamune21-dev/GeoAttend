'use client';

import { useMemo, useState } from 'react';
import { endOfMonth, format, isSameDay, startOfMonth } from 'date-fns';
import { CalendarX2 } from 'lucide-react';
import { useAttendanceList } from '@/hooks/useAttendance';
import type { AttendanceRecordResponse } from '@/types/api';
import { AttendanceCalendar } from '@/components/features/attendance/AttendanceCalendar';
import { AttendanceCard } from '@/components/features/attendance/AttendanceCard';
import { AttendanceDetailDialog } from '@/components/features/attendance/AttendanceDetailDialog';
import { Skeleton } from '@/components/ui/skeleton';

export default function HistoryPage() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [detailRecord, setDetailRecord] = useState<AttendanceRecordResponse | null>(null);

  const { data, isLoading } = useAttendanceList({
    userId: 'self',
    from: startOfMonth(month).toISOString(),
    to: endOfMonth(month).toISOString(),
    limit: 100,
  });

  const records = useMemo(() => data?.data ?? [], [data]);

  const filteredRecords = useMemo(() => {
    if (!selectedDate) return records;
    return records.filter((r) => isSameDay(new Date(r.timestamp), selectedDate));
  }, [records, selectedDate]);

  return (
    <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2">
      <div>
        {isLoading ? (
          <Skeleton className="h-80 w-full" />
        ) : (
          <AttendanceCalendar
            month={month}
            onMonthChange={(m) => {
              setMonth(m);
              setSelectedDate(null);
            }}
            records={records}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        )}
        <div className="mt-3 flex gap-4 text-xs text-text-secondary">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-green-100 ring-1 ring-green-300" /> Dalam area
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm bg-red-100 ring-1 ring-red-300" /> Ada di luar area
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-text-secondary">
          {selectedDate
            ? `Absensi ${format(selectedDate, 'dd/MM/yyyy')}`
            : 'Semua absensi bulan ini'}
        </h2>

        {isLoading ? (
          <>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </>
        ) : filteredRecords.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-subtle">
              <CalendarX2 className="h-7 w-7 text-primary" aria-hidden="true" />
            </span>
            <p className="text-sm text-text-secondary">Belum ada riwayat absensi</p>
          </div>
        ) : (
          filteredRecords.map((record) => (
            <AttendanceCard
              key={record.id}
              record={record}
              showDate={!selectedDate}
              onClick={() => setDetailRecord(record)}
            />
          ))
        )}
      </div>

      <AttendanceDetailDialog record={detailRecord} onClose={() => setDetailRecord(null)} />
    </div>
  );
}
