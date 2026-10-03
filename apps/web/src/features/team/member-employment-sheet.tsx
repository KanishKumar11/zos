// Edit a member's employment details (OWNER/ADMIN): name, phone, joining date, department,
// designation and reporting manager. Clearing a field sends null so it is really removed.
'use client';

import { useEffect, useMemo, useState } from 'react';

import type { AdminUpdateUserInput } from '@agency/shared';

import { ApiRequestError, getErrorMessage } from '@/lib/api-client';
import { toLocalDateInput } from '@/lib/form';

import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useDepartments, useDesignations } from '@/features/org/org.hooks';

import type { UserRow } from './team.api';
import { useAdminUpdateUser, useStaffDirectory } from './team.hooks';

interface Values {
  name: string;
  phone: string;
  dateOfJoining: string;
  dateOfExit: string;
  departmentId: string;
  designationId: string;
  reportingManagerId: string;
}

const fromUser = (u: UserRow): Values => ({
  name: u.name,
  phone: u.phone ?? '',
  dateOfJoining: u.dateOfJoining ? toLocalDateInput(u.dateOfJoining) : '',
  dateOfExit: u.dateOfExit ? toLocalDateInput(u.dateOfExit) : '',
  departmentId: u.departmentId ?? '',
  designationId: u.designationId ?? '',
  reportingManagerId: u.reportingManagerId ?? '',
});

export function MemberEmploymentSheet({
  user,
  open,
  onOpenChange,
}: {
  user: UserRow;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const update = useAdminUpdateUser({ successMessage: 'Details saved' });
  const departments = useDepartments();
  const designations = useDesignations();
  const staff = useStaffDirectory({ enabled: open });
  const [v, setV] = useState<Values>(() => fromUser(user));
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [serverError, setServerError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setV(fromUser(user));
    setErrors({});
    setServerError(undefined);
  }, [open, user]);

  const designationOptions = useMemo(
    () => (designations.data ?? []).filter((d) => !v.departmentId || d.departmentId === v.departmentId),
    [designations.data, v.departmentId],
  );
  const managerOptions = useMemo(
    () =>
      (staff.data ?? [])
        .filter((p) => p._id !== user._id)
        .map((p) => ({ value: p._id, label: p.name, description: p.email })),
    [staff.data, user._id],
  );

  const set = (k: keyof Values, val: string) => {
    setV((p) => {
      const next = { ...p, [k]: val };
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
    if (v.phone.trim() && !/^\+?[0-9\s\-()]{7,20}$/.test(v.phone.trim())) e.phone = 'Use digits, spaces, + or -, e.g. +91 98765 43210';
    setErrors(e);
    if (Object.keys(e).length) return;

    // Only send what changed; blanks clear a field (null).
    const initial = fromUser(user);
    const body: AdminUpdateUserInput = {};
    if (v.name.trim() !== initial.name) body.name = v.name.trim();
    if (v.phone.trim() !== initial.phone && v.phone.trim()) body.phone = v.phone.trim();
    if (v.dateOfJoining !== initial.dateOfJoining) body.dateOfJoining = (v.dateOfJoining ? v.dateOfJoining : null) as never;
    if (v.dateOfExit !== initial.dateOfExit) body.dateOfExit = (v.dateOfExit ? v.dateOfExit : null) as never;
    if (v.departmentId !== initial.departmentId) body.departmentId = v.departmentId || null;
    if (v.designationId !== initial.designationId) body.designationId = v.designationId || null;
    if (v.reportingManagerId !== initial.reportingManagerId) body.reportingManagerId = v.reportingManagerId || null;
    if (Object.keys(body).length === 0) {
      onOpenChange(false);
      return;
    }
    setServerError(undefined);
    try {
      await update.mutateAsync({ id: user._id, body });
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiRequestError) setErrors(Object.fromEntries(Object.entries(err.fieldErrors).map(([k, m]) => [k, m[0]])));
      setServerError(getErrorMessage(err));
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !update.isPending && onOpenChange(o)}>
      <SheetContent>
        <form
          className="flex h-full flex-col"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <SheetHeader>
            <SheetTitle>Edit details</SheetTitle>
            <SheetDescription>{user.email}</SheetDescription>
          </SheetHeader>
          <SheetBody>
            {serverError && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{serverError}</p>}
            <FormField label="Name" required error={errors.name}>
              <Input value={v.name} onChange={(e) => set('name', e.target.value)} />
            </FormField>
            <FormField
              label="Phone"
              error={errors.phone}
              hint={user.phone && !v.phone ? 'A phone number can’t be removed here, only changed.' : undefined}
            >
              <Input type="tel" value={v.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91 98765 43210" />
            </FormField>
            <FormField label="Joining date" error={errors.dateOfJoining} hint="Payroll treats working days before this as unpaid.">
              <Input type="date" value={v.dateOfJoining} onChange={(e) => set('dateOfJoining', e.target.value)} />
            </FormField>
            {(user.status === 'EXITED' || user.dateOfExit) && (
              <FormField label="Last working day">
                <Input type="date" value={v.dateOfExit} onChange={(e) => set('dateOfExit', e.target.value)} />
              </FormField>
            )}
            <FormField label="Department" error={errors.departmentId}>
              <Select value={v.departmentId} onChange={(e) => set('departmentId', e.target.value)}>
                <option value="">Not set</option>
                {(departments.data ?? []).map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Designation" error={errors.designationId}>
              <Select value={v.designationId} onChange={(e) => set('designationId', e.target.value)}>
                <option value="">Not set</option>
                {designationOptions.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.title}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Reports to" error={errors.reportingManagerId}>
              <Combobox
                options={managerOptions}
                value={v.reportingManagerId || undefined}
                onChange={(val) => set('reportingManagerId', val ?? '')}
                allowClear
                loading={staff.isLoading}
                placeholder="No manager"
                searchPlaceholder="Search people…"
              />
            </FormField>
          </SheetBody>
          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? 'Saving…' : 'Save details'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

