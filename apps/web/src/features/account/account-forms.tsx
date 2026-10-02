// Self-service account forms — used by My profile (staff) and Account (client portal).
'use client';

import { useEffect, useState } from 'react';

import { ApiRequestError, getErrorMessage } from '@/lib/api-client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { useChangePassword } from '@/features/auth/auth.hooks';
import { useMyProfile, useUpdateMe, useUpdateMyBank } from '@/features/team/team.hooks';

export function ProfileDetailsCard() {
  const me = useMyProfile();
  const update = useUpdateMe();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});

  useEffect(() => {
    if (me.data) {
      setName(me.data.name);
      setPhone(me.data.phone ?? '');
    }
  }, [me.data]);

  const dirty = !!me.data && (name !== me.data.name || phone !== (me.data.phone ?? ''));

  const save = async () => {
    const e: typeof errors = {};
    if (name.trim().length < 2) e.name = 'Enter your name';
    if (phone && !/^\+?[0-9\s\-()]{7,20}$/.test(phone)) e.phone = 'Enter a valid phone number';
    setErrors(e);
    if (Object.keys(e).length) return;
    try {
      await update.mutateAsync({ name: name.trim(), ...(phone ? { phone } : {}) });
    } catch (err) {
      if (err instanceof ApiRequestError) setErrors({ name: err.fieldErrors.name?.[0], phone: err.fieldErrors.phone?.[0] });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your details</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <FormField label="Name" error={errors.name}>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <FormField label="Phone" error={errors.phone}>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" />
        </FormField>
        <FormField label="Email" hint="Ask your workspace owner to change your login email." className="sm:col-span-2">
          <Input value={me.data?.email ?? ''} disabled />
        </FormField>
        <div className="flex justify-end sm:col-span-2">
          <Button size="sm" onClick={() => void save()} disabled={!dirty || update.isPending}>
            {update.isPending ? 'Saving…' : 'Save details'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function BankDetailsCard() {
  const me = useMyProfile();
  const save = useUpdateMyBank();
  const current = me.data?.bankDetails;
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState({ accountHolderName: '', accountNumber: '', ifsc: '', bankName: '', branch: '', upiId: '' });
  const [error, setError] = useState<string>();

  const submit = async () => {
    if (v.accountHolderName.trim().length < 2) return setError('Enter the account holder name');
    if (!/^\d{6,30}$/.test(v.accountNumber.replace(/\s/g, ''))) return setError('Account number should be 6–30 digits');
    if (!/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(v.ifsc)) return setError('IFSC looks like HDFC0001234');
    if (v.bankName.trim().length < 2) return setError('Enter the bank name');
    setError(undefined);
    try {
      await save.mutateAsync({
        ...v,
        accountNumber: v.accountNumber.replace(/\s/g, ''),
        ifsc: v.ifsc.toUpperCase(),
        branch: v.branch || undefined,
        upiId: v.upiId || undefined,
      });
      setEditing(false);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Bank details for payouts</CardTitle>
          <p className="mt-1 text-[13px] text-muted-foreground">Only you and the workspace owner can see these. Stored encrypted.</p>
        </div>
        {!editing && (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            {current ? 'Update' : 'Add'}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {!editing ? (
          current ? (
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <Row label="Account holder" value={current.accountHolderName} />
              <Row label="Account" value={`•••• ${current.accountNumberLast4}`} />
              <Row label="Bank" value={`${current.bankName}${current.branch ? `, ${current.branch}` : ''}`} />
              <Row label="IFSC" value={current.ifsc} />
              {current.upiId && <Row label="UPI" value={current.upiId} />}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">No bank details yet. Add them so payments reach you without back-and-forth.</p>
          )
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive sm:col-span-2">{error}</p>}
            {([
              ['accountHolderName', 'Account holder name'],
              ['accountNumber', 'Account number'],
              ['ifsc', 'IFSC'],
              ['bankName', 'Bank'],
              ['branch', 'Branch (optional)'],
              ['upiId', 'UPI ID (optional)'],
            ] as const).map(([k, label]) => (
              <FormField key={k} label={label}>
                <Input value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} autoComplete="off" />
              </FormField>
            ))}
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={() => void submit()} disabled={save.isPending}>
                {save.isPending ? 'Saving…' : 'Save bank details'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function ChangePasswordCard() {
  const change = useChangePassword();
  const [v, setV] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof v, string>>>({});

  const submit = async () => {
    const e: typeof errors = {};
    if (!v.currentPassword) e.currentPassword = 'Enter your current password';
    if (v.newPassword.length < 8) e.newPassword = 'At least 8 characters';
    else if (!/[A-Za-z]/.test(v.newPassword) || !/[0-9]/.test(v.newPassword)) e.newPassword = 'Use letters and numbers';
    if (v.confirmPassword !== v.newPassword) e.confirmPassword = "Passwords don't match";
    setErrors(e);
    if (Object.keys(e).length) return;
    try {
      await change.mutateAsync(v);
      setV({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      if (err instanceof ApiRequestError && Object.keys(err.fieldErrors).length) {
        setErrors(Object.fromEntries(Object.entries(err.fieldErrors).map(([k, m]) => [k, m[0]])));
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-3 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <FormField label="Current password" error={errors.currentPassword}>
            <Input type="password" autoComplete="current-password" value={v.currentPassword} onChange={(e) => setV({ ...v, currentPassword: e.target.value })} />
          </FormField>
          <FormField label="New password" error={errors.newPassword} hint="8+ characters, letters and numbers">
            <Input type="password" autoComplete="new-password" value={v.newPassword} onChange={(e) => setV({ ...v, newPassword: e.target.value })} />
          </FormField>
          <FormField label="Confirm new password" error={errors.confirmPassword}>
            <Input type="password" autoComplete="new-password" value={v.confirmPassword} onChange={(e) => setV({ ...v, confirmPassword: e.target.value })} />
          </FormField>
          <div className="flex justify-end sm:col-span-3">
            <Button size="sm" type="submit" disabled={change.isPending}>
              {change.isPending ? 'Changing…' : 'Change password'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 sm:block">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
