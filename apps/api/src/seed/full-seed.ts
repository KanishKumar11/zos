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
  // Projects
  pFenkmat: oid(), pSPFixes: oid(), pFoody: oid(),
  pSoftwareKadai: oid(), pTaxByAkram: oid(), pCityDental: oid(),
  pSellercircle: oid(), pBallBoundary: oid(), pMendingMindPlatform: oid(), pMendingMindQuiz: oid(),
  pAllWheel: oid(), pSocialSecurity: oid(), pInterioDecor: oid(),
  pUnextdoor: oid(), pPNJFitness: oid(), pBestDiet: oid(),
  pSourcingScreen: oid(), pElectricMarshmallow: oid(), pGessure: oid(),
  pShivmani: oid(), pShivAiTelerad: oid(), pSWBuild: oid(),
  pDhawada: oid(), pSkoal: oid(), pLandingPages: oid(),
  pSoulnamaste: oid(), pGiftParty: oid(), pUttrakhand: oid(),
  pGoLaundry: oid(), pGKGIndustries: oid(), pStudycrux: oid(),
  pJouelcube: oid(), pDigitalMandir: oid(), pHRBook: oid(),
  pFirstrank: oid(), pRewardzy: oid(), pOnebox: oid(),
  pRealEstate: oid(), pNavisha: oid(), pAvcoEnergy: oid(),
  pEldeco: oid(), pBroBuzz: oid(), pVelotra: oid(),
  pArowai: oid(), pBitaminNaturals: oid(), pDhawadaNGO: oid(),
  pHiristan: oid(), pSoulSurf: oid(), pResto: oid(),
  pMrVeg: oid(), pGPower: oid(), pSPNov25: oid(),
};

// Invoice counter
let _inv = 0;
const nextInv = () => `INV-${String(++_inv).padStart(4, '0')}`;

// Payroll run IDs per month
const runIds: Record<string, Types.ObjectId> = {};
const runId = (month: string) => { if (!runIds[month]) runIds[month] = oid(); return runIds[month]; };

// ── HELPERS ───────────────────────────────────────────────────────────────────
const payment = (date: string, amountINR: number, method = 'Bank Transfer', ref = '') => ({
  _id: oid(), paidAt: d(date), amountPaise: p(amountINR), reference: ref, method,
});

const lineItem = (desc: string, qty: number, unitINR: number) => ({
  description: desc, qty, unitPaise: p(unitINR),
});

