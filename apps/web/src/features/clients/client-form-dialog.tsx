// Create / edit client — company, billing (GST, PAN, state, terms) and contacts.
'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { CreateClientInput } from '@agency/shared';

import { ApiRequestError, getErrorMessage } from '@/lib/api-client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

import { useCreateClient, useUpdateClient, type ClientContactRow, type ClientRow } from './clients.hooks';

const STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh',
  'Jammu and Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
  'Uttarakhand', 'West Bengal', 'Chandigarh', 'Andaman and Nicobar Islands', 'Dadra and Nagar Haveli and Daman and Diu', 'Lakshadweep',
  'Outside India',
];

interface Values {
  name: string;
  gstin: string;
  pan: string;
  state: string;
  address: string;
  billingEmail: string;
  phone: string;
  website: string;
  paymentTermsDays: string;
  notes: string;
  contacts: ClientContactRow[];
}

const fromClient = (c?: ClientRow): Values => ({
  name: c?.name ?? '',
  gstin: c?.gstin ?? '',
  pan: c?.pan ?? '',
  state: c?.state ?? '',
  address: c?.address ?? '',
  billingEmail: c?.billingEmail ?? '',
  phone: c?.phone ?? '',
  website: c?.website ?? '',
  paymentTermsDays: String(c?.paymentTermsDays ?? 15),
  notes: c?.notes ?? '',
  contacts: c?.contacts?.length ? c.contacts : [],
});

export function ClientFormDialog({
  open,
  onOpenChange,
  client,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  client?: ClientRow;
  onSaved?: (c: ClientRow) => void;
}) {
  const create = useCreateClient();
  const update = useUpdateClient();
  const [v, setV] = useState<Values>(() => fromClient(client));
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [serverError, setServerError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setV(fromClient(client));
    setErrors({});
    setServerError(undefined);
  }, [open, client]);

  const set = (k: keyof Values, val: string) => {
    setV((p) => {
      const next = { ...p, [k]: val };
      // GSTIN digits 3–12 are the PAN — fill it in for them.
      if (k === 'gstin' && /^[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z]/.test(val) && !p.pan) next.pan = val.slice(2, 12).toUpperCase();
      return next;
    });
    setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const setContact = (i: number, patch: Partial<ClientContactRow>) =>
    setV((p) => ({ ...p, contacts: p.contacts.map((c, idx) => (idx === i ? { ...c, ...patch } : c)) }));

  const submit = async () => {
    const e: Record<string, string> = {};
    if (v.name.trim().length < 2) e.name = 'Enter the client name';
    if (v.gstin && !/^[0-9]{2}[A-Za-z0-9]{13}$/.test(v.gstin.trim())) e.gstin = 'GSTIN is 15 characters, e.g. 27ABCDE1234F1Z5';
    if (v.pan && !/^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/.test(v.pan.trim())) e.pan = 'PAN looks like ABCDE1234F';
    if (v.billingEmail && !/^\S+@\S+\.\S+$/.test(v.billingEmail)) e.billingEmail = 'Enter a valid email';
    v.contacts.forEach((c, i) => {
      if (!c.name?.trim()) e[`contacts.${i}.name`] = 'Name required';
      if (c.email && !/^\S+@\S+\.\S+$/.test(c.email)) e[`contacts.${i}.email`] = 'Invalid email';
    });
    setErrors(e);
    if (Object.keys(e).length) return;
    const body = {
      ...v,
      paymentTermsDays: v.paymentTermsDays === '' ? undefined : Number(v.paymentTermsDays),
      contacts: v.contacts.filter((c) => c.name?.trim()),
    } as unknown as CreateClientInput;
    try {
      const saved = client ? await update.mutateAsync({ id: client._id, body }) : await create.mutateAsync(body);
      onOpenChange(false);
      onSaved?.(saved);
    } catch (err) {
      if (err instanceof ApiRequestError) setErrors(Object.fromEntries(Object.entries(err.fieldErrors).map(([k, m]) => [k, m[0]])));
      setServerError(getErrorMessage(err));
    }
  };

  const f = (k: keyof Values, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <FormField label={label} error={errors[k]}>
      <Input value={v[k] as string} onChange={(e) => set(k, e.target.value)} {...props} />
    </FormField>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{client ? `Edit ${client.name}` : 'New client'}</DialogTitle>
        </DialogHeader>
        <form
          className="grid max-h-[72vh] gap-4 overflow-y-auto pr-1"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {serverError && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{serverError}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {f('name', 'Company name *', { autoFocus: true })}
            {f('website', 'Website', { placeholder: 'example.com' })}
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Billing</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {f('gstin', 'GSTIN', { placeholder: '27ABCDE1234F1Z5', className: 'uppercase' })}
              {f('pan', 'PAN', { className: 'uppercase' })}
              <FormField label="State (place of supply)">
                <Select value={v.state} onChange={(e) => set('state', e.target.value)}>
                  <option value="">Not set</option>
                  {STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {f('billingEmail', 'Billing email', { type: 'email', placeholder: 'accounts@client.com' })}
              {f('phone', 'Phone')}
              <FormField label="Payment terms" hint="Days after issue">
                <Select value={v.paymentTermsDays} onChange={(e) => set('paymentTermsDays', e.target.value)}>
                  {[0, 7, 15, 30, 45, 60].map((d) => (
                    <option key={d} value={d}>
                      {d === 0 ? 'Due on receipt' : `Net ${d}`}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
            <FormField label="Billing address" className="mt-3">
              <Textarea rows={2} value={v.address} onChange={(e) => set('address', e.target.value)} />
            </FormField>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Contacts</p>
              <Button type="button" size="sm" variant="ghost" onClick={() => setV((p) => ({ ...p, contacts: [...p.contacts, { name: '', email: '', phone: '', role: '' }] }))}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add contact
              </Button>
            </div>
            {v.contacts.length === 0 && <p className="text-xs text-muted-foreground">No contacts yet. You can invite contacts to the client portal from the client page.</p>}
            <div className="space-y-2">
              {v.contacts.map((c, i) => (
                <div key={i} className="grid gap-2 rounded-md border p-2 sm:grid-cols-[1fr_1fr_130px_120px_auto]">
                  <FormField error={errors[`contacts.${i}.name`]}>
                    <Input placeholder="Name" value={c.name} onChange={(e) => setContact(i, { name: e.target.value })} />
                  </FormField>
                  <FormField error={errors[`contacts.${i}.email`]}>
                    <Input placeholder="Email" type="email" value={c.email ?? ''} onChange={(e) => setContact(i, { email: e.target.value })} />
                  </FormField>
                  <Input placeholder="Phone" value={c.phone ?? ''} onChange={(e) => setContact(i, { phone: e.target.value })} />
                  <Input placeholder="Role" value={c.role ?? ''} onChange={(e) => setContact(i, { role: e.target.value })} />
                  <button
                    type="button"
                    aria-label="Remove contact"
                    className="self-start rounded p-2 text-muted-foreground hover:bg-accent hover:text-destructive"
                    onClick={() => setV((p) => ({ ...p, contacts: p.contacts.filter((_, idx) => idx !== i) }))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <FormField label="Notes" hint="Internal — never shown to the client.">
            <Textarea rows={3} value={v.notes} onChange={(e) => set('notes', e.target.value)} />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending || update.isPending}>
              {create.isPending || update.isPending ? 'Saving…' : client ? 'Save changes' : 'Create client'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
