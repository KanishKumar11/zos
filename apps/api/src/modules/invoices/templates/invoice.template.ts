// Invoice PDF template — Zlaark branded design.
export interface InvoicePdfData {
  agency: { name: string; address?: string; gstin?: string; pan?: string };
  client: { name: string; company?: string; gstin?: string; address?: string };
  number: string;
  issueDate?: Date;
  dueDate?: Date;
  currency: string;
  lineItems: { description: string; qty: number; unitPaise: number; projectName?: string }[];
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
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

// Indian-system rupee amount in words (e.g. "Rupees Eighteen Thousand Only").
const amountToWords = (paise: number): string => {
  const rupees = Math.round(paise / 100);
  if (rupees <= 0) return 'Rupees Zero Only';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (n: number): string =>
    n < 20 ? (ones[n] ?? '') : (tens[Math.floor(n / 10)] ?? '') + (n % 10 ? ' ' + (ones[n % 10] ?? '') : '');
  const three = (n: number): string => {
    const h = Math.floor(n / 100);
    const r = n % 100;
    return (h ? (ones[h] ?? '') + ' Hundred' + (r ? ' ' : '') : '') + (r ? two(r) : '');
  };
  let n = rupees;
  let w = '';
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) w += three(crore) + ' Crore ';
  if (lakh) w += two(lakh) + ' Lakh ';
  if (thousand) w += two(thousand) + ' Thousand ';
  if (n) w += three(n);
  return 'Rupees ' + w.trim().replace(/\s+/g, ' ') + ' Only';
};