function invoice(
  num: string, clientId: Types.ObjectId, projectId: Types.ObjectId | undefined,
  desc: string, totalINR: number, payments_arr: ReturnType<typeof payment>[],
  issueDate: string, status: string, currency = 'INR',
) {
  const paidINR = payments_arr.reduce((s, x) => s + x.amountPaise / 100, 0);
  const subTotal = p(totalINR);
  return {
    number: num, clientId, projectId,
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
  membersList: { uid: Types.ObjectId; role: string }[],
  budgetINR = 0, marginINR = 0, desc = '',
) {
  return {
    _id: id, name, code, clientId, status, description: desc, brief: '',
    startDate: d(startDate), endDate: endDate ? d(endDate) : undefined,
    clientBudgetPaise: p(budgetINR), agencyMarginPaise: p(marginINR), currency: 'INR',
    members: membersList.map((m) => ({ userId: m.uid, role: m.role, addedAt: d(startDate) })),
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
    'clients','projects','invoices','payroll_runs','payslips','settings',
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
    mkIntern(ID.uSanjana,    'sanjana@zlaark.com',    'Sanjana Mahindru', '2026-02-09', ID.uJaya),
    mkIntern(ID.uIsha,       'isha@zlaark.com',        'Isha',             '2026-03-01', ID.uJaya, 'EXITED'),
    mkIntern(ID.uYatin,      'yatin@zlaark.com',       'Yatin',            '2026-03-03', ID.uJaya),
    // Shivam's team interns
    mkIntern(ID.uJyotiYadav, 'jyotiyadav@zlaark.com', 'Jyoti Yadav',      '2026-04-17', ID.uShivam),
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
  const contact = (name: string, email = '', phone = '', role = '') => ({ name, email, phone, role });

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

  // ── PROJECTS ────────────────────────────────────────────────────────────────
  const L = 'LEAD', C = 'CONTRIBUTOR';

  await db.collection('projects').insertMany([
    project(ID.pFenkmat, 'Fenkmat WordPress News Website', 'FENKMAT', ID.cLalit, 'COMPLETED', '2024-12-19', '2025-01-01', [{ uid: ID.uSidhak, role: L }], 5500, 2600, 'WordPress news website design & development'),
    project(ID.pSPFixes, 'Social Parindee Website Fixes', 'SP-FIXES', ID.cSP, 'COMPLETED', '2025-01-10', '2025-01-20', [{ uid: ID.uKanish, role: L }], 1200, 1200, 'General website fixes done by owner'),
    project(ID.pFoody, 'Foodyqueen Monthly Contract', 'FOODY-DEV', ID.cFoody, 'ACTIVE', '2025-01-15', null, [{ uid: ID.uKanish, role: L }], 0, 0, 'Ongoing monthly development contract — done by Kanish'),
    project(ID.pSoftwareKadai, 'SoftwareKadai.com Development', 'SWKADAI', ID.cBluehutch, 'COMPLETED', '2025-02-06', '2025-02-28', [{ uid: ID.uShabd, role: L }], 4000, 1500, 'Full website development'),
    project(ID.pTaxByAkram, 'TaxBy Akram Website', 'TAXBYAKRAM', ID.cSculpt, 'COMPLETED', '2025-02-01', '2025-03-01', [{ uid: ID.uKanish, role: L }], 4000, 4000, 'Website done by Kanish for Sculpt Agency (Sampreet)'),
    project(ID.pCityDental, 'City Dental WordPress Website', 'CITYDENTAL', ID.cSP, 'COMPLETED', '2025-03-01', '2025-03-17', [{ uid: ID.uSidhak, role: L }], 5500, 3500, 'WordPress website for dental clinic'),
    project(ID.pSellercircle, 'Sellercircle Website & Blog', 'SELLERCIRCLE', ID.cSellercircle, 'COMPLETED', '2025-03-01', '2026-01-31', [{ uid: ID.uShabd, role: L }, { uid: ID.uSidhak, role: C }], 27810, 15310, 'Website updates, blog section & virus removal'),
    project(ID.pBallBoundary, 'BallBoundary Website Updates', 'BALLBOUNDARY', ID.cBallBoundary, 'COMPLETED', '2025-04-03', '2025-04-03', [{ uid: ID.uKanish, role: L }], 1000, 1000, 'Website updates done by Kanish'),
    project(ID.pMendingMindQuiz, 'Mending Mind Quiz Website', 'MM-QUIZ', ID.cMendingMind, 'COMPLETED', '2025-04-01', '2025-07-20', [{ uid: ID.uShabd, role: L }, { uid: ID.uJaya, role: C }], 11700, 7700, 'Quiz website — fully paid (₹11.7k received Apr–Jul 2025)'),
    project(ID.pMendingMindPlatform, 'Mending Mind Platform', 'MM-PLATFORM', ID.cMendingMind, 'ACTIVE', '2025-10-01', null, [{ uid: ID.uShabd, role: L }, { uid: ID.uJaya, role: C }, { uid: ID.uGeetanjali, role: C }], 38000, 22500, 'Platform development — ₹18k pending from client'),
    project(ID.pAllWheel, 'AllWheelDriving School Website', 'ALLWHEEL', ID.cAllWheel, 'COMPLETED', '2025-04-01', '2025-04-18', [{ uid: ID.uKanish, role: L }], 5500, 5500, 'WordPress website done by Kanish'),
    project(ID.pSocialSecurity, 'Social Security Website', 'SP-SECSEC', ID.cSP, 'COMPLETED', '2025-04-15', '2025-04-23', [{ uid: ID.uSidhak, role: L }], 5500, 3500, 'Social security website development'),
    project(ID.pInterioDecor, 'InterioDecor Website', 'SP-INTERIODECOR', ID.cSP, 'COMPLETED', '2025-05-15', '2025-05-26', [{ uid: ID.uSidhak, role: L }], 2600, 1600, 'Interior decoration website'),
    project(ID.pUnextdoor, 'Unextdoor App & Website', 'UNEXTDOOR', ID.cUnextdoor, 'COMPLETED', '2025-06-19', '2025-09-24', [{ uid: ID.uKanish, role: L }, { uid: ID.uShivam, role: C }], 32500, 26500, 'Play store / App store deployment & website development'),
    project(ID.pPNJFitness, 'PNJ Fitness Website', 'SP-PNJFITNESS', ID.cSP, 'COMPLETED', '2025-07-01', '2025-07-21', [{ uid: ID.uKanish, role: L }], 1200, 1200, 'Fitness website development'),
    project(ID.pBestDiet, 'Best Diet WordPress Website', 'SP-BESTDIET', ID.cSP, 'COMPLETED', '2025-07-15', '2025-07-29', [{ uid: ID.uShivam, role: L }], 5500, 3500, 'WordPress diet website'),
    project(ID.pSourcingScreen, 'Sourcing Screen Website', 'SOURCINGSCREEN', ID.cSourcingScreen, 'COMPLETED', '2025-07-29', '2026-01-30', [{ uid: ID.uSidhak, role: L }], 15100, 11100, 'Web development project'),
    project(ID.pElectricMarshmallow, 'Electric Marshmallow', 'ELECMARSH', ID.cNJG, 'COMPLETED', '2025-08-11', '2025-09-09', [{ uid: ID.uJaya, role: L }, { uid: ID.uSidhak, role: C }], 7500, 4000, 'Design & development for NJ Graphica'),
    project(ID.pGessure, 'Gessure Platform & Maintenance', 'GESSURE', ID.cGessure, 'ACTIVE', '2025-09-17', null, [{ uid: ID.uSidhak, role: L }], 123001, 78001, 'Platform development + ongoing monthly maintenance — currently maintained by Sidhak only'),
    project(ID.pShivmani, 'Shivmanicreations Website', 'SP-SHIVMANI', ID.cSP, 'COMPLETED', '2025-09-01', '2025-09-18', [{ uid: ID.uShivam, role: L }], 3500, 2500, 'Website development'),
    project(ID.pShivAiTelerad, 'ShivAiTelerad Website', 'SHIVAI', ID.cShivAiTelerad, 'COMPLETED', '2025-09-19', '2025-11-22', [{ uid: ID.uGeetanjali, role: L }], 6500, 4000, 'Website development — total received 6.5k'),
    project(ID.pSWBuild, 'SW Build Website', 'SWBUILD', ID.cSWBuild, 'COMPLETED', '2025-09-27', '2025-09-27', [{ uid: ID.uSidhak, role: L }], 3500, 2000, 'Website development'),
    project(ID.pDhawada, 'Dhawada E-commerce Website', 'DHAWADA', ID.cDhawada, 'ACTIVE', '2025-10-06', null, [{ uid: ID.uJaya, role: L }], 56500, 36500, 'E-commerce website — 12.5k pending from client; logo by Shubham Jain (freelancer); Figma by Sampreet (freelancer)'),
    project(ID.pSkoal, 'Skoal Website', 'SKOAL', ID.cSkoal, 'ON_HOLD', '2025-11-22', null, [{ uid: ID.uSidhak, role: L }], 20000, 6000, 'Client ghosted after advance payment — total deal 20k, received 6k only. Work was delivered.'),
    project(ID.pLandingPages, 'NJ Graphica 2 Landing Pages', 'NJG-LANDING', ID.cNJG, 'COMPLETED', '2025-10-01', '2025-10-09', [{ uid: ID.uSidhak, role: L }, { uid: ID.uJaya, role: C }], 5500, 3500, '2 landing pages design & development'),
    project(ID.pSoulnamaste, 'Soulnamaste Website', 'SP-SOULNAMASTE', ID.cSP, 'COMPLETED', '2025-10-01', '2025-10-13', [{ uid: ID.uSidhak, role: L }], 5000, 2500, 'Website development'),
    project(ID.pGiftParty, 'GiftParty Shopify Website', 'NJG-GIFTPARTY', ID.cNJG, 'COMPLETED', '2025-11-01', '2025-11-11', [{ uid: ID.uKanish, role: L }], 8000, 8000, 'Shopify website development'),
    project(ID.pMrVeg, 'Mr Veg Website', 'SP-MRVEG', ID.cSP, 'COMPLETED', '2025-11-01', '2025-11-04', [{ uid: ID.uJaya, role: L }, { uid: ID.uSidhak, role: C }], 10000, 6000, 'Website development'),
    project(ID.pSPNov25, 'Social Parindee Website Maintenance Nov 2025', 'SP-NOV25', ID.cSP, 'COMPLETED', '2025-11-25', '2025-11-25', [{ uid: ID.uSidhak, role: L }], 1600, 800, 'Small website maintenance'),
    project(ID.pUttrakhand, 'Uttrakhand News Website', 'SP-UTTRAKHAND', ID.cSP, 'COMPLETED', '2025-12-01', '2025-12-14', [{ uid: ID.uSidhak, role: L }], 3300, 1800, 'News website development'),
    project(ID.pGoLaundry, 'Go Laundry Website', 'GOLAUNDRY', ID.cSculpt, 'COMPLETED', '2025-12-01', '2026-01-15', [{ uid: ID.uGeetanjali, role: L }, { uid: ID.uJaya, role: C }], 14500, 9200, 'Website development for Sculpt Agency'),
    project(ID.pGKGIndustries, 'GKG Industries Website', 'SP-GKG', ID.cSP, 'COMPLETED', '2025-12-15', '2025-12-30', [{ uid: ID.uGeetanjali, role: L }], 5000, 3200, 'Industries website development'),
    project(ID.pStudycrux, 'Studycrux LMS', 'STUDYCRUX', ID.cStartiffy, 'ACTIVE', '2026-02-01', null, [{ uid: ID.uShivam, role: L }], 50000, 35000, 'LMS development — 25k pending from client; 15k pending to Shivam'),
    project(ID.pJouelcube, 'Jouelcube Website', 'JOUELCUBE', ID.cNamit, 'ACTIVE', '2026-02-12', null, [{ uid: ID.uSidhak, role: L }, { uid: ID.uHarshika, role: C }], 22000, 17000, 'Website development — part of 20k pending (G-Power + Jouelcube); 1k to Harshika pending'),
    project(ID.pDigitalMandir, 'Digital Mandir App', 'DIGITALMANDIR', ID.cDigitalMandir, 'ACTIVE', '2026-02-01', null, [{ uid: ID.uGeetanjali, role: L }], 9000, 2000, 'App development — all received from client, agency owes 6k more to team'),
    project(ID.pHRBook, 'HR Book HRMS', 'HRBOOK', ID.cHorizon, 'ACTIVE', '2026-02-23', null, [{ uid: ID.uJaya, role: L }, { uid: ID.uSidhak, role: C }], 240000, 82500, 'HRMS platform — 172.5k pending from client; 52.5k to Jyoti (freelancer), 10k to Jaya, 20k to Sidhak pending'),
    project(ID.pFirstrank, 'Firstrank Website & Platform', 'FIRSTRANK', ID.cFirstrank, 'ACTIVE', '2026-03-06', null, [{ uid: ID.uJaya, role: L }, { uid: ID.uKanish, role: C }], 85000, 57500, 'Website & platform development'),
    project(ID.pRewardzy, 'Rewardzy Platform', 'REWARDZY', ID.cAnshulGlobal, 'ACTIVE', '2026-03-13', null, [{ uid: ID.uSidhak, role: L }], 30000, 9000, '9k pending from client; 12k to Sidhak pending'),
    project(ID.pOnebox, 'Onebox Project', 'ONEBOX', ID.cOnebox, 'ACTIVE', '2026-03-14', null, [{ uid: ID.uKanish, role: L }], 40001, 12001, 'Platform development — 28k pending from client'),
    project(ID.pRealEstate, 'Inno Transventive Real Estate App & Website', 'INNO-REALESTATE', ID.cInnoTrans, 'ACTIVE', '2026-04-06', null, [{ uid: ID.uShivam, role: L }], 92000, 20050, 'Real estate app (60.95k pending) + website (25k pending); 11k to Shivam pending'),
    project(ID.pNavisha, 'Navisha Website', 'SP-NAVISHA', ID.cSP, 'COMPLETED', '2026-03-15', '2026-03-27', [{ uid: ID.uJaya, role: L }], 12000, 7000, 'Website development'),
    project(ID.pAvcoEnergy, 'Avco Energy Website', 'AVCO-ENERGY', ID.cStartiffy, 'COMPLETED', '2026-04-01', '2026-04-30', [{ uid: ID.uJaya, role: L }, { uid: ID.uSidhak, role: C }], 8000, 5000, 'Website development'),
    project(ID.pEldeco, 'Eldeco Website', 'ELDECO', ID.cEldeco, 'ACTIVE', '2026-04-28', null, [{ uid: ID.uShivam, role: L }], 3500, 1500, 'Website development — more pending'),
    project(ID.pBroBuzz, 'Bro Buzz App', 'BROBUZZ', ID.cBroBuzz, 'ACTIVE', '2026-02-01', null, [{ uid: ID.uShivam, role: L }, { uid: ID.uJaya, role: C }], 60000, 42000, 'App development — 30k pending from client'),
    project(ID.pVelotra, 'Velotra Website', 'VELOTRA', ID.cVelotra, 'ACTIVE', '2026-02-20', null, [{ uid: ID.uShivam, role: L }], 20000, 15000, 'Website development — ongoing, 20k total received so far; 15k balance to pay Shivam'),
    project(ID.pArowai, 'Arowai Website', 'AROWAI', ID.cArowai, 'COMPLETED', '2026-05-10', '2026-05-18', [{ uid: ID.uShivam, role: L }], 3000, 1500, 'Website development'),
    project(ID.pBitaminNaturals, 'Bitamin Naturals Website', 'BITAMINNATURALS', ID.cBitaminNaturals, 'COMPLETED', '2026-05-10', '2026-05-18', [{ uid: ID.uShivam, role: L }], 0, -1500, 'Client had payment issues — agency covered 1.5k cost from Arowai payment'),
    project(ID.pDhawadaNGO, 'Dhawada NGO Website', 'DHAWADA-NGO', ID.cDhawada, 'ACTIVE', '2026-05-01', null, [{ uid: ID.uSidhak, role: L }], 14000, 12000, 'NGO website — 6k Hiristan pending from client'),
    project(ID.pHiristan, 'Hiristan Website', 'HIRISTAN', ID.cDhawada, 'ACTIVE', '2026-05-01', null, [{ uid: ID.uKanish, role: L }], 8000, 2000, 'Part of Dhawada group — 6k pending from client'),
    project(ID.pSoulSurf, 'SoulSurf Website', 'NJG-SOULSURF', ID.cNJG, 'COMPLETED', '2026-02-15', '2026-03-06', [{ uid: ID.uShivam, role: L }], 12000, 7500, 'Website for NJ Graphica'),
    project(ID.pResto, 'Resto Shopify Website', 'NJG-RESTO', ID.cNJG, 'COMPLETED', '2026-04-01', '2026-04-21', [{ uid: ID.uGeetanjali, role: L }], 12000, 7000, 'Shopify website for NJ Graphica'),
    project(ID.pGPower, 'G-Power Website', 'GPOWER', ID.cNamit, 'ACTIVE', '2026-04-01', null, [{ uid: ID.uJaya, role: L }, { uid: ID.uHarshika, role: C }], 20000, 18500, 'Website development under Namit (same client as Jouelcube) — part of ₹20k combined G-Power+Jouelcube pending; ₹1k to Harshika pending'),
  ]);

  // ── INVOICES (client → agency) ───────────────────────────────────────────────
  const invoices: object[] = [];

  const inv = (cid: Types.ObjectId, pid: Types.ObjectId | undefined, desc: string, totalINR: number, pays: ReturnType<typeof payment>[], issueDate: string, status: string) => {
    invoices.push(invoice(nextInv(), cid, pid, desc, totalINR, pays, issueDate, status));
  };

  // Fenkmat (5500 total, PAID)
  inv(ID.cLalit, ID.pFenkmat, 'Fenkmat WordPress News Website', 5500,
    [payment('2024-12-19', 2500), payment('2025-01-01', 3000)], '2024-12-19', 'PAID');

  // Social Parindee fixes (1200, PAID)
  inv(ID.cSP, ID.pSPFixes, 'Website Fixes', 1200,
    [payment('2025-01-15', 1200)], '2025-01-15', 'PAID');

  // Foodyqueen — one invoice per month; multi-payment months combined into a single invoice
  inv(ID.cFoody, ID.pFoody, 'Monthly Development Contract — 2025-01', 22000,
    [payment('2025-01-15', 3000), payment('2025-01-19', 3000), payment('2025-01-26', 3000), payment('2025-01-31', 13000)],
    '2025-01-01', 'PAID');
  inv(ID.cFoody, ID.pFoody, 'Monthly Development Contract — 2025-02', 3000,
    [payment('2025-02-24', 3000)], '2025-02-01', 'PAID');
  inv(ID.cFoody, ID.pFoody, 'Monthly Development Contract — 2025-03', 35000,
    [payment('2025-03-01', 16000), payment('2025-03-22', 6000), payment('2025-03-30', 13000)],
    '2025-03-01', 'PAID');
  inv(ID.cFoody, ID.pFoody, 'Monthly Development Contract — 2025-04', 22000,
    [payment('2025-04-30', 22000)], '2025-04-01', 'PAID');
  inv(ID.cFoody, ID.pFoody, 'Monthly Development Contract — 2025-06', 23000,
    [payment('2025-06-09', 23000)], '2025-06-01', 'PAID');
  inv(ID.cFoody, ID.pFoody, 'Monthly Development Contract — 2025-07', 44000,
    [payment('2025-07-05', 22000), payment('2025-07-31', 22000)], '2025-07-01', 'PAID');
  inv(ID.cFoody, ID.pFoody, 'Monthly Development Contract — 2025-09', 22000,
    [payment('2025-09-07', 22000)], '2025-09-01', 'PAID');
  inv(ID.cFoody, ID.pFoody, 'Monthly Development Contract — 2025-10', 22000,
    [payment('2025-10-08', 2000), payment('2025-10-10', 20000)], '2025-10-01', 'PAID');
  inv(ID.cFoody, ID.pFoody, 'Monthly Development Contract — 2025-11', 22000,
    [payment('2025-11-17', 22000)], '2025-11-01', 'PAID');
  inv(ID.cFoody, ID.pFoody, 'Monthly Development Contract — 2025-12', 22000,
    [payment('2025-12-05', 22000)], '2025-12-01', 'PAID');
  inv(ID.cFoody, ID.pFoody, 'Monthly Development Contract — 2026-01', 22000,
    [payment('2026-01-31', 22000)], '2026-01-01', 'PAID');
  inv(ID.cFoody, ID.pFoody, 'Monthly Development Contract — 2026-02', 22000,
    [payment('2026-02-20', 22000)], '2026-02-01', 'PAID');
  inv(ID.cFoody, ID.pFoody, 'Monthly Development Contract — 2026-03', 22000,
    [payment('2026-03-20', 22000)], '2026-03-01', 'PAID');
  inv(ID.cFoody, ID.pFoody, 'Monthly Development Contract — 2026-04', 22000,
    [payment('2026-04-21', 22000)], '2026-04-01', 'PAID');
  inv(ID.cFoody, ID.pFoody, 'Monthly Development Contract — 2026-05', 22000,
    [payment('2026-05-13', 22000)], '2026-05-01', 'PAID');

  // SoftwareKadai (4000, PAID)
  inv(ID.cBluehutch, ID.pSoftwareKadai, 'SoftwareKadai.com Development', 4000,
    [payment('2025-02-06', 1000), payment('2025-02-11', 1000), payment('2025-02-16', 2000)], '2025-02-06', 'PAID');

  // City Dental (5500, PAID)
  inv(ID.cSP, ID.pCityDental, 'City Dental WordPress Website', 5500,
    [payment('2025-03-17', 5500)], '2025-03-17', 'PAID');

  // Sellercircle (27810 total, PAID)
  inv(ID.cSellercircle, ID.pSellercircle, 'Sellercircle Website, Blog & Virus Removal', 27810,
    [payment('2025-03-31', 10000), payment('2025-04-30', 8810), payment('2026-01-17', 9000)], '2025-03-31', 'PAID');

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
  // Mending Mind — Platform (38000 total, 20000 received, 18000 pending)
  inv(ID.cMendingMind, ID.pMendingMindPlatform, 'Mending Mind Platform Development', 38000,
    [
      payment('2025-10-04', 5000),
      payment('2025-12-07', 5000),
      payment('2026-02-11', 10000),
    ], '2025-10-04', 'PARTIALLY_PAID');

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

  // Gessure (123001, ACTIVE — ongoing maintenance)
  inv(ID.cGessure, ID.pGessure, 'Gessure Platform Development & Maintenance', 123001,
    [
      payment('2025-09-17', 4001),
      payment('2025-10-19', 10000),
      payment('2025-11-09', 10000),
      payment('2026-01-05', 15000),
      payment('2026-01-30', 15000),
      payment('2026-02-27', 15000),
      payment('2026-03-31', 15000),
      payment('2026-04-30', 15000),
      payment('2026-06-03', 24000),
    ], '2025-09-17', 'PAID');

  // Shivmanicreations (3500, PAID)
  inv(ID.cSP, ID.pShivmani, 'Shivmanicreations Website', 3500,
    [payment('2025-09-18', 3500)], '2025-09-18', 'PAID');

  // ShivAiTelerad (6500, PAID)
  inv(ID.cShivAiTelerad, ID.pShivAiTelerad, 'ShivAiTelerad Website Development', 6500,
    [payment('2025-09-19', 3500), payment('2025-11-22', 3000)], '2025-09-19', 'PAID');

  // SW Build (3500, PAID)
  inv(ID.cSWBuild, ID.pSWBuild, 'SW Build Website', 3500,
    [payment('2025-09-27', 3500)], '2025-09-27', 'PAID');

  // Dhawada E-commerce (56500 total, 44000 received, 12500 pending)
  inv(ID.cDhawada, ID.pDhawada, 'Dhawada E-commerce Website', 56500,
    [
      payment('2025-10-06', 12500, 'Bank Transfer', 'Advance'),
      payment('2025-11-02', 12500, 'Bank Transfer', 'Milestone 2'),
      payment('2025-12-14', 19000, 'Bank Transfer', 'Milestone 3 + Logo'),
    ], '2025-10-06', 'PARTIALLY_PAID');

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

  // Studycrux (50000 total, 25000 received, 25000 pending)
  inv(ID.cStartiffy, ID.pStudycrux, 'Studycrux LMS Development', 50000,
    [payment('2026-02-01', 5000), payment('2026-05-22', 20000)], '2026-02-01', 'PARTIALLY_PAID');

  // Jouelcube (22000 total, 2000 received)
  inv(ID.cNamit, ID.pJouelcube, 'Jouelcube Website Development', 22000,
    [payment('2026-02-12', 2000, 'Bank Transfer', 'Advance')], '2026-02-12', 'PARTIALLY_PAID');

  // Digital Mandir (9000, PAID by client)
  inv(ID.cDigitalMandir, ID.pDigitalMandir, 'Digital Mandir App Development', 9000,
    [payment('2026-02-01', 1500), payment('2026-02-25', 6000), payment('2026-02-28', 1500)], '2026-02-01', 'PAID');

  // HR Book (240000 total, 67500 received, 172500 pending)
  inv(ID.cHorizon, ID.pHRBook, 'HR Book HRMS Development', 240000,
    [payment('2026-02-23', 10000, 'Bank Transfer', 'Advance'), payment('2026-05-01', 57500, 'Bank Transfer', 'Milestone 2')], '2026-02-23', 'PARTIALLY_PAID');

  // Firstrank (85000 received so far)
  inv(ID.cFirstrank, ID.pFirstrank, 'Firstrank Website & Platform Development', 85000,
    [payment('2026-03-06', 10000), payment('2026-04-04', 25000), payment('2026-06-02', 50000)], '2026-03-06', 'PAID');

  // Rewardzy (30000 total, 21000 received, 9000 pending)
  inv(ID.cAnshulGlobal, ID.pRewardzy, 'Rewardzy Platform Development', 30000,
    [payment('2026-03-13', 9000, 'Bank Transfer', 'Advance'), payment('2026-04-19', 12000, 'Bank Transfer', 'Milestone 2')], '2026-03-13', 'PARTIALLY_PAID');

  // Onebox (40001 total, 12001 received, 28000 pending)
  inv(ID.cOnebox, ID.pOnebox, 'Onebox Project Development', 40001,
    [payment('2026-03-14', 12001, 'Bank Transfer', 'Advance')], '2026-03-14', 'PARTIALLY_PAID');

  // Real Estate App & Website (92000 total, 31050 received, 60950 pending)
  inv(ID.cInnoTrans, ID.pRealEstate, 'Real Estate App & Website Development', 92000,
    [payment('2026-04-06', 13050, 'Bank Transfer', 'Advance'), payment('2026-05-21', 18000, 'Bank Transfer', 'Milestone 2')], '2026-04-06', 'PARTIALLY_PAID');

  // Navisha (12000, PAID)
  inv(ID.cSP, ID.pNavisha, 'Navisha Website', 12000,
    [payment('2026-03-27', 12000)], '2026-03-27', 'PAID');

  // Avco Energy (8000, PAID)
  inv(ID.cStartiffy, ID.pAvcoEnergy, 'Avco Energy Website', 8000,
    [payment('2026-04-19', 8000)], '2026-04-19', 'PAID');

  // Eldeco (3500 total, 3500 received)
  inv(ID.cEldeco, ID.pEldeco, 'Eldeco Website Development', 3500,
    [payment('2026-04-28', 1500, 'Bank Transfer', 'Advance'), payment('2026-05-20', 2000)], '2026-04-28', 'PAID');

  // Bro Buzz App (60000 total, 30000 received, 30000 pending)
  inv(ID.cBroBuzz, ID.pBroBuzz, 'Bro Buzz App Development', 60000,
    [payment('2026-05-22', 30000)], '2026-05-22', 'PARTIALLY_PAID');

  // Velotra (20000 received so far)
  inv(ID.cVelotra, ID.pVelotra, 'Velotra Website Development', 20000,
    [payment('2026-02-20', 5000), payment('2026-04-17', 5000), payment('2026-05-06', 5000), payment('2026-06-04', 5000)], '2026-02-20', 'PAID');

  // Arowai (3000, PAID)
  inv(ID.cArowai, ID.pArowai, 'Arowai Website', 3000,
    [payment('2026-05-18', 3000)], '2026-05-18', 'PAID');

  // Dhawada NGO + Hiristan (10000 received, 6000 pending)
  inv(ID.cDhawada, ID.pDhawadaNGO, 'Dhawada NGO Website', 14000,
    [payment('2026-05-22', 8000)], '2026-05-22', 'PARTIALLY_PAID');
  inv(ID.cDhawada, ID.pHiristan, 'Hiristan Website', 8000,
    [payment('2026-05-22', 2000)], '2026-05-22', 'PARTIALLY_PAID');

  // SoulSurf (12000, PAID)
  inv(ID.cNJG, ID.pSoulSurf, 'SoulSurf Website', 12000,
    [payment('2026-03-06', 12000)], '2026-03-06', 'PAID');

  // Resto Shopify (12000, PAID)
  inv(ID.cNJG, ID.pResto, 'Resto Shopify Website', 12000,
    [payment('2026-04-21', 12000)], '2026-04-21', 'PAID');

  // G-Power (pending — no payment received yet from client)
  // No invoice created; project exists as placeholder

  // Hostinger Affiliate / Referral Income (agency income — kept as agency not personal)
  inv(ID.cHostinger, undefined, 'Hostinger Referral Affiliate Income Nov 2025', 4992.94,
    [payment('2025-11-28', 4992.94)], '2025-11-28', 'PAID');
  inv(ID.cHostinger, undefined, 'Hostinger Referral Affiliate Income Dec 2025', 7094.13,
    [payment('2025-12-10', 7094.13)], '2025-12-10', 'PAID');

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
    ['2025-12', ID.uJaya,       6800], // Go Laundry 2.8k + Dhawada 4k
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
    ['2026-02', ID.uShivam,     8500], // Studycrux 1.5k + unknown 2.5k + BroBuzz 4.5k
    ['2026-02', ID.uJaya,      12500], // BroBuzz 6.5k + Mending Mind 6k
    ['2026-02', ID.uGeetanjali, 4500], // Digital Mandir
    ['2026-02', ID.uSidhak,     6000], // Gessure maintenance
    // Mar 2026
    ['2026-03', ID.uAnjali,   1500], // Stipend
    ['2026-03', ID.uHarshika, 1000], // Stipend (before increment)
    ['2026-03', ID.uSanjana,  1000], // Stipend (1st payment)
    ['2026-03', ID.uShivam,  4500], // SoulSurf
    ['2026-03', ID.uSidhak,  6000], // Gessure maintenance
    ['2026-03', ID.uJaya,    7500], // Navisha 5k + Skoal 2.5k
    // Apr 2026
    ['2026-04', ID.uAnjali,   1500], // Stipend
    ['2026-04', ID.uHarshika, 1000], // Stipend (before increment)
    ['2026-04', ID.uIsha,     1000], // Stipend
    ['2026-04', ID.uYatin,    1000], // Stipend
    ['2026-04', ID.uSanjana,  1000], // Stipend
    ['2026-04', ID.uJaya,       2000], // Avco Energy
    ['2026-04', ID.uGeetanjali, 5000], // Resto Shopify
    ['2026-04', ID.uShabd,      7500], // Dhawada 2k + Mending Mind 5.5k
    ['2026-04', ID.uSidhak,    10500], // Gessure 6k + Skoal 2.5k + Avco 2k
    // May 2026
    ['2026-05', ID.uJaya,       10000], // HR Book
    ['2026-05', ID.uIsha,        2000], // Stipend (final — internship concluded May 29)
    ['2026-05', ID.uYatin,       3000], // Increment/stipend
    ['2026-05', ID.uShivam,      6000], // Velotra 5k + Eldeco 1k
    ['2026-05', ID.uAnjali,      1500], // Final stipend (concluded May 13)
    ['2026-05', ID.uJyotiYadav,  1000], // Stipend
    ['2026-05', ID.uAmit,        1000], // Stipend
    ['2026-05', ID.uHarshika,    3000], // Increment
    ['2026-05', ID.uGeetanjali,  2500], // Digital Mandir
    ['2026-05', ID.uSidhak,      4500], // Dhawada NGO 2k + Jouelcube 2.5k
    // Jun 2026
    ['2026-06', ID.uJaya,   17500], // Firstrank 10k + BroBuzz 6.5k + Jouelcube/G-Power 4k (gross; 3k contributed to Claude subscription)
    ['2026-06', ID.uSidhak, 12000], // Gessure (gross; 3k contributed to Claude subscription)
    ['2026-06', ID.uYatin,   3000], // Stipend
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
  await db.collection('expenses').insertMany([
    { _id: oid(), date: expD('2026-04-05'), title: 'VPS Server — Hetzner',           category: 'INFRASTRUCTURE', vendor: 'Hetzner',    amountPaise: p(728.07),   currency: 'INR', notes: 'Monthly VPS subscription', createdAt: now, updatedAt: now },
    { _id: oid(), date: expD('2026-05-05'), title: 'VPS Server — Hetzner',           category: 'INFRASTRUCTURE', vendor: 'Hetzner',    amountPaise: p(1039.78),  currency: 'INR', notes: 'Monthly VPS subscription', createdAt: now, updatedAt: now },
    { _id: oid(), date: expD('2026-06-03'), title: 'VPS Server — Hetzner',           category: 'INFRASTRUCTURE', vendor: 'Hetzner',    amountPaise: p(1586.13),  currency: 'INR', notes: 'Monthly VPS subscription', createdAt: now, updatedAt: now },
    { _id: oid(), date: expD('2026-06-03'), title: 'Bnani AI Design Tool',           category: 'SOFTWARE',       vendor: 'Bnani',      amountPaise: p(1981.22),  currency: 'INR', notes: 'AI design tool subscription', createdAt: now, updatedAt: now },
    { _id: oid(), date: expD('2026-06-02'), title: 'Claude AI Subscription',          category: 'SOFTWARE',       vendor: 'Anthropic',  amountPaise: p(11771.85), currency: 'INR', notes: 'Claude subscription — ₹3k contributed by Jaya, ₹3k by Sidhak (deducted from their Jun payslips); net agency cost ₹5,771.85', createdAt: now, updatedAt: now },
  ]);
  console.log('[full-seed] Inserted 5 expense records');

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
      agreedTotalPaise: p(52500), paidPaise: p(17500), pendingPaise: p(35000),
      payments: [
        { date: d('2026-05-01'), amountPaise: p(17500), note: 'Milestone 2 — brought the project, 1st payout' },
      ],
      status: 'ACTIVE', currency: 'INR',
      notes: 'Jyoti Makwana sourced this project. ₹52,500 agreed total; ₹35,000 still pending.',
      createdAt: now, updatedAt: now,
    },
  ]);
  console.log('[full-seed] Inserted 3 freelancer payment records');

  await mongoose.disconnect();
  console.log('[full-seed] Done ✓');
  console.log('');
  console.log('  Owner login → kanish@zlaark.com / kanish@7.7');
  console.log('  Team default password → Zlaark@123');
}

main().catch((err) => { console.error(err); process.exit(1); });
