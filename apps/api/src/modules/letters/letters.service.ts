import * as fs from 'fs';
import * as path from 'path';

import { Injectable } from '@nestjs/common';
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  ImageRun,
  LevelFormat,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  UnderlineType,
  VerticalAlign,
  WidthType,
} from 'docx';

import type { GenerateInternshipLetterDto } from './dto/generate-letter.dto';

// ─── Design tokens ───────────────────────────────────────────────────────────
const C = {
  orange: 'E04A0F',
  orangeLight: 'F5C4A8',
  black: '0A0A0A',
  charcoal: '1A1A2E',
  inkDark: '2C2C2C',
  inkMid: '4A4A4A',
  inkLight: '888888',
  silver: 'C8C8C8',
  snowWhite: 'F8F8F6',
  pureWhite: 'FFFFFF',
  rule: 'DEDEDE',
};

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const NO_BORDERS = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER };

const CW = 9746; // A4 content width in DXA (11906 - 2×1080 margins)

// ─── Utility builders ────────────────────────────────────────────────────────
const gap = (before = 0, after = 120) =>
  new Paragraph({ children: [new TextRun({ text: '' })], spacing: { before, after } });

const txt = (text: string, opts: { font?: string; size?: number; bold?: boolean; italics?: boolean; color?: string; allCaps?: boolean; underline?: boolean } = {}) =>
  new TextRun({
    text,
    font: opts.font ?? 'Segoe UI',
    size: opts.size ?? 22,
    bold: opts.bold ?? false,
    italics: opts.italics ?? false,
    color: opts.color ?? C.inkDark,
    allCaps: opts.allCaps ?? false,
    underline: opts.underline ? { type: UnderlineType.SINGLE } : undefined,
  });

const para = (children: TextRun | TextRun[] | ImageRun[], opts: { align?: (typeof AlignmentType)[keyof typeof AlignmentType]; before?: number; after?: number; line?: number; pageBreakBefore?: boolean } = {}) =>
  new Paragraph({
    children: Array.isArray(children) ? children : [children],
    alignment: opts.align ?? AlignmentType.LEFT,
    spacing: { before: opts.before ?? 80, after: opts.after ?? 80, line: opts.line ?? 360 },
    pageBreakBefore: opts.pageBreakBefore ?? false,
  });

const body = (text: string, opts: Parameters<typeof txt>[1] & Parameters<typeof para>[1] = {}) =>
  para([txt(text, opts)], opts);

const bul = (text: string) =>
  new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    children: [txt(text, { size: 20, color: C.inkMid })],
    spacing: { before: 60, after: 60, line: 360 },
  });

const sectionHead = (num: number, title: string) => [
  gap(480, 0),
  new Paragraph({
    children: [
      new TextRun({ text: `${String(num).padStart(2, '0')}  `, font: 'Segoe UI', size: 26, bold: true, color: C.orange }),
      new TextRun({ text: title, font: 'Segoe UI', size: 26, bold: true, color: C.charcoal }),
    ],
    spacing: { before: 0, after: 240 },
  }),
];

const clauseHead = (text: string) =>
  new Paragraph({
    children: [new TextRun({ text, font: 'Segoe UI', size: 21, bold: true, color: C.inkDark })],
    spacing: { before: 300, after: 120 },
  });

