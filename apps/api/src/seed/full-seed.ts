// full-seed.ts — Complete agency data seed (Zlaark / Kanish Kumar)
// Run: pnpm --filter @agency/api seed:full
import mongoose, { Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGO_URI!;
const p = (inr: number) => Math.round(inr * 100); // INR → paise
const d = (s: string) => new Date(s);
const oid = () => new Types.ObjectId();

// ── PRE-ALLOCATE ALL IDs ──────────────────────────────────────────────────────
const ID = {
  // Departments
  dDev: oid(), dMgmt: oid(),
  // Designations
  dgOwner: oid(), dgFSD: oid(), dgDev: oid(), dgDesign: oid(), dgIntern: oid(),
  // Users
  uKanish: oid(), uSidhak: oid(), uShabd: oid(), uShivam: oid(),
  uGeetanjali: oid(), uJaya: oid(),
  uAnjali: oid(), uHarshika: oid(), uSanjana: oid(), uIsha: oid(),
  uYatin: oid(), uJyotiYadav: oid(), uAmit: oid(),
  // Clients
  cLalit: oid(), cSP: oid(), cFoody: oid(), cBluehutch: oid(),
  cSculpt: oid(), cMendingMind: oid(), cUnextdoor: oid(),
  cSourcingScreen: oid(), cNJG: oid(), cGessure: oid(),
  cDhawada: oid(), cSkoal: oid(), cStartiffy: oid(),
  cDigitalMandir: oid(), cNamit: oid(), cHorizon: oid(),
  cFirstrank: oid(), cAnshulGlobal: oid(), cInnoTrans: oid(),
  cVelotra: oid(), cBallBoundary: oid(), cAllWheel: oid(),
  cSellercircle: oid(), cSWBuild: oid(), cShivAiTelerad: oid(),
  cEldeco: oid(), cArowai: oid(), cBroBuzz: oid(),
  cBitaminNaturals: oid(), cOnebox: oid(), cHostinger: oid(),
  // Invoices (explicit IDs for those referenced in milestones) — one invoice per milestone
  iFirstrank: oid(), iFirstrankM2: oid(), iFirstrankM3: oid(), iFirstrank2: oid(), iFirstrankM5: oid(),
  iHRBook: oid(), iHRBookM2: oid(), iHRBook2: oid(),
  iDhawada: oid(), iDhawadaM2: oid(), iDhawadaM3: oid(),
  iRewardzy: oid(), iRewardzyM2: oid(),
  iRealEstate: oid(), iRealEstateM2: oid(),
  iInnoWebsite: oid(), iStudycrux: oid(), iStudycruxM2: oid(),
  // Combined invoice covering both Inno Transventive engagements (Aug 2026)
  iInnoCombined: oid(),
  iDigitalMandir1: oid(), iDigitalMandir2: oid(), iDigitalMandir3: oid(),
  iEldeco: oid(), iEldecoFinal: oid(),
  iGPower: oid(), iGPower2: oid(),
  iDhawadaNGO: oid(),
  iMendingMindPlatform: oid(), iMendingMindP2: oid(), iMendingMindP3: oid(),
  iMendingMindBalance: oid(), iBroBuzz: oid(),
  iOnebox: oid(), iOnebox2: oid(),
  // Contracts
  cFoodyContract: oid(), cGessureContract: oid(), cMendingMindContract: oid(),
  // Projects
  pFenkmat: oid(), pSPFixes: oid(), pFoody: oid(),
  pSoftwareKadai: oid(), pTaxByAkram: oid(), pCityDental: oid(),
  pSellercircle: oid(), pSellercircle2: oid(), pBallBoundary: oid(), pMendingMindPlatform: oid(), pMendingMindQuiz: oid(),
  pAllWheel: oid(), pSocialSecurity: oid(), pInterioDecor: oid(),
  pUnextdoor: oid(), pPNJFitness: oid(), pBestDiet: oid(),
  pSourcingScreen: oid(), pElectricMarshmallow: oid(), pGessure: oid(),
  pShivmani: oid(), pShivAiTelerad: oid(), pSWBuild: oid(),
  pDhawada: oid(), pSkoal: oid(), pLandingPages: oid(),
  pSoulnamaste: oid(), pGiftParty: oid(), pUttrakhand: oid(),
  pGoLaundry: oid(), pGKGIndustries: oid(), pStudycrux: oid(),
  pJouelcube: oid(), pDigitalMandir: oid(), pHRBook: oid(),
  pFirstrank: oid(), pRewardzy: oid(), pOnebox: oid(),
  pRealEstate: oid(), pInnoWebsite: oid(), pNavisha: oid(), pAvcoEnergy: oid(),
  pEldeco: oid(), pBroBuzz: oid(), pVelotra: oid(),
  pArowai: oid(), pBitaminNaturals: oid(), pDhawadaNGO: oid(),
  pHiristan: oid(), pSoulSurf: oid(), pResto: oid(),
  pMrVeg: oid(), pGPower: oid(), pSPNov25: oid(),
  // Milestones referenced by multi-project invoice line items
  msRealEstateM2Short: oid(), msRealEstateM3: oid(), msInnoWebsiteBalance: oid(),
};

// Invoice counter — per-year sequential: ZLK-YYYY-NNNN
const _invCounters: Record<number, number> = {};
const nextInv = (issueDate?: string) => {
  const y = issueDate ? new Date(issueDate).getFullYear() : new Date().getFullYear();
  _invCounters[y] = (_invCounters[y] ?? 0) + 1;
  return `ZLK-${y}-${String(_invCounters[y]).padStart(4, '0')}`;
};

// Payroll run IDs per month
const runIds: Record<string, Types.ObjectId> = {};
const runId = (month: string) => { if (!runIds[month]) runIds[month] = oid(); return runIds[month]; };

// ── HELPERS ───────────────────────────────────────────────────────────────────
const payment = (date: string, amountINR: number, method = 'Bank Transfer', ref = '') => ({
  _id: oid(), paidAt: d(date), amountPaise: p(amountINR), reference: ref, method,
});

const lineItem = (
  desc: string, qty: number, unitINR: number,
  projectId?: Types.ObjectId, milestoneId?: Types.ObjectId,
) => ({
  description: desc, qty, unitPaise: p(unitINR),
  ...(projectId ? { projectId } : {}),
  ...(milestoneId ? { milestoneId } : {}),
});

/**
 * Invoice whose lines carry their own project — one document billing several
 * projects at once, with each project keeping its revenue attribution.
 */
function multiProjectInvoice(
  num: string, clientId: Types.ObjectId,
  items: ReturnType<typeof lineItem>[],
  payments_arr: ReturnType<typeof payment>[],
  issueDate: string, dueDate: string, status: string,
  notes = '', id?: Types.ObjectId,
) {
  const subTotal = items.reduce((s, li) => s + Math.round(li.qty * li.unitPaise), 0);
  return {
    ...(id ? { _id: id } : {}),
    number: num, clientId, projectId: undefined, contractId: undefined,
    lineItems: items,
    subTotalPaise: subTotal, gstPercent: 0, gstPaise: 0, totalPaise: subTotal,
    paidPaise: payments_arr.reduce((s, x) => s + x.amountPaise, 0),
    currency: 'INR', status,
    issueDate: d(issueDate), dueDate: d(dueDate),
    payments: payments_arr,
    notes, createdAt: d(issueDate), updatedAt: new Date(),
  };
}

function invoice(
  num: string, clientId: Types.ObjectId,
  projectId: Types.ObjectId | undefined, contractId: Types.ObjectId | undefined,
  desc: string, totalINR: number, payments_arr: ReturnType<typeof payment>[],
  issueDate: string, status: string, currency = 'INR', id?: Types.ObjectId,
) {
  const paidINR = payments_arr.reduce((s, x) => s + x.amountPaise / 100, 0);
  const subTotal = p(totalINR);
  return {
    ...(id ? { _id: id } : {}),
    number: num, clientId, projectId, contractId,
    lineItems: [lineItem(desc, 1, totalINR)],
    subTotalPaise: subTotal, gstPercent: 0, gstPaise: 0, totalPaise: subTotal,
    paidPaise: Math.round(paidINR * 100),
    currency, status, issueDate: d(issueDate), payments: payments_arr,
    notes: '', createdAt: d(issueDate), updatedAt: new Date(),
  };
}

function project(
  id: Types.ObjectId, name: string, code: string, clientId: Types.ObjectId | undefined,
  status: string, startDate: string, endDate: string | null,
  membersList: { uid: Types.ObjectId; role: string; amountINR?: number; paidINR?: number; paidAtDate?: string; payments?: { amountINR: number; paidAtDate: string; note?: string; forPeriod?: string }[] }[],
  budgetINR = 0, marginINR = 0, desc = '',
  milestonesList?: { id?: Types.ObjectId; name: string; amountINR: number; dueDate?: string; status?: string; invoiceId?: Types.ObjectId; note?: string }[],
) {
  return {
    _id: id, name, code, clientId, status, description: desc, brief: '',
    startDate: d(startDate), endDate: endDate ? d(endDate) : undefined,
    clientBudgetPaise: p(budgetINR), agencyMarginPaise: p(marginINR), currency: 'INR',
    members: membersList.map((m) => ({
      userId: m.uid, role: m.role, addedAt: d(startDate), amountPaise: p(m.amountINR ?? 0),
      payments: m.payments ? m.payments.map(pmt => ({ _id: oid(), paidAt: d(pmt.paidAtDate), amountPaise: p(pmt.amountINR), note: pmt.note ?? '', ...(pmt.forPeriod ? { forPeriod: pmt.forPeriod } : {}) })) : (m.paidINR ? [{ _id: oid(), paidAt: d(m.paidAtDate ?? startDate), amountPaise: p(m.paidINR), note: '' }] : []),
    })),
    milestones: (milestonesList ?? []).map((ms) => ({
      _id: ms.id ?? oid(), name: ms.name, amountPaise: p(ms.amountINR),
      dueDate: ms.dueDate ? d(ms.dueDate) : undefined,
      status: ms.status ?? 'PENDING',
      ...(ms.invoiceId ? { invoiceId: ms.invoiceId } : {}),
      note: ms.note ?? '',
    })),
    createdAt: d(startDate), updatedAt: new Date(),
  };
}

function payslip(
  runMonthStr: string, userId: Types.ObjectId, amountINR: number, createdAtStr: string,
) {
  return {
    _id: oid(), runId: runId(runMonthStr), month: runMonthStr, userId,
    breakdown: {
      baseAmount: p(amountINR), hra: 0, specialAllowance: 0, lopDeduction: 0,
      providentFundEmployee: 0, professionalTax: 0, tdsMonthly: 0,
      lateDeduction: 0, bonusPaise: 0, manualDeductionPaise: 0,
    },
    grossPaise: p(amountINR), deductionsPaise: 0, netPaise: p(amountINR),
    workingDays: 26, presentDays: 26, lopDays: 0, currency: 'INR', adjustments: [],
    createdAt: d(createdAtStr), updatedAt: new Date(),
  };
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db!;
  console.log('[full-seed] Connected to MongoDB');

  for (const col of [
    'departments','designations','users','compensation_profiles','compensation_history',
    'clients','contracts','projects','invoices','payroll_runs','payslips','settings', 'expenses',
  ]) { try { await db.collection(col).drop(); } catch {} }
  console.log('[full-seed] Collections cleared');

  const now = new Date();
  const defaultPw = await bcrypt.hash('Zlaark@123', 10);
  const ownerPw   = await bcrypt.hash('kanish@7.7', 10);

  // ── SETTINGS ────────────────────────────────────────────────────────────────
  await db.collection('settings').insertOne({
    key: 'workspace', workspaceName: 'Zlaark', defaultCurrency: 'INR',
    timezone: 'Asia/Kolkata', locale: 'en-IN', weekendDays: [],
    annualLeavePerYear: 0, sickLeavePerYear: 0,
    city: 'Amritsar', state: 'Punjab', country: 'India',
    lateDeductionPaisePerDay: 0, createdAt: now, updatedAt: now,
  });

  // ── DEPARTMENTS ─────────────────────────────────────────────────────────────
  await db.collection('departments').insertMany([
    { _id: ID.dDev,  name: 'Development', description: 'Engineering & development team', createdAt: now, updatedAt: now },
    { _id: ID.dMgmt, name: 'Management',  description: 'Founders & operations',          createdAt: now, updatedAt: now },
  ]);

  // ── DESIGNATIONS ────────────────────────────────────────────────────────────
  await db.collection('designations').insertMany([
    { _id: ID.dgOwner,  title: 'Founder & CEO',         departmentId: ID.dMgmt, seniorityLevel: 10, createdAt: now, updatedAt: now },
    { _id: ID.dgFSD,    title: 'Full Stack Developer',   departmentId: ID.dDev,  seniorityLevel: 4,  createdAt: now, updatedAt: now },
    { _id: ID.dgDev,    title: 'Developer',              departmentId: ID.dDev,  seniorityLevel: 3,  createdAt: now, updatedAt: now },
    { _id: ID.dgDesign, title: 'Designer & Developer',   departmentId: ID.dDev,  seniorityLevel: 3,  createdAt: now, updatedAt: now },
    { _id: ID.dgIntern, title: 'Intern - Development',   departmentId: ID.dDev,  seniorityLevel: 1,  createdAt: now, updatedAt: now },
  ]);

  // ── USERS ───────────────────────────────────────────────────────────────────
  const mkMember = (id: Types.ObjectId, email: string, name: string, doj: string, skills: string[], desig: Types.ObjectId, status = 'ACTIVE') => ({
    _id: id, email, passwordHash: defaultPw, name, role: 'MEMBER', status,
    departmentId: ID.dDev, designationId: desig, dateOfJoining: d(doj),
    bio: '', skills, documents: [], onboardingChecklist: [], tokenVersion: 0,
    createdAt: d(doj), updatedAt: now,
  });
  // managerId: Jaya's team = Anjali, Harshika, Sanjana, Isha, Yatin
  //            Shivam's team = Jyoti Yadav, Amit
  const mkIntern = (id: Types.ObjectId, email: string, name: string, doj: string, managerId: Types.ObjectId, status = 'ACTIVE') => ({
    _id: id, email, passwordHash: defaultPw, name, role: 'INTERN', status,
    departmentId: ID.dDev, designationId: ID.dgIntern, dateOfJoining: d(doj),
    reportingManagerId: managerId,
    bio: '', skills: [], documents: [], onboardingChecklist: [], tokenVersion: 0,
    createdAt: d(doj), updatedAt: now,
  });

  await db.collection('users').insertMany([
    {
      _id: ID.uKanish, email: 'kanish@zlaark.com', passwordHash: ownerPw,
      name: 'Kanish Kumar', role: 'OWNER', status: 'ACTIVE',
      departmentId: ID.dMgmt, designationId: ID.dgOwner,
      dateOfJoining: d('2024-01-01'), bio: 'Founder & CEO at Zlaark',
      skills: ['WordPress', 'React', 'Node.js', 'Project Management', 'SEO'],
      documents: [], onboardingChecklist: [], tokenVersion: 0,
      createdAt: d('2024-01-01'), updatedAt: now,
    },
    mkMember(ID.uSidhak,    'sidhak@zlaark.com',     'Sidhak',           '2024-12-19', ['React','Node.js','WordPress','Next.js','MongoDB'], ID.dgFSD),
    mkMember(ID.uShabd,     'shabdpreet@zlaark.com',  'Shabdpreet Singh', '2025-02-06', ['React','Node.js','WordPress','Shopify'],           ID.dgFSD, 'EXITED'),
    mkMember(ID.uShivam,    'shivam@zlaark.com',      'Shivam',           '2025-07-01', ['React','Next.js','Tailwind','WordPress'],          ID.dgDev),
    mkMember(ID.uGeetanjali,'geetanjali@zlaark.com',  'Geetanjali',       '2025-09-01', ['React','WordPress','Figma','CSS'],                 ID.dgDesign),
    mkMember(ID.uJaya,      'jaya@zlaark.com',        'Jaya Arora',       '2025-08-11', ['Shopify','WordPress','React','Figma','UI Design'],  ID.dgDesign),
    // Jaya's team interns
    mkIntern(ID.uAnjali,     'anjali@zlaark.com',     'Anjali',           '2025-11-13', ID.uJaya, 'EXITED'),
    mkIntern(ID.uHarshika,   'harshika@zlaark.com',   'Harshika',         '2026-01-19', ID.uJaya),
    mkIntern(ID.uSanjana,    'sanjana@zlaark.com',    'Sanjana Mahindru', '2026-02-09', ID.uJaya, 'EXITED'),
    mkIntern(ID.uIsha,       'isha@zlaark.com',        'Isha',             '2026-03-01', ID.uJaya, 'EXITED'),
    mkIntern(ID.uYatin,      'yatin@zlaark.com',       'Yatin',            '2026-03-03', ID.uJaya),
    // Shivam's team interns
    mkIntern(ID.uJyotiYadav, 'jyotiyadav@zlaark.com', 'Jyoti Yadav',      '2026-04-17', ID.uShivam, 'EXITED'),
    mkIntern(ID.uAmit,       'amit@zlaark.com',        'Amit Maurya',      '2026-04-17', ID.uShivam),
  ]);

  // ── COMPENSATION PROFILES ───────────────────────────────────────────────────
  const mkProjComp = (uid: Types.ObjectId) => ({
    userId: uid, type: 'PROJECT_BASED', baseAmount: 0, currency: 'INR',
    hra: 0, specialAllowance: 0, providentFundEmployee: 0, providentFundEmployer: 0,
    professionalTax: 0, tdsMonthly: 0, effectiveFrom: now, notes: 'Project-based payouts',
    createdAt: now, updatedAt: now,
  });
  const mkStipend = (uid: Types.ObjectId, amtINR: number, from: string) => ({
    userId: uid, type: 'STIPEND', baseAmount: p(amtINR), currency: 'INR',
    hra: 0, specialAllowance: 0, providentFundEmployee: 0, providentFundEmployer: 0,
    professionalTax: 0, tdsMonthly: 0, effectiveFrom: d(from),
    createdAt: d(from), updatedAt: now,
  });

  await db.collection('compensation_profiles').insertMany([
    mkProjComp(ID.uSidhak), mkProjComp(ID.uShabd), mkProjComp(ID.uShivam),
    mkProjComp(ID.uGeetanjali), mkProjComp(ID.uJaya),
    mkStipend(ID.uAnjali,     1500, '2026-01-14'), // incremented Jan
    mkStipend(ID.uHarshika,   3000, '2026-05-19'), // incremented May
    mkStipend(ID.uSanjana,    3000, '2026-05-09'),
    mkStipend(ID.uIsha,       1000, '2026-03-01'),
    mkStipend(ID.uYatin,      3000, '2026-05-03'), // incremented May
    mkStipend(ID.uJyotiYadav, 1000, '2026-04-17'),
    mkStipend(ID.uAmit,       1000, '2026-04-17'),
  ]);

  // ── CLIENTS ─────────────────────────────────────────────────────────────────
  const mkClient = (id: Types.ObjectId, name: string, notes = '', contacts: object[] = []) => ({
    _id: id, name, gstin: '', address: '', contacts, notes, createdAt: now, updatedAt: now,
  });

  await db.collection('clients').insertMany([
    mkClient(ID.cLalit,          'Lalit Kumar Soni',       'Individual client — Fenkmat WordPress news website'),
    mkClient(ID.cSP,             'Social Parindee',         'Recurring agency client — multiple WordPress & web projects'),
    mkClient(ID.cFoody,          'Foodyqueen',              'Monthly development contract client — ongoing retainer'),
    mkClient(ID.cBluehutch,      'Blue Hutch Agency',       'Agency client — SoftwareKadai.com development'),
    mkClient(ID.cSculpt,         'Sculpt Agency',            'Agency owned by Sampreet — TaxBy Akram, Go Laundry, and originally BroBuzz projects'),
    mkClient(ID.cMendingMind,    'Mending Mind',            'Quiz platform & ongoing development'),
    mkClient(ID.cUnextdoor,      'Unextdoor',               'App deployment & web development'),
    mkClient(ID.cSourcingScreen, 'Sourcing Screen',          'Web development project'),
    mkClient(ID.cNJG,            'NJ Graphica',              'Agency — multiple design & dev projects'),
    mkClient(ID.cGessure,        'Gessure',                  'Platform development & ongoing maintenance retainer'),
    mkClient(ID.cDhawada,        'Dhawada',                  'E-commerce, NGO & Hiristan websites'),
    mkClient(ID.cSkoal,          'Skoal',                    'Website development — client ghosted after advance (total deal 20k, received 6k)'),
    mkClient(ID.cStartiffy,      'Startiffy',               'Studycrux LMS & Avco Energy website'),
    mkClient(ID.cDigitalMandir,  'Digital Mandir',           'App development'),
    mkClient(ID.cNamit,          'Namit',                    'CTO at Startiffy; also runs separate agency — client for Jouelcube and G-Power projects'),
    mkClient(ID.cHorizon,        'Horizon Technologies',     'HR Book — HRMS platform'),
    mkClient(ID.cFirstrank,      'Firstrank',               'Website & platform development'),
    mkClient(ID.cAnshulGlobal,   'Anshul Global Agency',    'Rewardzy & Onebox projects'),
    mkClient(ID.cInnoTrans,      'Inno Transventive',       'Real estate app & website'),
    mkClient(ID.cVelotra,        'Velotra',                  'Website development — ongoing'),
    mkClient(ID.cBallBoundary,   'BallBoundary',            'Website updates'),
    mkClient(ID.cAllWheel,       'AllWheelDriving School',  'WordPress website'),
    mkClient(ID.cSellercircle,   'Sellercircle',            'Website updates, blog & virus removal'),
    mkClient(ID.cSWBuild,        'SW Build',                'Website development'),
    mkClient(ID.cShivAiTelerad,  'ShivAiTelerad',           'Website development'),
    mkClient(ID.cEldeco,         'Eldeco',                   'Website development'),
    mkClient(ID.cArowai,         'Arowai',                   'Website development'),
    mkClient(ID.cBroBuzz,        'Bro Buzz',                'App development — originally via Sculpt Agency (Sampreet), now a direct client after Sculpt left as mediator'),
    mkClient(ID.cBitaminNaturals,'Bitamin Naturals',        'Website development — client payment issues, agency covered cost'),
    mkClient(ID.cOnebox,         'Onebox',                   'Platform development — separate client; 28k pending'),
    mkClient(ID.cHostinger,      'Hostinger',               'Affiliate/referral income from Hostinger partnership'),
  ]);

  // ── CONTRACTS ───────────────────────────────────────────────────────────────
  await db.collection('contracts').insertMany([
    {
      _id: ID.cFoodyContract,
      name: 'Foodyqueen Monthly Development Retainer',
      clientId: ID.cFoody,
      description: 'Ongoing monthly development contract — maintained by Kanish',
      monthlyAmountPaise: p(22000),
      currency: 'INR',
      status: 'ACTIVE',
      startDate: d('2025-01-15'),
      notes: 'Month-to-month retainer. No fixed end date. Kanish handles all development.',
      billingDay: 20,
      createdAt: d('2025-01-01'), updatedAt: new Date(),
    },
    {
      _id: ID.cGessureContract,
      name: 'Gessure Support & Maintenance',
      clientId: ID.cGessure,
      description: 'Monthly support and maintenance retainer — started after development completion',
      monthlyAmountPaise: p(20000),
      currency: 'INR',
      status: 'ACTIVE',
      startDate: d('2026-02-27'),
      notes: 'First 2 months (Feb-Mar 2026) @ ₹15k. Apr 2026 @ ₹20k. May 2026 @ ₹24k (one month only). From June 2026 @ ₹20k. Sidhak handles maintenance.',
      billingDay: 1,
      createdAt: d('2026-02-27'), updatedAt: new Date(),
    },
    {
      _id: ID.cMendingMindContract,
      name: 'Mending Mind Monthly Retainer',
      clientId: ID.cMendingMind,
      description: 'Ongoing monthly retainer — started after platform balance settled',
      monthlyAmountPaise: p(7000),
      currency: 'INR',
      status: 'ACTIVE',
      startDate: d('2026-08-03'),
      notes: 'Monthly retainer of ₹7,000 starting Aug 2026.',
      billingDay: 3,
      createdAt: d('2026-08-03'), updatedAt: new Date(),
    },
  ]);
  console.log('[full-seed] Inserted contracts');

  // ── PROJECTS ────────────────────────────────────────────────────────────────
  const L = 'LEAD', C = 'CONTRIBUTOR';

  await db.collection('projects').insertMany([
    project(ID.pFenkmat, 'Fenkmat WordPress News Website', 'FENKMAT', ID.cLalit, 'COMPLETED', '2024-12-19', '2025-01-01', [{ uid: ID.uSidhak, role: L, amountINR: 2400, payments: [
      { amountINR: 1000, paidAtDate: '2024-12-31', note: 'Advance Dec' },
      { amountINR: 1400, paidAtDate: '2025-01-15', note: 'Final Jan' },
    ] }], 5500, 3100, 'WordPress news website — Sidhak 2.4k (1k Dec + 1.4k Jan)'),
    project(ID.pSPFixes, 'Social Parindee Website Fixes', 'SP-FIXES', ID.cSP, 'COMPLETED', '2025-01-10', '2025-01-20', [{ uid: ID.uKanish, role: L }], 1200, 1200, 'General website fixes done by owner'),
    project(ID.pSoftwareKadai, 'SoftwareKadai.com Development', 'SWKADAI', ID.cBluehutch, 'COMPLETED', '2025-02-06', '2025-02-28', [{ uid: ID.uShabd, role: L, amountINR: 2500, paidINR: 2500, paidAtDate: '2025-02-28' }], 4000, 1500, 'Full website development — Shabd 2.5k paid'),
    project(ID.pTaxByAkram, 'TaxBy Akram Website', 'TAXBYAKRAM', ID.cSculpt, 'COMPLETED', '2025-02-01', '2025-03-01', [{ uid: ID.uKanish, role: L }], 4000, 4000, 'Website done by Kanish for Sculpt Agency (Sampreet)'),
    project(ID.pCityDental, 'City Dental WordPress Website', 'CITYDENTAL', ID.cSP, 'COMPLETED', '2025-03-01', '2025-03-17', [{ uid: ID.uSidhak, role: L, amountINR: 2000, paidINR: 2000, paidAtDate: '2025-03-17' }], 5500, 3500, 'WordPress website for dental clinic — Sidhak 2k paid'),
    project(ID.pSellercircle, 'Sellercircle Website & Blog', 'SELLERCIRCLE', ID.cSellercircle, 'COMPLETED', '2025-03-01', '2025-05-31', [{ uid: ID.uShabd, role: L, amountINR: 13000, payments: [
      { amountINR: 4500, paidAtDate: '2025-04-30', note: 'Advance Apr 2025' },
      { amountINR: 4000, paidAtDate: '2026-04-06', note: 'Payment 2' },
      { amountINR: 4500, paidAtDate: '2026-04-30', note: 'Payment 3' },
    ] }], 18810, 14310, 'Website + blog page creation — Shabd 13k (4.5k Apr 2025 + 8.5k Apr 2026)'),
    project(ID.pSellercircle2, 'Sellercircle Virus Removal & Updates', 'SELLERCIRCLE-V', ID.cSellercircle, 'COMPLETED', '2026-01-01', '2026-01-31', [{ uid: ID.uSidhak, role: L, amountINR: 4000, paidINR: 4000, paidAtDate: '2026-01-31' }], 9000, 5000, 'Virus removal & minor website updates — Sidhak 4k paid Jan'),
    project(ID.pBallBoundary, 'BallBoundary Website Updates', 'BALLBOUNDARY', ID.cBallBoundary, 'COMPLETED', '2025-04-03', '2025-04-03', [{ uid: ID.uKanish, role: L }], 1000, 1000, 'Website updates done by Kanish'),
    project(ID.pMendingMindQuiz, 'Mending Mind Quiz Website', 'MM-QUIZ', ID.cMendingMind, 'COMPLETED', '2025-04-01', '2025-07-20', [{ uid: ID.uShabd, role: L }, { uid: ID.uJaya, role: C }], 11700, 7700, 'Quiz website — fully paid (₹11.7k received Apr–Jul 2025)'),
    project(ID.pMendingMindPlatform, 'Mending Mind Platform', 'MM-PLATFORM', ID.cMendingMind, 'ACTIVE', '2025-10-01', null, [
      { uid: ID.uShabd, role: L, amountINR: 9000, payments: [
        { amountINR: 2500, paidAtDate: '2025-10-31', note: 'Milestone Oct', forPeriod: '2025-10' },
        { amountINR: 1000, paidAtDate: '2025-12-31', note: 'Milestone Dec', forPeriod: '2025-12' },
        { amountINR: 5500, paidAtDate: '2026-04-30', note: 'Milestone Apr', forPeriod: '2026-04' },
      ]},
      { uid: ID.uJaya, role: C, amountINR: 10000, paidINR: 10000, payments: [
        { amountINR: 1500, paidAtDate: '2025-12-08', note: 'Milestone Dec' },
        { amountINR: 6000, paidAtDate: '2026-02-01', note: 'Milestone Feb' },
        { amountINR: 2500, paidAtDate: '2026-07-03', note: 'Additional (Jul)' },
      ]},
      { uid: ID.uGeetanjali, role: C, amountINR: 500, payments: [
        { amountINR: 500, paidAtDate: '2025-12-31', note: 'Design work Dec' },
      ]},
    ], 38000, 22500, 'Platform development — fully paid (₹18k balance received: ₹8k Jun 29 + ₹5k Jul 23 + ₹5k Aug 3); Shabd 9k (Oct+Dec+Apr), Jaya 10k (1.5k Dec + 6k Feb + 2.5k Jul), Geetanjali 500 (Dec)',
      [
        { name: 'Payment 1', amountINR: 5000,  dueDate: '2025-10-04', status: 'COLLECTED', invoiceId: ID.iMendingMindPlatform, note: 'Oct 2025' },
        { name: 'Payment 2', amountINR: 5000,  dueDate: '2025-12-07', status: 'COLLECTED', invoiceId: ID.iMendingMindP2, note: 'Dec 2025' },
        { name: 'Payment 3', amountINR: 10000, dueDate: '2026-02-11', status: 'COLLECTED', invoiceId: ID.iMendingMindP3, note: 'Feb 2026' },
        { name: 'Balance',   amountINR: 18000, status: 'COLLECTED',   invoiceId: ID.iMendingMindBalance,  note: 'Balance ₹18,000 — fully paid: ₹8k Jun 29 + ₹5k Jul 23 + ₹5k Aug 3' },
      ]),
    project(ID.pAllWheel, 'AllWheelDriving School Website', 'ALLWHEEL', ID.cAllWheel, 'COMPLETED', '2025-04-01', '2025-04-18', [{ uid: ID.uKanish, role: L }], 5500, 5500, 'WordPress website done by Kanish'),
    project(ID.pSocialSecurity, 'Social Security Website', 'SP-SECSEC', ID.cSP, 'COMPLETED', '2025-04-15', '2025-04-23', [{ uid: ID.uSidhak, role: L, amountINR: 2000, paidINR: 2000, paidAtDate: '2025-04-23' }], 5500, 3500, 'Social security website development — Sidhak 2k paid'),
    project(ID.pInterioDecor, 'InterioDecor Website', 'SP-INTERIODECOR', ID.cSP, 'COMPLETED', '2025-05-15', '2025-05-26', [{ uid: ID.uSidhak, role: L, amountINR: 1000, paidINR: 1000, paidAtDate: '2025-05-26' }], 2600, 1600, 'Interior decoration website — Sidhak 1k paid'),
    project(ID.pUnextdoor, 'Unextdoor App & Website', 'UNEXTDOOR', ID.cUnextdoor, 'COMPLETED', '2025-06-19', '2025-09-24', [{ uid: ID.uKanish, role: L }, { uid: ID.uShivam, role: C, amountINR: 3000, paidINR: 3000, paidAtDate: '2025-09-24' }], 32500, 29500, 'Play store / App store deployment & website development — Shivam 3k paid'),
    project(ID.pPNJFitness, 'PNJ Fitness Website', 'SP-PNJFITNESS', ID.cSP, 'COMPLETED', '2025-07-01', '2025-07-21', [{ uid: ID.uKanish, role: L }], 1200, 1200, 'Fitness website development'),
    project(ID.pBestDiet, 'Best Diet WordPress Website', 'SP-BESTDIET', ID.cSP, 'COMPLETED', '2025-07-15', '2025-07-29', [{ uid: ID.uShivam, role: L, amountINR: 2000, paidINR: 2000, paidAtDate: '2025-07-29' }], 5500, 3500, 'WordPress diet website — Shivam 2k paid'),
    project(ID.pSourcingScreen, 'Sourcing Screen Website', 'SOURCINGSCREEN', ID.cSourcingScreen, 'COMPLETED', '2025-07-29', '2026-01-30', [{ uid: ID.uSidhak, role: L, amountINR: 2000, paidINR: 2000, paidAtDate: '2026-01-30' }], 15100, 11100, 'Web development project — Sidhak 2k paid'),
    project(ID.pElectricMarshmallow, 'Electric Marshmallow', 'ELECMARSH', ID.cNJG, 'COMPLETED', '2025-08-11', '2025-09-09', [
      { uid: ID.uJaya, role: L, amountINR: 1750, payments: [
        { amountINR: 500,  paidAtDate: '2025-08-31', note: 'Advance Aug' },
        { amountINR: 1250, paidAtDate: '2025-09-09', note: 'Final Sep' },
      ]},
      { uid: ID.uSidhak, role: C, amountINR: 1750, payments: [
        { amountINR: 500,  paidAtDate: '2025-08-31', note: 'Advance Aug' },
        { amountINR: 1250, paidAtDate: '2025-09-09', note: 'Final Sep' },
      ]},
    ], 7500, 4000, 'Design & development for NJ Graphica — Jaya 1.75k + Sidhak 1.75k'),
    project(ID.pGessure, 'Gessure Platform', 'GESSURE', ID.cGessure, 'COMPLETED', '2025-09-17', '2026-02-27', [
      { uid: ID.uSidhak, role: L, payments: [
        { amountINR: 1000,  paidAtDate: '2025-10-31', note: 'Dev milestone — Oct', forPeriod: '2025-10' },
        { amountINR: 7500,  paidAtDate: '2026-01-15', note: 'Dev milestone — Jan final', forPeriod: '2026-01' },
        { amountINR: 6000,  paidAtDate: '2026-02-27', note: 'Maintenance Feb (40% of ₹15k)', forPeriod: '2026-02' },
        { amountINR: 6000,  paidAtDate: '2026-03-31', note: 'Maintenance Mar (40% of ₹15k)', forPeriod: '2026-03' },
        { amountINR: 6000,  paidAtDate: '2026-04-30', note: 'Maintenance Apr (40% of ₹15k)', forPeriod: '2026-04' },
        { amountINR: 12000, paidAtDate: '2026-06-10', note: 'Maintenance May (late, paid Jun; new rate 50% of ₹24k; ₹3k Claude contribution deducted from payslip)', forPeriod: '2026-05' },
        { amountINR: 12000, paidAtDate: '2026-07-03', note: 'Maintenance Jun (₹20k retainer; ₹2.5k Claude contribution deducted from payslip, net ₹9.5k cash)', forPeriod: '2026-06' },
        { amountINR: 12000, paidAtDate: '2026-08-01', note: 'Maintenance Jul (₹20k retainer; ₹2.5k Claude contribution deducted from payslip, net ₹9.5k cash)', forPeriod: '2026-07' },
        { amountINR: 12000, paidAtDate: '2026-08-01', note: 'Maintenance Aug (₹20k retainer; ₹2.5k Claude contribution deducted from payslip, net ₹9.5k cash)', forPeriod: '2026-08' },
      ]},
      { uid: ID.uJaya, role: C, amountINR: 2000, payments: [
        { amountINR: 1000, paidAtDate: '2025-10-31', note: 'Dev milestone — Oct', forPeriod: '2025-10' },
        { amountINR: 1000, paidAtDate: '2026-01-15', note: 'Dev milestone — Jan final', forPeriod: '2026-01' },
      ]},
      { uid: ID.uShivam, role: C, amountINR: 5000, payments: [
        { amountINR: 1000, paidAtDate: '2025-10-31', note: 'Dev milestone — Oct', forPeriod: '2025-10' },
        { amountINR: 2000, paidAtDate: '2025-11-30', note: 'Dev milestone — Nov', forPeriod: '2025-11' },
        { amountINR: 2000, paidAtDate: '2026-01-15', note: 'Dev milestone — Jan final', forPeriod: '2026-01' },
      ]},
      { uid: ID.uGeetanjali, role: C, amountINR: 4000, payments: [
        { amountINR: 1000, paidAtDate: '2025-10-31', note: 'Dev milestone — Oct', forPeriod: '2025-10' },
        { amountINR: 3000, paidAtDate: '2026-01-15', note: 'Dev milestone — Jan final', forPeriod: '2026-01' },
      ]},
      { uid: ID.uShabd, role: C, amountINR: 1000, payments: [
        { amountINR: 1000, paidAtDate: '2025-10-31', note: 'Dev milestone — Oct', forPeriod: '2025-10' },
      ]},
    ], 94001, 36501, 'Platform development (Sep 2025 – Feb 2026). Maintenance via contract from Feb 27 — retainer ₹15k Feb–Apr, ₹24k May (one month only), ₹20k from Jun onward; Sidhak handles maintenance.'),
    project(ID.pShivmani, 'Shivmanicreations Website', 'SP-SHIVMANI', ID.cSP, 'COMPLETED', '2025-09-01', '2025-09-18', [{ uid: ID.uShivam, role: L, amountINR: 1000, paidINR: 1000, paidAtDate: '2025-09-18' }], 3500, 2500, 'Website development — Shivam 1k paid'),
    project(ID.pShivAiTelerad, 'ShivAiTelerad Website', 'SHIVAI', ID.cShivAiTelerad, 'COMPLETED', '2025-09-19', '2025-11-22', [{ uid: ID.uGeetanjali, role: L, amountINR: 1000, paidINR: 1000, paidAtDate: '2025-09-30' }], 6500, 5500, 'Website development — Geetanjali 1k paid'),
    project(ID.pSWBuild, 'SW Build Website', 'SWBUILD', ID.cSWBuild, 'COMPLETED', '2025-09-27', '2025-09-27', [{ uid: ID.uSidhak, role: L, amountINR: 1500, paidINR: 1500, paidAtDate: '2025-09-27' }], 3500, 2000, 'Website development — Sidhak 1.5k paid'),
    project(ID.pDhawada, 'Dhawada E-commerce Website', 'DHAWADA', ID.cDhawada, 'ACTIVE', '2025-10-06', null, [
      { uid: ID.uJaya, role: L, amountINR: 6000, payments: [
        { amountINR: 2000, paidAtDate: '2025-11-30', note: 'Milestone Nov' },
        { amountINR: 4000, paidAtDate: '2025-12-31', note: 'Milestone Dec' },
      ]},
      { uid: ID.uShabd, role: C, amountINR: 6000, payments: [
        { amountINR: 2000, paidAtDate: '2025-11-30', note: 'Milestone Nov' },
        { amountINR: 2000, paidAtDate: '2025-12-31', note: 'Milestone Dec' },
        { amountINR: 2000, paidAtDate: '2026-04-30', note: 'Milestone Apr' },
      ]},
    ], 56500, 36500, 'E-commerce website — 12.5k pending from client; Jaya 6k (Nov+Dec), Shabd 6k (Nov+Dec+Apr); logo by Shubham Jain (freelancer); Figma by Sampreet (freelancer)',
      [
        { name: 'Advance',            amountINR: 12500, dueDate: '2025-10-06', status: 'COLLECTED', invoiceId: ID.iDhawada,   note: 'Advance — Oct 6' },
        { name: 'Milestone 2',        amountINR: 12500, dueDate: '2025-11-02', status: 'COLLECTED', invoiceId: ID.iDhawadaM2, note: 'Milestone 2 — Nov 2' },
        { name: 'Milestone 3 + Logo', amountINR: 19000, dueDate: '2025-12-14', status: 'COLLECTED', invoiceId: ID.iDhawadaM3, note: 'Milestone 3 + Logo — Dec 14' },
        { name: 'Final',              amountINR: 12500, status: 'PENDING',     note: 'Final payment pending' },
      ]),
    project(ID.pSkoal, 'Skoal Website', 'SKOAL', ID.cSkoal, 'ON_HOLD', '2025-11-22', null, [{ uid: ID.uJaya, role: C, amountINR: 2500, paidINR: 2500, paidAtDate: '2026-03-27' }, { uid: ID.uSidhak, role: L, amountINR: 2500, paidINR: 2500, paidAtDate: '2026-04-01' }], 20000, 6000, 'Client ghosted — Jaya 2.5k (Mar 27) + Sidhak 2.5k (Apr 1). Work delivered; 14k written off.'),
    project(ID.pLandingPages, 'NJ Graphica 2 Landing Pages', 'NJG-LANDING', ID.cNJG, 'COMPLETED', '2025-10-01', '2025-10-09', [
      { uid: ID.uSidhak, role: L, amountINR: 1000, paidINR: 1000, paidAtDate: '2025-10-09' },
      { uid: ID.uJaya,   role: C, amountINR: 1000, paidINR: 1000, paidAtDate: '2025-10-09' },
    ], 5500, 3500, '2 landing pages — Sidhak 1k + Jaya 1k paid'),
    project(ID.pSoulnamaste, 'Soulnamaste Website', 'SP-SOULNAMASTE', ID.cSP, 'COMPLETED', '2025-10-01', '2025-10-13', [{ uid: ID.uSidhak, role: L, amountINR: 2500, paidINR: 2500, paidAtDate: '2025-10-13' }], 5000, 2500, 'Website development — Sidhak 2.5k paid'),
    project(ID.pGiftParty, 'GiftParty Shopify Website', 'NJG-GIFTPARTY', ID.cNJG, 'COMPLETED', '2025-11-01', '2025-11-11', [{ uid: ID.uKanish, role: L }], 8000, 8000, 'Shopify website development'),
    project(ID.pMrVeg, 'Mr Veg Website', 'SP-MRVEG', ID.cSP, 'COMPLETED', '2025-11-01', '2025-11-04', [
      { uid: ID.uJaya,   role: L, amountINR: 2000, paidINR: 2000, paidAtDate: '2025-11-04' },
      { uid: ID.uSidhak, role: C, amountINR: 2000, paidINR: 2000, paidAtDate: '2025-11-04' },
    ], 10000, 6000, 'Website development — Jaya 2k + Sidhak 2k paid'),
    project(ID.pSPNov25, 'Social Parindee Website Maintenance Nov 2025', 'SP-NOV25', ID.cSP, 'COMPLETED', '2025-11-25', '2025-11-25', [{ uid: ID.uSidhak, role: L, amountINR: 800, paidINR: 800, paidAtDate: '2025-11-25' }], 1600, 800, 'Small website maintenance — Sidhak 800 paid'),
    project(ID.pUttrakhand, 'Uttrakhand News Website', 'SP-UTTRAKHAND', ID.cSP, 'COMPLETED', '2025-12-01', '2025-12-14', [{ uid: ID.uSidhak, role: L, amountINR: 1500, paidINR: 1500, paidAtDate: '2025-12-14' }], 3300, 1800, 'News website development — Sidhak 1.5k paid'),
    project(ID.pGoLaundry, 'Go Laundry Website', 'GOLAUNDRY', ID.cSculpt, 'COMPLETED', '2025-12-01', '2026-01-15', [
      { uid: ID.uGeetanjali, role: L, amountINR: 2500, paidINR: 2500, paidAtDate: '2025-12-31' },
      { uid: ID.uJaya,       role: C, amountINR: 2800, paidINR: 2800, paidAtDate: '2025-12-31' },
    ], 14500, 9200, 'Website development for Sculpt Agency — Geetanjali 2.5k + Jaya 2.8k paid'),
    project(ID.pGKGIndustries, 'GKG Industries Website', 'SP-GKG', ID.cSP, 'COMPLETED', '2025-12-15', '2025-12-30', [{ uid: ID.uGeetanjali, role: L, amountINR: 1800, paidINR: 1800, paidAtDate: '2025-12-30' }], 5000, 3200, 'Industries website development — 1.8k paid to Geetanjali'),
    project(ID.pStudycrux, 'Studycrux LMS', 'STUDYCRUX', ID.cStartiffy, 'ACTIVE', '2026-02-01', null, [{ uid: ID.uShivam, role: L, amountINR: 40000, paidINR: 18500, payments: [{ amountINR: 1500, paidAtDate: '2026-02-01', note: 'Initial payment' }, { amountINR: 5500, paidAtDate: '2026-05-01', note: 'Second payment' }, { amountINR: 5000, paidAtDate: '2026-07-08', note: 'Third payment' }, { amountINR: 2500, paidAtDate: '2026-08-03', note: 'Claude contribution — deducted from LMS balance, no cash paid out' }, { amountINR: 4000, paidAtDate: '2026-08-06', note: 'Fourth payment (Aug)' }] }], 80000, 40000, 'LMS development — dev cost 40k; Shivam budgeted 40k, paid 18.5k (1.5k Feb 1 + 5.5k May 1 + 5k Jul 8 + 2.5k Aug 3 Claude contribution no cash + 4k Aug 6); 55k pending from client',
      [
        { name: 'Advance',     amountINR: 5000,  dueDate: '2026-02-01', status: 'COLLECTED', invoiceId: ID.iStudycrux,   note: 'Initial — Feb 1' },
        { name: 'Milestone 2', amountINR: 20000, dueDate: '2026-05-22', status: 'COLLECTED', invoiceId: ID.iStudycruxM2, note: 'Milestone 2 — May 22' },
        { name: 'Final',       amountINR: 55000, status: 'PENDING',     note: 'Final balance pending' },
      ]),
    project(ID.pDigitalMandir, 'Digital Mandir App', 'DIGITALMANDIR', ID.cDigitalMandir, 'COMPLETED', '2026-02-01', '2026-06-13', [{ uid: ID.uGeetanjali, role: L, amountINR: 9000, paidINR: 9000, payments: [{ amountINR: 4500, paidAtDate: '2026-02-01', note: 'Payment 1' }, { amountINR: 4500, paidAtDate: '2026-05-27', note: 'Payment 2' }] }], 15000, 4000, 'Android app + admin panel. Fully paid — 10% advance (1.5k Feb 1) + 50% milestone (7.5k Feb 28) + 40% final (6k Jun 13).',
      [
        { name: 'Advance (10%)',    amountINR: 1500, dueDate: '2026-02-01', status: 'COLLECTED', invoiceId: ID.iDigitalMandir1, note: 'Advance 10% — Feb 1' },
        { name: 'Milestone (50%)', amountINR: 7500, dueDate: '2026-02-28', status: 'COLLECTED', invoiceId: ID.iDigitalMandir2, note: '50% milestone — Feb 28' },
        { name: 'Final (40%)',     amountINR: 6000, dueDate: '2026-06-13', status: 'COLLECTED', invoiceId: ID.iDigitalMandir3, note: 'Final 40% — Jun 13' },
      ]),
    project(ID.pHRBook, 'HR Book HRMS', 'HRBOOK', ID.cHorizon, 'ACTIVE', '2026-02-23', null, [{ uid: ID.uJaya, role: L, amountINR: 20000, paidINR: 20000, payments: [{ amountINR: 10000, paidAtDate: '2026-05-01', note: 'Payment 1' }, { amountINR: 10000, paidAtDate: '2026-07-03', note: 'Payment 2 (Jul)' }] }, { uid: ID.uSidhak, role: C, amountINR: 20000, paidINR: 0 }], 240000, 82500, 'HRMS platform — 57.5k pending from client; 70k to Jyoti Makwana (freelancer, 52.5k paid across 3 phases), 20k to Jaya (fully paid), 20k to Sidhak pending',
      [
        { name: 'Advance',     amountINR: 10000,  dueDate: '2026-02-23', status: 'COLLECTED', invoiceId: ID.iHRBook,   note: 'Advance — Feb 23' },
        { name: 'Milestone 2', amountINR: 57500,  dueDate: '2026-05-01', status: 'COLLECTED', invoiceId: ID.iHRBookM2, note: 'Milestone 2 — May 1' },
        { name: 'Milestone 3', amountINR: 57500,  dueDate: '2026-06-25', status: 'COLLECTED', invoiceId: ID.iHRBook2, note: 'Milestone 3 — paid Jun 27 (NEFT)' },
        { name: 'Milestone 4', amountINR: 57500,  dueDate: '2026-07-27', status: 'COLLECTED', note: 'Milestone 4 (Phase 3) — paid Jul 27 (NEFT)' },
        { name: 'Balance',     amountINR: 57500,  status: 'PENDING',                          note: 'Remaining ₹57,500' },
      ]),
    project(ID.pFirstrank, 'Firstrank Website & Platform', 'FIRSTRANK', ID.cFirstrank, 'ACTIVE', '2026-03-06', null, [{ uid: ID.uJaya, role: L, amountINR: 45000, paidINR: 37500, payments: [
      { amountINR: 10000, paidAtDate: '2026-06-02', note: 'Payment 1' },
      { amountINR: 10000, paidAtDate: '2026-07-03', note: 'Payment 2 (Jul)' },
      { amountINR: 17500, paidAtDate: '2026-08-03', note: 'Payment 3 (Aug) — ₹2.5k Claude contribution deducted from payslip, net ₹15k cash' },
    ] }, { uid: ID.uSidhak, role: C, amountINR: 45000, paidINR: 0 }, { uid: ID.uKanish, role: C, amountINR: 0 }], 530000, 440000, 'Website & platform — 258k received of 530k (M4 ₹63k collected Jul 1; M5 ₹1,10,000 fully collected — ₹55k Aug 2 + ₹55k Aug 5); 37.5k of 45k paid to Jaya (10k Jun 2 + 10k Jul + 17.5k Aug, net 15k cash after ₹2.5k Claude contribution); 0 of 45k paid to Sidhak',
      [
        { name: 'Advance',     amountINR: 10000,  dueDate: '2026-03-06', status: 'COLLECTED', invoiceId: ID.iFirstrank,   note: 'Advance payment — Mar 6' },
        { name: 'Milestone 2', amountINR: 25000,  dueDate: '2026-04-04', status: 'COLLECTED', invoiceId: ID.iFirstrankM2, note: 'Milestone 2 — Apr 4' },
        { name: 'Milestone 3', amountINR: 50000,  dueDate: '2026-06-02', status: 'COLLECTED', invoiceId: ID.iFirstrankM3, note: 'Milestone 3 — Jun 2' },
        { name: 'Milestone 4', amountINR: 63000,  dueDate: '2026-06-24', status: 'COLLECTED', invoiceId: ID.iFirstrank2, note: 'Milestone 4 — collected Jul 1' },
        { name: 'Milestone 5', amountINR: 110000, dueDate: '2026-08-02', status: 'COLLECTED', invoiceId: ID.iFirstrankM5, note: 'Milestone 5 — fully collected: ₹55,000 Aug 2 + ₹55,000 Aug 5' },
        { name: 'Balance',     amountINR: 272000, status: 'PENDING',                          note: 'Remaining balance — ₹2,72,000' },
      ]),
    project(ID.pRewardzy, 'Rewardzy Platform', 'REWARDZY', ID.cAnshulGlobal, 'ACTIVE', '2026-03-13', null, [{ uid: ID.uSidhak, role: L, amountINR: 12000, paidINR: 0 }], 30000, 18000, '9k pending from client; 12k to Sidhak (not paid yet)',
      [
        { name: 'Advance',     amountINR: 9000,  dueDate: '2026-03-13', status: 'COLLECTED', invoiceId: ID.iRewardzy,   note: 'Advance — Mar 13' },
        { name: 'Milestone 2', amountINR: 12000, dueDate: '2026-04-19', status: 'COLLECTED', invoiceId: ID.iRewardzyM2, note: 'Milestone 2 — Apr 19' },
        { name: 'Final',       amountINR: 9000,  status: 'PENDING',     note: 'Final payment pending' },
      ]),
    project(ID.pOnebox, 'Onebox Project', 'ONEBOX', ID.cOnebox, 'ACTIVE', '2026-03-14', null, [{ uid: ID.uKanish, role: L, amountINR: 0 }, { uid: ID.uGeetanjali, role: C, amountINR: 10000, paidINR: 5000, payments: [{ amountINR: 5000, paidAtDate: '2026-07-10', note: 'Payment 1' }] }], 40000, 30000, 'Platform development — 28k received of 40k (12k Mar 14 + 16k Jul 6); 12k pending from client; Geetanjali 10k budgeted, 5k paid (Jul 10)',
      [
        { name: 'Milestone 1', amountINR: 12000, dueDate: '2026-03-14', status: 'COLLECTED', invoiceId: ID.iOnebox,  note: 'Advance — Mar 14' },
        { name: 'Milestone 2', amountINR: 16000, dueDate: '2026-07-06', status: 'COLLECTED', invoiceId: ID.iOnebox2, note: 'Milestone 2 — Jul 6' },
        { name: 'Milestone 3', amountINR: 12000, status: 'PENDING',                          note: 'Final milestone — ₹12k pending' },
      ]),
    project(ID.pRealEstate, 'Inno Transventive Real Estate App', 'INNO-REALESTATE', ID.cInnoTrans, 'ACTIVE', '2026-04-06', null, [{ uid: ID.uShivam, role: L, amountINR: 30000 }], 87000, 57000, 'Real estate app — ₹26.15k invoiced Aug 11 (M2 shortfall + M3) on the combined Inno invoice; ₹39.2k still to bill; ₹30k to Shivam',
      [
        { name: 'Advance',     amountINR: 13050, dueDate: '2026-04-06', status: 'COLLECTED', invoiceId: ID.iRealEstate,   note: 'Advance — Apr 6' },
        // Milestone 2 was raised at ₹13,000 but only ₹8,600 came in; the ₹4,400
        // shortfall is re-billed on the combined Aug 2026 invoice below.
        { name: 'Milestone 2', amountINR: 8600,  dueDate: '2026-05-21', status: 'COLLECTED', invoiceId: ID.iRealEstateM2, note: 'Milestone 2 — May 21 (₹8,600 of ₹13,000 collected)' },
        { id: ID.msRealEstateM2Short, name: 'Milestone 2 shortfall', amountINR: 4400, dueDate: '2026-08-25', status: 'INVOICED', invoiceId: ID.iInnoCombined, note: 'Unpaid balance of Milestone 2 — re-billed Aug 11' },
        { id: ID.msRealEstateM3,      name: 'Milestone 3',           amountINR: 21750, dueDate: '2026-08-25', status: 'INVOICED', invoiceId: ID.iInnoCombined, note: 'Milestone 3 — invoiced Aug 11' },
        { name: 'Balance',     amountINR: 39200, status: 'PENDING',   note: 'Balance ₹39,200 not yet invoiced' },
      ]),
    project(ID.pInnoWebsite, 'Inno Transventive Website', 'INNO-WEBSITE', ID.cInnoTrans, 'ACTIVE', '2026-04-06', null, [{ uid: ID.uShivam, role: L, amountINR: 11000 }, { uid: ID.uGeetanjali, role: C, amountINR: 11000, paidINR: 5000, paidAtDate: '2026-07-02' }], 30000, 8000, 'Website development — ₹25k final balance invoiced Aug 11 on the combined Inno invoice; ₹11k to Shivam; ₹11k to Geetanjali (5k paid Jul 2, 6k pending)',
      [
        { name: 'Milestone 1', amountINR: 5000,  dueDate: '2026-05-21', status: 'COLLECTED', invoiceId: ID.iInnoWebsite, note: 'Milestone 1 — May 21' },
        { id: ID.msInnoWebsiteBalance, name: 'Final balance', amountINR: 25000, dueDate: '2026-08-25', status: 'INVOICED', invoiceId: ID.iInnoCombined, note: 'Final balance — invoiced Aug 11 on the combined Inno invoice' },
      ]),
    project(ID.pNavisha, 'Navisha Website', 'SP-NAVISHA', ID.cSP, 'COMPLETED', '2026-03-15', '2026-03-27', [{ uid: ID.uJaya, role: L, amountINR: 5000, paidINR: 5000, paidAtDate: '2026-03-27' }], 12000, 7000, 'Website development — 5k paid to Jaya on Mar 27'),
    project(ID.pAvcoEnergy, 'Avco Energy Website', 'AVCO-ENERGY', ID.cStartiffy, 'COMPLETED', '2026-04-01', '2026-04-30', [{ uid: ID.uJaya, role: L, amountINR: 2000, paidINR: 2000, paidAtDate: '2026-04-19' }, { uid: ID.uSidhak, role: C, amountINR: 2000, paidINR: 2000, paidAtDate: '2026-04-30' }], 8000, 4000, 'Website development'),
    project(ID.pEldeco, 'Eldeco Website', 'ELDECO', ID.cEldeco, 'COMPLETED', '2026-04-28', '2026-05-20', [{ uid: ID.uShivam, role: L, amountINR: 3500, paidINR: 3500, payments: [{ amountINR: 1500, paidAtDate: '2026-04-28', note: 'Advance' }, { amountINR: 2000, paidAtDate: '2026-05-20', note: 'Final' }] }], 3500, 2500, 'Website development — fully paid (1.5k Apr 28 + 2k May 20).',
      [
        { name: 'Advance', amountINR: 1500, dueDate: '2026-04-28', status: 'COLLECTED', invoiceId: ID.iEldeco,      note: 'Advance — Apr 28' },
        { name: 'Final',   amountINR: 2000, dueDate: '2026-05-20', status: 'COLLECTED', invoiceId: ID.iEldecoFinal, note: 'Final — May 20' },
      ]),
    project(ID.pBroBuzz, 'Bro Buzz App', 'BROBUZZ', ID.cBroBuzz, 'ACTIVE', '2026-02-01', null, [{ uid: ID.uShivam, role: L, amountINR: 9000, paidINR: 9000, payments: [{ amountINR: 4500, paidAtDate: '2026-02-20', note: 'Payment 1' }, { amountINR: 4500, paidAtDate: '2026-03-06', note: 'Payment 2' }] }, { uid: ID.uJaya, role: C, amountINR: 13000, paidINR: 13000, payments: [{ amountINR: 6500, paidAtDate: '2026-02-01', note: 'Payment 1' }, { amountINR: 6500, paidAtDate: '2026-06-02', note: 'Payment 2' }] }], 60000, 42000, 'App development — Shivam 9k (Feb 20: 4.5k + Mar 6: 4.5k), Jaya 13k (Feb: 6.5k + Jun 2: 6.5k); 30k pending from client',
      [
        { name: 'Advance', amountINR: 30000, dueDate: '2026-05-22', status: 'COLLECTED', invoiceId: ID.iBroBuzz, note: 'Advance 50% — May 22' },
        { name: 'Final',   amountINR: 30000, status: 'PENDING',     note: 'Final 50% pending' },
      ]),
    project(ID.pVelotra, 'Velotra Website', 'VELOTRA', ID.cVelotra, 'ACTIVE', '2026-02-20', null, [{ uid: ID.uShivam, role: L, amountINR: 20000, payments: [
      { amountINR: 5000, paidAtDate: '2026-05-06', note: 'Payment 1' },
      { amountINR: 3000, paidAtDate: '2026-06-12', note: 'Payment 2' },
      { amountINR: 2000, paidAtDate: '2026-06-23', note: 'Payment 3' },
      { amountINR: 5000, paidAtDate: '2026-07-05', note: 'Payment 4 (Jul) — ₹2.5k cash + ₹2.5k Claude contribution' },
    ] }], 30000, 10000, 'Website development — ongoing, 30k total received from client (incl. ₹5k Aug 3); 15k of 20k paid to Shivam (5k May 6 + 3k Jun 12 + 2k Jun 23 + 5k Jul 5 of which ₹2.5k went to Claude); 5k balance pending to Shivam'),
    project(ID.pArowai, 'Arowai Website', 'AROWAI', ID.cArowai, 'COMPLETED', '2026-05-10', '2026-05-18', [{ uid: ID.uShivam, role: L, amountINR: 1500, paidINR: 1500, paidAtDate: '2026-05-18' }], 3000, 1500, 'Website development'),
    project(ID.pBitaminNaturals, 'Bitamin Naturals Website', 'BITAMINNATURALS', ID.cBitaminNaturals, 'COMPLETED', '2026-05-10', '2026-05-18', [{ uid: ID.uShivam, role: L, amountINR: 1500, paidINR: 1500, paidAtDate: '2026-05-18' }], 0, -1500, 'Client had payment issues — agency covered 1.5k cost from Arowai payment'),
    project(ID.pDhawadaNGO, 'Dhawada NGO Website', 'DHAWADA-NGO', ID.cDhawada, 'COMPLETED', '2026-05-01', '2026-05-22', [{ uid: ID.uSidhak, role: L, amountINR: 2000, paidINR: 2000, paidAtDate: '2026-05-01' }], 8000, 6000, 'NGO website — fully paid (₹8k received May 22).',
      [
        { name: 'Full Payment', amountINR: 8000, dueDate: '2026-05-22', status: 'COLLECTED', invoiceId: ID.iDhawadaNGO, note: 'Full payment — May 22' },
      ]),
    project(ID.pHiristan, 'Hiristan Website', 'HIRISTAN', ID.cDhawada, 'ACTIVE', '2026-05-01', null, [{ uid: ID.uKanish, role: L }], 8000, 2000, 'Part of Dhawada group — 6k pending from client'),
    project(ID.pSoulSurf, 'SoulSurf Website', 'NJG-SOULSURF', ID.cNJG, 'COMPLETED', '2026-02-15', '2026-03-06', [{ uid: ID.uShivam, role: L, amountINR: 4500, paidINR: 4500, paidAtDate: '2026-03-06' }], 12000, 7500, 'Website for NJ Graphica — 4.5k paid to Shivam on March 6'),
    project(ID.pResto, 'Resto Shopify Website', 'NJG-RESTO', ID.cNJG, 'COMPLETED', '2026-04-01', '2026-04-21', [{ uid: ID.uGeetanjali, role: L, amountINR: 5000, paidINR: 5000, paidAtDate: '2026-04-21' }], 12000, 7000, 'Shopify website for NJ Graphica'),
    project(ID.pGPower, 'G-Power & Jouelcube Website', 'GPOWER-JOUELCUBE', ID.cNamit, 'ACTIVE', '2026-02-12', null, [
      { uid: ID.uJaya,     role: L, amountINR: 4000, paidINR: 4000, paidAtDate: '2026-06-03' },
      { uid: ID.uSidhak,   role: L, amountINR: 2500, paidINR: 2500, paidAtDate: '2026-05-01' },
      { uid: ID.uHarshika, role: C, amountINR: 3000, payments: [
        { amountINR: 1000, paidAtDate: '2026-02-12', note: 'G-Power initial' },
        { amountINR: 1000, paidAtDate: '2026-06-09', note: 'Jouelcube final' },
        { amountINR: 1000, paidAtDate: '2026-06-09', note: 'G-Power final' },
      ]},
    ], 22000, 14500, 'Combined G-Power & Jouelcube project for Namit; Jaya 4k (Jun 3), Sidhak 2.5k (May), Harshika 3k (1k Feb 12 + 1k Jouelcube + 1k G-Power Jun 9); ₹20k balance invoice raised Jun 26.',
      [
        { name: 'Advance',       amountINR: 2000,  dueDate: '2026-02-12', status: 'COLLECTED', invoiceId: ID.iGPower,  note: 'Advance — Feb 12' },
        { name: 'Final Balance', amountINR: 20000, dueDate: '2026-06-26', status: 'INVOICED',  invoiceId: ID.iGPower2, note: 'Final balance — Jun 26' },
      ]),
  ]);

  // ── INVOICES (client → agency) ───────────────────────────────────────────────
  const invoices: object[] = [];

  // Invoice numbers are auto-sequential per year (ZLK-YYYY-NNNN starting from 0001).

  const inv = (
    cid: Types.ObjectId,
    pid: Types.ObjectId | undefined,
    desc: string, totalINR: number, pays: ReturnType<typeof payment>[],
    issueDate: string, status: string,
    contractId?: Types.ObjectId,
    id?: Types.ObjectId,
  ) => {
    invoices.push(invoice(nextInv(issueDate), cid, pid, contractId, desc, totalINR, pays, issueDate, status, 'INR', id));
  };

  // Fenkmat (5500 total, PAID)
  inv(ID.cLalit, ID.pFenkmat, 'Fenkmat WordPress News Website', 5500,
    [payment('2024-12-19', 2500), payment('2025-01-01', 3000)], '2024-12-19', 'PAID');

  // Social Parindee fixes (1200, PAID)
  inv(ID.cSP, ID.pSPFixes, 'Website Fixes', 1200,
    [payment('2025-01-15', 1200)], '2025-01-15', 'PAID');

  // Foodyqueen — one invoice per month; all linked to the Foodyqueen retainer contract
  inv(ID.cFoody, undefined, 'Monthly Development Contract — 2025-01', 22000,
    [payment('2025-01-15', 3000), payment('2025-01-19', 3000), payment('2025-01-26', 3000), payment('2025-01-31', 13000)],
    '2025-01-01', 'PAID', ID.cFoodyContract);
  inv(ID.cFoody, undefined, 'Monthly Development Contract — 2025-02', 3000,
    [payment('2025-02-24', 3000)], '2025-02-01', 'PAID', ID.cFoodyContract);
  inv(ID.cFoody, undefined, 'Monthly Development Contract — 2025-03', 35000,
    [payment('2025-03-01', 16000), payment('2025-03-22', 6000), payment('2025-03-30', 13000)],
    '2025-03-01', 'PAID', ID.cFoodyContract);
  inv(ID.cFoody, undefined, 'Monthly Development Contract — 2025-04', 22000,
    [payment('2025-04-30', 22000)], '2025-04-01', 'PAID', ID.cFoodyContract);
  inv(ID.cFoody, undefined, 'Monthly Development Contract — 2025-06', 23000,
    [payment('2025-06-09', 23000)], '2025-06-01', 'PAID', ID.cFoodyContract);
  inv(ID.cFoody, undefined, 'Monthly Development Contract — 2025-07', 44000,
    [payment('2025-07-05', 22000), payment('2025-07-31', 22000)], '2025-07-01', 'PAID', ID.cFoodyContract);
  inv(ID.cFoody, undefined, 'Monthly Development Contract — 2025-09', 22000,
    [payment('2025-09-07', 22000)], '2025-09-01', 'PAID', ID.cFoodyContract);
  inv(ID.cFoody, undefined, 'Monthly Development Contract — 2025-10', 22000,
    [payment('2025-10-08', 2000), payment('2025-10-10', 20000)], '2025-10-01', 'PAID', ID.cFoodyContract);
  inv(ID.cFoody, undefined, 'Monthly Development Contract — 2025-11', 22000,
    [payment('2025-11-17', 22000)], '2025-11-01', 'PAID', ID.cFoodyContract);
  inv(ID.cFoody, undefined, 'Monthly Development Contract — 2025-12', 22000,
    [payment('2025-12-05', 22000)], '2025-12-01', 'PAID', ID.cFoodyContract);
  inv(ID.cFoody, undefined, 'Monthly Development Contract — 2026-01', 22000,
    [payment('2026-01-31', 22000)], '2026-01-01', 'PAID', ID.cFoodyContract);
  inv(ID.cFoody, undefined, 'Monthly Development Contract — 2026-02', 22000,
    [payment('2026-02-20', 22000)], '2026-02-01', 'PAID', ID.cFoodyContract);
  inv(ID.cFoody, undefined, 'Monthly Development Contract — 2026-03', 22000,
    [payment('2026-03-20', 22000)], '2026-03-01', 'PAID', ID.cFoodyContract);
  inv(ID.cFoody, undefined, 'Monthly Development Contract — 2026-04', 22000,
    [payment('2026-04-21', 22000)], '2026-04-01', 'PAID', ID.cFoodyContract);
  inv(ID.cFoody, undefined, 'Monthly Development Contract — 2026-05', 22000,
    [payment('2026-05-13', 22000)], '2026-05-01', 'PAID', ID.cFoodyContract);

  // SoftwareKadai (4000, PAID)
  inv(ID.cBluehutch, ID.pSoftwareKadai, 'SoftwareKadai.com Development', 4000,
    [payment('2025-02-06', 1000), payment('2025-02-11', 1000), payment('2025-02-16', 2000)], '2025-02-06', 'PAID');

  // City Dental (5500, PAID)
  inv(ID.cSP, ID.pCityDental, 'City Dental WordPress Website', 5500,
    [payment('2025-03-17', 5500)], '2025-03-17', 'PAID');

  // Sellercircle — Website & Blog (Shabd, 2 payments totalling 18810)
  inv(ID.cSellercircle, ID.pSellercircle, 'Sellercircle Website & Blog Development', 18810,
    [payment('2025-03-31', 10000), payment('2025-04-30', 8810)], '2025-03-31', 'PAID');
  // Sellercircle — Virus Removal & Updates (Sidhak, Jan 2026)
  inv(ID.cSellercircle, ID.pSellercircle2, 'Sellercircle Virus Removal & Updates', 9000,
    [payment('2026-01-17', 9000)], '2026-01-01', 'PAID');

  // TaxBy Akram (4000, PAID — done by Kanish for Sculpt/Sampreet)
  inv(ID.cSculpt, ID.pTaxByAkram, 'TaxBy Akram Website Development', 4000,
    [payment('2025-03-01', 4000)], '2025-02-01', 'PAID');

  // BallBoundary (1000, PAID)
  inv(ID.cBallBoundary, ID.pBallBoundary, 'BallBoundary Website Updates', 1000,
    [payment('2025-04-03', 1000)], '2025-04-03', 'PAID');

  // Mending Mind — Quiz Website (11700 total, fully paid Apr–Jul 2025)
  inv(ID.cMendingMind, ID.pMendingMindQuiz, 'Mending Mind Quiz Website Development', 11700,
    [
      payment('2025-04-15', 3000),
      payment('2025-04-30', 7000),
      payment('2025-06-12', 1100),
      payment('2025-07-20', 600),
    ], '2025-04-15', 'PAID');
  // Mending Mind — Platform collected (₹20k across 3 milestone invoices)
  inv(ID.cMendingMind, ID.pMendingMindPlatform, 'Mending Mind Platform Development — Payment 1', 5000,
    [payment('2025-10-04', 5000)], '2025-10-04', 'PAID', undefined, ID.iMendingMindPlatform);
  inv(ID.cMendingMind, ID.pMendingMindPlatform, 'Mending Mind Platform Development — Payment 2', 5000,
    [payment('2025-12-07', 5000)], '2025-12-07', 'PAID', undefined, ID.iMendingMindP2);
  inv(ID.cMendingMind, ID.pMendingMindPlatform, 'Mending Mind Platform Development — Payment 3', 10000,
    [payment('2026-02-11', 10000)], '2026-02-11', 'PAID', undefined, ID.iMendingMindP3);
  // Mending Mind — Platform balance invoice (₹18k, fully paid: ₹8k Jun 29 + ₹5k Jul 23 + ₹5k Aug 3)
  inv(ID.cMendingMind, ID.pMendingMindPlatform, 'Mending Mind Platform Development — Balance', 18000,
    [payment('2026-06-29', 8000), payment('2026-07-23', 5000), payment('2026-08-03', 5000)], '2026-06-26', 'PAID', undefined, ID.iMendingMindBalance);

  // AllWheelDriving (5500, PAID)
  inv(ID.cAllWheel, ID.pAllWheel, 'AllWheelDriving School WordPress Website', 5500,
    [payment('2025-04-18', 5500)], '2025-04-18', 'PAID');

  // Social Security (5500, PAID)
  inv(ID.cSP, ID.pSocialSecurity, 'Social Security Website', 5500,
    [payment('2025-04-23', 5500)], '2025-04-23', 'PAID');

  // InterioDecor (2600, PAID)
  inv(ID.cSP, ID.pInterioDecor, 'InterioDecor Website', 2600,
    [payment('2025-05-26', 2600)], '2025-05-26', 'PAID');

  // Unextdoor (32500, PAID)
  inv(ID.cUnextdoor, ID.pUnextdoor, 'Unextdoor App Deployment & Website Development', 32500,
    [payment('2025-06-19', 22500), payment('2025-09-24', 10000)], '2025-06-19', 'PAID');

  // PNJ Fitness (1200, PAID)
  inv(ID.cSP, ID.pPNJFitness, 'PNJ Fitness Website', 1200,
    [payment('2025-07-21', 1200)], '2025-07-21', 'PAID');

  // Best Diet (5500, PAID)
  inv(ID.cSP, ID.pBestDiet, 'Best Diet WordPress Website', 5500,
    [payment('2025-07-29', 5500)], '2025-07-29', 'PAID');

  // Sourcing Screen (15100, PAID)
  inv(ID.cSourcingScreen, ID.pSourcingScreen, 'Sourcing Screen Website Development', 15100,
    [payment('2025-07-29', 1000), payment('2025-08-20', 4100), payment('2026-01-05', 6000), payment('2026-01-12', 4000)], '2025-07-29', 'PAID');

  // Electric Marshmallow (7500, PAID)
  inv(ID.cNJG, ID.pElectricMarshmallow, 'Electric Marshmallow Design & Development', 7500,
    [payment('2025-08-11', 2250), payment('2025-09-09', 5250)], '2025-08-11', 'PAID');

  // Gessure — Development milestones
  inv(ID.cGessure, ID.pGessure, 'Gessure — Project Kickoff', 4001,
    [payment('2025-09-17', 4001, 'UPI', 'Payment received for project kickoff')],
    '2025-09-17', 'PAID');
  inv(ID.cGessure, ID.pGessure, 'Gessure — Development Milestone 1', 10000,
    [payment('2025-10-19', 10000, 'UPI', 'Payment received for milestone 1')],
    '2025-10-19', 'PAID');
  inv(ID.cGessure, ID.pGessure, 'Gessure — Development Milestone 2 & 3', 10000,
    [payment('2025-11-09', 10000)], '2025-11-09', 'PAID');
  inv(ID.cGessure, ID.pGessure, 'Gessure — Development Milestone 4', 15000,
    [payment('2026-01-05', 15000, 'UPI', 'T2601052030175278059313 / UTR: 105340297039')],
    '2026-01-05', 'PAID');
  inv(ID.cGessure, ID.pGessure, 'Gessure — Development Milestone 5', 15000,
    [payment('2026-01-30', 15000, 'UPI', 'T2601302201596556293975 / UTR: 255766393455')],
    '2026-01-30', 'PAID');

  // Gessure — Maintenance invoices (contract)
  inv(ID.cGessure, undefined, 'Gessure — Support & Maintenance', 15000,
    [payment('2026-02-27', 15000, 'UPI', 'T2602271931483945575954 / UTR: 621314791177')],
    '2026-02-27', 'PAID', ID.cGessureContract);
  inv(ID.cGessure, undefined, 'Gessure — Support & Maintenance — March 2026', 15000,
    [payment('2026-03-31', 15000, 'UPI', 'T2603311222106893406313 | UTR: 013971040394')],
    '2026-03-31', 'PAID', ID.cGessureContract);
  inv(ID.cGessure, undefined, 'Gessure — Support & Maintenance — April 2026', 15000,
    [payment('2026-04-30', 15000, 'UPI', 'T2604300606554460125994 | UTR: 244261982743')],
    '2026-04-30', 'PAID', ID.cGessureContract);
  inv(ID.cGessure, undefined, 'Gessure — Support & Maintenance — May 2026', 24000,
    [payment('2026-06-03', 24000, 'UPI', 'June payment')],
    '2026-06-01', 'PAID', ID.cGessureContract);
  inv(ID.cGessure, undefined, 'Gessure — Support & Maintenance — June 2026', 20000,
    [payment('2026-07-02', 19000, 'UPI', 'June maintenance — advance'), payment('2026-07-20', 1000, 'UPI', 'June maintenance — balance cleared')],
    '2026-06-01', 'PAID', ID.cGessureContract);
  inv(ID.cGessure, undefined, 'Gessure — Support & Maintenance — July 2026', 20000,
    [payment('2026-08-01', 20000, 'UPI', 'July maintenance')],
    '2026-08-01', 'PAID', ID.cGessureContract);

  // Shivmanicreations (3500, PAID)
  inv(ID.cSP, ID.pShivmani, 'Shivmanicreations Website', 3500,
    [payment('2025-09-18', 3500)], '2025-09-18', 'PAID');

  // ShivAiTelerad (6500, PAID)
  inv(ID.cShivAiTelerad, ID.pShivAiTelerad, 'ShivAiTelerad Website Development', 6500,
    [payment('2025-09-19', 3500), payment('2025-11-22', 3000)], '2025-09-19', 'PAID');

  // SW Build (3500, PAID)
  inv(ID.cSWBuild, ID.pSWBuild, 'SW Build Website', 3500,
    [payment('2025-09-27', 3500)], '2025-09-27', 'PAID');

  // Dhawada E-commerce (44000 collected across 3 milestone invoices; 12500 final pending)
  inv(ID.cDhawada, ID.pDhawada, 'Dhawada E-commerce Website — Advance', 12500,
    [payment('2025-10-06', 12500, 'Bank Transfer', 'Advance')], '2025-10-06', 'PAID', undefined, ID.iDhawada);
  inv(ID.cDhawada, ID.pDhawada, 'Dhawada E-commerce Website — Milestone 2', 12500,
    [payment('2025-11-02', 12500, 'Bank Transfer', 'Milestone 2')], '2025-11-02', 'PAID', undefined, ID.iDhawadaM2);
  inv(ID.cDhawada, ID.pDhawada, 'Dhawada E-commerce Website — Milestone 3 + Logo', 19000,
    [payment('2025-12-14', 19000, 'Bank Transfer', 'Milestone 3 + Logo')], '2025-12-14', 'PAID', undefined, ID.iDhawadaM3);

  // Skoal (20000 total, 6000 received — client ghosted; 14k written off)
  inv(ID.cSkoal, ID.pSkoal, 'Skoal Website Development', 20000,
    [payment('2025-11-22', 6000, 'Bank Transfer', 'Advance')], '2025-11-22', 'WRITTEN_OFF');

  // NJ Graphica 2 Landing Pages (5500, PAID)
  inv(ID.cNJG, ID.pLandingPages, '2 Landing Pages Design & Development', 5500,
    [payment('2025-10-09', 5500)], '2025-10-09', 'PAID');

  // Soulnamaste (5000, PAID)
  inv(ID.cSP, ID.pSoulnamaste, 'Soulnamaste Website', 5000,
    [payment('2025-10-13', 5000)], '2025-10-13', 'PAID');

  // GiftParty (8000, PAID)
  inv(ID.cNJG, ID.pGiftParty, 'GiftParty Shopify Website', 8000,
    [payment('2025-11-11', 8000)], '2025-11-11', 'PAID');

  // Mr Veg (10000, PAID)
  inv(ID.cSP, ID.pMrVeg, 'Mr Veg Website', 10000,
    [payment('2025-11-04', 10000)], '2025-11-04', 'PAID');

  // SP Nov 25 (1600, PAID)
  inv(ID.cSP, ID.pSPNov25, 'Website Maintenance Nov 2025', 1600,
    [payment('2025-11-25', 1600)], '2025-11-25', 'PAID');

  // Uttrakhand (3300, PAID)
  inv(ID.cSP, ID.pUttrakhand, 'Uttrakhand News Website', 3300,
    [payment('2025-12-13', 3300)], '2025-12-13', 'PAID');

  // GKG Industries (5000, PAID)
  inv(ID.cSP, ID.pGKGIndustries, 'GKG Industries Website', 5000,
    [payment('2025-12-30', 5000)], '2025-12-30', 'PAID');

  // Go Laundry (14500, PAID)
  inv(ID.cSculpt, ID.pGoLaundry, 'Go Laundry Website Development', 14500,
    [payment('2026-01-15', 14500)], '2025-12-01', 'PAID');

  // Studycrux (25000 collected across 2 milestone invoices; 25000 final pending)
  inv(ID.cStartiffy, ID.pStudycrux, 'Studycrux LMS Development — Advance', 5000,
    [payment('2026-02-01', 5000)], '2026-02-01', 'PAID', undefined, ID.iStudycrux);
  inv(ID.cStartiffy, ID.pStudycrux, 'Studycrux LMS Development — Milestone 2', 20000,
    [payment('2026-05-22', 20000)], '2026-05-22', 'PAID', undefined, ID.iStudycruxM2);

  // Digital Mandir — three milestone invoices (total ₹15k, fully paid)
  inv(ID.cDigitalMandir, ID.pDigitalMandir,
    'Digital Mandir App Development — Advance Payment (10%)', 1500,
    [payment('2026-02-01', 1500, 'UPI Transfer', 'T2602011444211734427575')],
    '2026-02-01', 'PAID', undefined, ID.iDigitalMandir1);
  inv(ID.cDigitalMandir, ID.pDigitalMandir,
    'Digital Mandir App Development — 50% Project Completion', 7500,
    [payment('2026-02-25', 6000, 'UPI', 'T2602252309205945592246'), payment('2026-02-28', 1500, 'UPI', 'UTR: 398077738704')],
    '2026-02-28', 'PAID', undefined, ID.iDigitalMandir2);
  inv(ID.cDigitalMandir, ID.pDigitalMandir,
    'Digital Mandir App Development — Final 40%', 6000,
    [payment('2026-06-13', 6000, 'UPI Transfer', 'Final payment')],
    '2026-06-13', 'PAID', undefined, ID.iDigitalMandir3);

  // HR Book — one invoice per milestone (M3 = iHRBook2, raised later)
  inv(ID.cHorizon, ID.pHRBook, 'HR Book HRMS Development — Advance', 10000,
    [payment('2026-02-23', 10000, 'Bank Transfer', 'Advance')], '2026-02-23', 'PAID', undefined, ID.iHRBook);
  inv(ID.cHorizon, ID.pHRBook, 'HR Book HRMS Development — Milestone 2', 57500,
    [payment('2026-05-01', 57500, 'Bank Transfer', 'Milestone 2')], '2026-05-01', 'PAID', undefined, ID.iHRBookM2);

  // Firstrank — one invoice per milestone (M4 = iFirstrank2, raised later)
  inv(ID.cFirstrank, ID.pFirstrank, 'Firstrank Website & Platform — Advance', 10000,
    [payment('2026-03-06', 10000, 'Bank Transfer', 'Advance')], '2026-03-06', 'PAID', undefined, ID.iFirstrank);
  inv(ID.cFirstrank, ID.pFirstrank, 'Firstrank Website & Platform — Milestone 2', 25000,
    [payment('2026-04-04', 25000, 'Bank Transfer', 'Milestone 2')], '2026-04-04', 'PAID', undefined, ID.iFirstrankM2);
  inv(ID.cFirstrank, ID.pFirstrank, 'Firstrank Website & Platform — Milestone 3', 50000,
    [payment('2026-06-02', 50000, 'Bank Transfer', 'Milestone 3')], '2026-06-02', 'PAID', undefined, ID.iFirstrankM3);

  // Rewardzy (21000 collected across 2 milestone invoices; 9000 final pending)
  inv(ID.cAnshulGlobal, ID.pRewardzy, 'Rewardzy Platform Development — Advance', 9000,
    [payment('2026-03-13', 9000, 'Bank Transfer', 'Advance')], '2026-03-13', 'PAID', undefined, ID.iRewardzy);
  inv(ID.cAnshulGlobal, ID.pRewardzy, 'Rewardzy Platform Development — Milestone 2', 12000,
    [payment('2026-04-19', 12000, 'Bank Transfer', 'Milestone 2')], '2026-04-19', 'PAID', undefined, ID.iRewardzyM2);

  // Onebox — Milestone 1 / Advance (12000 collected Mar 14)
  inv(ID.cOnebox, ID.pOnebox, 'Onebox Project Development — Milestone 1 (Advance)', 12000,
    [payment('2026-03-14', 12000, 'Bank Transfer', 'Advance')], '2026-03-14', 'PAID', undefined, ID.iOnebox);

  // Inno Transventive Real Estate App (21,650 collected across 2 milestone invoices)
  inv(ID.cInnoTrans, ID.pRealEstate, 'Real Estate App Development — Advance', 13050,
    [payment('2026-04-06', 13050, 'Bank Transfer', 'Advance')], '2026-04-06', 'PAID', undefined, ID.iRealEstate);
  // Raised at ₹13,000; ₹8,600 collected. Closed at the collected amount because the
  // ₹4,400 shortfall is re-billed on the combined Aug 2026 invoice — leaving this one
  // open would count that ₹4,400 as outstanding twice.
  inv(ID.cInnoTrans, ID.pRealEstate, 'Real Estate App Development — Milestone 2', 8600,
    [payment('2026-05-21', 8600, 'Bank Transfer', 'Milestone 2 — part payment')], '2026-05-21', 'PAID', undefined, ID.iRealEstateM2);
  // Inno Transventive Website (5000 collected; balance billed on the combined invoice)
  inv(ID.cInnoTrans, ID.pInnoWebsite, 'Website Development — Milestone 1', 5000,
    [payment('2026-05-21', 5000, 'Bank Transfer', 'Milestone 1')], '2026-04-06', 'PAID', undefined, ID.iInnoWebsite);

  // Navisha (12000, PAID)
  inv(ID.cSP, ID.pNavisha, 'Navisha Website', 12000,
    [payment('2026-03-27', 12000)], '2026-03-27', 'PAID');

  // Avco Energy (8000, PAID)
  inv(ID.cStartiffy, ID.pAvcoEnergy, 'Avco Energy Website', 8000,
    [payment('2026-04-19', 8000)], '2026-04-19', 'PAID');

  // Eldeco (3500 total, fully paid across 2 milestone invoices)
  inv(ID.cEldeco, ID.pEldeco, 'Eldeco Website Development — Advance', 1500,
    [payment('2026-04-28', 1500, 'Bank Transfer', 'Advance')], '2026-04-28', 'PAID', undefined, ID.iEldeco);
  inv(ID.cEldeco, ID.pEldeco, 'Eldeco Website Development — Final', 2000,
    [payment('2026-05-20', 2000)], '2026-05-20', 'PAID', undefined, ID.iEldecoFinal);

  // Bro Buzz App (30000 collected; remaining 30000 not yet invoiced)
  inv(ID.cBroBuzz, ID.pBroBuzz, 'Bro Buzz App Development — Advance', 30000,
    [payment('2026-05-22', 30000)], '2026-05-22', 'PAID', undefined, ID.iBroBuzz);

  // Velotra (30000 received so far)
  inv(ID.cVelotra, ID.pVelotra, 'Velotra Website Development', 30000,
    [payment('2026-02-20', 5000), payment('2026-04-17', 5000), payment('2026-05-06', 5000), payment('2026-06-04', 5000), payment('2026-07-01', 5000), payment('2026-08-03', 5000)], '2026-02-20', 'PAID');

  // Arowai (3000, PAID)
  inv(ID.cArowai, ID.pArowai, 'Arowai Website', 3000,
    [payment('2026-05-18', 3000)], '2026-05-18', 'PAID');

  // Dhawada NGO (8000, PAID May 22)
  inv(ID.cDhawada, ID.pDhawadaNGO, 'Dhawada NGO Website', 8000,
    [payment('2026-05-22', 8000)], '2026-05-22', 'PAID', undefined, ID.iDhawadaNGO);
  inv(ID.cDhawada, ID.pHiristan, 'Hiristan Website — Advance', 2000,
    [payment('2026-05-22', 2000)], '2026-05-22', 'PAID');

  // SoulSurf (12000, PAID)
  inv(ID.cNJG, ID.pSoulSurf, 'SoulSurf Website', 12000,
    [payment('2026-03-06', 12000)], '2026-03-06', 'PAID');

  // Resto Shopify (12000, PAID)
  inv(ID.cNJG, ID.pResto, 'Resto Shopify Website', 12000,
    [payment('2026-04-21', 12000)], '2026-04-21', 'PAID');

  // G-Power & Jouelcube (22000 total; advance ₹2k paid Feb 12; ₹20k balance invoiced Jun 26)
  inv(ID.cNamit, ID.pGPower, 'G-Power & Jouelcube Website Development — Advance', 2000,
    [payment('2026-02-12', 2000, 'Bank Transfer', 'Advance')], '2026-02-12', 'PAID', undefined, ID.iGPower);
  inv(ID.cNamit, ID.pGPower, 'G-Power & Jouelcube Website Development — Final Balance', 20000,
    [], '2026-06-26', 'SENT', undefined, ID.iGPower2);

  // FoodyQueen — June 2026 monthly contract (paid Jul 7)
  inv(ID.cFoody, undefined, 'Monthly Development Contract — 2026-06', 22000,
    [payment('2026-07-07', 22000)], '2026-06-20', 'PAID', ID.cFoodyContract);

  // Hostinger Affiliate / Referral Income (agency income — kept as agency not personal)
  inv(ID.cHostinger, undefined, 'Hostinger Referral Affiliate Income Nov 2025', 4992.94,
    [payment('2025-11-28', 4992.94)], '2025-11-28', 'PAID');
  inv(ID.cHostinger, undefined, 'Hostinger Referral Affiliate Income Dec 2025', 7094.13,
    [payment('2025-12-10', 7094.13)], '2025-12-10', 'PAID');

  // Firstrank — Milestone 4 invoice (₹63k, raised Jun 24; paid Jul 1)
  inv(ID.cFirstrank, ID.pFirstrank, 'Firstrank Website & Platform — Milestone 4', 63000,
    [payment('2026-07-01', 63000, 'Bank Transfer', 'Milestone 4')], '2026-06-24', 'PAID', undefined, ID.iFirstrank2);

  // HR Book — Milestone 3 invoice (₹57k, raised Jun 25; paid Jun 27 via NEFT)
  inv(ID.cHorizon, ID.pHRBook, 'HR Book HRMS Development — Milestone 3', 57000,
    [payment('2026-06-27', 57000, 'NEFT', 'Milestone 3')], '2026-06-25', 'PAID', undefined, ID.iHRBook2);

  // ── JULY 2026 income ─────────────────────────────────────────────────────────
  // Social Parindee — small WordPress bug fixing (₹300, Jul 4)
  inv(ID.cSP, undefined, 'WordPress Bug Fixing (small)', 300,
    [payment('2026-07-04', 300)], '2026-07-04', 'PAID');
  // Onebox — Milestone 2 (₹16k received Jul 6)
  inv(ID.cOnebox, ID.pOnebox, 'Onebox Project Development — Milestone 2', 16000,
    [payment('2026-07-06', 16000, 'Bank Transfer', 'Milestone 2')], '2026-07-06', 'PAID', undefined, ID.iOnebox2);

  // ── AUGUST 2026 income ───────────────────────────────────────────────────────
  // Firstrank — Milestone 5 (₹1,10,000 total; fully paid — ₹55,000 Aug 2 + ₹55,000 Aug 5)
  inv(ID.cFirstrank, ID.pFirstrank, 'Firstrank Website & Platform — Milestone 5', 110000,
    [payment('2026-08-02', 55000, 'Bank Transfer', 'Milestone 5 — part 1'),
     payment('2026-08-05', 55000, 'Bank Transfer', 'Milestone 5 — part 2')], '2026-08-02', 'PAID', undefined, ID.iFirstrankM5);

  // Inno Transventive — one invoice covering both engagements (₹51,150, unpaid).
  // Appended last so it takes the next free 2026 number without renumbering anything above.
  invoices.push(multiProjectInvoice(
    nextInv('2026-08-11'), ID.cInnoTrans,
    [
      lineItem('Website Development — final balance', 1, 25000, ID.pInnoWebsite, ID.msInnoWebsiteBalance),
      lineItem('Real Estate App — Milestone 2 shortfall', 1, 4400, ID.pRealEstate, ID.msRealEstateM2Short),
      lineItem('Real Estate App — Milestone 3', 1, 21750, ID.pRealEstate, ID.msRealEstateM3),
    ],
    [], '2026-08-11', '2026-08-25', 'SENT',
    'Covers both active Inno Transventive engagements. Single payment against this invoice number.',
    ID.iInnoCombined,
  ));

  await db.collection('invoices').insertMany(invoices);
  console.log(`[full-seed] Inserted ${invoices.length} invoices`);

  // ── PAYROLL RUNS + PAYSLIPS ─────────────────────────────────────────────────
  // One PayrollRun per month, one Payslip per user per month (project-based payments aggregated).
  // All amounts are what was ACTUALLY PAID OUT to each team member that month.

  type SlipEntry = [string, Types.ObjectId, number]; // [month, userId, amountINR]
  const slips: SlipEntry[] = [
    // Dec 2024
    ['2024-12', ID.uSidhak, 1000],  // Fenkmat advance
    // Jan 2025
    ['2025-01', ID.uSidhak, 1400],  // Fenkmat final
    // Feb 2025
    ['2025-02', ID.uShabd, 2500],   // SoftwareKadai (1k+1k+0.5k)
    // Mar 2025
    ['2025-03', ID.uSidhak, 2000],  // City Dental
    // Apr 2025
    ['2025-04', ID.uShabd,  4500],  // Sellercircle
    ['2025-04', ID.uSidhak, 2000],  // Social Security website
    // May 2025
    ['2025-05', ID.uSidhak, 1000],  // InterioDecor
    // Jul 2025
    ['2025-07', ID.uShivam, 2000],  // Best Diet
    // Aug 2025
    ['2025-08', ID.uJaya,   500],   // Electric Marshmallow advance
    ['2025-08', ID.uSidhak, 500],   // Electric Marshmallow advance
    // Sep 2025
    ['2025-09', ID.uJaya,       1250], // Electric Marshmallow final
    ['2025-09', ID.uSidhak,     2750], // EM 1250 + SW Build 1500
    ['2025-09', ID.uShivam,     4000], // Shivmani 1000 + Unextdoor 3000
    ['2025-09', ID.uGeetanjali, 1000], // ShivAiTelerad advance
    // Oct 2025
    ['2025-10', ID.uSidhak,     4500], // Landing pages 1k + Soulnamaste 2.5k + Gessure 1k
    ['2025-10', ID.uJaya,       2000], // Landing pages 1k + Gessure 1k
    ['2025-10', ID.uShivam,     1000], // Gessure milestone
    ['2025-10', ID.uGeetanjali, 1000], // Gessure milestone
    ['2025-10', ID.uShabd,      3500], // Mending Mind 2.5k + Gessure 1k
    // Nov 2025
    ['2025-11', ID.uJaya,   4000], // Dhawada 2k + Mr Veg 2k
    ['2025-11', ID.uShabd,  2000], // Dhawada milestone 2
    ['2025-11', ID.uSidhak, 2800], // Mr Veg 2k + SP Nov25 0.8k
    ['2025-11', ID.uShivam, 2000], // Gessure milestone
    // Dec 2025
    ['2025-12', ID.uAnjali,     1000], // Stipend (1st payment)
    ['2025-12', ID.uSidhak,     1500], // Uttrakhand
    ['2025-12', ID.uGeetanjali, 4800], // Mending Mind 0.5k + Go Laundry 2.5k + GKG 1.8k
    ['2025-12', ID.uShabd,      3000], // Mending Mind 1k + Dhawada 2k
    ['2025-12', ID.uJaya,       8300], // Go Laundry 2.8k + Dhawada 4k + Mending Mind 1.5k (Dec 8)
    ['2025-12', ID.uShivam,     4000], // Multiple projects Dec
    // Jan 2026
    ['2026-01', ID.uAnjali,     1500], // Stipend (incremented)
    ['2026-01', ID.uSidhak,    13500], // Sellercircle 4k + Sourcing Screen 2k + Gessure 7.5k
    ['2026-01', ID.uGeetanjali, 3000], // Gessure milestone
    ['2026-01', ID.uJaya,       1000], // Gessure milestone
    ['2026-01', ID.uShivam,     2000], // Gessure milestone
    // Feb 2026
    ['2026-02', ID.uAnjali,     1500], // Stipend
    ['2026-02', ID.uHarshika,   1000], // Stipend (1st payment)
    ['2026-02', ID.uShivam,     8500], // Studycrux 1.5k (Feb 1) + BroBuzz 4.5k (Feb 20) + unknown 2.5k
    ['2026-02', ID.uJaya,      12500], // BroBuzz 6.5k + Mending Mind 6k
    ['2026-02', ID.uGeetanjali, 4500], // Digital Mandir (4.5k)
    ['2026-02', ID.uSidhak,     6000], // Gessure maintenance 6k (Sellercircle2 6k was wrong transaction)
    // Mar 2026
    ['2026-03', ID.uAnjali,   1500], // Stipend
    ['2026-03', ID.uHarshika, 1000], // Stipend (before increment)
    ['2026-03', ID.uSanjana,  1000], // Stipend (1st payment)
    ['2026-03', ID.uShivam,  9000], // SoulSurf 4.5k (Mar 6) + BroBuzz 4.5k (Mar 6)
    ['2026-03', ID.uSidhak,  6000], // Gessure maintenance
    ['2026-03', ID.uJaya,    7500], // Navisha 5k + Skoal 2.5k
    // Apr 2026
    ['2026-04', ID.uAnjali,   1500], // Stipend
    ['2026-04', ID.uHarshika, 1000], // Stipend (before increment)
    ['2026-04', ID.uIsha,     1000], // Stipend
    ['2026-04', ID.uYatin,    1000], // Stipend
    ['2026-04', ID.uSanjana,  1000], // Stipend
    ['2026-04', ID.uJaya,       2000], // Avco Energy (Apr 19)
    ['2026-04', ID.uGeetanjali, 5000], // Resto Shopify (Apr 21)
    ['2026-04', ID.uShivam,    1500], // Eldeco advance (Apr 28)
    ['2026-04', ID.uShabd,     16000], // Sellercircle 8.5k (4k Apr 6 + 4.5k Apr 30) + Dhawada 2k + Mending Mind 5.5k
    ['2026-04', ID.uSidhak,    10500], // Gessure 6k + Skoal 2.5k + Avco 2k (Apr 30)
    // May 2026
    ['2026-05', ID.uJaya,       10000], // HR Book (May 1)
    ['2026-05', ID.uIsha,        2000], // Stipend (final — internship concluded May 29)
    ['2026-05', ID.uYatin,       3000], // Increment/stipend
    ['2026-05', ID.uShivam,      15500], // Velotra 5k (May 6) + Eldeco 2k (May 20) + Studycrux 5.5k (May 1) + Arowai 1.5k (May 18) + Bitamin 1.5k (May 18)
    ['2026-05', ID.uAnjali,      1500], // Final stipend (concluded May 13)
    ['2026-05', ID.uJyotiYadav,  1000], // Stipend
    ['2026-05', ID.uAmit,        1000], // Stipend
    ['2026-05', ID.uHarshika,    3000], // Increment
    ['2026-05', ID.uSanjana,     3000], // Stipend (incremented, May 9)
    ['2026-05', ID.uGeetanjali,  4500], // Digital Mandir (May 27)
    ['2026-05', ID.uSidhak,      4500], // Dhawada NGO 2k + G-Power 2.5k (Gessure May was late, paid in Jun)
    // Jun 2026
    ['2026-06', ID.uJaya,       17500], // Firstrank 10k + BroBuzz 6.5k + G-Power 4k
    ['2026-06', ID.uSidhak,     9000],  // Gessure 12k (increased rate) — 3k contributed to Claude subscription, net paid 9k
    ['2026-06', ID.uShivam,     5000],  // Velotra 3k (Jun 12) + 2k (Jun 23)
    ['2026-06', ID.uHarshika,   5000],  // Stipend advance 3k + Jouelcube 1k + G-Power 1k
    ['2026-06', ID.uSanjana,    3000],  // Stipend (June 9)
    ['2026-06', ID.uYatin,      3000],  // Stipend (June 3)
    ['2026-06', ID.uJyotiYadav, 1000],  // Final stipend before exit (Jun 17)
    ['2026-06', ID.uAmit,       1000],  // Stipend (Jun 17)
    // Jul 2026
    ['2026-07', ID.uJaya,       20000], // HR Book 10k + Firstrank 10k + Mending Mind 2.5k = 22.5k payable, less 2.5k Claude contribution → net 20k
    ['2026-07', ID.uSidhak,     9500],  // Gessure June maintenance 12k (50% of ₹24k), less 2.5k Claude contribution → net 9.5k
    ['2026-07', ID.uGeetanjali, 10000], // Inno Transventive website 5k (Jul 2) + Onebox 5k (Jul 10)
    ['2026-07', ID.uShivam,     7500],  // Velotra 5k payable (Jul 5), less 2.5k Claude contribution → net 2.5k; + Studycrux 5k (Jul 8)
    ['2026-07', ID.uYatin,      3000],  // Stipend (Jul 3)
    ['2026-07', ID.uSanjana,    3000],  // Final stipend before exit (Jul 10)
    // Aug 2026
    ['2026-08', ID.uJaya,       15000], // Firstrank Milestone 5 payout 17.5k, less 2.5k Claude contribution → net 15k (Aug 3)
    ['2026-08', ID.uSidhak,     9500],  // Gessure Aug maintenance 12k, less 2.5k Claude contribution → net 9.5k (Aug 1)
    ['2026-08', ID.uYatin,      3000],  // Stipend (Aug 3)
    ['2026-08', ID.uShivam,     4000],  // Studycrux LMS payout (Aug 6)
  ];

  // Build payroll runs
  const monthsWithPayroll = [...new Set(slips.map((s) => s[0]))].sort();
  const payrollRuns = monthsWithPayroll.map((month) => {
    const monthSlips = slips.filter((s) => s[0] === month);
    const totalNet = monthSlips.reduce((sum, s) => sum + p(s[2]), 0);
    const isPast = month < '2026-06';
    return {
      _id: runId(month), month, status: isPast ? 'FINALIZED' : 'FINALIZED',
      totalNetPaise: totalNet, employeeCount: monthSlips.length,
      createdBy: ID.uKanish, finalizedBy: ID.uKanish,
      finalizedAt: new Date(`${month}-28`),
      notes: `Project-based payouts for ${month}`,
      createdAt: new Date(`${month}-01`), updatedAt: new Date(),
    };
  });

  await db.collection('payroll_runs').insertMany(payrollRuns);

  const payslips = slips.map(([month, uid, amt]) =>
    payslip(month, uid, amt, `${month}-28`));
  await db.collection('payslips').insertMany(payslips);

  console.log(`[full-seed] Inserted ${payrollRuns.length} payroll runs, ${payslips.length} payslips`);

  // ── BUSINESS EXPENSES ───────────────────────────────────────────────────────
  // Tracked in a raw `expenses` collection (no NestJS module yet — for profit calcs)
  const expD = d;
  await db.collection('expenses').drop().catch(() => {});
  // Claude AI Subscription — gross bill + structured per-user contributions (recovered via payroll deduction).
  const claudeContribution = (uid: Types.ObjectId, inr: number, month: string) => ({
    userId: uid, amountPaise: p(inr), note: `Claude contribution (${month})`,
  });
  await db.collection('expenses').insertMany([
    { _id: oid(), date: expD('2026-04-05'), title: 'VPS Server — Hetzner',           category: 'INFRASTRUCTURE', vendor: 'Hetzner',    amountPaise: p(728.07),   currency: 'INR', description: 'Monthly VPS subscription', contributions: [], createdAt: now, updatedAt: now },
    { _id: oid(), date: expD('2026-05-05'), title: 'VPS Server — Hetzner',           category: 'INFRASTRUCTURE', vendor: 'Hetzner',    amountPaise: p(1039.78),  currency: 'INR', description: 'Monthly VPS subscription', contributions: [], createdAt: now, updatedAt: now },
    { _id: oid(), date: expD('2026-06-03'), title: 'VPS Server — Hetzner',           category: 'INFRASTRUCTURE', vendor: 'Hetzner',    amountPaise: p(1586.13),  currency: 'INR', description: 'Monthly VPS subscription', contributions: [], createdAt: now, updatedAt: now },
    { _id: oid(), date: expD('2026-06-03'), title: 'Bnani AI Design Tool',           category: 'SOFTWARE',       vendor: 'Bnani',      amountPaise: p(1981.22),  currency: 'INR', description: 'AI design tool subscription', contributions: [], createdAt: now, updatedAt: now },
    { _id: oid(), date: expD('2026-06-02'), title: 'Claude AI Subscription',          category: 'SOFTWARE',       vendor: 'Anthropic',  amountPaise: p(11771.85), currency: 'INR', description: 'Claude subscription — Jun bill', contributions: [
      claudeContribution(ID.uJaya, 3000, 'Jun'), claudeContribution(ID.uSidhak, 3000, 'Jun'),
    ], createdAt: now, updatedAt: now },
    { _id: oid(), date: expD('2026-07-03'), title: 'Claude AI Subscription',          category: 'SOFTWARE',       vendor: 'Anthropic',  amountPaise: p(11500),    currency: 'INR', description: 'Claude subscription — Jul bill', contributions: [
      claudeContribution(ID.uJaya, 2500, 'Jul'), claudeContribution(ID.uSidhak, 2500, 'Jul'), claudeContribution(ID.uShivam, 2500, 'Jul'),
    ], createdAt: now, updatedAt: now },
    { _id: oid(), date: expD('2026-07-05'), title: 'VPS Server — Hetzner',           category: 'INFRASTRUCTURE', vendor: 'Hetzner',    amountPaise: p(1781.35),  currency: 'INR', description: 'Monthly VPS subscription', contributions: [], createdAt: now, updatedAt: now },
    { _id: oid(), date: expD('2026-07-03'), title: 'Lead Generation — Algomail',      category: 'MARKETING',      vendor: 'Algomail',   amountPaise: p(1500),     currency: 'INR', description: 'Leads purchase', contributions: [], createdAt: now, updatedAt: now },
    { _id: oid(), date: expD('2026-08-03'), title: 'Claude AI Subscription',          category: 'SOFTWARE',       vendor: 'Anthropic',  amountPaise: p(11266.31), currency: 'INR', description: 'Claude subscription — Aug bill', contributions: [
      claudeContribution(ID.uJaya, 2500, 'Aug'), claudeContribution(ID.uSidhak, 2500, 'Aug'), claudeContribution(ID.uShivam, 2500, 'Aug'),
    ], createdAt: now, updatedAt: now },
  ]);
  console.log('[full-seed] Inserted 9 expense records');

  // ── FREELANCER PAYMENTS ──────────────────────────────────────────────────────
  // External freelancers paid per-project (Sampreet = Sculpt owner, Shubham Jain, Jyoti Makwana)
  await db.collection('freelancer_payments').drop().catch(() => {});
  await db.collection('freelancer_payments').insertMany([
    {
      _id: oid(), freelancerName: 'Sampreet (Sculpt Agency)',
      projectRef: 'Dhawada E-commerce', projectId: ID.pDhawada,
      agreedTotalPaise: p(2000), paidPaise: p(2000), pendingPaise: 0,
      payments: [{ date: d('2025-10-05'), amountPaise: p(2000), note: 'Figma design for Dhawada e-commerce' }],
      status: 'COMPLETED', currency: 'INR',
      notes: 'Sampreet (Sculpt Agency) — Figma design work.',
      createdAt: now, updatedAt: now,
    },
    {
      _id: oid(), freelancerName: 'Shubham Jain',
      projectRef: 'Dhawada E-commerce', projectId: ID.pDhawada,
      agreedTotalPaise: p(4500), paidPaise: p(4500), pendingPaise: 0,
      payments: [
        { date: d('2025-11-03'), amountPaise: p(1000), note: 'Logo design — advance' },
        { date: d('2025-11-23'), amountPaise: p(1000), note: 'Logo design — 2nd instalment' },
        { date: d('2025-12-13'), amountPaise: p(2500), note: 'Logo design — final payment' },
      ],
      status: 'COMPLETED', currency: 'INR',
      notes: 'Shubham Jain — Dhawada logo design (3 instalments).',
      createdAt: now, updatedAt: now,
    },
    {
      _id: oid(), freelancerName: 'Jyoti Makwana',
      projectRef: 'HR Book HRMS', projectId: ID.pHRBook,
      agreedTotalPaise: p(70000), paidPaise: p(52500), pendingPaise: p(17500),
      payments: [
        { date: d('2026-05-01'), amountPaise: p(17500), note: 'Phase 1 commission (Milestone 2)' },
        { date: d('2026-06-25'), amountPaise: p(17500), note: 'Phase 2 commission (Milestone 3)' },
        { date: d('2026-07-27'), amountPaise: p(17500), note: 'Phase 3 commission (Milestone 4)' },
      ],
      status: 'ACTIVE', currency: 'INR',
      notes: 'Jyoti Makwana sourced this project. ₹70,000 agreed total; ₹52,500 paid across 3 phases; ₹17,500 still pending.',
      createdAt: now, updatedAt: now,
    },
  ]);
  console.log('[full-seed] Inserted 3 freelancer payment records');

  await db.collection('expenses').insertMany([
    {
      _id: oid(),
      title: 'Meta Ads',
      amountPaise: p(2950),
      category: 'MARKETING',
      date: expD('2026-08-01'),
      vendor: 'Meta',
      currency: 'INR',
      addedBy: ID.uKanish,
      contributions: [],
      createdAt: now, updatedAt: now,
    },
    {
      _id: oid(),
      title: 'Lemlist Online Tool - Lead Enricher',
      amountPaise: p(503.43),
      category: 'TOOLS',
      date: expD('2026-08-01'),
      vendor: 'Lemlist',
      currency: 'INR',
      addedBy: ID.uKanish,
      contributions: [],
      createdAt: now, updatedAt: now,
    }
  ]);
  console.log('[full-seed] Inserted 2 more expense records (11 total)');

  await mongoose.disconnect();
  console.log('[full-seed] Done ✓');
  console.log('');
  console.log('  Owner login → kanish@zlaark.com / kanish@7.7');
  console.log('  Team default password → Zlaark@123');
}

main().catch((err) => { console.error(err); process.exit(1); });
