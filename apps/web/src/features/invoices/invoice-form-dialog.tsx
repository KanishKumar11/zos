// Invoice create / edit dialog.
//  • Create: client combobox, optional retainer contract (pre-fills client, line and amount),
//    due date = issue date + the client's payment terms unless changed by hand.
//  • Edit a draft: everything. Edit a sent invoice: only notes and due date (amounts are locked).
'use client';

import { Lock } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { ContractStatus } from '@agency/shared';

import { Button } from '@/components/ui/button';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ApiRequestError, getErrorMessage } from '@/lib/api-client';
import { todayLocal, toLocalDateInput } from '@/lib/form';
import { formatPaise } from '@/lib/formatters';

import { useClients } from '@/features/clients/clients.hooks';
import { useContracts } from '@/features/contracts/contracts.hooks';
import { useAllProjects } from '@/features/projects/projects.hooks';

import { InvoiceLineItems, newLine, validateLines, type LineDraft, type LineErrors } from './invoice-line-items';
import {
  useCreateInvoice,
  useNextInvoiceNumber,
  useUpdateInvoice,
  type InvoiceRow,
} from './invoices.hooks';

const DEFAULT_TERMS = 15;

/** yyyy-mm-dd + n calendar days, in local time. */
export const addDaysLocal = (ymd: string, days: number): string => {
  const [y, m, d] = ymd.split('-').map(Number) as [number, number, number];
  return toLocalDateInput(new Date(y, m - 1, d + days));
};

/** "Due on receipt" / "Net 15". */
export const termsLabel = (days: number | undefined): string =>
  days === 0 ? 'Due on receipt' : `Net ${days ?? DEFAULT_TERMS}`;

const monthLabel = (ymd: string) =>
  new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date(`${ymd}T00:00:00`));

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Edit this invoice; omit to create. */
  invoice?: InvoiceRow;
  defaultClientId?: string;
  defaultProjectId?: string;
  onSaved?: (inv: InvoiceRow) => void;
}

type FieldErrors = Partial<Record<'clientId' | 'gstPercent' | 'issueDate' | 'dueDate' | 'notes' | 'lineItems', string>>;

