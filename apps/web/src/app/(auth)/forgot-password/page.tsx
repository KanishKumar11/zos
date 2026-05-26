// Forgot-password page — submits an email to the reset endpoint.
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { requestPasswordResetSchema, type RequestPasswordResetInput } from '@agency/shared';

import { useForgotPassword } from '@/features/auth/auth.hooks';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ForgotPasswordPage() {
  const m = useForgotPassword();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RequestPasswordResetInput>({
    resolver: zodResolver(requestPasswordResetSchema),
    defaultValues: { email: '' },
  });
  return (
    <Card className="shadow-md">
      <CardHeader className="pb-4 pt-6">
        <CardTitle className="text-[18px]">Forgot password</CardTitle>
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
        </form>
      </CardContent>
    </Card>
  );
}
