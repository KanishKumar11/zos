// Login page — RHF + Zod with the shared loginSchema.
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { loginSchema, type LoginInput } from '@agency/shared';

import { useLogin } from '@/features/auth/auth.hooks';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const login = useLogin();
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  const onSubmit = (data: LoginInput) => login.mutate(data);

  return (
    <Card className="relative overflow-hidden rounded-2xl border border-border/80 bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/40">
      {/* Illuminated top accent line */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

      <CardHeader className="border-b-0 pb-2 pt-7 px-7 sm:px-8 space-y-2">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary w-fit">
          <Sparkles className="h-3 w-3" />
          <span>Agency Workspace</span>
        </div>
        <CardTitle className="font-display text-2xl sm:text-[1.75rem] font-bold tracking-tight text-foreground">
          Sign in
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm text-muted-foreground">
          Enter your credentials to access your agency dashboard.
        </CardDescription>
      </CardHeader>

      <CardContent className="p-7 sm:p-8 pt-4">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Email input with icon */}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-medium text-foreground/90">
              Email
            </Label>
            <div className="relative group">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                className="h-11 pl-10 rounded-xl bg-background/60 border-input/80 transition-all duration-200 hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:border-primary"
                {...register('email')}
              />
            </div>
            {errors.email && (
              <p className="text-[11px] font-medium text-destructive mt-1">{errors.email.message}</p>
            )}
          </div>

          {/* Password input with lock icon and show/hide toggle */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-xs font-medium text-foreground/90">
                Password
              </Label>
              <Link
                className="text-xs text-muted-foreground hover:text-primary transition-colors font-medium"
                href="/forgot-password"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative group">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
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
            {errors.password && (
              <p className="text-[11px] font-medium text-destructive mt-1">{errors.password.message}</p>
            )}
          </div>

          {/* Submit CTA button */}
          <Button
            type="submit"
            variant="brand"
            className="mt-2 h-11 w-full rounded-xl text-sm font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2 group"
            disabled={isSubmitting || login.isPending}
          >
            {login.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Signing in…</span>
              </>
            ) : (
              <>
                <span>Sign in</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
          </Button>

          {/* Helper note below button */}
          <div className="pt-3 text-center text-xs text-muted-foreground">
            Don&apos;t have an account?{' '}
            <span className="text-foreground font-medium">Contact your workspace administrator</span>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