export function InvoiceFormDialog({ open, onOpenChange, invoice, defaultClientId, defaultProjectId, onSaved }: Props) {
  const editing = !!invoice;
  const locked = !!invoice && invoice.status !== 'DRAFT';

  const clients = useClients();
  const projects = useAllProjects({ enabled: open });
  const contracts = useContracts();
  const nextNumber = useNextInvoiceNumber(open && !editing);
  const create = useCreateInvoice();
  const update = useUpdateInvoice();

  const [clientId, setClientId] = useState('');
  const [contractId, setContractId] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [lines, setLines] = useState<LineDraft[]>([newLine()]);
  const [gst, setGst] = useState('');
  const [issueDate, setIssueDate] = useState(todayLocal());
  const [dueDate, setDueDate] = useState('');
  const [dueTouched, setDueTouched] = useState(false);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [lineErrors, setLineErrors] = useState<LineErrors>({});
  const [serverError, setServerError] = useState<string>();

  const clientList = clients.data ?? [];
  const client = clientList.find((c) => c._id === clientId);
  const terms = client?.paymentTermsDays ?? DEFAULT_TERMS;

  // Reset every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setLineErrors({});
    setServerError(undefined);
    if (invoice) {
      setClientId(invoice.clientId);
      setContractId(invoice.contractId ?? '');
      setCurrency(invoice.currency || 'INR');
      setLines(invoice.lineItems.map((li) => newLine({ ...li })));
      setGst(invoice.gstPercent ? String(invoice.gstPercent) : '');
      setIssueDate(invoice.issueDate ? toLocalDateInput(invoice.issueDate) : todayLocal());
      setDueDate(invoice.dueDate ? toLocalDateInput(invoice.dueDate) : '');
      setDueTouched(true);
      setNotes(invoice.notes ?? '');
      return;
    }
    const project = defaultProjectId ? projects.data?.items.find((p) => p._id === defaultProjectId) : undefined;
    setClientId(defaultClientId ?? project?.clientId ?? '');
    setContractId('');
    setCurrency('INR');
    setLines([newLine({ projectId: defaultProjectId })]);
    setGst('');
    setIssueDate(todayLocal());
    setDueDate('');
    setDueTouched(false);
    setNotes('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, invoice?._id]);

  // Due date follows issue date + client terms until it is changed by hand.
  useEffect(() => {
    if (!open || dueTouched || !issueDate) return;
    setDueDate(addDaysLocal(issueDate, terms));
  }, [open, dueTouched, issueDate, terms]);

  const clientOptions = useMemo<ComboboxOption[]>(
    () =>
      clientList.map((c) => ({
        value: c._id,
        label: c.name,
        description: termsLabel(c.paymentTermsDays),
        keywords: [c.gstin, c.billingEmail].filter(Boolean).join(' '),
      })),
    [clientList],
  );

  const contractOptions = useMemo<ComboboxOption[]>(() => {
    const names = new Map(clientList.map((c) => [c._id, c.name]));
    return (contracts.data ?? [])
      .filter((c) => (!clientId || c.clientId === clientId) && (c.status === ContractStatus.ACTIVE || c._id === contractId))
      .map((c) => ({
        value: c._id,
        label: c.name,
        description: `${formatPaise(c.monthlyAmountPaise, c.currency)} / month${clientId ? '' : ` · ${names.get(c.clientId) ?? 'Deleted client'}`}`,
      }));
  }, [contracts.data, clientList, clientId, contractId]);

  const clientProjects = (projects.data?.items ?? []).filter((p) => !clientId || p.clientId === clientId);

  const pickClient = (id: string | undefined) => {
    setClientId(id ?? '');
    setErrors((e) => ({ ...e, clientId: undefined }));
    // A contract from another client no longer applies.
    const c = (contracts.data ?? []).find((x) => x._id === contractId);
    if (c && c.clientId !== id) setContractId('');
  };

  const pickContract = (id: string | undefined) => {
    setContractId(id ?? '');
    const c = (contracts.data ?? []).find((x) => x._id === id);
    if (!c) return;
    if (c.clientId !== clientId) {
      setClientId(c.clientId);
      setErrors((e) => ({ ...e, clientId: undefined }));
    }
    setCurrency(c.currency || 'INR');
    const line = newLine({
      description: `${c.name} — ${monthLabel(issueDate || todayLocal())}`,
      unitPaise: c.monthlyAmountPaise,
      contractId: c._id,
    });
    const blank = lines.every((li) => !li.description.trim() && li.unitPaise === undefined);
    setLines(blank ? [line] : [...lines, line]);
  };

  const subTotal = lines.reduce((s, li) => s + Math.round((li.qty || 0) * (li.unitPaise ?? 0)), 0);
  const gstNum = gst === '' ? 0 : Number(gst);
  const gstPaise = Number.isFinite(gstNum) ? Math.round((subTotal * gstNum) / 100) : 0;

  const validate = (): boolean => {
    const e: FieldErrors = {};
    if (!locked) {
      if (!clientId) e.clientId = 'Pick a client';
      if (gst !== '' && (!Number.isFinite(gstNum) || gstNum < 0 || gstNum > 50)) e.gstPercent = 'GST must be between 0 and 50%';
      if (!issueDate) e.issueDate = 'Pick the issue date';
      if (lines.length === 0) e.lineItems = 'Add at least one line item';
    }
    if (dueDate && issueDate && dueDate < issueDate) e.dueDate = "Can't be before the issue date";
    const le = locked ? {} : validateLines(lines);
    setErrors(e);
    setLineErrors(le);
    return Object.keys(e).length === 0 && Object.keys(le).length === 0;
  };

  const showServerError = (err: unknown) => {
    if (err instanceof ApiRequestError) {
      const fe = err.fieldErrors;
      setErrors((prev) => ({
        ...prev,
        ...Object.fromEntries(
          Object.entries(fe)
            .filter(([k]) => ['clientId', 'gstPercent', 'issueDate', 'dueDate', 'notes'].includes(k))
            .map(([k, m]) => [k, m[0]]),
        ),
        ...(Object.keys(fe).some((k) => k.startsWith('lineItems')) ? { lineItems: 'Check the line items' } : {}),
      }));
    }
    setServerError(getErrorMessage(err));
  };

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    setServerError(undefined);
    if (!validate()) return;

    if (locked && invoice) {
      update.mutate(
        { id: invoice._id, body: { notes, ...(dueDate ? { dueDate: dueDate as unknown as Date } : {}) } },
        { onSuccess: (inv) => (onOpenChange(false), onSaved?.(inv)), onError: showServerError },
      );
      return;
    }

    const body = {
      clientId,
      contractId: contractId || undefined,
      lineItems: lines.map(({ key: _key, ...li }) => ({
        description: li.description.trim(),
        qty: li.qty,
        unitPaise: li.unitPaise ?? 0,
        projectId: li.projectId || undefined,
        milestoneId: li.milestoneId || undefined,
        contractId: li.contractId || undefined,
      })),
      gstPercent: gst === '' ? 0 : gstNum,
      currency,
      issueDate: issueDate as unknown as Date,
      dueDate: (dueDate || undefined) as unknown as Date | undefined,
      notes: notes.trim() ? notes : editing ? '' : undefined,
    };
    if (invoice) {
      update.mutate(
        { id: invoice._id, body },
        { onSuccess: (inv) => (onOpenChange(false), onSaved?.(inv)), onError: showServerError },
      );
    } else {
      create.mutate(body, { onSuccess: (inv) => (onOpenChange(false), onSaved?.(inv)), onError: showServerError });
    }
  };

  const busy = create.isPending || update.isPending;
  const dueHint =
    dueDate && issueDate && dueDate === issueDate
      ? 'Due on receipt'
      : !dueTouched
        ? client
          ? `${termsLabel(terms)} — from ${client.name}'s payment terms`
          : `${termsLabel(DEFAULT_TERMS)} by default — picks up the client's payment terms`
        : undefined;

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${invoice!.number}` : 'New invoice'}</DialogTitle>
          <DialogDescription>
            {editing
              ? locked
                ? 'This invoice has been sent, so only the due date and notes can change.'
                : 'Drafts can be changed freely until you mark them as sent.'
              : nextNumber.data
                ? `Will be numbered ${nextNumber.data.number} (assigned when saved). Saved as a draft.`
                : 'Saved as a draft — nothing is sent to the client.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="grid gap-4" noValidate>
          {locked && (
            <div className="flex gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              <Lock className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                Client, line items, amounts and GST are locked once an invoice is sent, so what the client received
                always matches your books. To change the amount, write this invoice off and duplicate it.
              </p>
            </div>
          )}

          {!locked && (
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Client" required error={errors.clientId}>
                <Combobox
                  options={clientOptions}
                  value={clientId || undefined}
                  onChange={pickClient}
                  placeholder="Pick a client"
                  searchPlaceholder="Search clients…"
                  emptyText="No clients match"
                  loading={clients.isLoading}
                  invalid={!!errors.clientId}
                />
              </FormField>
              <FormField
                label="Retainer contract"
                hint={contractOptions.length === 0 && clientId ? 'This client has no active contracts.' : 'Optional — fills in the monthly line.'}
              >
                <Combobox
                  options={contractOptions}
                  value={contractId || undefined}
                  onChange={pickContract}
                  allowClear
                  placeholder="No contract"
                  searchPlaceholder="Search contracts…"
                  emptyText="No active contracts"
                  loading={contracts.isLoading}
                />
              </FormField>
            </div>
          )}

          {!locked && (
            <div className="space-y-1">
              <InvoiceLineItems
                value={lines}
                onChange={(l) => {
                  setLines(l);
                  setLineErrors({});
                }}
                projects={clientProjects}
                currency={currency}
                showQty
                errors={lineErrors}
              />
              {errors.lineItems && <p className="text-xs text-destructive">{errors.lineItems}</p>}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3">
            {!locked && (
              <FormField label="GST %" error={errors.gstPercent} hint={gstPaise ? `${formatPaise(gstPaise, currency)} GST` : 'Leave blank for no GST'}>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="50"
                  step="0.01"
                  placeholder="0"
                  value={gst}
                  onChange={(e) => setGst(e.target.value)}
                />
              </FormField>
            )}
            {!locked && (
              <FormField label="Issue date" required error={errors.issueDate}>
                <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
              </FormField>
            )}
            <FormField
              label="Due date"
              error={errors.dueDate}
              hint={
                dueHint ??
                (!locked && (
                  <button type="button" className="text-primary hover:underline" onClick={() => setDueTouched(false)}>
                    Reset to {termsLabel(terms).toLowerCase()}
                  </button>
                ))
              }
            >
              <Input
                type="date"
                value={dueDate}
                min={issueDate || undefined}
                onChange={(e) => {
                  setDueDate(e.target.value);
                  setDueTouched(true);
                  setErrors((x) => ({ ...x, dueDate: undefined }));
                }}
              />
            </FormField>
          </div>

          <FormField label="Notes" hint="Printed on the invoice." error={errors.notes}>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={20_000} />
          </FormField>

          {!locked && (
            <div className="flex justify-end text-sm tabular-nums">
              <span className="text-muted-foreground">Total&nbsp;</span>
              <span className="font-semibold">{formatPaise(subTotal + gstPaise, currency)}</span>
            </div>
          )}

          {serverError && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{serverError}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Create draft'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
