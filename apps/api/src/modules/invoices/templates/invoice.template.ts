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

/**
 * Remittance details for the "Pay To" block. Fill these in to switch the block on.
 * An empty field hides its own row; with every field empty the block is omitted
 * entirely, so a half-configured template can never print partial payment details.
 */
const PAY_TO = {
  upi: '7508670783@kotak811',
  accountName: 'Kanish Kumar',
  accountNumber: '0847279942',
  ifsc: 'KKBK0004001',
  bank: 'Kotak Mahindra Bank',
  branch: 'Amritsar — East Mohan Nagar',
};

/**
 * Editorial-luxury palette. Warm paper ground and espresso ink rather than the
 * cool blue-greys of a default UI kit — the document should read as printed
 * stationery, not as a screenshot of a web page.
 */
const C = {
  paper: '#FDFBF7',
  card: '#FFFFFF',
  ink: '#1A1614',
  inkMid: '#6B625C',
  inkSoft: '#A79C93',
  hair: 'rgba(26,22,20,0.09)',
  hairSoft: 'rgba(26,22,20,0.055)',
  brand: '#F85F00',
  brandInk: '#9A3412',
  brandWash: '#FFF6EF',
  brandHair: 'rgba(248,95,0,0.16)',
};

/** Micro-label: the small-caps eyebrow used for every section and field label. */
const MICRO = 'font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.18em';

/** Keeps a section from being split across a page break (headings, cards, rows). */
const NOBREAK = 'page-break-inside:avoid;break-inside:avoid';

/** Paper tooth — a fixed, non-interactive grain wash so flat fills read as stock. */
const GRAIN =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'>" +
  "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/></filter>" +
  "<rect width='180' height='180' filter='url(%23n)'/></svg>";

