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
    <Card className="shadow-md">
      <CardHeader className="pb-4 pt-6">
        <CardTitle className="text-[18px]">Welcome aboard</CardTitle>
        <CardDescription>Complete your profile and set a password to activate your account.</CardDescription>
      </CardHeader>
      <CardContent className="pb-6">
        <form onSubmit={handleSubmit((d) => m.mutate(d))} className="space-y-4">
          <input type="hidden" {...register('token')} />
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name <span className="text-muted-foreground">(optional)</span></Label>
            <Input id="name" placeholder="Jane Doe" {...register('name')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone <span className="text-muted-foreground">(optional)</span></Label>
            <Input id="phone" type="tel" placeholder="+91 98765 43210" {...register('phone')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
            {errors.password && <p className="text-[11px] text-destructive">{errors.password.message}</p>}
          </div>
          <Button type="submit" className="mt-1 w-full" disabled={isSubmitting || m.isPending || !token}>
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