const fmtDate = (isoOrStr: string) => {
  const d = new Date(isoOrStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
};

@Injectable()
export class LettersService {
  private loadLogo(): Buffer | null {
    try {
      return fs.readFileSync(path.resolve(__dirname, '../../../../../../zlaark-brand-kit/png/logo_color.png'));
    } catch {
      return null;
    }
  }

  async generateInternshipLetter(dto: GenerateInternshipLetterDto): Promise<Buffer> {
    const logoData = this.loadLogo();
    const issueDate = dto.issueDate ? fmtDate(dto.issueDate) : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
    const issueYear = dto.issueDate ? new Date(dto.issueDate).getFullYear() : new Date().getFullYear();
    const refNum = dto.referenceNumber ?? `ZLK-INT-${issueYear}-001`;
    const firstName = dto.candidateName.split(' ')[0] ?? dto.candidateName;
    const workHours = dto.workHours ?? '10:00 AM – 6:00 PM';
    const workDays = dto.workDays ?? 'Monday – Friday';
    const workMode = dto.workMode ?? 'Remote';
    const manager = dto.manager ?? 'Kanish Kumar, Founder';
    const deadline = dto.acceptanceDeadline ? fmtDate(dto.acceptanceDeadline) : '7 days from the date of this letter';

    const cover = this.makeCover(logoData, dto.candidateName, dto.candidateEmail, issueDate, refNum);
    const offer = this.makeOfferLetter(dto, firstName, issueDate, deadline);
    const terms = this.makeTerms(dto, workHours, workDays, workMode, manager);
    const sig = this.makeSignature(dto.candidateName, dto.position);
    const header = this.makeHeader(logoData);
    const footer = this.makeFooter();

    const doc = new Document({
      numbering: {
        config: [
          {
            reference: 'bullets',
            levels: [{
              level: 0,
              format: LevelFormat.BULLET,
              text: '–',
              alignment: AlignmentType.LEFT,
              style: {
                run: { font: 'Segoe UI', size: 22, color: C.orange },
                paragraph: { indent: { left: 480, hanging: 340 } },
              },
            }],
          },
        ],
      },
      styles: {
        default: {
          document: { run: { font: 'Segoe UI', size: 22, color: C.inkMid } },
        },
        paragraphStyles: [
          {
            id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
            run: { size: 26, bold: true, font: 'Segoe UI', color: C.charcoal },
            paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 0 },
          },
        ],
      },
      sections: [{
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
          titlePage: true,
        },
        headers: {
          default: header,
          first: new Header({ children: [new Paragraph({ children: [new TextRun('')] })] }),
        },
        footers: {
          default: footer,
          first: new Footer({ children: [new Paragraph({ children: [new TextRun('')] })] }),
        },
        children: [...cover, ...offer, ...terms, ...sig],
      }],
    });

    return Packer.toBuffer(doc);
  }

  // ── Cover page ─────────────────────────────────────────────────────────────
  private makeCover(logoData: Buffer | null, candidateName: string, candidateEmail: string, issueDate: string, refNum: string) {
    const children: (Paragraph | Table)[] = [];
    const seg = Math.floor((CW - 120) / 3);

    children.push(new Table({
      width: { size: CW, type: WidthType.DXA },
      columnWidths: [seg, 60, seg, 60, CW - 2 * seg - 120],
      rows: [new TableRow({
        height: { value: 140, rule: 'exact' as const },
        children: [
          new TableCell({ shading: { fill: C.orange, type: ShadingType.CLEAR }, borders: NO_BORDERS, children: [new Paragraph({ children: [new TextRun('')] })] }),
          new TableCell({ borders: NO_BORDERS, children: [new Paragraph({ children: [new TextRun('')] })] }),
          new TableCell({ shading: { fill: C.orange, type: ShadingType.CLEAR }, borders: NO_BORDERS, children: [new Paragraph({ children: [new TextRun('')] })] }),
          new TableCell({ borders: NO_BORDERS, children: [new Paragraph({ children: [new TextRun('')] })] }),
          new TableCell({ shading: { fill: C.orange, type: ShadingType.CLEAR }, borders: NO_BORDERS, children: [new Paragraph({ children: [new TextRun('')] })] }),
        ],
      })],
    }));

    children.push(gap(1400, 0));

    if (logoData) {
      children.push(new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [new ImageRun({ data: logoData, transformation: { width: 140, height: 39 }, type: 'png' })],
        spacing: { before: 0, after: 2800 },
      }));
    } else {
      children.push(gap(2800, 0));
    }

    children.push(new Paragraph({
      children: [txt('INTERNSHIP AGREEMENT', { size: 17, color: C.orange, allCaps: true, bold: true })],
      spacing: { before: 0, after: 120 },
    }));
    children.push(new Paragraph({
      children: [txt('Internship', { size: 82, bold: true, color: C.charcoal })],
      spacing: { before: 0, after: 0 },
    }));
    children.push(new Paragraph({
      children: [txt('Offer Letter', { size: 82, bold: true, color: C.charcoal })],
      spacing: { before: 0, after: 720 },
    }));

    children.push(new Paragraph({
      children: [new TextRun('')],
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.rule } },
      spacing: { before: 0, after: 320 },
    }));

    children.push(new Table({
      width: { size: CW, type: WidthType.DXA },
      columnWidths: [3300, 2600, 3846],
      rows: [new TableRow({
        children: [
          new TableCell({
            borders: { ...NO_BORDERS, right: { style: BorderStyle.SINGLE, size: 3, color: C.rule } },
            children: [
              para([txt('PREPARED FOR', { size: 14, color: C.inkLight, allCaps: true })], { before: 0, after: 60 }),
              para([txt(candidateName, { size: 20, bold: true, color: C.black })], { before: 0, after: 40 }),
              para([txt(candidateEmail, { size: 17, color: C.inkMid })], { before: 0, after: 0 }),
            ],
            margins: { top: 60, bottom: 60, left: 0, right: 160 },
          }),
          new TableCell({
            borders: { ...NO_BORDERS, right: { style: BorderStyle.SINGLE, size: 3, color: C.rule } },
            children: [
              para([txt('DATE OF ISSUE', { size: 14, color: C.inkLight, allCaps: true })], { before: 0, after: 60 }),
              para([txt(issueDate, { size: 20, bold: true, color: C.black })], { before: 0, after: 0 }),
            ],
            margins: { top: 60, bottom: 60, left: 160, right: 160 },
          }),
          new TableCell({
            borders: NO_BORDERS,
            children: [
              para([txt('REFERENCE NO.', { size: 14, color: C.inkLight, allCaps: true })], { before: 0, after: 60 }),
              para([txt(refNum, { size: 20, bold: true, color: C.orange })], { before: 0, after: 0 }),
            ],
            margins: { top: 60, bottom: 60, left: 160, right: 0 },
          }),
        ],
      })],
    }));

    children.push(gap(600, 0));
    children.push(para([txt('Private & Confidential  ·  Not for circulation', { size: 15, color: C.inkLight, italics: true })], { align: AlignmentType.RIGHT, before: 0, after: 0 }));
    children.push(new Paragraph({ children: [new PageBreak()] }));
    return children;
  }

  // ── Offer letter ───────────────────────────────────────────────────────────
  private makeOfferLetter(dto: GenerateInternshipLetterDto, firstName: string, issueDate: string, deadline: string) {
    const accentW = 260;
    const contentW = CW - accentW - 200;
    const lc: (Paragraph | Table)[] = [];

    lc.push(para([txt(issueDate, { size: 20, color: C.inkLight })], { align: AlignmentType.RIGHT, before: 0, after: 280 }));
    lc.push(body('To,', { bold: true, size: 20, color: C.inkDark, before: 0, after: 40 }));
    lc.push(body(dto.candidateName, { bold: true, size: 22, color: C.black, before: 0, after: 40 }));
    if (dto.candidateAddress) {
      lc.push(body(dto.candidateAddress, { size: 20, color: C.inkMid, before: 0, after: 40 }));
    }
    if (dto.candidateCity) {
      lc.push(body(dto.candidateCity, { size: 20, color: C.inkMid, before: 0, after: 40 }));
    }
    const contactLine = [dto.candidateEmail, dto.candidatePhone].filter(Boolean).join('  ·  ');
    lc.push(body(contactLine, { size: 20, color: C.inkMid, before: 0, after: 200 }));

    lc.push(new Paragraph({
      children: [
        new TextRun({ text: 'Re: ', font: 'Segoe UI', size: 22, bold: true, color: C.orange }),
        new TextRun({ text: 'Offer of Internship — Zlaark', font: 'Segoe UI', size: 22, bold: true, color: C.black }),
      ],
      spacing: { before: 0, after: 200 },
    }));

    lc.push(new Paragraph({
      children: [new TextRun('')],
      border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: C.rule } },
      spacing: { before: 0, after: 180 },
    }));

    lc.push(body(`Dear ${firstName},`, { bold: true, size: 21, color: C.black, before: 0, after: 120 }));
    lc.push(body(`We are exceptionally pleased to extend this formal offer of an internship at Zlaark in the capacity of ${dto.position}. Having carefully evaluated your profile and capabilities, we believe you bring the passion, skill, and creative vision that align closely with our standards.`, { size: 20, color: C.inkMid, line: 320, before: 0, after: 120 }));
    lc.push(body(`During your time at Zlaark, you will work closely with our design and engineering teams on real-world projects, building practical skills and gaining meaningful industry experience within the ${dto.department} department.`, { size: 20, color: C.inkMid, line: 320, before: 0, after: 120 }));
    lc.push(body(`The terms and conditions governing this internship are set out fully in the agreement on the pages that follow. Please review them carefully. To indicate your acceptance, kindly sign the acceptance section at the end of this document and return a signed copy to us no later than ${deadline}.`, { size: 20, color: C.inkMid, line: 320, before: 0, after: 160 }));
    lc.push(body('We look forward to welcoming you to the Zlaark team.', { size: 20, color: C.inkMid, before: 0, after: 240 }));
    lc.push(body('Sincerely,', { size: 20, color: C.inkDark, before: 0, after: 240 }));

    lc.push(new Table({
      width: { size: contentW - 200, type: WidthType.DXA },
      columnWidths: [4000, contentW - 200 - 4000],
      rows: [new TableRow({
        children: [
          new TableCell({
            borders: NO_BORDERS,
            children: [
              para([txt('Kanish Kumar', { bold: true, size: 22, color: C.black })], { before: 0, after: 40 }),
              para([txt('Founder, Zlaark', { size: 19, color: C.inkMid })], { before: 0, after: 40 }),
              para([txt('hello@zlaark.com', { size: 18, color: C.orange })], { before: 0, after: 0 }),
            ],
          }),
          new TableCell({
            borders: { left: { style: BorderStyle.SINGLE, size: 4, color: C.orange }, top: NO_BORDER, bottom: NO_BORDER, right: NO_BORDER },
            children: [
              para([txt('www.zlaark.com', { size: 18, color: C.inkLight })], { before: 0, after: 40 }),
              para([txt('+91 7508670783', { size: 18, color: C.inkMid })], { before: 0, after: 0 }),
            ],
            margins: { left: 240 },
          }),
        ],
      })],
    }));

    const c: (Paragraph | Table)[] = [];
    c.push(new Table({
      width: { size: CW, type: WidthType.DXA },
      columnWidths: [accentW, 200, contentW],
      rows: [new TableRow({
        children: [
          new TableCell({
            shading: { fill: C.orange, type: ShadingType.CLEAR },
            borders: NO_BORDERS,
            width: { size: accentW, type: WidthType.DXA },
            children: [new Paragraph({ children: [new TextRun('')] })],
          }),
          new TableCell({
            borders: NO_BORDERS,
            width: { size: 200, type: WidthType.DXA },
            children: [new Paragraph({ children: [new TextRun('')] })],
          }),
          new TableCell({
            borders: NO_BORDERS,
            width: { size: contentW, type: WidthType.DXA },
            margins: { top: 240, bottom: 240, left: 200, right: 0 },
            children: lc,
          }),
        ],
      })],
    }));

    c.push(new Paragraph({ children: [new PageBreak()] }));
    return c;
  }

  // ── Agreement terms ────────────────────────────────────────────────────────
  private makeTerms(dto: GenerateInternshipLetterDto, workHours: string, workDays: string, workMode: string, manager: string) {
    const c: (Paragraph | Table)[] = [];

    c.push(new Paragraph({
      children: [new TextRun({ text: 'Internship Agreement', font: 'Segoe UI', size: 44, bold: true, color: C.black })],
      spacing: { before: 0, after: 60 },
    }));
    c.push(new Paragraph({
      children: [new TextRun({ text: 'Terms & Conditions', font: 'Segoe UI', size: 44, color: C.inkLight })],
      spacing: { before: 0, after: 400 },
    }));
    c.push(body(`This agreement is entered into between Zlaark ("the Company") and ${dto.candidateName} ("the Intern") effective from ${fmtDate(dto.startDate)}.`, { size: 20, color: C.inkLight, italics: true, before: 0, after: 0 }));

    c.push(...sectionHead(1, 'Position & Duties'));
    c.push(clauseHead('Role'));
    c.push(bul(`You will serve as an intern in the role of ${dto.position} within the ${dto.department} team.`));
    c.push(bul('Primary responsibilities include, but are not limited to, tasks assigned within your role.'));
    c.push(bul("You are expected to perform all assigned duties diligently, maintaining the quality standards consistent with Zlaark's brand."));
    c.push(clauseHead('Reporting'));
    c.push(bul(`You will report directly to ${manager}. In their absence, direction follows the chain designated by the Founder.`));
    c.push(bul('A regular communication cadence (stand-ups, check-ins) will be agreed upon at onboarding.'));

    c.push(...sectionHead(2, 'Duration & Working Hours'));
    c.push(clauseHead('Internship Period'));
    c.push(bul(`The internship commences on ${fmtDate(dto.startDate)} and concludes on ${fmtDate(dto.endDate)}, subject to satisfactory performance.`));
    c.push(bul('The first 30 calendar days shall be a probationary period. During this time either party may end the arrangement with 3 days\' written notice.'));
    c.push(clauseHead('Working Hours'));
    c.push(bul(`Standard hours are ${workHours}, ${workDays}, in ${workMode} mode.`));
    c.push(bul('Flexibility may be required during project deadlines. Zlaark advocates for sustainable work practices and will not require regular overtime without prior discussion.'));
    c.push(bul('Any change to agreed hours must be requested in writing and approved by your reporting manager at least 5 working days in advance.'));

    c.push(...sectionHead(3, 'Compensation & Reimbursements'));
    c.push(clauseHead('Monthly Stipend'));
    c.push(bul(`You will receive a fixed monthly stipend of ₹${dto.stipendAmount.toLocaleString('en-IN')}, paid by the 10th of the following month via bank transfer.`));
    c.push(clauseHead('Performance Bonus'));
    c.push(bul('You are eligible for performance-based bonuses tied to successful project milestone delivery.'));
    c.push(bul('Bonus terms and triggers will be communicated in writing at the commencement of each project sprint.'));
    c.push(clauseHead('Expenses'));
    c.push(bul('Pre-approved, project-related out-of-pocket expenses will be reimbursed within 15 working days on submission of valid receipts and a completed expense claim form.'));
    c.push(bul('All expenses must be approved before incurrence. Retroactive approvals will not be granted.'));

    c.push(...sectionHead(4, 'Leave & Attendance Policy'));
    c.push(bul('As Zlaark works with international clients across multiple time zones, there are no fixed public holiday entitlements. Any leave, whether planned or urgent, must be requested in advance and approved by your reporting manager before being taken.'));
    c.push(bul('Leave taken without prior approval will be treated as an unauthorised absence and may result in stipend deduction or disciplinary action.'));

    c.push(...sectionHead(5, 'Confidentiality & Non-Disclosure'));
    c.push(bul('You will have access to confidential materials including proprietary systems, source code, design assets, business strategies, financial data, and client information.'));
    c.push(bul('You agree to maintain strict confidentiality over all such assets and use them solely to execute your assigned duties.'));
    c.push(bul('A separate Non-Disclosure Agreement (NDA) will be executed. Its obligations permanently survive the conclusion or termination of this internship.'));
    c.push(bul('Deliberate or negligent disclosure of any confidential information constitutes a material breach and may result in immediate termination and legal action.'));
    c.push(bul("You must not discuss Zlaark's unreleased products, projects, client identities, or internal strategies on any social media platform or public forum, directly or indirectly."));

    c.push(...sectionHead(6, 'Intellectual Property'));
    c.push(bul('All code, designs, concepts, algorithms, documentation, and creative works authored or conceived by you during this internship — using any tools or resources — are the sole and exclusive property of Zlaark.'));
    c.push(bul('You irrevocably assign all rights, title, and interest in such work products to Zlaark. No additional compensation beyond the agreed stipend is owed for this assignment.'));
    c.push(bul("You may not reproduce, republish, or include Zlaark's proprietary work in your personal portfolio without explicit written consent from the Founder."));
    c.push(bul('Zlaark may, at its discretion, credit your contributions publicly or in internal records.'));

    c.push(...sectionHead(7, 'Code of Conduct & Professionalism'));
    c.push(bul('You are expected to maintain professional, respectful conduct in all interactions with team members, vendors, and clients.'));
    c.push(bul('Zlaark enforces a zero-tolerance policy for harassment, discrimination, intimidation, or bullying of any kind.'));
    c.push(bul('Repeated submission of substandard work after feedback and guidance constitutes grounds for termination.'));
    c.push(bul("You must not engage in secondary employment, freelancing, or any business activity that conflicts with Zlaark's interests during the internship without prior written approval."));
    c.push(bul('Misrepresentation of qualifications, skills, or experience that materially influenced your selection will constitute cause for immediate termination.'));

    c.push(...sectionHead(8, 'Device, Tools & Data Security'));
    c.push(bul('All company-issued hardware, software licences, and access credentials remain the property of Zlaark at all times.'));
    c.push(bul('You must not install unauthorised software on company devices, share login credentials, or access Zlaark systems from unsecured public networks without a VPN.'));
    c.push(bul('Any security incident, suspected data breach, or unauthorised access must be reported to your manager within 1 hour of discovery.'));
    c.push(bul('Use of company devices for personal activities (streaming, gaming, non-work browsing) during working hours is prohibited.'));

    c.push(...sectionHead(9, 'Termination & Return of Assets'));
    c.push(clauseHead('Standard Notice'));
    c.push(bul("Either party may terminate this arrangement with 30 calendar days' written notice. During the probationary period (first 30 days) the notice period is 3 days."));
    c.push(clauseHead('Termination for Cause'));
    c.push(bul('Zlaark may terminate immediately and without notice in cases of: gross misconduct, NDA breach, data theft, harassment, fraud, or repeated wilful policy violations.'));
    c.push(bul('In such cases, pending stipend may be withheld pending investigation.'));
    c.push(clauseHead('Return of Assets'));
    c.push(bul('Upon cessation, you must immediately return all company hardware, credentials, data, and proprietary documents. Non-return within 48 hours of the last working day may result in legal recovery action.'));

    c.push(...sectionHead(10, 'Performance Review & Certification'));
    c.push(bul('A formal mid-term review will be conducted at the halfway mark, with written feedback issued to the Intern.'));
    c.push(bul('An internship completion certificate and/or letter of recommendation will be issued upon successful completion, subject to satisfactory performance and a clean exit process.'));
    c.push(bul('Interns who leave before completing 50% of their tenure without a mutually agreed cause will not be eligible for a completion certificate.'));

    c.push(...sectionHead(11, 'Grievance, Governing Law & Jurisdiction'));
    c.push(bul('Grievances should first be raised with your reporting manager. If unresolved within 5 working days, the matter may be escalated in writing to the Founder.'));
    c.push(bul('This agreement is governed by the laws of India. Both parties submit to the exclusive jurisdiction of the courts of Chandigarh, India.'));

    c.push(...sectionHead(12, 'Miscellaneous'));
    c.push(bul('This document, together with any separately executed NDA, constitutes the entire agreement between the parties and supersedes all prior representations.'));
    c.push(bul('No modification to this agreement shall be valid unless made in writing and signed by both parties.'));
    c.push(bul('If any provision is found to be unenforceable, the remaining provisions continue in full force.'));
    c.push(bul('This agreement does not constitute a contract of employment, nor does it guarantee a full-time offer upon internship completion.'));

    return c;
  }

  // ── Signature page ─────────────────────────────────────────────────────────
  private makeSignature(candidateName: string, position: string) {
    const c: (Paragraph | Table)[] = [];
    c.push(new Paragraph({ children: [new PageBreak()] }));
    c.push(gap(0, 0));

    c.push(new Paragraph({
      children: [new TextRun({ text: 'Acceptance', font: 'Segoe UI', size: 44, bold: true, color: C.black })],
      spacing: { before: 0, after: 60 },
    }));
    c.push(new Paragraph({
      children: [new TextRun({ text: 'of Agreement', font: 'Segoe UI', size: 44, color: C.inkLight })],
      spacing: { before: 0, after: 480 },
    }));

    c.push(body(`I, ${candidateName}, confirm that I have read, understood, and agree to be bound by all terms and conditions set out in this Internship Offer and Agreement. I understand this document is legally binding upon my acceptance.`, { size: 21, color: C.inkMid, italics: true, line: 310, before: 0, after: 80 }));
    c.push(body('By signing below, I formally accept the offer of internship at Zlaark.', { size: 21, color: C.inkMid, italics: true, before: 0, after: 600 }));

    c.push(new Table({
      width: { size: CW, type: WidthType.DXA },
      columnWidths: [4500, 400, 4846],
      rows: [
        new TableRow({
          children: [
            new TableCell({ borders: NO_BORDERS, width: { size: 4500, type: WidthType.DXA }, children: [para([txt('FOR ZLAARK', { size: 15, color: C.inkLight, allCaps: true })], { before: 0, after: 80 })] }),
            new TableCell({ borders: NO_BORDERS, width: { size: 400, type: WidthType.DXA }, children: [gap()] }),
            new TableCell({ borders: NO_BORDERS, width: { size: 4846, type: WidthType.DXA }, children: [para([txt('INTERN ACCEPTANCE', { size: 15, color: C.inkLight, allCaps: true })], { before: 0, after: 80 })] }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ borders: { top: NO_BORDER, bottom: { style: BorderStyle.SINGLE, size: 6, color: C.charcoal }, left: NO_BORDER, right: NO_BORDER }, width: { size: 4500, type: WidthType.DXA }, children: [para([txt('', { size: 22 })], { before: 720, after: 80 })] }),
            new TableCell({ borders: NO_BORDERS, width: { size: 400, type: WidthType.DXA }, children: [gap()] }),
            new TableCell({ borders: { top: NO_BORDER, bottom: { style: BorderStyle.SINGLE, size: 6, color: C.charcoal }, left: NO_BORDER, right: NO_BORDER }, width: { size: 4846, type: WidthType.DXA }, children: [para([txt('', { size: 22 })], { before: 720, after: 80 })] }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              borders: NO_BORDERS, width: { size: 4500, type: WidthType.DXA },
              children: [
                para([txt('Kanish Kumar', { size: 22, bold: true, color: C.black })], { before: 120, after: 40 }),
                para([txt('Founder, Zlaark', { size: 19, color: C.inkMid })], { before: 0, after: 0 }),
              ],
            }),
            new TableCell({ borders: NO_BORDERS, width: { size: 400, type: WidthType.DXA }, children: [gap()] }),
            new TableCell({
              borders: NO_BORDERS, width: { size: 4846, type: WidthType.DXA },
              children: [
                para([txt(candidateName, { size: 22, bold: true, color: C.black })], { before: 120, after: 40 }),
                para([txt(position, { size: 19, color: C.inkMid })], { before: 0, after: 0 }),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ borders: NO_BORDERS, width: { size: 4500, type: WidthType.DXA }, children: [para([txt('Date: ___________________________', { size: 20, color: C.inkMid })], { before: 240, after: 0 })] }),
            new TableCell({ borders: NO_BORDERS, width: { size: 400, type: WidthType.DXA }, children: [gap()] }),
            new TableCell({ borders: NO_BORDERS, width: { size: 4846, type: WidthType.DXA }, children: [para([txt('Date: ___________________________', { size: 20, color: C.inkMid })], { before: 240, after: 0 })] }),
          ],
        }),
      ],
    }));

    c.push(gap(480, 240));
    c.push(para([txt('This document was prepared exclusively by Zlaark for the named recipient. Unauthorised distribution, reproduction, or disclosure is strictly prohibited.', { size: 16, color: C.inkLight, italics: true })], { align: AlignmentType.CENTER, before: 0, after: 0 }));

    return c;
  }

  // ── Header & Footer ────────────────────────────────────────────────────────
  private makeHeader(logoData: Buffer | null): Header {
    return new Header({
      children: [
        new Table({
          width: { size: CW, type: WidthType.DXA },
          columnWidths: [CW / 2, CW / 2],
          borders: NO_BORDERS,
          rows: [new TableRow({
            children: [
              new TableCell({
                borders: NO_BORDERS,
                verticalAlign: VerticalAlign.CENTER,
                children: logoData
                  ? [new Paragraph({ children: [new ImageRun({ data: logoData, transformation: { width: 90, height: 26 }, type: 'png' })] })]
                  : [para([txt('ZLAARK', { size: 16, bold: true, color: C.orange })])],
              }),
              new TableCell({
                borders: NO_BORDERS,
                verticalAlign: VerticalAlign.CENTER,
                children: [para([txt('INTERNSHIP OFFER & AGREEMENT', { size: 15, color: C.inkMid, allCaps: true, bold: true })], { align: AlignmentType.RIGHT, before: 0, after: 0 })],
              }),
            ],
          })],
        }),
        gap(0, 300),
      ],
    });
  }

  private makeFooter(): Footer {
    return new Footer({
      children: [
        new Paragraph({ children: [new TextRun('')] }),
        new Table({
          width: { size: CW, type: WidthType.DXA },
          columnWidths: [3200, 3200, 3346],
          borders: NO_BORDERS,
          rows: [new TableRow({
            children: [
              new TableCell({
                borders: NO_BORDERS,
                verticalAlign: VerticalAlign.CENTER,
                children: [para([txt('TEL: ', { size: 15, bold: true, color: C.charcoal }), txt('+91 7508670783', { size: 15, color: C.inkMid })], { align: AlignmentType.LEFT, before: 0, after: 0 })],
              }),
              new TableCell({
                borders: NO_BORDERS,
                verticalAlign: VerticalAlign.CENTER,
                children: [para([txt('LOC: ', { size: 15, bold: true, color: C.charcoal }), txt('Remote / India', { size: 15, color: C.inkMid })], { align: AlignmentType.CENTER, before: 0, after: 0 })],
              }),
              new TableCell({
                borders: NO_BORDERS,
                verticalAlign: VerticalAlign.CENTER,
                children: [para([txt('MAIL: ', { size: 15, bold: true, color: C.charcoal }), txt('hello@zlaark.com', { size: 15, color: C.inkMid })], { align: AlignmentType.RIGHT, before: 0, after: 0 })],
              }),
            ],
          })],
        }),
        gap(160, 0),
        new Paragraph({
          children: [
            new TextRun({ text: 'Zlaark  ·  Confidential   |   Page ', font: 'Segoe UI', size: 14, color: C.silver }),
            new TextRun({ children: [PageNumber.CURRENT], font: 'Segoe UI', size: 14, color: C.orange }),
            new TextRun({ text: ' of ', font: 'Segoe UI', size: 14, color: C.silver }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Segoe UI', size: 14, color: C.silver }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 0 },
        }),
      ],
    });
  }
}
