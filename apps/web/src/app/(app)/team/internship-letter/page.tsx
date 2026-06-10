'use client';

import { useState } from 'react';
import Link from 'next/link';

import { useGenerateInternshipLetter } from '@/features/letters/letters.hooks';

const today = new Date().toISOString().slice(0, 10);

export default function InternshipLetterPage() {
  const gen = useGenerateInternshipLetter();

  const [form, setForm] = useState({
    candidateName: '',
    candidateEmail: '',
    candidateAddress: '',
    candidateCity: '',
    candidatePhone: '',
    position: '',
    department: '',
    startDate: '',
    endDate: '',
    stipendAmount: '',
    manager: '',
    workHours: '10:00 AM – 6:00 PM',
    workDays: 'Monday – Friday',
    workMode: 'Remote',
    acceptanceDeadline: '',
    issueDate: today,
    referenceNumber: '',
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    gen.mutate({
      ...form,
      stipendAmount: Number(form.stipendAmount),
      candidateAddress: form.candidateAddress || undefined,
      candidateCity: form.candidateCity || undefined,
      candidatePhone: form.candidatePhone || undefined,
      manager: form.manager || undefined,
      acceptanceDeadline: form.acceptanceDeadline || undefined,
      referenceNumber: form.referenceNumber || undefined,
    });
  };

  return (
    <div className="max-w-3xl mx-auto pb-24 px-4 md:px-0">
      <header className="border-b border-border py-8 md:py-16 mb-8 md:mb-12">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/team" className="text-[10px] uppercase tracking-[0.2em] font-mono text-muted-foreground hover:text-foreground">
            ← Team
          </Link>
        </div>
        <h1 className="text-4xl md:text-6xl font-medium tracking-tighter uppercase">
          Internship<br />Letter
        </h1>
        <p className="text-[10px] uppercase tracking-[0.2em] font-mono text-muted-foreground mt-4">
          Generate a branded offer letter as a .docx file
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-0">

        {/* Candidate */}
        <Section label="Candidate">
          <Field label="Full Name" required>
            <input className={INPUT} value={form.candidateName} onChange={set('candidateName')} placeholder="Aryan Sharma" required />
          </Field>
          <Field label="Email" required>
            <input className={INPUT} type="email" value={form.candidateEmail} onChange={set('candidateEmail')} placeholder="aryan@example.com" required />
          </Field>
          <Field label="Phone">
            <input className={INPUT} value={form.candidatePhone} onChange={set('candidatePhone')} placeholder="+91 98765 43210" />
          </Field>
          <Field label="Address Line">
            <input className={INPUT} value={form.candidateAddress} onChange={set('candidateAddress')} placeholder="123, Street Name" />
          </Field>
          <Field label="City / State / Pin">
            <input className={INPUT} value={form.candidateCity} onChange={set('candidateCity')} placeholder="Chandigarh, Punjab 160001" />
          </Field>
        </Section>

        {/* Role */}
        <Section label="Role">
          <Field label="Position / Role Name" required>
            <input className={INPUT} value={form.position} onChange={set('position')} placeholder="UI/UX Design Intern" required />
          </Field>
          <Field label="Department" required>
            <input className={INPUT} value={form.department} onChange={set('department')} placeholder="Design" required />
          </Field>
          <Field label="Reporting Manager">
            <input className={INPUT} value={form.manager} onChange={set('manager')} placeholder="Kanish Kumar, Founder" />
          </Field>
        </Section>

        {/* Duration */}
        <Section label="Duration">
          <Field label="Start Date" required>
            <input className={INPUT} type="date" value={form.startDate} onChange={set('startDate')} required />
          </Field>
          <Field label="End Date" required>
            <input className={INPUT} type="date" value={form.endDate} onChange={set('endDate')} required />
          </Field>
          <Field label="Acceptance Deadline">
            <input className={INPUT} type="date" value={form.acceptanceDeadline} onChange={set('acceptanceDeadline')} />
          </Field>
        </Section>

        {/* Compensation */}
        <Section label="Compensation">
          <Field label="Monthly Stipend (₹)" required>
            <input className={INPUT} type="number" min={0} value={form.stipendAmount} onChange={set('stipendAmount')} placeholder="8000" required />
          </Field>
        </Section>

        {/* Work */}
        <Section label="Work Details">
          <Field label="Work Hours">
            <input className={INPUT} value={form.workHours} onChange={set('workHours')} placeholder="10:00 AM – 6:00 PM" />
          </Field>
          <Field label="Work Days">
            <input className={INPUT} value={form.workDays} onChange={set('workDays')} placeholder="Monday – Friday" />
          </Field>
          <Field label="Work Mode">
            <select className={INPUT} value={form.workMode} onChange={set('workMode')}>
              <option>Remote</option>
              <option>On-site</option>
              <option>Hybrid</option>
            </select>
          </Field>
        </Section>

        {/* Document */}
        <Section label="Document">
          <Field label="Issue Date" required>
            <input className={INPUT} type="date" value={form.issueDate} onChange={set('issueDate')} required />
          </Field>
          <Field label="Reference Number">
            <input className={INPUT} value={form.referenceNumber} onChange={set('referenceNumber')} placeholder="Auto-generated if blank (ZLK-INT-2026-001)" />
          </Field>
        </Section>

        <div className="pt-8 border-t border-border">
          <button
            type="submit"
            disabled={gen.isPending}
            className="w-full md:w-auto px-8 py-3 bg-foreground text-background text-sm font-bold uppercase tracking-widest hover:opacity-80 disabled:opacity-40 transition-opacity"
          >
            {gen.isPending ? 'Generating…' : 'Generate & Download .docx'}
          </button>
        </div>
      </form>
    </div>
  );
}

const INPUT = 'w-full bg-transparent border-b border-border py-2 text-sm focus:outline-none focus:border-foreground placeholder:text-muted-foreground transition-colors';

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-border py-8">
      <p className="text-[10px] uppercase tracking-[0.2em] font-mono text-muted-foreground mb-6">{label}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{children}</div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        {label}{required && <span className="text-orange-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}
