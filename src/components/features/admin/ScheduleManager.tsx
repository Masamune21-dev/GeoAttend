'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Droplets, Save, Users, Wand2 } from 'lucide-react';
import type { ScheduleShift, ScheduleUser, TechnicianTeam } from '@/types/api';
import {
  useSchedule,
  useSaveSchedule,
  usePiket,
  useSavePiket,
  useScheduleParticipants,
  useSaveScheduleParticipants,
  useSetTechnicianTeam,
} from '@/hooks/useSchedule';
import {
  monthDates,
  generateRotation,
  generateOffDaysOnly,
  generatePiket,
  toLocalMonth,
} from '@/lib/schedule/rotation';
import {
  SHIFT_LABEL,
  WEEKDAY_SHORT,
  WEEKDAY_ORDER,
  shiftCellClass,
  monthLabel,
  addMonth,
  weekdayOf,
  isWeekend,
  isMoppingDay,
  MOPPING_LABEL,
} from '@/lib/schedule/display';
import { ROLE_GROUP_LABEL, shiftCycleForRole } from '@/lib/schedule/roles';
import { TEAM_LABEL } from '@/lib/schedule/teams';
import { getRoleLabel } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

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
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const participantsQuery = useScheduleParticipants(participantsOpen);
  const saveParticipants = useSaveScheduleParticipants();
  const setTeam = useSetTechnicianTeam();

  const dates = useMemo(() => monthDates(month), [month]);
  const users = useMemo(() => data?.users ?? [], [data]);
  const technicians = useMemo(() => users.filter((u) => u.role === 'teknisi'), [users]);

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

  // Siklus sel mengikuti role: teknisi hanya S1 ↔ Libur (tidak punya Shift 2)
  const cycleCell = (userId: string, date: string, role: string) => {
    const cycle = shiftCycleForRole(role);
    setCells((prev) => {
      const key = cellKey(userId, date);
      const idx = cycle.indexOf(prev[key]);
      const nextVal = cycle[(idx + 1) % cycle.length];
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
        // Teknisi tidak beroper shift — yang digenerate hanya hari liburnya
        const rotation =
          u.role === 'teknisi'
            ? generateOffDaysOnly(month, cfg.off)
            : generateRotation(month, cfg.startShift, cfg.off);
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

  const openParticipants = () => {
    setSelectedIds(new Set(users.map((u) => u.id)));
    setParticipantsOpen(true);
  };

  // Selaraskan centang dengan data server saat dialog dibuka
  useEffect(() => {
    if (participantsQuery.data) {
      setSelectedIds(new Set(participantsQuery.data.participantIds));
    }
  }, [participantsQuery.data]);

  const toggleParticipant = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const saveParticipantsFn = () => {
    saveParticipants.mutate(
      { userIds: Array.from(selectedIds) },
      {
        onSuccess: () => {
          toast.success('Peserta jadwal diperbarui');
          setParticipantsOpen(false);
        },
        onError: (err: Error) => toast.error(err.message || 'Gagal menyimpan peserta'),
      }
    );
  };

  const changeTeam = (u: ScheduleUser, team: TechnicianTeam | null) => {
    setTeam.mutate(
      { userId: u.id, team },
      {
        onSuccess: () =>
          toast.success(
            team ? `${u.name} masuk ${TEAM_LABEL[team]}` : `${u.name} dikeluarkan dari tim`
          ),
        onError: (err: Error) => toast.error(err.message || 'Gagal menyimpan tim'),
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
          <Button variant="outline" onClick={openParticipants}>
            <Users className="h-4 w-4" aria-hidden="true" />
            Kelola Peserta
          </Button>
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
        Teknisi hanya <span className="font-medium">S1</span> →{' '}
        <span className="font-medium">Libur</span> (jadwalnya menentukan hari libur saja).
        Pakai <span className="font-medium">Kelola Peserta</span> untuk menambah atau mengeluarkan
        karyawan dari grid.
      </p>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : users.length === 0 ? (
        <p className="py-10 text-center text-sm text-text-secondary">
          Belum ada peserta jadwal — klik <span className="font-medium">Kelola Peserta</span> untuk
          menambahkan karyawan
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
                      {ROLE_GROUP_LABEL[role] ?? getRoleLabel(role)}
                    </td>
                  </tr>
                  {roleUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-background">
                      <td className="sticky left-0 z-10 w-28 border-b border-r border-border bg-white px-3 py-1.5 text-left text-sm font-medium text-text-primary">
                        {u.name}
                        {u.technicianTeam && (
                          <span className="block text-[11px] font-normal text-text-secondary">
                            {TEAM_LABEL[u.technicianTeam]}
                          </span>
                        )}
                      </td>
                      {dates.map((d) => {
                        const shift = cells[cellKey(u.id, d)];
                        return (
                          <td key={d} className="border-b border-l border-border/50 p-0">
                            <button
                              type="button"
                              onClick={() => cycleCell(u.id, d, u.role)}
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
            Satu petugas per hari (bergiliran). Setiap{' '}
            <span className="font-medium text-green-700">Sabtu</span> petugasnya{' '}
            <span className="font-medium text-green-700">wajib mengepel</span> — ditandai hijau.
            Petugas menandai “sudah piket” dari halaman Jadwal Saya (ditandai ✓).
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
            {dates.map((d) => {
              const mopping = isMoppingDay(d);
              return (
              <div
                key={d}
                className={`rounded-md border p-1.5 ${
                  mopping
                    ? 'border-green-300 bg-green-50'
                    : isWeekend(d)
                      ? 'border-red-100 bg-red-50/50'
                      : 'border-border'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span
                    className={
                      mopping
                        ? 'font-semibold text-green-700'
                        : isWeekend(d)
                          ? 'font-medium text-red-600'
                          : 'text-text-secondary'
                    }
                  >
                    {Number(d.slice(-2))} {WEEKDAY_SHORT[weekdayOf(d)]}
                  </span>
                  {piketDone[d] && (
                    <span className="text-green-600" title="Sudah piket" aria-label="Sudah piket">
                      ✓
                    </span>
                  )}
                </div>
                {mopping && (
                  <div className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-green-700">
                    <Droplets className="h-3 w-3" aria-hidden="true" />
                    {MOPPING_LABEL}
                  </div>
                )}
                <Select
                  value={piket[d] ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    setPiket((p) => ({ ...p, [d]: v }));
                    setPiketDirty(true);
                  }}
                  aria-label={`Petugas piket tanggal ${d}`}
                  className="mt-1 h-8 rounded-sm pl-2 pr-7 text-xs md:text-xs"
                >
                  <option value="">—</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </Select>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tim jaga lembur malam untuk teknisi */}
      {!isLoading && technicians.length > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold text-text-primary">Tim Jaga Malam Teknisi</h3>
          <p className="text-xs text-text-secondary">
            Saat ada gangguan malam hari, tim yang siaga lembur ditentukan oleh tanggal:{' '}
            <span className="font-medium">Tim Ganjil</span> pada tanggal ganjil (1, 3, 5, …),{' '}
            <span className="font-medium">Tim Genap</span> pada tanggal genap (2, 4, 6, …).
            Teknisi melihat statusnya di halaman Jadwal Saya.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {technicians.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border p-2"
              >
                <span className="truncate text-sm font-medium text-text-primary">{u.name}</span>
                <Select
                  value={u.technicianTeam ?? ''}
                  onChange={(e) =>
                    changeTeam(u, (e.target.value || null) as TechnicianTeam | null)
                  }
                  disabled={setTeam.isPending}
                  aria-label={`Tim jaga ${u.name}`}
                  className="h-8 w-auto rounded-sm pl-2 pr-7 text-xs md:text-xs"
                >
                  <option value="">— belum ada tim —</option>
                  <option value="ganjil">Tim Ganjil</option>
                  <option value="genap">Tim Genap</option>
                </Select>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-text-secondary">
            {(['ganjil', 'genap'] as const).map((team) => {
              const members = technicians.filter((u) => u.technicianTeam === team);
              return (
                <span key={team} className="flex items-center gap-1.5">
                  <Badge variant={team === 'ganjil' ? 'default' : 'secondary'}>
                    {TEAM_LABEL[team]}
                  </Badge>
                  {members.length > 0
                    ? members.map((m) => m.name).join(', ')
                    : 'belum ada anggota'}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Kelola peserta grid jadwal */}
      <Dialog
        open={participantsOpen}
        onClose={() => setParticipantsOpen(false)}
        title="Kelola Peserta Jadwal"
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-text-secondary">
            Centang karyawan yang muncul di grid jadwal shift dan menjadi kandidat piket.
            Karyawan yang dikeluarkan tidak lagi muncul di grid, tetapi jadwal yang sudah
            tersimpan tetap ada.
          </p>

          {participantsQuery.isLoading ? (
            <Skeleton className="h-56 w-full" />
          ) : (
            <div className="max-h-[50vh] overflow-y-auto rounded-md border border-border">
              {(participantsQuery.data?.candidates ?? []).map((c, index, arr) => {
                const showHeader = index === 0 || arr[index - 1].role !== c.role;
                return (
                  <Fragment key={c.id}>
                    {showHeader && (
                      <div className="bg-secondary px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-text-secondary">
                        {ROLE_GROUP_LABEL[c.role] ?? getRoleLabel(c.role)}
                      </div>
                    )}
                    <label className="flex cursor-pointer items-center gap-2.5 border-b border-border/50 px-3 py-2 text-sm last:border-0 hover:bg-background">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(c.id)}
                        onChange={() => toggleParticipant(c.id)}
                        className="h-4 w-4 accent-primary"
                      />
                      <span className="font-medium text-text-primary">{c.name}</span>
                      {c.technicianTeam && (
                        <Badge variant="secondary">{TEAM_LABEL[c.technicianTeam]}</Badge>
                      )}
                    </label>
                  </Fragment>
                );
              })}
              {(participantsQuery.data?.candidates ?? []).length === 0 && (
                <p className="p-4 text-center text-sm text-text-secondary">
                  Belum ada karyawan selain administrator
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-text-secondary">{selectedIds.size} dipilih</span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setParticipantsOpen(false)}>
                Batal
              </Button>
              <Button onClick={saveParticipantsFn} isLoading={saveParticipants.isPending}>
                Simpan Peserta
              </Button>
            </div>
          </div>
        </div>
      </Dialog>

      <Dialog open={genOpen} onClose={() => setGenOpen(false)} title="Generate Rotasi Mingguan">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-text-secondary">
            Tetapkan shift awal (pekan pertama) & hari libur tiap karyawan. Shift akan berselang
            tiap pekan (oper shift). Teknisi tidak beroper shift — yang diisi hanya hari liburnya.
            Hasilnya masih bisa disunting manual.
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
                        {u.role === 'teknisi' ? (
                          <span className="text-xs text-text-secondary">S1 (tetap)</span>
                        ) : (
                          <Select
                            value={cfg.startShift}
                            aria-label={`Shift awal ${u.name}`}
                            onChange={(e) =>
                              setGenConfig((c) => ({
                                ...c,
                                [u.id]: { ...cfg, startShift: Number(e.target.value) as 1 | 2 },
                              }))
                            }
                            className="h-8 w-auto rounded-sm pl-2 pr-7"
                          >
                            <option value={1}>S1</option>
                            <option value={2}>S2</option>
                          </Select>
                        )}
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
