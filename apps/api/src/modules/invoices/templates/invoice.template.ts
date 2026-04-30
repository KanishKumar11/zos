// Inline HTML template for invoices.
export interface InvoicePdfData {
  agency: { name: string; address?: string; gstin?: string; pan?: string };
  client: { name: string; company?: string; gstin?: string; address?: string };
  number: string;
  issueDate?: Date;
  dueDate?: Date;
  currency: string;
  lineItems: { description: string; qty: number; unitPaise: number }[];
  subTotalPaise: number;
  gstPercent: number;
  gstPaise: number;
  totalPaise: number;
  paidPaise: number;
  notes?: string;
}

const fmt = (paise: number, currency: string): string => {
  const v = paise / 100;
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(v);
  } catch {
    return `${currency} ${v.toFixed(2)}`;
  }
};
const date = (d?: Date) => (d ? new Date(d).toISOString().slice(0, 10) : '—');

export function renderInvoiceHtml(data: InvoicePdfData): string {
  const balance = data.totalPaise - data.paidPaise;
  return `<!doctype html><html><head><meta charset="utf-8"/>
<style>
  *{box-sizing:border-box}
  body{font:13px/1.4 -apple-system,Segoe UI,Inter,sans-serif;color:#111;margin:0}
  .wrap{padding:32px}
  .head{display:flex;justify-content:space-between;align-items:start;margin-bottom:24px}
  h1{margin:0;font-size:28px;letter-spacing:.05em}
  .muted{color:#666;font-size:12px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:16px 0}
  .card{border:1px solid #e5e7eb;border-radius:8px;padding:16px}
  table{width:100%;border-collapse:collapse;margin-top:16px}
  th,td{padding:10px;text-align:left;border-bottom:1px solid #e5e7eb;font-size:12px}
  th{background:#f8fafc;text-transform:uppercase;letter-spacing:.04em;color:#475569;font-weight:600}
  .right{text-align:right}
  .totals{margin-top:16px;margin-left:auto;width:300px}
  .totals .row{display:flex;justify-content:space-between;padding:6px 0}
  .totals .total{border-top:2px solid #111;font-weight:700;font-size:15px;padding-top:10px;margin-top:8px}
  .due{background:#fef3c7;border:1px solid #fde68a;padding:12px;border-radius:6px;margin-top:16px;text-align:right;font-weight:600}
</style></head><body><div class="wrap">
  <div class="head">
    <div>
      <h1>INVOICE</h1>
      <div class="muted">#${data.number}</div>
    </div>
    <div style="text-align:right">
      <strong>${data.agency.name}</strong>
      <div class="muted">${data.agency.address ?? ''}</div>
      ${data.agency.gstin ? `<div class="muted">GSTIN ${data.agency.gstin}</div>` : ''}
      ${data.agency.pan ? `<div class="muted">PAN ${data.agency.pan}</div>` : ''}
    </div>
  </div>
  <div class="grid">
    <div class="card">
      <div class="muted">Bill To</div>
      <strong>${data.client.company ?? data.client.name}</strong>
      ${data.client.company ? `<div>${data.client.name}</div>` : ''}
      ${data.client.address ? `<div class="muted">${data.client.address}</div>` : ''}
      ${data.client.gstin ? `<div class="muted">GSTIN ${data.client.gstin}</div>` : ''}
    </div>
    <div class="card">
      <div class="row"><span class="muted">Issued:</span> <strong>${date(data.issueDate)}</strong></div>
      <div class="row"><span class="muted">Due:</span> <strong>${date(data.dueDate)}</strong></div>
      <div class="row"><span class="muted">Currency:</span> ${data.currency}</div>
    </div>
  </div>
  <table>
    <thead><tr><th>Description</th><th class="right">Qty</th><th class="right">Unit</th><th class="right">Amount</th></tr></thead>
    <tbody>
      ${data.lineItems
        .map(
          (li) =>
            `<tr><td>${li.description}</td><td class="right">${li.qty}</td><td class="right">${fmt(li.unitPaise, data.currency)}</td><td class="right">${fmt(li.qty * li.unitPaise, data.currency)}</td></tr>`,
        )
        .join('')}
    </tbody>
  </table>
  <div class="totals">
    <div class="row"><span>Subtotal</span><span>${fmt(data.subTotalPaise, data.currency)}</span></div>
    ${data.gstPercent ? `<div class="row"><span>GST (${data.gstPercent}%)</span><span>${fmt(data.gstPaise, data.currency)}</span></div>` : ''}
    <div class="row total"><span>Total</span><span>${fmt(data.totalPaise, data.currency)}</span></div>
    ${data.paidPaise ? `<div class="row"><span>Paid</span><span>− ${fmt(data.paidPaise, data.currency)}</span></div>` : ''}
  </div>
  ${balance > 0 ? `<div class="due">Balance Due: ${fmt(balance, data.currency)}</div>` : ''}
  ${data.notes ? `<p class="muted" style="margin-top:24px">${data.notes}</p>` : ''}
</div></body></html>`;
}