export function renderInvoiceHtml(data: InvoicePdfData): string {
  const balance = Math.max(0, data.totalPaise - data.paidPaise);
  const isPaid = balance === 0 && data.totalPaise > 0;
  const isPartial = !isPaid && data.paidPaise > 0;

  const status = isPaid
    ? { label: 'Paid', fg: '#2F7A45', bg: '#F1F7F2', ring: 'rgba(47,122,69,0.20)' }
    : isPartial
      ? { label: 'Partial', fg: '#A76A16', bg: '#FDF6EA', ring: 'rgba(167,106,22,0.20)' }
      : { label: 'Unpaid', fg: '#B3402C', bg: '#FDF0EC', ring: 'rgba(179,64,44,0.20)' };

  const itemRow = (li: InvoicePdfData['lineItems'][number]): string => {
    const total = Math.round(li.qty * li.unitPaise);
    const cell = `padding:13px 20px;border-bottom:1px solid ${C.hairSoft}`;
    return `<tr style="${NOBREAK}">
        <td style="${cell};color:${C.ink};font-weight:500">${li.description}</td>
        <td style="${cell};text-align:right;color:${C.inkSoft};font-variant-numeric:tabular-nums">${li.qty}</td>
        <td style="${cell};text-align:right;color:${C.inkMid};font-variant-numeric:tabular-nums">₹${fmtNum(li.unitPaise)}</td>
        <td style="${cell};text-align:right;font-weight:700;color:${C.ink};font-variant-numeric:tabular-nums">₹${fmtNum(total)}</td>
      </tr>`;
  };

  // A group header + subtotal row per project, so an invoice covering several
  // projects still reads as one document with clear per-project figures.
  const groupHeaderRow = (name: string): string =>
    `<tr><td colspan="4" style="padding:12px 20px 8px;background:${C.brandWash};border-bottom:1px solid ${C.hairSoft}">
      <span style="display:inline-block;width:3px;height:9px;background:${C.brand};border-radius:1px;vertical-align:middle;margin-right:8px"></span>
      <span style="${MICRO};color:${C.brandInk}">${name}</span>
    </td></tr>`;

  const groupSubtotalRow = (paise: number): string =>
    `<tr><td colspan="3" style="padding:8px 20px;text-align:right;font-size:11px;color:${C.inkSoft};border-bottom:1px solid ${C.hairSoft}">Subtotal</td>
      <td style="padding:8px 20px;text-align:right;font-size:12px;font-weight:700;color:${C.inkMid};border-bottom:1px solid ${C.hairSoft};font-variant-numeric:tabular-nums">₹${fmtNum(paise)}</td></tr>`;

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

  /** Section eyebrow — a tick of brand colour, the label, then a hairline to the edge. */
  const eyebrow = (label: string): string =>
    `<div style="display:flex;align-items:center;gap:9px;margin-bottom:13px">
      <span style="display:inline-block;width:3px;height:11px;background:${C.brand};border-radius:1px"></span>
      <p style="${MICRO};color:${C.inkSoft}">${label}</p>
      <span style="flex:1;height:1px;background:${C.hairSoft}"></span>
    </div>`;

  // Only show payment history when it adds information:
  // - multiple payments (shows the breakdown), or
  // - partially paid (shows what's received so far)
  const showPaymentHistory =
    data.payments && data.payments.length > 0 && (data.payments.length > 1 || !isPaid);
  const paymentsHtml = showPaymentHistory
    ? `<div style="margin-top:22px;${NOBREAK}">
        ${eyebrow('Payment History')}
        ${data.payments!
          .map(
            (p) =>
              `<div style="display:flex;justify-content:space-between;align-items:center;font-size:11.5px;padding:8px 0;border-bottom:1px solid ${C.hairSoft}">
                <span style="color:${C.inkMid}">${fmtDate(p.paidAt)}${p.reference ? ` · ${p.reference}` : ''}${p.method ? ` · ${p.method}` : ''}</span>
                <span style="font-weight:700;color:#2F7A45;font-variant-numeric:tabular-nums">+₹${fmtNum(p.amountPaise)}</span>
              </div>`,
          )
          .join('')}
      </div>`
    : '';

  // "Pay To" — shown only while a balance is outstanding and details are configured.
  const payToRows: [string, string][] = (
    [
      ['UPI', PAY_TO.upi],
      ['Account', PAY_TO.accountName],
      ['A/C No.', PAY_TO.accountNumber],
      ['IFSC', PAY_TO.ifsc],
      ['Bank', PAY_TO.bank],
      ['Branch', PAY_TO.branch],
      ['Reference', data.number],
    ] as [string, string][]
  ).filter(([, value]) => Boolean(value));
  const hasPayToDetails = payToRows.some(([label]) => label !== 'Reference');

  /** Secondary panel — double-bezel shell so it sits in the page rather than on it. */
  const panel = (label: string, inner: string): string =>
    `<div style="flex:1;padding:5px;border-radius:20px;background:${C.brandWash};box-shadow:inset 0 0 0 1px ${C.brandHair};${NOBREAK}">
      <div style="height:100%;padding:15px 17px;border-radius:15px;background:${C.card};box-shadow:inset 0 0 0 1px ${C.hairSoft}">
        <p style="${MICRO};color:${C.brand};margin-bottom:11px">${label}</p>
        ${inner}
      </div>
    </div>`;

  const payToHtml =
    balance > 0 && hasPayToDetails
      ? panel(
          'Pay To',
          `<table style="width:100%;border-collapse:collapse">
            ${payToRows
              .map(
                ([label, value]) =>
                  `<tr>
                    <td style="padding:4px 0;width:74px;${MICRO};color:${C.inkSoft};vertical-align:top;letter-spacing:0.12em">${label}</td>
                    <td style="padding:4px 0;font-size:11.5px;font-weight:600;color:${C.ink};font-variant-numeric:tabular-nums">${value}</td>
                  </tr>`,
              )
              .join('')}
          </table>`,
        )
      : '';

  const notesHtml = data.notes
    ? panel(
        'Notes',
        `<p style="font-size:11px;color:${C.inkMid};line-height:1.75">${data.notes}</p>`,
      )
    : '';

  const closingHtml =
    payToHtml || notesHtml
      ? `<div style="display:flex;gap:14px;align-items:stretch;margin-top:22px">${payToHtml}${notesHtml}</div>`
      : '';

  const amountWords = amountToWords(data.totalPaise);

  // Right-hand note inside the amount card — adapts to paid / partial / unpaid.
  const heroPill = isPartial
    ? `<div style="display:inline-flex;align-items:center;gap:14px;padding:7px 18px;background:${C.card};border-radius:9999px;box-shadow:inset 0 0 0 1px ${C.hair}">
        <span style="font-size:10.5px;color:#2F7A45;font-weight:600;font-variant-numeric:tabular-nums">Paid ₹${fmtNum(data.paidPaise)}</span>
        <span style="width:1px;height:11px;background:${C.hair};display:inline-block"></span>
        <span style="font-size:10.5px;color:#A76A16;font-weight:600;font-variant-numeric:tabular-nums">Due ₹${fmtNum(balance)}</span>
      </div>`
    : isPaid
      ? `<div style="display:inline-flex;align-items:center;padding:7px 18px;background:${C.card};border-radius:9999px;box-shadow:inset 0 0 0 1px rgba(47,122,69,0.22)">
        <span style="font-size:10.5px;color:#2F7A45;font-weight:600">Paid in full${data.payments && data.payments.length ? ' · ' + fmtDate(data.payments[data.payments.length - 1]!.paidAt) : ''}</span>
      </div>`
      : `<div style="display:inline-flex;align-items:center;padding:7px 18px;background:${C.card};border-radius:9999px;box-shadow:inset 0 0 0 1px ${C.brandHair}">
        <span style="font-size:10.5px;color:${C.brandInk};font-weight:600">${data.dueDate ? 'Due by ' + fmtDate(data.dueDate) : 'Payment due on receipt'}</span>
      </div>`;

  const party = (
    label: string,
    accent: string,
    name: string,
    lines: (string | undefined)[],
  ): string =>
    `<div style="flex:1;border-left:2px solid ${accent};padding-left:15px">
      <p style="${MICRO};color:${accent === C.brand ? C.brand : C.inkSoft};margin-bottom:9px">${label}</p>
      <p style="font-size:15px;font-weight:700;color:${C.ink};line-height:1.3">${name}</p>
      ${lines
        .filter(Boolean)
        .map(
          (l) =>
            `<p style="font-size:10.5px;color:${C.inkMid};margin-top:4px;line-height:1.6">${l}</p>`,
        )
        .join('')}
    </div>`;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet"/>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Plus Jakarta Sans', 'Segoe UI', sans-serif;
    background: ${C.paper};
    color: ${C.ink};
    -webkit-font-smoothing: antialiased;
  }
  .display { font-family: 'Instrument Serif', 'Georgia', 'Times New Roman', serif; font-weight: 400; }
  .grain {
    position: fixed; inset: 0; pointer-events: none; z-index: 2;
    opacity: 0.032; background-image: url("${GRAIN}"); background-size: 180px 180px;
  }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="grain"></div>
