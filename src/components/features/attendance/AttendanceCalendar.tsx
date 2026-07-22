'use client';

import { useMemo } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isAfter,
  isSameDay,
  isSameMonth,
  startOfMonth,
} from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { AttendanceRecordResponse } from '@/types/api';
import { cn } from '@/lib/utils';

const WEEKDAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

interface AttendanceCalendarProps {
  month: Date;
  onMonthChange: (month: Date) => void;
  records: AttendanceRecordResponse[];
  selectedDate: Date | null;
  onSelectDate: (date: Date | null) => void;
}

export function AttendanceCalendar({
  month,
  onMonthChange,
  records,
  selectedDate,
  onSelectDate,
}: AttendanceCalendarProps) {
  const today = new Date();

  const days = useMemo(
    () => eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) }),
    [month]
  );

  const recordsByDay = useMemo(() => {
    const map = new Map<string, AttendanceRecordResponse[]>();
    for (const record of records) {
      const key = format(new Date(record.timestamp), 'yyyy-MM-dd');
      const list = map.get(key) ?? [];
      list.push(record);
      map.set(key, list);
    }
    return map;
  }, [records]);

  const leadingBlanks = getDay(startOfMonth(month));

  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onMonthChange(addMonths(month, -1))}
          aria-label="Bulan sebelumnya"
          className="rounded-md p-1.5 text-text-secondary hover:bg-secondary"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="font-semibold capitalize text-text-primary">
          {format(month, 'MMMM yyyy', { locale: localeId })}
        </p>
        <button
          type="button"
          onClick={() => onMonthChange(addMonths(month, 1))}
          aria-label="Bulan berikutnya"
          disabled={isSameMonth(month, today) || isAfter(month, today)}
          className="rounded-md p-1.5 text-text-secondary hover:bg-secondary disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="py-1 text-xs font-medium text-text-secondary">
            {label}
          </span>
        ))}

        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <span key={`blank-${i}`} />
        ))}

        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const dayRecords = recordsByDay.get(key);
          const hasOutside = dayRecords?.some((r) => !r.isWithinGeofence);
          const isFuture = isAfter(day, today);
          const isSelected = selectedDate !== null && isSameDay(day, selectedDate);

          return (
            <button
              key={key}
              type="button"
              disabled={isFuture}
              onClick={() => onSelectDate(isSelected ? null : day)}
              aria-pressed={isSelected}
              aria-label={`${format(day, 'dd MMMM', { locale: localeId })}${
                dayRecords ? `, ${dayRecords.length} absensi` : ', tidak ada absensi'
              }`}
              className={cn(
                'flex aspect-square items-center justify-center rounded-md text-sm transition-colors',
                isFuture && 'cursor-not-allowed text-slate-300',
                !isFuture && !dayRecords && 'text-text-secondary hover:bg-secondary',
                dayRecords && !hasOutside && 'bg-green-100 font-medium text-green-700 hover:bg-green-200',
                dayRecords && hasOutside && 'bg-red-100 font-medium text-red-700 hover:bg-red-200',
                isSelected && 'ring-2 ring-primary ring-offset-1',
                isSameDay(day, today) && 'font-bold'
              )}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}
