'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Clock, Save } from 'lucide-react';
import { useShifts } from '@/hooks/useAttendance';
import { DEFAULT_SHIFTS, WORK_ROLES } from '@/lib/constants';
import { getRoleLabel } from '@/lib/utils';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface ShiftRow {
  role: string;
  shiftNumber: number;
  startTime: string;
  endTime: string;
}

/**
 * Form pengaturan jam kerja SOP per role.
 * Admin & NOC: 2 shift, Teknisi: 1 shift.
 */
export function ShiftSettingsForm() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useShifts();

  const [shifts, setShifts] = useState<ShiftRow[]>([...DEFAULT_SHIFTS]);

  useEffect(() => {
    if (data?.data && data.data.length > 0) {
      setShifts(
        data.data.map((s) => ({
          role: s.role,
          shiftNumber: s.shiftNumber,
          startTime: s.startTime,
          endTime: s.endTime,
        }))
      );
    }
  }, [data]);

  const shiftsByRole = useMemo(() => {
    const map = new Map<string, ShiftRow[]>();
    for (const role of WORK_ROLES) {
      map.set(
        role,
        shifts
          .filter((s) => s.role === role)
          .sort((a, b) => a.shiftNumber - b.shiftNumber)
      );
    }
    return map;
  }, [shifts]);

  const updateShift = (role: string, shiftNumber: number, field: 'startTime' | 'endTime', value: string) => {
    setShifts((prev) =>
      prev.map((s) =>
        s.role === role && s.shiftNumber === shiftNumber ? { ...s, [field]: value } : s
      )
    );
  };

  const hasInvalidRange = shifts.some((s) => s.startTime >= s.endTime);

  const saveMutation = useMutation({
    mutationFn: async (input: ShiftRow[]) => {
      const res = await fetch('/api/shifts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shifts: input }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? 'Gagal menyimpan jam kerja');
      return body;
    },
    onSuccess: () => {
      toast.success('Jam kerja SOP tersimpan');
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return <Skeleton className="h-72 w-full" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" aria-hidden="true" />
          Jam Kerja SOP per Role
        </CardTitle>
        <CardDescription>
          Dasar perhitungan rekap: datang lebih awal / pulang lebih larut dihitung lembur,
          datang setelah jam masuk dihitung telat. Shift ditentukan otomatis dari jam masuk
          terdekat.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {WORK_ROLES.map((role) => (
          <fieldset key={role} className="rounded-md border border-border p-3">
            <legend className="px-1 text-sm font-semibold text-text-primary">
              {getRoleLabel(role)}
            </legend>
            <div className="flex flex-col gap-3">
              {(shiftsByRole.get(role) ?? []).map((shift) => (
                <div
                  key={`${shift.role}-${shift.shiftNumber}`}
                  className="grid grid-cols-[auto_1fr_1fr] items-center gap-3"
                >
                  <span className="w-14 text-sm text-text-secondary">
                    Shift {shift.shiftNumber}
                  </span>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`${role}-${shift.shiftNumber}-start`} className="text-xs">
                      Jam Masuk
                    </Label>
                    <Input
                      id={`${role}-${shift.shiftNumber}-start`}
                      type="time"
                      value={shift.startTime}
                      onChange={(e) =>
                        updateShift(role, shift.shiftNumber, 'startTime', e.target.value)
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`${role}-${shift.shiftNumber}-end`} className="text-xs">
                      Jam Pulang
                    </Label>
                    <Input
                      id={`${role}-${shift.shiftNumber}-end`}
                      type="time"
                      value={shift.endTime}
                      onChange={(e) =>
                        updateShift(role, shift.shiftNumber, 'endTime', e.target.value)
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </fieldset>
        ))}

        {hasInvalidRange && (
          <Alert variant="destructive">
            Jam masuk harus lebih awal dari jam pulang pada setiap shift
          </Alert>
        )}

        <Button
          className="self-start"
          onClick={() => saveMutation.mutate(shifts)}
          disabled={hasInvalidRange}
          isLoading={saveMutation.isPending}
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          Simpan Jam Kerja
        </Button>
      </CardContent>
    </Card>
  );
}
