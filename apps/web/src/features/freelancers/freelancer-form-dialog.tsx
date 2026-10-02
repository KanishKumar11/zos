'use client';

import { useEffect, useState } from 'react';

import type { FreelancerInput } from '@agency/shared';

import { getErrorMessage } from '@/lib/api-client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import { useCreateFreelancer, useUpdateFreelancer, type FreelancerRow } from './freelancers.hooks';

const EMPTY: FreelancerInput = { name: '', email: '', phone: '', skill: '', upiId: '', bankName: '', accountNumber: '', ifsc: '', pan: '', notes: '' };

export function FreelancerFormDialog({
  open,
  onOpenChange,
  freelancer,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  freelancer?: Pick<FreelancerRow, '_id' | 'name' | 'email' | 'phone' | 'skill' | 'upiId' | 'bankName' | 'accountNumber' | 'ifsc' | 'pan' | 'notes'>;
  onSaved?: (id: string) => void;
}) {
  const create = useCreateFreelancer();
  const update = useUpdateFreelancer();
  const [v, setV] = useState<FreelancerInput>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FreelancerInput, string>>>({});
  const [serverError, setServerError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setV(freelancer ? { ...EMPTY, ...Object.fromEntries(Object.entries(freelancer).filter(([, val]) => val != null)) } as FreelancerInput : EMPTY);
    setErrors({});
    setServerError(undefined);
  }, [open, freelancer]);

  const set = (k: keyof FreelancerInput, val: string) => {
    setV((p) => ({ ...p, [k]: val }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = async () => {
    const e: typeof errors = {};
    if (v.name.trim().length < 2) e.name = 'Enter their name';
    if (v.email && !/^\S+@\S+\.\S+$/.test(v.email)) e.email = 'Enter a valid email';
    if (v.ifsc && !/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(v.ifsc)) e.ifsc = 'IFSC looks like HDFC0001234';
    setErrors(e);
    if (Object.keys(e).length) return;
    const body = { ...v, name: v.name.trim(), ifsc: v.ifsc?.toUpperCase(), pan: v.pan?.toUpperCase() };
    try {
      if (freelancer) {
        await update.mutateAsync({ id: freelancer._id, body });
        onSaved?.(freelancer._id);
      } else {
        const f = await create.mutateAsync(body);
        onSaved?.(f._id);
      }
      onOpenChange(false);
    } catch (err) {
      setServerError(getErrorMessage(err));
    }
  };

  const field = (k: keyof FreelancerInput, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <FormField label={label} error={errors[k]}>
      <Input value={(v[k] as string) ?? ''} onChange={(e) => set(k, e.target.value)} {...props} />
    </FormField>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{freelancer ? `Edit ${freelancer.name}` : 'Add freelancer'}</DialogTitle>
        </DialogHeader>
        <form
          className="grid max-h-[70vh] gap-3 overflow-y-auto pr-1"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {serverError && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{serverError}</p>}
          <div className="grid grid-cols-2 gap-3">
            {field('name', 'Name *', { autoFocus: true })}
            {field('skill', 'Skill', { placeholder: 'e.g. Motion designer' })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {field('email', 'Email', { type: 'email' })}
            {field('phone', 'Phone')}
          </div>
          <p className="pt-1 text-xs font-medium text-muted-foreground">How you pay them</p>
          <div className="grid grid-cols-2 gap-3">
            {field('upiId', 'UPI ID', { placeholder: 'name@bank' })}
            {field('pan', 'PAN', { placeholder: 'For TDS' })}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {field('bankName', 'Bank')}
            {field('accountNumber', 'Account no.')}
            {field('ifsc', 'IFSC')}
          </div>
          <FormField label="Notes">
            <Textarea rows={2} value={v.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
          </FormField>
          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending || update.isPending}>
              {create.isPending || update.isPending ? 'Saving…' : freelancer ? 'Save' : 'Add freelancer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
