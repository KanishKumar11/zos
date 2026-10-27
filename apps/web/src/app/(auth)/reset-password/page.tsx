// Reset password — token from query string, full schema with confirm field.
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';

import { performPasswordResetSchema, type PerformPasswordResetInput } from '@agency/shared';

import { useResetPassword } from '@/features/auth/auth.hooks';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function Inner() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const m = useResetPassword();
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<PerformPasswordResetInput>({
    resolver: zodResolver(performPasswordResetSchema),
    defaultValues: { token, password: '', confirmPassword: '' },
  });

  return (
    <Card className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/40">
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      <CardHeader className="border-b-0 pb-2 pt-8 px-7 sm:px-8 space-y-2">
        <CardTitle className="font-display text-2xl sm:text-[1.75rem] font-bold tracking-tight text-foreground">
          Reset password
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm text-muted-foreground">
          Choose a strong new password for your account.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-7 sm:p-8 pt-4">
        <form onSubmit={handleSubmit((d) => m.mutate(d))} className="space-y-4">
          <input type="hidden" {...register('token')} />

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-medium text-foreground/90">
              New password
            </Label>
            <div className="relative group">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="••••••••"
                className="h-11 pl-10 pr-10 rounded-xl bg-background/60 border-input/80 transition-all duration-200 hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:border-primary"
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded focus:outline-none"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-[11px] font-medium text-destructive mt-1">{errors.password.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword" className="text-xs font-medium text-foreground/90">
              Confirm password
            </Label>
            <div className="relative group">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <Input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="••••••••"
                className="h-11 pl-10 pr-10 rounded-xl bg-background/60 border-input/80 transition-all duration-200 hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:border-primary"
                {...register('confirmPassword')}
              />
            </div>
            {errors.confirmPassword && <p className="text-[11px] font-medium text-destructive mt-1">{errors.confirmPassword.message}</p>}
          </div>

          {!token && (
            <p className="rounded-xl bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
              This reset link is missing a valid token. Please request a new one.
            </p>
          )}

          <Button
            type="submit"
            variant="brand"
            className="mt-2 h-11 w-full rounded-xl text-sm font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
            disabled={isSubmitting || m.isPending || !token}
          >
            {m.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Resetting…</span>
              </>
            ) : (
              <>
                <span>Set new password</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground pt-3">
            Link expired?{' '}
            <Link href="/forgot-password" className="text-primary hover:underline font-medium">
              Send a new one
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
