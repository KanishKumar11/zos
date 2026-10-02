// CSV export — builds a UTF-8 (with BOM, so Excel shows ₹ correctly) file and downloads it.

type Cell = string | number | boolean | null | undefined | Date;

const escape = (v: Cell): string => {
  if (v === null || v === undefined) return '';
  const s = v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(headers: string[], rows: Cell[][]): string {
  return [headers, ...rows].map((r) => r.map(escape).join(',')).join('\r\n');
}

export function downloadCsv(filename: string, headers: string[], rows: Cell[][]): void {
  const blob = new Blob(['﻿' + toCsv(headers, rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Money for spreadsheets: plain rupees with 2 decimals, no symbol or grouping. */
export const csvMoney = (paise: number | undefined | null): string =>
  paise === undefined || paise === null ? '' : (paise / 100).toFixed(2);
