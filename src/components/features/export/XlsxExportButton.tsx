'use client';

import { useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { downloadXlsx, type XlsxSheet } from '@/lib/export/xlsx';
import { Button, type ButtonProps } from '@/components/ui/button';

interface XlsxExportButtonProps {
  /** Nama berkas tanpa/dengan akhiran `.xlsx`. */
  filename: string;
  /** Dipanggil saat diklik — data terbaru, dan ExcelJS baru dimuat di sini. */
  build: () => XlsxSheet[];
  label?: string;
  size?: ButtonProps['size'];
}

/** Tombol ekspor Excel bersama (rekap absensi, inventaris gudang, dst). */
export function XlsxExportButton({
  filename,
  build,
  label = 'Excel',
  size = 'sm',
}: XlsxExportButtonProps) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    try {
      const sheets = build();
      if (sheets.every((s) => s.cells.length === 0)) {
        toast.warning('Tidak ada data untuk diekspor');
        return;
      }
      await downloadXlsx(filename, sheets);
      toast.success('Excel berhasil diunduh');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal membuat berkas Excel');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="outline" size={size} onClick={handleClick} isLoading={busy}>
      {!busy && <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />}
      {busy ? 'Menyiapkan…' : label}
    </Button>
  );
}
