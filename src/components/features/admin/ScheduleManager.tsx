'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Save, Wand2 } from 'lucide-react';
import type { ScheduleShift, ScheduleUser } from '@/types/api';
import { useSchedule, useSaveSchedule, usePiket, useSavePiket } from '@/hooks/useSchedule';
import { monthDates, generateRotation, generatePiket, toLocalMonth } from '@/lib/schedule/rotation';
import {
  SHIFT_LABEL,
  WEEKDAY_SHORT,
  WEEKDAY_ORDER,
  shiftCellClass,
  monthLabel,
  addMonth,
  weekdayOf,
  isWeekend,
} from '@/lib/schedule/display';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

const GROUP_LABEL: Record<string, string> = { admin: 'Admin & CS', noc: 'NOC' };
const CYCLE: (ScheduleShift | undefined)[] = [undefined, '1', '2', 'libur'];

type GenConfig = { startShift: 1 | 2; off: number[] };

function cellKey(userId: string, date: string) {
  return `${userId}|${date}`;
}

export function ScheduleManager() {
  const [month, setMonth] = useState(() => toLocalMonth(new Date()));
  const { data, isLoading } = useSchedule(month);
  const saveSchedule = useSaveSchedule();
  const { data: piketData } = usePiket(month);
  const savePiket = useSavePiket();

  const [cells, setCells] = useState<Record<string, ScheduleShift>>({});
  const [dirty, setDirty] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [genConfig, setGenConfig] = useState<Record<string, GenConfig>>({});
  const [piket, setPiket] = useState<Record<string, string>>({});
  const [piketDirty, setPiketDirty] = useState(false);

  const dates = useMemo(() => monthDates(month), [month]);
  const users = useMemo(() => data?.users ?? [], [data]);

  // Sinkronkan grid lokal dari server tiap ganti bulan / data baru
  useEffect(() => {
    if (!data) return;
    const next: Record<string, ScheduleShift> = {};
    for (const e of data.entries) next[cellKey(e.userId, e.date)] = e.shift;
    setCells(next);
    setDirty(false);
  }, [data]);

  // Sinkronkan piket lokal dari server
  useEffect(() => {
    if (!piketData) return;
    const next: Record<string, string> = {};
    for (const a of piketData.assignments) next[a.date] = a.userId;
    setPiket(next);
    setPiketDirty(false);
  }, [piketData]);

  const piketDone = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const a of piketData?.assignments ?? []) map[a.date] = a.done;
    return map;
  }, [piketData]);

  const groups = useMemo(() => {
    const map = new Map<string, ScheduleUser[]>();
    for (const u of users) {
      const arr = map.get(u.role) ?? [];
      arr.push(u);
      map.set(u.role, arr);
    }
    return Array.from(map.entries());
  }, [users]);

  const cycleCell = (userId: string, date: string) => {
    setCells((prev) => {
      const key = cellKey(userId, date);
      const idx = CYCLE.indexOf(prev[key]);
      const nextVal = CYCLE[(idx + 1) % CYCLE.length];
      const next = { ...prev };
      if (nextVal) next[key] = nextVal;
      else delete next[key];
      return next;
    });
    setDirty(true);
  };

  const openGenerate = () => {
    const cfg: Record<string, GenConfig> = {};
    for (const u of users) cfg[u.id] = genConfig[u.id] ?? { startShift: 1, off: [0] };
    setGenConfig(cfg);
    setGenOpen(true);
  };

  const applyGenerate = () => {
    setCells((prev) => {
      const next = { ...prev };
      for (const u of users) {
        const cfg = genConfig[u.id] ?? { startShift: 1, off: [0] };
        const rotation = generateRotation(month, cfg.startShift, cfg.off);
        for (const [date, shift] of Object.entries(rotation)) {
          next[cellKey(u.id, date)] = shift;
        }
      }
      return next;
    });
    setDirty(true);
    setGenOpen(false);
    toast.success('Rotasi digenerate — silakan sunting bila perlu, lalu Simpan');
  };

  const handleSave = () => {
    const entries = Object.entries(cells).map(([key, shift]) => {
      const [userId, date] = key.split('|');
      return { userId, date, shift };
    });
    saveSchedule.mutate(
      { month, entries },
      {
        onSuccess: () => {
          toast.success('Jadwal tersimpan');
          setDirty(false);
        },
        onError: (err: Error) => toast.error(err.message || 'Gagal menyimpan jadwal'),
      }
    );
  };

  const generatePiketFn = () => {
    setPiket(generatePiket(month, users.map((u) => u.id)));
    setPiketDirty(true);
    toast.success('Piket digenerate — bisa disunting per hari, lalu Simpan Piket');
  };

  const savePiketFn = () => {
    const assignments = Object.entries(piket)
      .filter(([, userId]) => userId)
      .map(([date, userId]) => ({ date, userId }));
    savePiket.mutate(
      { month, assignments },
      {
        onSuccess: () => {
          toast.success('Jadwal piket tersimpan');
          setPiketDirty(false);
        },
        onError: (err: Error) => toast.error(err.message || 'Gagal menyimpan piket'),
      }
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => setMonth((m) => addMonth(m, -1))} aria-label="Bulan sebelumnya">
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <span className="w-40 text-center text-sm font-semibold text-text-primary">
            {monthLabel(month)}
          </span>
          <Button variant="outline" size="icon" onClick={() => setMonth((m) => addMonth(m, 1))} aria-label="Bulan berikutnya">
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={openGenerate} disabled={users.length === 0}>
            <Wand2 className="h-4 w-4" aria-hidden="true" />
            Generate Rotasi
          </Button>
          <Button onClick={handleSave} isLoading={saveSchedule.isPending} disabled={!dirty}>
            <Save className="h-4 w-4" aria-hidden="true" />
            Simpan
          </Button>
        </div>
      </div>

      <p className="text-xs text-text-secondary">
        Klik sel untuk mengganti: kosong → <span className="font-medium">S1</span> →{' '}
        <span className="font-medium">S2</span> → <span className="font-medium">Libur</span> → kosong.
        Generate Rotasi mengisi otomatis, tetap bisa disunting manual.
      </p>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : users.length === 0 ? (
        <p className="py-10 text-center text-sm text-text-secondary">
          Belum ada karyawan admin/NOC untuk dijadwalkan
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[860px] table-fixed border-collapse text-center text-sm">
            <thead>
              <tr className="bg-secondary">
                <th className="sticky left-0 z-10 w-28 border-b border-r border-border bg-secondary px-3 py-2.5 text-left text-sm font-semibold">
                  Nama
                </th>
                {dates.map((d) => {
                  const day = Number(d.slice(-2));
                  return (
                    <th
                      key={d}
                      className={`border-b border-l border-border/60 px-1 py-2 font-medium ${
                        isWeekend(d) ? 'bg-red-50 text-red-600' : 'text-text-secondary'
                      }`}
                    >
                      <div className="text-sm font-semibold leading-tight">{day}</div>
                      <div className="text-xs font-normal">{WEEKDAY_SHORT[weekdayOf(d)]}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {groups.map(([role, roleUsers]) => (
                <Fragment key={role}>
                  <tr>
                    <td
                      colSpan={dates.length + 1}
                      className="sticky left-0 border-y border-border bg-primary-subtle px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-primary"
                    >
                      {GROUP_LABEL[role] ?? role}
                    </td>
                  </tr>
                  {roleUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-background">
                      <td className="sticky left-0 z-10 w-28 border-b border-r border-border bg-white px-3 py-1.5 text-left text-sm font-medium text-text-primary">
                        {u.name}
                      </td>
                      {dates.map((d) => {
                        const shift = cells[cellKey(u.id, d)];
                        return (
                          <td key={d} className="border-b border-l border-border/50 p-0">
                            <button
                              type="button"
                              onClick={() => cycleCell(u.id, d)}
                              className={`h-10 w-full text-sm font-semibold transition-colors hover:opacity-80 ${shiftCellClass(shift)}`}
                              aria-label={`${u.name} tanggal ${d}: ${shift ? SHIFT_LABEL[shift] : 'kosong'}`}
                            >
                              {shift ? SHIFT_LABEL[shift] : ''}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isLoading && users.length > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-text-primary">Piket Kebersihan</h3>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={generatePiketFn}>
                <Wand2 className="h-4 w-4" aria-hidden="true" /> Generate Piket
              </Button>
              <Button size="sm" onClick={savePiketFn} isLoading={savePiket.isPending} disabled={!piketDirty}>
                <Save className="h-4 w-4" aria-hidden="true" /> Simpan Piket
              </Button>
            </div>
          </div>
          <p className="text-xs text-text-secondary">
            Satu petugas ngepel per hari (bergiliran). Petugas menandai “sudah piket” dari halaman
            Jadwal Saya (ditandai ✓).
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
            {dates.map((d) => (
              <div
                key={d}
                className={`rounded-md border p-1.5 ${
                  isWeekend(d) ? 'border-red-100 bg-red-50/50' : 'border-border'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className={isWeekend(d) ? 'font-medium text-red-600' : 'text-text-secondary'}>
                    {Number(d.slice(-2))} {WEEKDAY_SHORT[weekdayOf(d)]}
                  </span>
                  {piketDone[d] && (
                    <span className="text-green-600" title="Sudah piket" aria-label="Sudah piket">
                      ✓
                    </span>
                  )}
                </div>
                <select
                  value={piket[d] ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    setPiket((p) => ({ ...p, [d]: v }));
                    setPiketDirty(true);
                  }}
                  aria-label={`Petugas piket tanggal ${d}`}
                  className="mt-1 h-8 w-full rounded-sm border border-border bg-white px-1 text-xs"
                >
                  <option value="">—</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={genOpen} onClose={() => setGenOpen(false)} title="Generate Rotasi Mingguan">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-text-secondary">
            Tetapkan shift awal (pekan pertama) & hari libur tiap karyawan. Shift akan berselang
            tiap pekan (oper shift). Hasilnya masih bisa disunting manual.
          </p>
          <div className="max-h-[50vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-text-secondary">
                  <th className="py-1 pr-2 font-medium">Nama</th>
                  <th className="py-1 pr-2 font-medium">Shift awal</th>
                  <th className="py-1 font-medium">Hari libur</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const cfg = genConfig[u.id] ?? { startShift: 1, off: [0] };
                  return (
                    <tr key={u.id} className="border-t border-border/60">
                      <td className="py-1.5 pr-2 font-medium text-text-primary">{u.name}</td>
                      <td className="py-1.5 pr-2">
                        <select
                          value={cfg.startShift}
                          onChange={(e) =>
                            setGenConfig((c) => ({
                              ...c,
                              [u.id]: { ...cfg, startShift: Number(e.target.value) as 1 | 2 },
                            }))
                          }
                          className="h-8 rounded-sm border border-border bg-white px-2 text-sm"
                        >
                          <option value={1}>S1</option>
                          <option value={2}>S2</option>
                        </select>
                      </td>
                      <td className="py-1.5">
                        <div className="flex flex-wrap gap-1">
                          {WEEKDAY_ORDER.map((w) => {
                            const active = cfg.off.includes(w.value);
                            return (
                              <button
                                key={w.value}
                                type="button"
                                onClick={() =>
                                  setGenConfig((c) => {
                                    const off = active
                                      ? cfg.off.filter((v) => v !== w.value)
                                      : [...cfg.off, w.value];
                                    return { ...c, [u.id]: { ...cfg, off } };
                                  })
                                }
                                className={`h-7 w-9 rounded-sm border text-[11px] font-medium transition-colors ${
                                  active
                                    ? 'border-red-300 bg-red-200 text-red-800'
                                    : 'border-border bg-white text-text-secondary hover:bg-secondary'
                                }`}
                              >
                                {w.label}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setGenOpen(false)}>
              Batal
            </Button>
            <Button onClick={applyGenerate}>Terapkan</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
