import { appDateOf, appTimeOf } from '@/lib/time';

/**
 * Penulis berkas Excel (.xlsx) untuk seluruh ekspor web.
 *
 * ExcelJS diimpor dinamis (±1 MB) supaya tidak membebani bundel awal — sama
 * seperti jsPDF pada ekspor PDF. Definisi sheet dibuat lewat `xlsxSheet()`
 * agar tiap kolom tetap terikat pada tipe barisnya; hasilnya matriks sel yang
 * sudah "pipih", sehingga satu berkas bisa memuat beberapa sheet dengan tipe
 * data berbeda.
 */

export type XlsxCell = string | number | Date | null;

export type XlsxAlign = 'left' | 'center' | 'right';

export interface XlsxColumn<T> {
  header: string;
  value: (row: T) => XlsxCell;
  /** Lebar kolom dalam satuan karakter (default 16). */
  width?: number;
  align?: XlsxAlign;
  /** Format sel Excel, mis. `XLSX_DATE_FMT` atau `'#,##0'`. */
  numFmt?: string;
}

export interface XlsxSheetInput<T> {
  /** Nama tab — dibersihkan dari karakter terlarang & dipotong ke 31 huruf. */
  name: string;
  /** Judul besar di baris pertama (opsional). */
  title?: string;
  /** Keterangan kecil di bawah judul (opsional). */
  subtitle?: string;
  columns: XlsxColumn<T>[];
  rows: T[];
}

/** Sheet siap tulis: datanya sudah dipipihkan sehingga tipe barisnya lepas. */
export interface XlsxSheet {
  name: string;
  title?: string;
  subtitle?: string;
  columns: { header: string; width: number; align: XlsxAlign; numFmt?: string }[];
  cells: XlsxCell[][];
}

/** Format tanggal Excel, mengikuti kebiasaan Indonesia. */
export const XLSX_DATE_FMT = 'dd/mm/yyyy';
export const XLSX_DATETIME_FMT = 'dd/mm/yyyy hh:mm';

const DEFAULT_WIDTH = 16;
const HEADER_FILL = 'FF2563EB'; // biru primer, sama dengan header tabel PDF
const HEADER_TEXT = 'FFFFFFFF';
const TITLE_TEXT = 'FF0F172A';
const SUBTITLE_TEXT = 'FF64748B';
const BORDER_COLOR = 'FFCBD5E1';
/** Sel kosong ditulis "-", seragam dengan tampilan tabel web, CSV, dan PDF. */
const EMPTY_CELL = '-';

/** Excel menolak `[ ] : * ? / \` pada nama sheet dan membatasinya 31 huruf. */
function safeSheetName(name: string): string {
  return name.replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31) || 'Sheet1';
}

/** Bangun definisi sheet — kolom terikat tipe `T`, hasilnya sudah dipipihkan. */
export function xlsxSheet<T>({
  name,
  title,
  subtitle,
  columns,
  rows,
}: XlsxSheetInput<T>): XlsxSheet {
  return {
    name: safeSheetName(name),
    title,
    subtitle,
    columns: columns.map((c) => ({
      header: c.header,
      width: c.width ?? DEFAULT_WIDTH,
      align: c.align ?? 'left',
      numFmt: c.numFmt,
    })),
    cells: rows.map((row) => columns.map((c) => c.value(row))),
  };
}

/**
 * Sel tanggal-jam dari waktu ISO.
 *
 * Excel menyimpan tanggal sebagai serial berbasis UTC, jadi jam dinding WIB
 * digeser dulu ke komponen UTC agar yang muncul di Excel sama dengan yang
 * tampil di web — server produksi berjalan pada TZ UTC.
 */
export function xlsxWibDateTime(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return new Date(`${appDateOf(at)}T${appTimeOf(at)}:00Z`);
}

/** Sel tanggal dari string "yyyy-MM-dd" (sudah menurut WIB). */
export function xlsxDate(date: string | null | undefined): Date | null {
  if (!date) return null;
  const at = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(at.getTime()) ? null : at;
}

