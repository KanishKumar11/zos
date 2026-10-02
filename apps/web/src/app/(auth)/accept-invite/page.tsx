// Accept invite — team members and client portal users set their password here.
'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { getErrorMessage } from '@/lib/api-client';
import { useAcceptInvite } from '@/features/auth/auth.hooks';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';

function Inner() {
  const token = useSearchParams().get('token') ?? '';
  const accept = useAcceptInvite();
  const [v, setV] = useState({ name: '', phone: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof v, string>>>({});
  const [serverError, setServerError] = useState<string>();

  if (!token) {
    return (
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-[18px]">This link is incomplete</CardTitle>
          <CardDescription>Open the invite link from your email again, or ask for a new invite.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">Go to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const submit = async () => {
    const e: typeof errors = {};
    if (v.name && v.name.trim().length < 2) e.name = 'At least 2 characters';
    if (v.phone && !/^\+?[0-9\s\-()]{7,20}$/.test(v.phone)) e.phone = 'Enter a valid phone number';
    if (v.password.length < 8) e.password = 'At least 8 characters';
    else if (!/[A-Za-z]/.test(v.password) || !/[0-9]/.test(v.password)) e.password = 'Use letters and numbers';
    if (v.confirm !== v.password) e.confirm = "Passwords don't match";
    setErrors(e);
    if (Object.keys(e).length) return;
    setServerError(undefined);
    try {
      await accept.mutateAsync({ token, password: v.password, name: v.name.trim() || undefined, phone: v.phone.trim() || undefined });
    } catch (err) {
      setServerError(getErrorMessage(err));
    }
  };

  return (
    <Card className="shadow-md">
      <CardHeader className="pb-4 pt-6">
        <CardTitle className="text-[18px]">Set up your account</CardTitle>
        <CardDescription>Choose a password to activate your access.</CardDescription>
      </CardHeader>
      <CardContent className="pb-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="space-y-4"
        >
          {serverError && (
            <div role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </div>
          )}
          <FormField label="Your name" hint="Leave blank to keep the name on your invite." error={errors.name}>
            <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} autoComplete="name" />
          </FormField>
          <FormField label="Phone (optional)" error={errors.phone}>
            <Input type="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} placeholder="+91 98765 43210" autoComplete="tel" />
          </FormField>
          <FormField label="Password" error={errors.password} hint="8+ characters with letters and numbers">
            <Input type="password" autoComplete="new-password" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} />
          </FormField>
          <FormField label="Confirm password" error={errors.confirm}>
            <Input type="password" autoComplete="new-password" value={v.confirm} onChange={(e) => setV({ ...v, confirm: e.target.value })} />
          </FormField>
          <Button type="submit" className="w-full" disabled={accept.isPending}>
            {accept.isPending ? 'Activating…' : 'Activate account'}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Already set a password?{' '}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
