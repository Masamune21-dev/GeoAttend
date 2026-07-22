'use client';

import { Download } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import type { AttendanceRecordResponse } from '@/types/api';
import { Button } from '@/components/ui/button';

interface ExportButtonProps {
  records: AttendanceRecordResponse[];
  filename?: string;
}

/** Ekspor daftar absensi ke file CSV (dipisah titik koma, kompatibel Excel ID). */
export function ExportButton({ records, filename }: ExportButtonProps) {
  const handleExport = () => {
    if (records.length === 0) {
      toast.warning('Tidak ada data untuk diekspor');
      return;
    }

    const header = [
      'Nama',
      'Tipe',
      'Tanggal',
      'Jam',
      'Latitude',
      'Longitude',
      'Dalam Area',
      'Jarak (m)',
      'Catatan',
    ];

    const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;

    const rows = records.map((r) => {
      const date = new Date(r.timestamp);
      return [
        escapeCsv(r.userName),
        r.type === 'clock_in' ? 'Masuk' : 'Pulang',
        format(date, 'dd/MM/yyyy'),
        format(date, 'HH:mm'),
        String(r.latitude),
        String(r.longitude),
        r.isWithinGeofence ? 'Ya' : 'Tidak',
        String(Math.round(r.distanceFromCenter)),
        escapeCsv(r.notes ?? ''),
      ].join(';');
    });

    const csv = '﻿' + [header.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename ?? `absensi_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('CSV berhasil diunduh');
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport}>
      <Download className="h-4 w-4" aria-hidden="true" />
      Ekspor CSV
    </Button>
  );
}