type ExcelJsModule = typeof import('exceljs');

/** ExcelJS terbit sebagai CommonJS/UMD — sebagian bundler menaruhnya di `default`. */
async function loadExcelJs(): Promise<ExcelJsModule> {
  const mod = (await import('exceljs')) as ExcelJsModule & { default?: ExcelJsModule };
  return mod.default ?? mod;
}

function addSheet(workbook: import('exceljs').Workbook, sheet: XlsxSheet): void {
  const ws = workbook.addWorksheet(sheet.name);
  const lastCol = Math.max(1, sheet.columns.length);
  ws.columns = sheet.columns.map((c) => ({ width: c.width }));

  const banner = (text: string, style: { size: number; bold?: boolean; color: string }) => {
    const row = ws.addRow([text]);
    if (lastCol > 1) ws.mergeCells(row.number, 1, row.number, lastCol);
    row.getCell(1).font = { bold: style.bold, size: style.size, color: { argb: style.color } };
    row.height = style.size + 8;
  };

  if (sheet.title) banner(sheet.title, { size: 14, bold: true, color: TITLE_TEXT });
  if (sheet.subtitle) banner(sheet.subtitle, { size: 10, color: SUBTITLE_TEXT });
  if (sheet.title || sheet.subtitle) ws.addRow([]);

  const border = {
    top: { style: 'thin' as const, color: { argb: BORDER_COLOR } },
    left: { style: 'thin' as const, color: { argb: BORDER_COLOR } },
    bottom: { style: 'thin' as const, color: { argb: BORDER_COLOR } },
    right: { style: 'thin' as const, color: { argb: BORDER_COLOR } },
  };

  const headerRow = ws.addRow(sheet.columns.map((c) => c.header));
  // Judul kolom dibungkus; tinggi baris ditaksir dari kolom yang paling sempit
  // dibanding panjang judulnya supaya tidak ada teks header yang terpotong.
  const headerLines = sheet.columns.reduce(
    (max, c) => Math.max(max, Math.ceil(c.header.length / Math.max(6, c.width))),
    1
  );
  headerRow.height = 15 * headerLines + 7;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_TEXT } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = border;
  });

  for (const cells of sheet.cells) {
    const row = ws.addRow(cells.map((v) => v ?? EMPTY_CELL));
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const spec = sheet.columns[colNumber - 1];
      cell.alignment = { horizontal: spec?.align ?? 'left', vertical: 'middle' };
      cell.border = border;
      // Format angka/tanggal hanya berlaku bila selnya memang bukan "-"
      if (spec?.numFmt && cell.value !== EMPTY_CELL) cell.numFmt = spec.numFmt;
    });
  }

  // Header ikut menempel saat digulir + bisa langsung disaring/diurut di Excel
  ws.views = [{ state: 'frozen', ySplit: headerRow.number }];
  ws.autoFilter = {
    from: { row: headerRow.number, column: 1 },
    to: { row: headerRow.number + sheet.cells.length, column: lastCol },
  };
}

/**
 * Rakit workbook menjadi buffer .xlsx (ZIP OOXML).
 *
 * ExcelJS mengembalikan `Buffer`-nya sendiri (dideklarasikan `extends
 * ArrayBuffer`); isinya sah sebagai bagian Blob maupun masukan `xlsx.load`.
 */
export async function buildXlsxBuffer(sheets: XlsxSheet[]): Promise<ArrayBuffer> {
  const { Workbook } = await loadExcelJs();
  const workbook = new Workbook();
  workbook.creator = 'GeoAttend';
  workbook.created = new Date();
  for (const sheet of sheets) addSheet(workbook, sheet);
  return workbook.xlsx.writeBuffer();
}

/** Rakit lalu unduh berkas .xlsx di browser. */
export async function downloadXlsx(filename: string, sheets: XlsxSheet[]): Promise<void> {
  const buffer = await buildXlsxBuffer(sheets);
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}
