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
    <Card>
      <CardHeader>
        <CardTitle>Forgot password</CardTitle>
        <CardDescription>We'll email you a link to reset.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((d) => m.mutate(d))} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register('email')} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting || m.isPending}>
            {m.isPending ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
