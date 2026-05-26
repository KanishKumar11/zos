// Reset password — token from query string, full schema with confirm field.
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useForm } from 'react-hook-form';

import { performPasswordResetSchema, type PerformPasswordResetInput } from '@agency/shared';

import { useResetPassword } from '@/features/auth/auth.hooks';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function Inner() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const m = useResetPassword();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<PerformPasswordResetInput>({
    resolver: zodResolver(performPasswordResetSchema),
    defaultValues: { token, password: '', confirmPassword: '' },
  });
  return (
    <Card className="shadow-md">
      <CardHeader className="pb-4 pt-6">
        <CardTitle className="text-[18px]">Reset password</CardTitle>
        <p className="text-[13px] text-muted-foreground">Choose a strong new password for your account.</p>
      </CardHeader>
      <CardContent className="pb-6">
        <form onSubmit={handleSubmit((d) => m.mutate(d))} className="space-y-4">
          <input type="hidden" {...register('token')} />
          <div className="space-y-1.5">
            <Label htmlFor="password">New password</Label>
            <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
            {errors.password && <p className="text-[11px] text-destructive">{errors.password.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input id="confirmPassword" type="password" autoComplete="new-password" {...register('confirmPassword')} />
            {errors.confirmPassword && <p className="text-[11px] text-destructive">{errors.confirmPassword.message}</p>}
          </div>
          <Button type="submit" className="mt-1 w-full" disabled={isSubmitting || m.isPending || !token}>
            {m.isPending ? 'Resetting…' : 'Set new password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function Page() {
  return <Suspense><Inner /></Suspense>;
}