<div style="position:relative;z-index:1;padding:44px 62px 30px;max-width:820px;margin:0 auto">

  <!-- Masthead: logo · invoice meta, closed by a hairline rule -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start">
    <div style="margin-top:2px">${LOGO_SVG}</div>
    <div style="text-align:right">
      <p style="${MICRO};color:${C.inkSoft};margin-bottom:8px">Invoice</p>
      <div style="font-size:19px;font-weight:800;color:${C.ink};letter-spacing:0.06em;font-variant-numeric:tabular-nums;margin-bottom:11px">${data.number}</div>
      <div style="display:inline-flex;align-items:center;gap:6px;padding:5px 13px;border-radius:9999px;background:${status.bg};box-shadow:inset 0 0 0 1px ${status.ring}">
        <span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:${status.fg}"></span>
        <span style="${MICRO};color:${status.fg};letter-spacing:0.14em">${status.label}</span>
      </div>
    </div>
  </div>

  <div style="height:1px;background:${C.hair};margin:26px 0 24px"></div>

  <!-- Parties · dates -->
  <div style="display:flex;gap:26px;align-items:flex-start;margin-bottom:24px">
    ${party('Billed To', C.brand, data.client.company ?? data.client.name, [
      data.client.company ? data.client.name : undefined,
      data.client.address,
      data.client.gstin ? `GSTIN ${data.client.gstin}` : undefined,
    ])}
    ${party('From', C.hair, data.agency.name, [
      data.agency.address,
      data.agency.gstin ? `GSTIN ${data.agency.gstin}` : undefined,
      data.agency.pan ? `PAN ${data.agency.pan}` : undefined,
    ])}
    <div style="text-align:right;min-width:118px">
      <p style="${MICRO};color:${C.inkSoft};margin-bottom:9px">Issued</p>
      <p style="font-size:12px;font-weight:700;color:${C.ink};font-variant-numeric:tabular-nums">${fmtDate(data.issueDate)}</p>
      ${
        data.dueDate
          ? `<p style="${MICRO};color:${C.inkSoft};margin:11px 0 9px">Due</p>
             <p style="font-size:12px;font-weight:700;color:${C.ink};font-variant-numeric:tabular-nums">${fmtDate(data.dueDate)}</p>`
          : ''
      }
    </div>
  </div>

  <!-- Amount — double-bezel card, editorial split, ghost ₹ in the margin -->
  <div style="padding:6px;border-radius:26px;background:${C.brandWash};box-shadow:inset 0 0 0 1px ${C.brandHair};${NOBREAK}">
    <div style="position:relative;overflow:hidden;border-radius:20px;padding:24px 28px 0;background:radial-gradient(115% 135% at 8% -20%,#FFE4CD 0%,#FFF4EA 46%,${C.card} 84%);box-shadow:inset 0 1px 0 rgba(255,255,255,0.9),inset 0 0 0 1px rgba(255,255,255,0.55)">
      <span class="display" style="position:absolute;right:-26px;top:-58px;font-size:215px;color:rgba(248,95,0,0.05);line-height:1">₹</span>
      <div style="position:relative;display:flex;justify-content:space-between;align-items:flex-end;gap:24px">
        <div>
          <p style="${MICRO};color:${C.brandInk};opacity:0.62;margin-bottom:6px">${isPaid ? 'Amount Received' : 'Total Amount'}</p>
          <div class="display" style="font-size:60px;color:${C.brand};line-height:0.95;letter-spacing:-0.015em">₹${fmtNum(data.totalPaise)}</div>
        </div>
        <div style="padding-bottom:6px">${heroPill}</div>
      </div>
      <div style="position:relative;display:flex;justify-content:space-between;align-items:center;gap:18px;margin-top:20px;padding:11px 0;border-top:1px solid ${C.brandHair}">
        <span style="${MICRO};color:${C.inkSoft};white-space:nowrap">In Words</span>
        <span style="font-size:11.5px;font-weight:600;color:${C.inkMid};text-align:right">${amountWords}</span>
      </div>
    </div>
  </div>

  <!-- Line items -->
  <div style="margin-top:24px">
    ${eyebrow('Details')}
    <div style="padding:5px;border-radius:20px;background:${C.brandWash};box-shadow:inset 0 0 0 1px ${C.brandHair}">
      <div style="border-radius:15px;overflow:hidden;background:${C.card};box-shadow:inset 0 0 0 1px ${C.hairSoft}">
        <table style="width:100%;border-collapse:collapse;font-size:12.5px">
          <thead>
            <tr style="background:${C.paper}">
              <th style="padding:11px 20px;text-align:left;${MICRO};color:${C.inkSoft};border-bottom:1px solid ${C.hair}">Description</th>
              <th style="padding:11px 20px;text-align:right;${MICRO};color:${C.inkSoft};border-bottom:1px solid ${C.hair};width:58px">Qty</th>
              <th style="padding:11px 20px;text-align:right;${MICRO};color:${C.inkSoft};border-bottom:1px solid ${C.hair};width:96px">Unit</th>
              <th style="padding:11px 20px;text-align:right;${MICRO};color:${C.inkSoft};border-bottom:1px solid ${C.hair};width:108px">Amount</th>
            </tr>
          </thead>
          <tbody>${lineItemsHtml}</tbody>
          <tfoot>
            ${
              data.gstPercent
                ? `<tr><td colspan="3" style="padding:10px 20px;text-align:right;font-size:11.5px;color:${C.inkMid}">GST (${data.gstPercent}%)</td><td style="padding:10px 20px;text-align:right;font-size:12.5px;color:${C.ink};font-variant-numeric:tabular-nums">₹${fmtNum(data.gstPaise)}</td></tr>`
                : ''
            }
            <tr style="background:${C.paper}">
              <td colspan="3" style="padding:12px 20px;text-align:right;${MICRO};color:${C.inkMid};border-top:1px solid ${C.hair}">Total</td>
              <td style="padding:12px 20px;text-align:right;font-size:14px;font-weight:800;color:${C.ink};border-top:1px solid ${C.hair};font-variant-numeric:tabular-nums">₹${fmtNum(data.totalPaise)}</td>
            </tr>
            ${
              data.paidPaise > 0 && balance > 0
                ? `<tr><td colspan="3" style="padding:9px 20px;text-align:right;font-size:11.5px;color:#2F7A45">Paid</td><td style="padding:9px 20px;text-align:right;font-size:12.5px;color:#2F7A45;font-weight:700;font-variant-numeric:tabular-nums">−₹${fmtNum(data.paidPaise)}</td></tr>`
                : ''
            }
            ${
              balance > 0
                ? `<tr style="background:${C.brandWash}"><td colspan="3" style="padding:13px 20px;text-align:right;${MICRO};color:${C.brandInk}">Balance Due</td><td style="padding:13px 20px;text-align:right;font-size:15px;font-weight:800;color:${C.brand};font-variant-numeric:tabular-nums">₹${fmtNum(balance)}</td></tr>`
                : ''
            }
          </tfoot>
        </table>
      </div>
    </div>
  </div>

  ${paymentsHtml}

  ${closingHtml}

  <!-- Footer: signature rail · labelled contact -->
  <div style="margin-top:30px;padding-top:20px;border-top:1px solid ${C.hair};display:flex;justify-content:space-between;align-items:flex-end;${NOBREAK}">
    <div style="border-left:2px solid ${C.brand};padding-left:15px">
      <p style="font-size:14px;font-weight:700;color:${C.ink}">Kanish Kumar</p>
      <p style="${MICRO};color:${C.inkSoft};margin-top:4px;letter-spacing:0.14em">Founder, Zlaark</p>
    </div>
    <div style="text-align:right">
      <p style="font-size:11.5px;color:${C.inkMid}"><span style="${MICRO};color:${C.ink}">Mail</span>&nbsp;&nbsp;<span style="font-weight:600;color:${C.brand}">kanish@zlaark.com</span></p>
      <p style="font-size:11.5px;color:${C.inkMid};margin-top:5px"><span style="${MICRO};color:${C.ink}">Tel</span>&nbsp;&nbsp;<span style="font-variant-numeric:tabular-nums">+91 88721 40807</span></p>
      <p style="${MICRO};color:${C.inkSoft};opacity:0.75;margin-top:10px;letter-spacing:0.12em">Payment due upon receipt · UPI or Bank Transfer</p>
    </div>
  </div>

</div>
</body>
</html>`;
}
