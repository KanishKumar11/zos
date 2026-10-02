// Internship letter — fill in the details and download a branded .docx offer letter (OWNER).
'use client';

import { Download } from 'lucide-react';
import { useState } from 'react';

import { Role } from '@agency/shared';

import { todayLocal } from '@/lib/form';

import { RoleGate } from '@/components/auth/role-gate';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/states';
import { useGenerateInternshipLetter } from '@/features/letters/letters.hooks';

interface Values {
  candidateName: string;
  candidateEmail: string;
  candidateAddress: string;
  candidateCity: string;
  candidatePhone: string;
  position: string;
  department: string;
  startDate: string;
  endDate: string;
  manager: string;
  workHours: string;
  workDays: string;
  workMode: string;
  acceptanceDeadline: string;
  issueDate: string;
  referenceNumber: string;
}

export default function InternshipLetterPage() {
  return (
    <RoleGate allow={[Role.OWNER]} fallback={<EmptyState title="Only the owner can create internship letters" />}>
      <Inner />
    </RoleGate>
  );
}

function Inner() {
  const gen = useGenerateInternshipLetter();
  const [v, setV] = useState<Values>(() => ({
    candidateName: '',
    candidateEmail: '',
    candidateAddress: '',
    candidateCity: '',
    candidatePhone: '',
    position: '',
    department: '',
    startDate: '',
    endDate: '',
    manager: '',
    workHours: '10:00 AM – 6:00 PM',
    workDays: 'Monday – Friday',
    workMode: 'Remote',
    acceptanceDeadline: '',
    issueDate: todayLocal(),
    referenceNumber: '',
  }));
  const [stipendPaise, setStipendPaise] = useState<number | undefined>();
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const val = e.target.value;
    setV((p) => ({ ...p, [k]: val }));
    setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const submit = () => {
    const e: Record<string, string> = {};
    if (v.candidateName.trim().length < 2) e.candidateName = 'Enter the candidate’s name';
    if (!/^\S+@\S+\.\S+$/.test(v.candidateEmail.trim())) e.candidateEmail = 'Enter a valid email';
    if (!v.position.trim()) e.position = 'Enter the role';
    if (!v.department.trim()) e.department = 'Enter the department';
    if (!v.startDate) e.startDate = 'Pick a start date';
    if (!v.endDate) e.endDate = 'Pick an end date';
    if (v.startDate && v.endDate && v.endDate < v.startDate) e.endDate = 'End date must be after the start date';
    if (!stipendPaise || stipendPaise <= 0) e.stipendAmount = 'Enter the monthly stipend';
    if (!v.issueDate) e.issueDate = 'Pick the issue date';
    setErrors(e);
    if (Object.keys(e).length) return;
    gen.mutate({
      ...v,
      candidateName: v.candidateName.trim(),
      candidateEmail: v.candidateEmail.trim(),
      stipendAmount: Math.round(stipendPaise!) / 100, // the letter service works in rupees
      candidateAddress: v.candidateAddress.trim() || undefined,
      candidateCity: v.candidateCity.trim() || undefined,
      candidatePhone: v.candidatePhone.trim() || undefined,
      manager: v.manager.trim() || undefined,
      acceptanceDeadline: v.acceptanceDeadline || undefined,
      referenceNumber: v.referenceNumber.trim() || undefined,
    });
  };

  const field = (k: keyof Values, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, required = false) => (
    <FormField label={label} required={required} error={errors[k]}>
      <Input value={v[k]} onChange={set(k)} {...props} />
    </FormField>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Internship letter"
        crumbs={[{ label: 'Team', href: '/team' }]}
        description="Fill in the details to download a branded offer letter (.docx) you can edit and send."
      />
      <form
        noValidate
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Candidate</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {field('candidateName', 'Full name', { placeholder: 'Aryan Sharma', autoFocus: true }, true)}
            {field('candidateEmail', 'Email', { type: 'email', placeholder: 'aryan@example.com' }, true)}
            {field('candidatePhone', 'Phone', { placeholder: '+91 98765 43210' })}
            {field('candidateAddress', 'Address', { placeholder: '123, Street name' })}
            {field('candidateCity', 'City, state and PIN', { placeholder: 'Chandigarh, Punjab 160001' })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Role and duration</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {field('position', 'Role', { placeholder: 'UI/UX design intern' }, true)}
            {field('department', 'Department', { placeholder: 'Design' }, true)}
            {field('manager', 'Reporting manager', { placeholder: 'Name, title' })}
            <FormField label="Monthly stipend" required error={errors.stipendAmount}>
              <MoneyInput
                value={stipendPaise}
                onChange={(p) => {
                  setStipendPaise(p);
                  setErrors((x) => ({ ...x, stipendAmount: undefined }));
                }}
                invalid={!!errors.stipendAmount}
                placeholder="8,000"
              />
            </FormField>
            {field('startDate', 'Start date', { type: 'date' }, true)}
            {field('endDate', 'End date', { type: 'date', min: v.startDate || undefined }, true)}
            {field('acceptanceDeadline', 'Accept by', { type: 'date' })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Work and document</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {field('workHours', 'Work hours')}
            {field('workDays', 'Work days')}
            <FormField label="Work mode">
              <Select value={v.workMode} onChange={set('workMode')}>
                <option>Remote</option>
                <option>On-site</option>
                <option>Hybrid</option>
              </Select>
            </FormField>
            {field('issueDate', 'Issue date', { type: 'date' }, true)}
            {field('referenceNumber', 'Reference number', { placeholder: 'Left blank, one is generated' })}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={gen.isPending}>
            <Download className="mr-1.5 h-4 w-4" />
            {gen.isPending ? 'Generating…' : 'Generate and download'}
          </Button>
        </div>
      </form>
    </div>
  );
}
