import { describe, expect, it } from 'vitest';
import { Workbook } from 'exceljs';
import {
  buildXlsxBuffer,
  xlsxDate,
  xlsxSheet,
  xlsxWibDateTime,
  XLSX_DATETIME_FMT,
} from '@/lib/export/xlsx';

interface Row {
  name: string;
  minutes: number;
  date: string;
  note: string | null;
}

const rows: Row[] = [
  { name: 'Budi', minutes: 123, date: '2026-07-01', note: 'oke' },
  { name: 'Siti', minutes: 0, date: '2026-07-02', note: null },
];

const sheet = xlsxSheet<Row>({
  name: 'Detail Harian',
  title: 'Rekap Absensi — Juli 2026',
  subtitle: 'Semua Karyawan',
  rows,
  columns: [
    { header: 'Nama', value: (r) => r.name },
    { header: 'Telat (menit)', align: 'right', value: (r) => r.minutes },
    { header: 'Tanggal', value: (r) => xlsxDate(r.date) },
    { header: 'Catatan', value: (r) => r.note },
  ],
});

/** Baca ulang buffer hasil ekspor supaya yang diuji benar-benar berkas xlsx. */
async function reopen(buffer: ArrayBuffer): Promise<Workbook> {
  const wb = new Workbook();
  await wb.xlsx.load(buffer);
  return wb;
}

describe('xlsxSheet', () => {
  it('memipihkan baris sesuai urutan kolom', () => {
    expect(sheet.cells).toEqual([
      ['Budi', 123, xlsxDate('2026-07-01'), 'oke'],
      ['Siti', 0, xlsxDate('2026-07-02'), null],
    ]);
  });

  it('membersihkan karakter terlarang & memotong nama sheet ke 31 huruf', () => {
    expect(xlsxSheet({ name: 'Rekap[2026]:Juli/Agustus', columns: [], rows: [] }).name).toBe(
      'Rekap 2026  Juli Agustus'
    );
    expect(xlsxSheet({ name: 'x'.repeat(40), columns: [], rows: [] }).name).toHaveLength(31);
    expect(xlsxSheet({ name: '  ', columns: [], rows: [] }).name).toBe('Sheet1');
  });
});

describe('buildXlsxBuffer', () => {
  it('menulis judul, header, dan data pada posisi yang benar', async () => {
    const wb = await reopen(await buildXlsxBuffer([sheet]));
    const ws = wb.getWorksheet('Detail Harian');
    expect(ws).toBeDefined();

    // baris 1 judul, 2 subjudul, 3 kosong, 4 header, data mulai baris 5
    expect(ws!.getCell('A1').value).toBe('Rekap Absensi — Juli 2026');
    expect(ws!.getCell('A2').value).toBe('Semua Karyawan');
    expect(ws!.getRow(4).values).toEqual([
      undefined,
      'Nama',
      'Telat (menit)',
      'Tanggal',
      'Catatan',
    ]);
    expect(ws!.getCell('A5').value).toBe('Budi');
    expect(ws!.getCell('B5').value).toBe(123);
    expect(ws!.getRow(4).getCell(1).font?.bold).toBe(true);
    expect(ws!.views[0]).toMatchObject({ state: 'frozen', ySplit: 4 });
  });

  it('menulis angka sebagai angka dan sel kosong sebagai "-"', async () => {
    const wb = await reopen(await buildXlsxBuffer([sheet]));
    const ws = wb.getWorksheet('Detail Harian')!;
    expect(ws.getCell('B6').value).toBe(0);
    expect(ws.getCell('D6').value).toBe('-');
  });

  it('menulis tanggal sebagai tanggal Excel yang bisa dibaca ulang', async () => {
    const wb = await reopen(await buildXlsxBuffer([sheet]));
    const cell = wb.getWorksheet('Detail Harian')!.getCell('C5');
    expect(cell.value).toBeInstanceOf(Date);
    expect((cell.value as Date).toISOString()).toBe('2026-07-01T00:00:00.000Z');
  });

  it('memuat beberapa sheet dengan tipe baris berbeda', async () => {
    const other = xlsxSheet<{ total: number }>({
      name: 'Ringkasan',
      rows: [{ total: 7 }],
      columns: [{ header: 'Total', value: (r) => r.total }],
    });
    const wb = await reopen(await buildXlsxBuffer([sheet, other]));
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Detail Harian', 'Ringkasan']);
    // Tanpa judul/subjudul, header langsung di baris 1
    expect(wb.getWorksheet('Ringkasan')!.getCell('A1').value).toBe('Total');
    expect(wb.getWorksheet('Ringkasan')!.getCell('A2').value).toBe(7);
  });
});

describe('xlsxWibDateTime', () => {
  it('menggeser waktu UTC ke jam dinding WIB', async () => {
    // 2026-07-01T22:30Z = 2 Juli 05:30 WIB
    const at = xlsxWibDateTime('2026-07-01T22:30:00.000Z');
    expect(at?.toISOString()).toBe('2026-07-02T05:30:00.000Z');
  });

  it('mengembalikan null untuk masukan kosong atau tak sah', () => {
    expect(xlsxWibDateTime(null)).toBeNull();
    expect(xlsxWibDateTime('bukan tanggal')).toBeNull();
    expect(xlsxDate(null)).toBeNull();
  });

  it('tampil sebagai jam WIB setelah ditulis ke xlsx', async () => {
    const s = xlsxSheet<{ at: string }>({
      name: 'Inventaris',
      rows: [{ at: '2026-07-01T22:30:00.000Z' }],
      columns: [
        { header: 'Pergerakan Terakhir', numFmt: XLSX_DATETIME_FMT, value: (r) => xlsxWibDateTime(r.at) },
      ],
    });
    const wb = await reopen(await buildXlsxBuffer([s]));
    const cell = wb.getWorksheet('Inventaris')!.getCell('A2');
    // Excel menyimpan serial berbasis UTC → jam yang tampil = 05:30 WIB
    expect((cell.value as Date).toISOString()).toBe('2026-07-02T05:30:00.000Z');
    expect(cell.numFmt).toBe(XLSX_DATETIME_FMT);
  });
});
