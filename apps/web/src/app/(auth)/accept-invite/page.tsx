// Accept invite — onboard the new team member; sets password + optional name/phone overrides.
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useForm } from 'react-hook-form';

import { acceptInviteSchema, type AcceptInviteInput } from '@agency/shared';

import { useAcceptInvite } from '@/features/auth/auth.hooks';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function Inner() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const m = useAcceptInvite();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<AcceptInviteInput>({
    resolver: zodResolver(acceptInviteSchema),
    defaultValues: { token, password: '', name: '', phone: '' },
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome aboard</CardTitle>
        <CardDescription>Set up your account to get started.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((d) => m.mutate(d))} className="space-y-4">
          <input type="hidden" {...register('token')} />
          <div className="space-y-2">
            <Label htmlFor="name">Full name (optional)</Label>
            <Input id="name" {...register('name')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input id="phone" {...register('phone')} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" {...register('password')} />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting || m.isPending || !token}>
            {m.isPending ? 'Activating…' : 'Activate account'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function Page() {
  return <Suspense><Inner /></Suspense>;
}
