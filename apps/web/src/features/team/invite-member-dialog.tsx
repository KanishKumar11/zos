// Invite a teammate — name, email, role and (optionally) department / designation.
'use client';

import { useEffect, useMemo, useState } from 'react';

import { Role, STAFF_ROLES } from '@agency/shared';

import { ApiRequestError, getErrorMessage } from '@/lib/api-client';
import { isOwner } from '@/lib/roles';
import { useAuthStore } from '@/store/auth.store';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useDepartments, useDesignations } from '@/features/org/org.hooks';

import { ROLE_LABEL } from './team.api';
import { useInviteMember } from './team.hooks';

interface Values {
  name: string;
  email: string;
  role: Role;
  departmentId: string;
  designationId: string;
}

const EMPTY: Values = { name: '', email: '', role: Role.MEMBER, departmentId: '', designationId: '' };

export function InviteMemberDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const myRole = useAuthStore((s) => s.user?.role);
  const invite = useInviteMember();
  const departments = useDepartments();
  const designations = useDesignations();
  const [v, setV] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [serverError, setServerError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setV(EMPTY);
    setErrors({});
    setServerError(undefined);
  }, [open]);

  const designationOptions = useMemo(
    () => (designations.data ?? []).filter((d) => !v.departmentId || d.departmentId === v.departmentId),
    [designations.data, v.departmentId],
  );

  const set = <K extends keyof Values>(k: K, val: Values[K]) => {
    setV((p) => {
      const next = { ...p, [k]: val };
      // A designation belongs to one department — drop it if it no longer fits.
      if (k === 'departmentId' && p.designationId) {
        const d = designations.data?.find((x) => x._id === p.designationId);
        if (d && val && d.departmentId !== val) next.designationId = '';
      }
      return next;
    });
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const submit = async () => {
    const e: Record<string, string> = {};
    if (v.name.trim().length < 2) e.name = 'Enter their name';
    if (!/^\S+@\S+\.\S+$/.test(v.email.trim())) e.email = 'Enter a valid email address';
    setErrors(e);
    if (Object.keys(e).length) return;
    setServerError(undefined);
    try {
      await invite.mutateAsync({
        name: v.name.trim(),
        email: v.email.trim(),
        role: v.role,
        departmentId: v.departmentId || undefined,
        designationId: v.designationId || undefined,
      });
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiRequestError) setErrors(Object.fromEntries(Object.entries(err.fieldErrors).map(([k, m]) => [k, m[0]])));
      setServerError(getErrorMessage(err));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite a teammate</DialogTitle>
          <DialogDescription>They get an email with a link to set their password. The link works for a limited time.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {serverError && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{serverError}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Name" required error={errors.name}>
              <Input autoFocus value={v.name} onChange={(e) => set('name', e.target.value)} />
            </FormField>
            <FormField label="Email" required error={errors.email}>
              <Input type="email" value={v.email} onChange={(e) => set('email', e.target.value)} placeholder="name@company.com" />
            </FormField>
          </div>
          <FormField
            label="Role"
            error={errors.role}
            hint={v.role === Role.ADMIN ? 'Admins can manage people, payroll and settings, but not see project money.' : undefined}
          >
            <Select value={v.role} onChange={(e) => set('role', e.target.value as Role)}>
              {STAFF_ROLES.filter((r) => r !== Role.OWNER || isOwner(myRole)).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </Select>
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Department" hint="Optional" error={errors.departmentId}>
              <Select value={v.departmentId} onChange={(e) => set('departmentId', e.target.value)}>
                <option value="">Not set</option>
                {(departments.data ?? []).map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Designation" hint="Optional" error={errors.designationId}>
              <Select value={v.designationId} onChange={(e) => set('designationId', e.target.value)}>
                <option value="">Not set</option>
                {designationOptions.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.title}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={invite.isPending}>
              {invite.isPending ? 'Sending…' : 'Send invite'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