// Zlaark logo — SVG inlined with cropped viewBox (0 118 370 134) to show only the logo area.
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 118 370 134" width="185" height="67" preserveAspectRatio="xMinYMid meet"><defs><g/><clipPath id="zlaark_clip"><rect x="0" width="361" y="0" height="134"/></clipPath></defs><g transform="matrix(1, 0, 0, 1, 0, 118)"><g clip-path="url(#zlaark_clip)"><g fill="#f85f00" fill-opacity="1"><g transform="translate(101.258174, 105.834575)"><g><path d="M 5.296875 -79.078125 L 20.234375 -79.078125 L 20.234375 0 L 5.296875 0 Z M 5.296875 -79.078125 "/></g></g></g><g fill="#f85f00" fill-opacity="1"><g transform="translate(125.815584, 105.834575)"><g><path d="M 61.015625 -53.65625 L 61.015625 0 L 48.140625 0 L 46.625 -5.734375 C 44.53125 -2.921875 42.023438 -1.046875 39.109375 -0.109375 C 36.191406 0.828125 33.144531 1.296875 29.96875 1.296875 C 26.144531 1.296875 22.628906 0.554688 19.421875 -0.921875 C 16.210938 -2.398438 13.414062 -4.414062 11.03125 -6.96875 C 8.65625 -9.53125 6.800781 -12.523438 5.46875 -15.953125 C 4.132812 -19.378906 3.46875 -23.039062 3.46875 -26.9375 C 3.46875 -30.832031 4.132812 -34.492188 5.46875 -37.921875 C 6.800781 -41.347656 8.65625 -44.335938 11.03125 -46.890625 C 13.414062 -49.453125 16.210938 -51.472656 19.421875 -52.953125 C 22.628906 -54.429688 26.144531 -55.171875 29.96875 -55.171875 C 33.425781 -55.171875 36.597656 -54.628906 39.484375 -53.546875 C 42.367188 -52.472656 44.75 -50.742188 46.625 -48.359375 L 48.140625 -53.65625 Z M 46.09375 -26.71875 C 46.09375 -29.53125 45.710938 -31.890625 44.953125 -33.796875 C 44.191406 -35.710938 43.179688 -37.265625 41.921875 -38.453125 C 40.660156 -39.648438 39.179688 -40.519531 37.484375 -41.0625 C 35.785156 -41.601562 33.96875 -41.875 32.03125 -41.875 C 30.082031 -41.875 28.257812 -41.472656 26.5625 -40.671875 C 24.863281 -39.878906 23.363281 -38.816406 22.0625 -37.484375 C 20.769531 -36.148438 19.757812 -34.5625 19.03125 -32.71875 C 18.3125 -30.882812 17.953125 -28.957031 17.953125 -26.9375 C 17.953125 -24.84375 18.3125 -22.894531 19.03125 -21.09375 C 19.757812 -19.289062 20.769531 -17.722656 22.0625 -16.390625 C 23.363281 -15.054688 24.863281 -13.992188 26.5625 -13.203125 C 28.257812 -12.410156 30.082031 -12.015625 32.03125 -12.015625 C 35.914062 -12.015625 39.210938 -13.21875 41.921875 -15.625 C 44.628906 -18.039062 46.019531 -21.738281 46.09375 -26.71875 Z M 46.09375 -26.71875 "/></g></g></g><g fill="#f85f00" fill-opacity="1"><g transform="translate(191.590486, 105.834575)"><g><path d="M 61.015625 -53.65625 L 61.015625 0 L 48.140625 0 L 46.625 -5.734375 C 44.53125 -2.921875 42.023438 -1.046875 39.109375 -0.109375 C 36.191406 0.828125 33.144531 1.296875 29.96875 1.296875 C 26.144531 1.296875 22.628906 0.554688 19.421875 -0.921875 C 16.210938 -2.398438 13.414062 -4.414062 11.03125 -6.96875 C 8.65625 -9.53125 6.800781 -12.523438 5.46875 -15.953125 C 4.132812 -19.378906 3.46875 -23.039062 3.46875 -26.9375 C 3.46875 -30.832031 4.132812 -34.492188 5.46875 -37.921875 C 6.800781 -41.347656 8.65625 -44.335938 11.03125 -46.890625 C 13.414062 -49.453125 16.210938 -51.472656 19.421875 -52.953125 C 22.628906 -54.429688 26.144531 -55.171875 29.96875 -55.171875 C 33.425781 -55.171875 36.597656 -54.628906 39.484375 -53.546875 C 42.367188 -52.472656 44.75 -50.742188 46.625 -48.359375 L 48.140625 -53.65625 Z M 46.09375 -26.71875 C 46.09375 -29.53125 45.710938 -31.890625 44.953125 -33.796875 C 44.191406 -35.710938 43.179688 -37.265625 41.921875 -38.453125 C 40.660156 -39.648438 39.179688 -40.519531 37.484375 -41.0625 C 35.785156 -41.601562 33.96875 -41.875 32.03125 -41.875 C 30.082031 -41.875 28.257812 -41.472656 26.5625 -40.671875 C 24.863281 -39.878906 23.363281 -38.816406 22.0625 -37.484375 C 20.769531 -36.148438 19.757812 -34.5625 19.03125 -32.71875 C 18.3125 -30.882812 17.953125 -28.957031 17.953125 -26.9375 C 17.953125 -24.84375 18.3125 -22.894531 19.03125 -21.09375 C 19.757812 -19.289062 20.769531 -17.722656 22.0625 -16.390625 C 23.363281 -15.054688 24.863281 -13.992188 26.5625 -13.203125 C 28.257812 -12.410156 30.082031 -12.015625 32.03125 -12.015625 C 35.914062 -12.015625 39.210938 -13.21875 41.921875 -15.625 C 44.628906 -18.039062 46.019531 -21.738281 46.09375 -26.71875 Z M 46.09375 -26.71875 "/></g></g></g><g fill="#f85f00" fill-opacity="1"><g transform="translate(257.365387, 105.834575)"><g><path d="M 19.578125 -46.203125 C 20.296875 -47.347656 21.125 -48.441406 22.0625 -49.484375 C 23.007812 -50.535156 24.128906 -51.472656 25.421875 -52.296875 C 26.722656 -53.128906 28.203125 -53.796875 29.859375 -54.296875 C 31.515625 -54.804688 33.390625 -55.0625 35.484375 -55.0625 C 37.929688 -55.0625 40.78125 -54.628906 44.03125 -53.765625 L 42.625 -40.46875 C 41.832031 -40.601562 41.039062 -40.78125 40.25 -41 C 39.59375 -41.144531 38.867188 -41.269531 38.078125 -41.375 C 37.285156 -41.488281 36.566406 -41.546875 35.921875 -41.546875 C 33.609375 -41.546875 31.457031 -41.21875 29.46875 -40.5625 C 27.488281 -39.914062 25.773438 -39.015625 24.328125 -37.859375 C 22.890625 -36.710938 21.738281 -35.328125 20.875 -33.703125 C 20.007812 -32.078125 19.578125 -30.328125 19.578125 -28.453125 L 19.578125 0 L 4.65625 0 L 4.65625 -53.65625 L 18.171875 -53.65625 Z M 19.578125 -46.203125 "/></g></g></g><g fill="#f85f00" fill-opacity="1"><g transform="translate(301.936538, 105.834575)"><g><path d="M 34.625 -31.375 L 57.234375 0 L 39.375 0 L 25.203125 -21.421875 L 19.90625 -15.6875 L 19.90625 0 L 4.984375 0 L 4.984375 -78.984375 L 19.90625 -78.984375 L 19.90625 -35.15625 L 37.328125 -53.65625 L 55.5 -53.65625 Z M 34.625 -31.375 "/></g></g></g><path fill="#f85f00" d="M 59.886719 54.808594 C 67.789062 46.933594 75.625 39.121094 83.609375 31.160156 C 87.292969 34.972656 90.949219 38.757812 94.546875 42.480469 C 72.667969 64.363281 50.835938 86.199219 29.113281 107.929688 C 25.417969 104.296875 21.695312 100.632812 17.769531 96.769531 C 31.722656 82.867188 45.773438 68.871094 59.886719 54.808594 Z M 59.886719 54.808594 " fill-opacity="1" fill-rule="nonzero"/><path fill="#f85f00" d="M 48.554688 95.152344 C 48.554688 94.503906 48.554688 93.984375 48.554688 93.390625 C 62.953125 93.390625 77.230469 93.390625 91.621094 93.390625 C 91.621094 98.101562 91.621094 102.835938 91.621094 107.644531 C 77.3125 107.644531 62.992188 107.644531 48.554688 107.644531 C 48.554688 103.472656 48.554688 99.378906 48.554688 95.152344 Z M 48.554688 95.152344 " fill-opacity="1" fill-rule="nonzero"/><path fill="#f85f00" d="M 21 43.222656 C 21 39.433594 21 35.777344 21 32.035156 C 35.339844 32.035156 49.578125 32.035156 63.875 32.035156 C 63.875 36.8125 63.875 41.519531 63.875 46.3125 C 49.644531 46.3125 35.414062 46.3125 21 46.3125 C 21 45.34375 21 44.347656 21 43.222656 Z M 21 43.222656 " fill-opacity="1" fill-rule="nonzero"/></g></g></svg>`;

export function renderInvoiceHtml(data: InvoicePdfData): string {
  const balance = Math.max(0, data.totalPaise - data.paidPaise);
  const isPaid = balance === 0 && data.totalPaise > 0;
  const isPartial = !isPaid && data.paidPaise > 0;
  const statusLabel = isPaid ? 'PAID' : isPartial ? 'PARTIAL' : 'UNPAID';
  const statusColor = isPaid ? '#16a34a' : isPartial ? '#d97706' : '#dc2626';
  const statusBg   = isPaid ? '#dcfce7' : isPartial ? '#fef3c7' : '#fee2e2';

  const itemRow = (li: InvoicePdfData['lineItems'][number]): string => {
    const total = Math.round(li.qty * li.unitPaise);
    return `<tr>
        <td style="padding:11px 16px;color:#374151;font-weight:500;border-bottom:1px solid #f3f4f6">${li.description}</td>
        <td style="padding:11px 16px;text-align:right;color:#6b7280;border-bottom:1px solid #f3f4f6">${li.qty}</td>
        <td style="padding:11px 16px;text-align:right;color:#6b7280;border-bottom:1px solid #f3f4f6">₹${fmtNum(li.unitPaise)}</td>
        <td style="padding:11px 16px;text-align:right;font-weight:700;color:#111827;border-bottom:1px solid #f3f4f6">₹${fmtNum(total)}</td>
      </tr>`;
  };

  // A group header + subtotal row per project, so an invoice covering several
  // projects still reads as one document with clear per-project figures.
  const groupHeaderRow = (name: string): string =>
    `<tr><td colspan="4" style="padding:10px 16px 7px;background:#fffaf6;border-bottom:1px solid #f3f4f6">
      <span style="display:inline-block;width:3px;height:9px;background:#f85f00;border-radius:1px;vertical-align:middle;margin-right:7px"></span>
      <span style="font-size:9px;font-weight:700;color:#9a3412;text-transform:uppercase;letter-spacing:0.12em">${name}</span>
    </td></tr>`;

  const groupSubtotalRow = (paise: number): string =>
    `<tr><td colspan="3" style="padding:7px 16px;text-align:right;font-size:11px;color:#9ca3af;border-bottom:1px solid #f3f4f6">Subtotal</td>
      <td style="padding:7px 16px;text-align:right;font-size:12px;font-weight:700;color:#6b7280;border-bottom:1px solid #f3f4f6">₹${fmtNum(paise)}</td></tr>`;

  // Preserve the caller's line order; only start a new group when the project changes.
  const groups: { name?: string; items: InvoicePdfData['lineItems'] }[] = [];
  for (const li of data.lineItems) {
    const last = groups[groups.length - 1];
    if (last && last.name === li.projectName) last.items.push(li);
    else groups.push({ name: li.projectName, items: [li] });
  }
  const showGroups = new Set(data.lineItems.map((li) => li.projectName ?? '')).size > 1;

  const lineItemsHtml = showGroups
    ? groups
        .map((g) => {
          const rows = g.items.map(itemRow).join('');
          if (!g.name) return rows;
          const subtotal = g.items.reduce((s, li) => s + Math.round(li.qty * li.unitPaise), 0);
          const withSubtotal = g.items.length > 1 ? rows + groupSubtotalRow(subtotal) : rows;
          return groupHeaderRow(g.name) + withSubtotal;
        })
        .join('')
    : data.lineItems.map(itemRow).join('');

  // Only show payment history when it adds information:
  // - multiple payments (shows the breakdown), or
  // - partially paid (shows what's received so far)
  const showPaymentHistory = data.payments && data.payments.length > 0 &&
    (data.payments.length > 1 || !isPaid);
  const paymentsHtml = showPaymentHistory
    ? `<div style="margin-top:24px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
          <div style="width:3px;height:14px;background:#f85f00;border-radius:2px"></div>
          <p style="font-size:9px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.14em">Payment History</p>
          <div style="flex:1;height:1px;background:#f0f0f0"></div>
        </div>
        ${data.payments!
          .map(
            (p) =>
              `<div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;padding:8px 0;border-bottom:1px solid #f5f5f5">
                <span style="color:#6b7280">${fmtDate(p.paidAt)}${p.reference ? ` · ${p.reference}` : ''}${p.method ? ` · ${p.method}` : ''}</span>
                <span style="font-weight:700;color:#16a34a">+₹${fmtNum(p.amountPaise)}</span>
              </div>`,
          )
          .join('')}
      </div>`
    : '';

  const amountWords = amountToWords(data.totalPaise);

  // Small status pill under the amount — adapts to paid / partial / unpaid.
  const heroPill = isPartial
    ? `<div style="display:inline-flex;align-items:center;gap:16px;margin-top:18px;padding:8px 22px;background:white;border-radius:9999px;border:1px solid #e5e7eb">
        <span style="font-size:11px;color:#16a34a;font-weight:600">Paid ₹${fmtNum(data.paidPaise)}</span>
        <span style="width:1px;height:12px;background:#e5e7eb;display:inline-block"></span>
        <span style="font-size:11px;color:#d97706;font-weight:600">Due ₹${fmtNum(balance)}</span>
      </div>`
    : isPaid
    ? `<div style="display:inline-flex;align-items:center;margin-top:18px;padding:7px 20px;background:white;border-radius:9999px;border:1px solid #dcfce7">
        <span style="font-size:11px;color:#16a34a;font-weight:600">Paid in full${data.payments && data.payments.length ? ' · ' + fmtDate(data.payments[data.payments.length - 1]!.paidAt) : ''}</span>
      </div>`
    : `<div style="display:inline-flex;align-items:center;margin-top:18px;padding:7px 20px;background:white;border-radius:9999px;border:1px solid #fde2cf">
        <span style="font-size:11px;color:#9a3412;font-weight:600">${data.dueDate ? 'Due by ' + fmtDate(data.dueDate) : 'Payment due on receipt'}</span>
      </div>`;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@700&display=swap" rel="stylesheet"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; background: white; color: #111827; }
  .amount-num { font-family: 'Space Grotesk', 'Plus Jakarta Sans', sans-serif; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div style="padding:46px 84px 36px;max-width:820px;margin:0 auto">

  <!-- Header: Logo left · Invoice meta right (no heavy rule — breathing room carries it) -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:34px">
    <div style="margin-top:4px">
      ${LOGO_SVG}
    </div>
    <div style="text-align:right">
      <p style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.16em;margin-bottom:7px">Invoice</p>
      <div class="amount-num" style="font-size:23px;font-weight:700;color:#f85f00;letter-spacing:0.02em;margin-bottom:10px">${data.number}</div>
      <!-- Pill badge with status dot -->
      <div style="display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:9999px;background:${statusBg};margin-bottom:10px">
        <span style="font-size:7px;color:${statusColor};line-height:1">●</span>
        <span style="font-size:10px;font-weight:700;color:${statusColor};text-transform:uppercase;letter-spacing:0.08em">${statusLabel}</span>
      </div>
      <div style="font-size:11px;color:#6b7280">Issued <strong style="color:#111827">${fmtDate(data.issueDate)}</strong></div>
      ${data.dueDate ? `<div style="font-size:11px;color:#6b7280;margin-top:3px">Due <strong style="color:#111827">${fmtDate(data.dueDate)}</strong></div>` : ''}
    </div>
  </div>

  <!-- Billing parties: open layout with left accent borders -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:36px">
    <div style="border-left:3px solid #f85f00;padding-left:14px">
      <p style="font-size:9px;font-weight:700;color:#f85f00;text-transform:uppercase;letter-spacing:0.14em;margin-bottom:10px">Billed To</p>
      <p style="font-size:16px;font-weight:700;color:#111827;line-height:1.3">${data.client.company ?? data.client.name}</p>
      ${data.client.company ? `<p style="font-size:12px;color:#6b7280;margin-top:4px">${data.client.name}</p>` : ''}
      ${data.client.address ? `<p style="font-size:11px;color:#6b7280;margin-top:4px;line-height:1.6">${data.client.address}</p>` : ''}
      ${data.client.gstin ? `<p style="font-size:11px;color:#6b7280;font-family:monospace;margin-top:4px">GSTIN: ${data.client.gstin}</p>` : ''}
    </div>
    <div style="border-left:3px solid #e5e7eb;padding-left:14px">
      <p style="font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.14em;margin-bottom:10px">From</p>
      <p style="font-size:16px;font-weight:700;color:#111827;line-height:1.3">${data.agency.name}</p>
      ${data.agency.gstin ? `<p style="font-size:11px;color:#6b7280;font-family:monospace;margin-top:4px">GSTIN: ${data.agency.gstin}</p>` : ''}
      ${data.agency.pan ? `<p style="font-size:11px;color:#6b7280;font-family:monospace;margin-top:4px">PAN: ${data.agency.pan}</p>` : ''}
    </div>
  </div>

  <!-- Amount hero — warm directional glow + ghost ₹ watermark -->
  <div style="position:relative;overflow:hidden;text-align:center;padding:34px 28px;margin-bottom:14px;border-radius:16px;background:radial-gradient(125% 120% at 50% 0%,#ffe2c9 0%,#fff4ec 44%,#ffffff 82%);border:1px solid #f4e7db;box-shadow:inset 0 1px 0 rgba(255,255,255,0.85)">
    <!-- Corner mark — small brand detail -->
    <div style="position:absolute;top:14px;right:16px;display:flex;gap:3px;opacity:0.9">
      <span style="display:inline-block;width:4px;height:4px;border-radius:50%;background:#f85f00;opacity:0.3"></span>
      <span style="display:inline-block;width:4px;height:4px;border-radius:50%;background:#f85f00;opacity:0.6"></span>
      <span style="display:inline-block;width:4px;height:4px;border-radius:50%;background:#f85f00"></span>
    </div>
    <!-- Ghost ₹ watermark -->
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none">
      <span class="amount-num" style="font-size:250px;font-weight:700;color:rgba(248,95,0,0.045);line-height:1;user-select:none;margin-top:18px">₹</span>
    </div>
    <div style="position:relative">
      <p style="font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.18em;margin-bottom:14px">
        ${isPaid ? 'Amount Received' : 'Total Amount'}
      </p>
      <div style="display:flex;align-items:flex-start;justify-content:center;gap:3px">
        <span class="amount-num" style="font-size:32px;font-weight:700;color:#f85f00;margin-top:8px;line-height:1">₹</span>
        <span class="amount-num" style="font-size:82px;font-weight:700;color:#f85f00;line-height:1;letter-spacing:-0.04em">${fmtNum(data.totalPaise)}</span>
      </div>
      ${heroPill}
    </div>
  </div>

  <!-- Amount in words — small functional detail -->
  <div style="display:flex;justify-content:space-between;align-items:center;gap:18px;margin-bottom:30px;padding:11px 18px;border-radius:12px;background:#fafafa;border:1px solid #f0f0f0">
    <span style="font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.14em;white-space:nowrap">In words</span>
    <span style="font-size:12px;font-weight:600;color:#374151;text-align:right;line-height:1.4">${amountWords}</span>
  </div>

  <!-- Line items -->
  <div style="margin-bottom:28px">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:12px">
      <span style="display:inline-block;width:4px;height:4px;background:#f85f00;border-radius:1px"></span>
      <p style="font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.14em">Details</p>
    </div>
    <div style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:#fafafa">
            <th style="padding:10px 16px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;font-weight:700;border-bottom:1px solid #e5e7eb">Description</th>
            <th style="padding:10px 16px;text-align:right;font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;font-weight:700;border-bottom:1px solid #e5e7eb;width:60px">Qty</th>
            <th style="padding:10px 16px;text-align:right;font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;font-weight:700;border-bottom:1px solid #e5e7eb;width:100px">Unit</th>
            <th style="padding:10px 16px;text-align:right;font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;font-weight:700;border-bottom:1px solid #e5e7eb;width:110px">Amount</th>
          </tr>
        </thead>
        <tbody>${lineItemsHtml}</tbody>
        <tfoot>
          ${data.gstPercent ? `<tr><td colspan="3" style="padding:10px 16px;text-align:right;font-size:12px;color:#6b7280">GST (${data.gstPercent}%)</td><td style="padding:10px 16px;text-align:right;font-size:13px;color:#374151">₹${fmtNum(data.gstPaise)}</td></tr>` : ''}
          <tr style="background:#fafafa">
            <td colspan="3" style="padding:12px 16px;text-align:right;font-weight:700;color:#111827;border-top:1px solid #e5e7eb">Total</td>
            <td style="padding:12px 16px;text-align:right;font-size:15px;font-weight:800;color:#111827;border-top:1px solid #e5e7eb">₹${fmtNum(data.totalPaise)}</td>
          </tr>
          ${data.paidPaise > 0 && balance > 0 ? `<tr><td colspan="3" style="padding:9px 16px;text-align:right;font-size:12px;color:#16a34a">Paid</td><td style="padding:9px 16px;text-align:right;font-size:13px;color:#16a34a;font-weight:700">−₹${fmtNum(data.paidPaise)}</td></tr>` : ''}
          ${balance > 0 ? `<tr style="background:#fff8f4"><td colspan="3" style="padding:12px 16px;text-align:right;font-weight:700;color:#f85f00">Balance Due</td><td style="padding:12px 16px;text-align:right;font-size:16px;font-weight:800;color:#f85f00">₹${fmtNum(balance)}</td></tr>` : ''}
        </tfoot>
      </table>
    </div>
  </div>

  ${paymentsHtml}

  ${data.notes ? `
  <div style="margin-top:24px;padding:14px 18px;background:#fafafa;border-radius:12px;border-left:3px solid #f85f00">
    <p style="font-size:9px;font-weight:700;color:#f85f00;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:6px">Notes</p>
    <p style="font-size:12px;color:#6b7280;line-height:1.7">${data.notes}</p>
  </div>` : ''}

  <!-- Footer: signature with orange rail · labelled contact (internship-doc styling) -->
  <div style="margin-top:40px;padding-top:22px;border-top:1px solid #ececec;display:flex;justify-content:space-between;align-items:flex-end">
    <div style="border-left:3px solid #f85f00;padding-left:14px">
      <p style="font-size:15px;font-weight:700;color:#111827">Kanish Kumar</p>
      <p style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.1em;margin-top:3px">Founder, Zlaark</p>
    </div>
    <div style="text-align:right">
      <p style="font-size:12px;color:#374151"><span style="font-weight:700;color:#111827">MAIL</span>&nbsp;&nbsp;<span style="font-weight:700;color:#f85f00">kanish@zlaark.com</span></p>
      <p style="font-size:12px;color:#374151;margin-top:4px"><span style="font-weight:700;color:#111827">TEL</span>&nbsp;&nbsp;+91 75086 70783</p>
      <p style="font-size:9px;color:#c7c7c7;margin-top:11px;letter-spacing:0.04em;text-transform:uppercase">Payment due upon receipt · UPI or Bank Transfer</p>
    </div>
  </div>

</div>
</body>
</html>`;
}
