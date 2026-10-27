// Accept invite — team members and client portal users set their password here.
'use client';

import { ArrowRight, Loader2 } from 'lucide-react';
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
      <Card className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/40">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
        <CardHeader className="border-b-0 pb-2 pt-8 px-7 sm:px-8 space-y-2">
          <CardTitle className="font-display text-2xl font-bold tracking-tight text-foreground">
            This link is incomplete
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm text-muted-foreground">
            Open the invite link from your email again, or ask your administrator for a new invite.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-7 sm:p-8 pt-4">
          <Button asChild variant="outline" className="h-11 w-full rounded-xl">
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
    <Card className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/40">
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      <CardHeader className="border-b-0 pb-2 pt-8 px-7 sm:px-8 space-y-2">
        <CardTitle className="font-display text-2xl sm:text-[1.75rem] font-bold tracking-tight text-foreground">
          Set up your account
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm text-muted-foreground">
          Choose a password to activate your ZOS access.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-7 sm:p-8 pt-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="space-y-4"
        >
          {serverError && (
            <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
              {serverError}
            </div>
          )}
          <FormField label="Your name" hint="Leave blank to keep the name on your invite." error={errors.name}>
            <Input className="h-11 rounded-xl bg-background/60" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} autoComplete="name" />
          </FormField>
          <FormField label="Phone (optional)" error={errors.phone}>
            <Input className="h-11 rounded-xl bg-background/60" type="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} placeholder="+91 98765 43210" autoComplete="tel" />
          </FormField>
          <FormField label="Password" error={errors.password} hint="8+ characters with letters and numbers">
            <Input className="h-11 rounded-xl bg-background/60" type="password" autoComplete="new-password" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} />
          </FormField>
          <FormField label="Confirm password" error={errors.confirm}>
            <Input className="h-11 rounded-xl bg-background/60" type="password" autoComplete="new-password" value={v.confirm} onChange={(e) => setV({ ...v, confirm: e.target.value })} />
          </FormField>
          <Button type="submit" variant="brand" className="mt-2 h-11 w-full rounded-xl text-sm font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2" disabled={accept.isPending}>
            {accept.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Activating account…</span>
              </>
            ) : (
              <>
                <span>Activate account</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
          <p className="text-center text-xs text-muted-foreground pt-3">
            Already set a password?{' '}
            <Link href="/login" className="text-primary hover:underline font-medium">
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
