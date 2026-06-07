// Inline HTML template for payslip — kept here to avoid filesystem reads at runtime.
// Numbers expected pre-formatted by caller (paise → rupees).
export interface PayslipPdfData {
  agency: { name: string; address?: string; gstin?: string; logoUrl?: string };
  employee: { name: string; email: string; designation?: string; department?: string; bankLast4?: string };
  month: string;
  workingDays: number;
  presentDays: number;
  lopDays: number;
  currency: string;
  lines: { label: string; value: number; kind: 'earning' | 'deduction' }[];
  grossPaise: number;
  deductionsPaise: number;
  netPaise: number;
}

const fmt = (paise: number, currency: string): string => {
  const v = paise / 100;
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(v);
  } catch {
    return `${currency} ${v.toFixed(2)}`;
  }
};

export function renderPayslipHtml(data: PayslipPdfData): string {
  const earnings = data.lines.filter((l) => l.kind === 'earning');
  const deductions = data.lines.filter((l) => l.kind === 'deduction');
  const row = (l: { label: string; value: number }) =>
    `<tr><td>${l.label}</td><td style="text-align:right">${fmt(l.value, data.currency)}</td></tr>`;
  return `<!doctype html><html><head><meta charset="utf-8"/>
<style>
  *{box-sizing:border-box}
  body{font:13px/1.4 -apple-system,Segoe UI,Inter,sans-serif;color:#111;margin:0}
  .wrap{padding:32px}
  h1{font-size:22px;margin:0 0 4px}
  .muted{color:#666;font-size:12px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:24px 0}
  .card{border:1px solid #e5e7eb;border-radius:8px;padding:16px}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  td{padding:6px 0;border-bottom:1px solid #f1f5f9}
  .totals{margin-top:24px;display:grid;grid-template-columns:1fr 1fr;gap:16px}
  .net{background:#f0fdf4;border:1px solid #bbf7d0;padding:16px;border-radius:8px;font-size:16px;font-weight:600}
  h3{margin:0 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:.04em;color:#475569}
</style></head><body><div class="wrap">
  <h1>${data.agency.name}</h1>
  <div class="muted">${data.agency.address ?? ''}${data.agency.gstin ? ' · GSTIN ' + data.agency.gstin : ''}</div>
  <div class="grid">
    <div class="card">
      <h3>Team Member</h3>
      <div><strong>${data.employee.name}</strong></div>
      <div class="muted">${data.employee.designation ?? ''}${data.employee.department ? ' · ' + data.employee.department : ''}</div>
      <div class="muted">${data.employee.email}</div>
      ${data.employee.bankLast4 ? `<div class="muted">A/c ••••${data.employee.bankLast4}</div>` : ''}
    </div>
    <div class="card">
      <h3>Pay period</h3>
      <div><strong>${data.month}</strong></div>
      <div class="muted">Working days: ${data.workingDays}</div>
      <div class="muted">Present: ${data.presentDays} · LOP: ${data.lopDays}</div>
    </div>
  </div>
  <div class="grid">
    <div class="card"><h3>Earnings</h3><table>${earnings.map(row).join('')}</table></div>
    <div class="card"><h3>Deductions</h3><table>${deductions.map(row).join('')}</table></div>
  </div>
  <div class="totals">
    <div class="card">Gross: <strong>${fmt(data.grossPaise, data.currency)}</strong></div>
    <div class="net">Net Pay: ${fmt(data.netPaise, data.currency)}</div>
  </div>
  <p class="muted" style="margin-top:32px">This is a computer-generated payslip and does not require a signature.</p>
</div></body></html>`;
}
