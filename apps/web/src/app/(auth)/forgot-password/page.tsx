// Forgot-password page — submits an email to the reset endpoint.
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck } from 'lucide-react';
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
      <Card className="border-0 bg-transparent shadow-none lg:border lg:bg-card lg:shadow-sm">
        <CardHeader className="items-center pb-4 pt-6 text-center">
          <MailCheck className="mb-2 h-8 w-8 text-primary" />
          <CardTitle className="font-display text-[1.6rem] font-bold">Check your email</CardTitle>
          <CardDescription>
            If an account exists for {getValues('email')}, a reset link is on its way. It expires in 2 hours — check spam if you don&apos;t see it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 pb-6">
          <Button variant="outline" className="w-full" onClick={() => m.reset()}>
            Use a different email
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            <Link href="/login" className="text-primary hover:underline">Back to sign in</Link>
          </p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="border-0 bg-transparent shadow-none lg:border lg:bg-card lg:shadow-sm">
      <CardHeader className="pb-4 pt-6">
        <CardTitle className="font-display text-[1.6rem] font-bold">Forgot password</CardTitle>
        <CardDescription>Enter your work email and we&apos;ll send a reset link.</CardDescription>
      </CardHeader>
      <CardContent className="pb-6">
        <form onSubmit={handleSubmit((d) => m.mutate(d))} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Work email</Label>
            <Input id="email" type="email" placeholder="you@company.com" {...register('email')} />
            {errors.email && <p className="text-[11px] text-destructive">{errors.email.message}</p>}
          </div>
          <Button type="submit" className="mt-1 w-full" disabled={isSubmitting || m.isPending}>
            {m.isPending ? 'Sending…' : 'Send reset link'}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Remembered it? <Link href="/login" className="text-primary hover:underline">Sign in</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
