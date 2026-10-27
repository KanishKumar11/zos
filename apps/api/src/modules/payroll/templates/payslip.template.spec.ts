import { renderPayslipHtml, type PayslipPdfData } from './payslip.template';

describe('renderPayslipHtml security & sanitization', () => {
  const sampleData: PayslipPdfData = {
    agency: {
      name: '<script>alert("pwned")</script> Agency',
      address: '123 Main St <img src=x onerror=alert(1)>',
      gstin: '29ABCDE1234F1Z5"><script>',
    },
    employee: {
      name: 'John <script>evil()</script> Doe',
      email: 'john@example.com',
      designation: 'Engineer " autofocus onfocus=alert(2) x="',
      department: 'Tech & Engineering <tag>',
      bankLast4: '1234<script>',
    },
    month: 'October 2026<script>',
    workingDays: 22,
    presentDays: 21,
    lopDays: 1,
    currency: 'INR',
    lines: [
      { label: 'Basic Pay <b onmouseover="alert(3)">test</b>', value: 5000000, kind: 'earning' },
      { label: 'Tax Deduction " onclick="alert(4)', value: 500000, kind: 'deduction' },
    ],
    grossPaise: 5000000,
    deductionsPaise: 500000,
    netPaise: 4500000,
  };

  it('escapes dangerous HTML characters from all user and entity fields', () => {
    const html = renderPayslipHtml(sampleData);

    // Verify raw unescaped HTML tags are NOT present in output
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<b ');
    expect(html).not.toContain('<tag>');

    // Verify proper HTML entity escaping
    expect(html).toContain('&lt;script&gt;alert(&quot;pwned&quot;)&lt;/script&gt; Agency');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('John &lt;script&gt;evil()&lt;/script&gt; Doe');
    expect(html).toContain('Engineer &quot; autofocus onfocus=alert(2) x=&quot;');
    expect(html).toContain('Tech &amp; Engineering &lt;tag&gt;');
    expect(html).toContain('Basic Pay &lt;b onmouseover=&quot;alert(3)&quot;&gt;test&lt;/b&gt;');
    expect(html).toContain('Tax Deduction &quot; onclick=&quot;alert(4)');
  });
});
