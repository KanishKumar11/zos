// Forgot-password page — submits an email to the reset endpoint.
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, Loader2, Mail, MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';

import { requestPasswordResetSchema, type RequestPasswordResetInput } from '@agency/shared';

import { useForgotPassword } from '@/features/auth/auth.hooks';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ForgotPasswordPage() {
  const m = useForgotPassword();
  const { register, handleSubmit, getValues, formState: { errors, isSubmitting } } = useForm<RequestPasswordResetInput>({
    resolver: zodResolver(requestPasswordResetSchema),
    defaultValues: { email: '' },
  });

  if (m.isSuccess) {
    return (
      <Card className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/40">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
        <CardHeader className="items-center border-b-0 pb-2 pt-8 px-7 sm:px-8 text-center space-y-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20">
            <MailCheck className="h-6 w-6" />
          </div>
          <CardTitle className="font-display text-2xl font-bold tracking-tight text-foreground">
            Check your email
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm text-muted-foreground max-w-sm">
            If an account exists for <span className="font-medium text-foreground">{getValues('email')}</span>, a reset link is on its way. It expires in 2 hours — check spam if you don&apos;t see it.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-7 sm:p-8 pt-4 space-y-3">
          <Button variant="outline" className="h-11 w-full rounded-xl" onClick={() => m.reset()}>
            Use a different email
          </Button>
          <p className="text-center text-xs text-muted-foreground pt-2">
            <Link href="/login" className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/40">
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      <CardHeader className="border-b-0 pb-2 pt-8 px-7 sm:px-8 space-y-2">
        <CardTitle className="font-display text-2xl sm:text-[1.75rem] font-bold tracking-tight text-foreground">
          Forgot password
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm text-muted-foreground">
          Enter your work email and we&apos;ll send you a password reset link.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-7 sm:p-8 pt-4">
        <form onSubmit={handleSubmit((d) => m.mutate(d))} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-medium text-foreground/90">
              Work email
            </Label>
            <div className="relative group">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                className="h-11 pl-10 rounded-xl bg-background/60 border-input/80 transition-all duration-200 hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:border-primary"
                {...register('email')}
              />
            </div>
            {errors.email && <p className="text-[11px] font-medium text-destructive mt-1">{errors.email.message}</p>}
          </div>

          <Button
            type="submit"
            variant="brand"
            className="mt-2 h-11 w-full rounded-xl text-sm font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
            disabled={isSubmitting || m.isPending}
          >
            {m.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Sending link…</span>
              </>
            ) : (
              <>
                <span>Send reset link</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground pt-3">
            Remembered it?{' '}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Back to sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
