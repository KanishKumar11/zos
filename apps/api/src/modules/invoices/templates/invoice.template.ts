// Invoice PDF template — matches Zlaark branded ReceiptTemplate design.
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
  payments?: { paidAt: Date; amountPaise: number; reference?: string; method?: string }[];
}

const fmtNum = (paise: number): string => {
  const v = paise / 100;
  return v.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const fmtDate = (d?: Date) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export function renderInvoiceHtml(data: InvoicePdfData): string {
  const balance = Math.max(0, data.totalPaise - data.paidPaise);
  const isPaid = balance === 0 && data.totalPaise > 0;
  const statusLabel = isPaid ? 'PAID' : balance === data.totalPaise ? 'UNPAID' : 'PARTIALLY PAID';
  const statusColor = isPaid ? '#16a34a' : '#ea580c';
  const statusBg = isPaid ? '#dcfce7' : '#fff7ed';

  const lineItemsHtml = data.lineItems
    .map((li) => {
      const total = Math.round(li.qty * li.unitPaise);
      return `<tr>
        <td style="padding:12px 16px;color:#4b5563;font-weight:500;border-bottom:1px solid #f3f4f6">${li.description}</td>
        <td style="padding:12px 16px;text-align:right;color:#4b5563;border-bottom:1px solid #f3f4f6">${li.qty}</td>
        <td style="padding:12px 16px;text-align:right;color:#4b5563;border-bottom:1px solid #f3f4f6">₹${fmtNum(li.unitPaise)}</td>
        <td style="padding:12px 16px;text-align:right;font-weight:700;color:#111827;border-bottom:1px solid #f3f4f6">₹${fmtNum(total)}</td>
      </tr>`;
    })
    .join('');

  const paymentsHtml =
    data.payments && data.payments.length > 0
      ? `<div style="margin-top:24px">
          <p style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 12px">Payment History</p>
          ${data.payments
            .map(
              (p) =>
                `<div style="display:flex;justify-content:space-between;font-size:12px;padding:6px 0;border-bottom:1px solid #f3f4f6">
                  <span style="color:#6b7280">${fmtDate(p.paidAt)}${p.reference ? ` · ${p.reference}` : ''}${p.method ? ` · ${p.method}` : ''}</span>
                  <span style="font-weight:700;color:#16a34a">+₹${fmtNum(p.amountPaise)}</span>
                </div>`,
            )
            .join('')}
        </div>`
      : '';

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; background: white; color: #111827; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
<div style="padding:40px;max-width:800px;margin:0 auto;position:relative">

  <!-- Top gradient bar -->
  <div style="position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(to right,#fb923c,#ec4899,#a855f7)"></div>

  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;padding-top:20px;margin-bottom:40px;padding-bottom:32px;border-bottom:1px solid #f3f4f6">
    <div>
      <p style="font-size:11px;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">Zlaark Agency</p>
      <p style="font-size:10px;color:#6b7280">Software &amp; Design Services</p>
    </div>
    <div style="text-align:right">
      <h1 style="font-size:36px;font-weight:900;color:#111827;text-transform:uppercase;letter-spacing:-0.02em;margin-bottom:8px">INVOICE</h1>
      <div style="display:inline-flex;align-items:center;gap:8px;padding:4px 12px;border-radius:9999px;background:${statusBg};margin-bottom:8px">
        <span style="font-size:10px;font-weight:700;color:${statusColor};text-transform:uppercase;letter-spacing:0.06em">${statusLabel}</span>
      </div>
      <div style="font-size:11px;color:#6b7280;margin-top:4px">Ref No. <strong style="color:#111827;font-family:monospace">${data.number}</strong></div>
      <div style="font-size:11px;color:#6b7280;margin-top:2px">Date <strong style="color:#111827">${fmtDate(data.issueDate)}</strong></div>
      ${data.dueDate ? `<div style="font-size:11px;color:#6b7280;margin-top:2px">Due <strong style="color:#111827">${fmtDate(data.dueDate)}</strong></div>` : ''}
    </div>
  </div>

  <!-- Amount panel -->
  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:16px;padding:32px;margin-bottom:24px">
    <div style="text-align:center;margin-bottom:32px">
      <p style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:12px">
        ${isPaid ? 'Amount Received' : 'Total Amount'}
      </p>
      <div style="display:flex;align-items:flex-start;justify-content:center;gap:4px">
        <span style="font-size:28px;font-weight:500;color:#111827;margin-top:6px">₹</span>
        <span style="font-size:72px;font-weight:900;color:#111827;line-height:1;letter-spacing:-0.03em">${fmtNum(data.totalPaise)}</span>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;padding-top:24px;border-top:1px solid #e5e7eb">
      <div>
        <p style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px">Billed To</p>
        <p style="font-size:15px;font-weight:700;color:#111827">${data.client.company ?? data.client.name}</p>
        ${data.client.company ? `<p style="font-size:12px;color:#6b7280;margin-top:2px">${data.client.name}</p>` : ''}
        ${data.client.address ? `<p style="font-size:11px;color:#6b7280;margin-top:2px">${data.client.address}</p>` : ''}
        ${data.client.gstin ? `<p style="font-size:11px;color:#6b7280;font-family:monospace;margin-top:2px">GSTIN: ${data.client.gstin}</p>` : ''}
      </div>
      <div>
        <p style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px">Issued By</p>
        <p style="font-size:15px;font-weight:700;color:#111827">${data.agency.name}</p>
        <p style="font-size:12px;color:#6b7280;margin-top:2px">Software Services</p>
        ${data.agency.gstin ? `<p style="font-size:11px;color:#6b7280;font-family:monospace;margin-top:2px">GSTIN: ${data.agency.gstin}</p>` : ''}
      </div>
    </div>
  </div>

  <!-- Line items -->
  <div style="margin-bottom:24px">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
      <span style="width:24px;height:1px;background:#d1d5db"></span>
      <p style="font-size:10px;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:0.12em">Details</p>
      <div style="flex:1;height:1px;background:#d1d5db"></div>
    </div>

    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:#f3f4f6;border-bottom:1px solid #e5e7eb">
            <th style="padding:10px 16px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#6b7280;font-weight:700">Description</th>
            <th style="padding:10px 16px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#6b7280;font-weight:700;width:60px">Qty</th>
            <th style="padding:10px 16px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#6b7280;font-weight:700;width:100px">Unit</th>
            <th style="padding:10px 16px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#6b7280;font-weight:700;width:100px">Amount</th>
          </tr>
        </thead>
        <tbody>${lineItemsHtml}</tbody>
        <tfoot>
          ${data.gstPercent ? `<tr style="background:#f9fafb"><td colspan="3" style="padding:10px 16px;text-align:right;font-size:12px;color:#6b7280">GST (${data.gstPercent}%)</td><td style="padding:10px 16px;text-align:right;font-size:13px;color:#111827">₹${fmtNum(data.gstPaise)}</td></tr>` : ''}
          <tr style="background:#f3f4f6">
            <td colspan="3" style="padding:12px 16px;text-align:right;font-weight:700;color:#111827">Total</td>
            <td style="padding:12px 16px;text-align:right;font-size:15px;font-weight:900;color:#111827">₹${fmtNum(data.totalPaise)}</td>
          </tr>
          ${data.paidPaise > 0 ? `<tr><td colspan="3" style="padding:10px 16px;text-align:right;font-size:12px;color:#16a34a">Paid</td><td style="padding:10px 16px;text-align:right;font-size:13px;color:#16a34a;font-weight:700">−₹${fmtNum(data.paidPaise)}</td></tr>` : ''}
          ${balance > 0 ? `<tr style="background:#fff7ed"><td colspan="3" style="padding:12px 16px;text-align:right;font-weight:700;color:#ea580c">Balance Due</td><td style="padding:12px 16px;text-align:right;font-size:15px;font-weight:900;color:#ea580c">₹${fmtNum(balance)}</td></tr>` : ''}
        </tfoot>
      </table>
    </div>
  </div>

  ${paymentsHtml}

  ${data.notes ? `<p style="font-size:11px;color:#9ca3af;margin-top:16px">${data.notes}</p>` : ''}

  <!-- Footer -->
  <div style="margin-top:40px;padding-top:24px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:flex-end">
    <div>
      <p style="font-size:14px;font-weight:700;color:#111827">Kanish Kumar</p>
      <p style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;margin-top:2px">Founder, Zlaark</p>
    </div>
    <div style="text-align:right">
      <p style="font-size:10px;color:#9ca3af;margin-bottom:4px">Need help?</p>
      <p style="font-size:12px;font-weight:700;color:#ea580c">kanish@zlaark.com</p>
      <p style="font-size:10px;color:#9ca3af;font-family:monospace;margin-top:2px">+91 75086 70783</p>
    </div>
  </div>

  <div style="margin-top:24px;text-align:center">
    <p style="font-size:9px;color:#9ca3af">Payment due upon receipt. Please pay via UPI or Bank Transfer.</p>
  </div>

</div>
</body>
</html>`;
}
