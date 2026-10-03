// Billing reminders — retainers due to be billed this month, one row per client. OWNER only.
'use client';

import { FileText } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ContractStatus } from '@agency/shared';

import { useContracts, useGenerateClientInvoice, type ContractRow } from '@/features/contracts/contracts.hooks';
import { useInvoices } from '@/features/invoices/invoices.hooks';
import { useClients } from '@/features/clients/clients.hooks';
import { thisMonthLocal } from '@/lib/form';

import { Button } from '@/components/ui/button';
import { Price } from '@/components/viz';
import { AttentionRow } from '@/features/dashboard/attention-row';

export function BillingReminders() {
  const contracts = useContracts({ status: ContractStatus.ACTIVE });
  const invoices = useInvoices();
  const clients = useClients();
  const router = useRouter();

  const today = new Date();
  const todayDay = today.getDate();
  const currentMonth = thisMonthLocal();

  const clientMap = new Map((clients.data ?? []).map((c) => [c._id, c.name]));

  // Contracts already on an invoice issued this month — billed alone (header link)
  // or alongside the client's other contracts (line-item link).
  const billedThisMonth = new Set<string>();
  for (const inv of invoices.data ?? []) {
    if (inv.issueDate?.slice(0, 7) !== currentMonth) continue;
    if (inv.contractId) billedThisMonth.add(inv.contractId);
    inv.lineItems.forEach((li) => li.contractId && billedThisMonth.add(li.contractId));
  }

  const due = (contracts.data ?? []).filter((c) => {
    if (c.billingDay === undefined || c.billingDay === null || billedThisMonth.has(c._id)) return false;
    // A retainer bills in arrears for a completed month — never remind for the
    // calendar month the contract itself started in (nothing's been delivered yet).
    const startMonth = c.startDate?.slice(0, 7);
    const startedBeforeThisMonth = !startMonth || startMonth < currentMonth;
    return startedBeforeThisMonth && todayDay >= (c.billingDay ?? 32);
  });

  // One reminder per client: its due contracts are billed together on one invoice.
  const byClient = new Map<string, ContractRow[]>();
  for (const c of due) byClient.set(c.clientId, [...(byClient.get(c.clientId) ?? []), c]);

  if (byClient.size === 0) return null;

  return (
    <div className="space-y-2">
      {[...byClient.entries()].map(([clientId, group]) => (
        <ReminderRow
          key={clientId}
          clientId={clientId}
          contracts={group}
          clientName={clientMap.get(clientId) ?? 'Deleted client'}
          month={currentMonth}
          onSuccess={(id) => router.push(`/invoices/${id}`)}
        />
      ))}
    </div>
  );
}

function ReminderRow({
  clientId, contracts, clientName, month, onSuccess,
}: {
  clientId: string;
  contracts: ContractRow[];
  clientName: string;
  month: string;
  onSuccess: (invoiceId: string) => void;
}) {
  const gen = useGenerateClientInvoice();
  const [yr, mo] = month.split('-');
  const monthLabel = new Date(Number(yr), Number(mo) - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  const contractLinks = contracts.map((c, i) => (
    <span key={c._id}>
      {i > 0 && (i === contracts.length - 1 ? ' and ' : ', ')}
      <Link href={`/contracts/${c._id}`} className="underline underline-offset-2 hover:text-brand">{c.name}</Link>
    </span>
  ));
  const total = contracts.reduce((s, c) => s + c.monthlyAmountPaise, 0);

  return (
    <AttentionRow
      icon={FileText}
      tone="brand"
      title={
        contracts.length === 1 ? (
          <>Time to bill {contractLinks} · <Price paise={total} currency={contracts[0]!.currency} compact /></>
        ) : (
          <>
            Bill {clientName} for {contracts.length} retainers in one invoice ·{' '}
            <Price paise={total} currency={contracts[0]!.currency} compact />
          </>
        )
      }
      sub={contracts.length === 1 ? <>{clientName} · {monthLabel}</> : <>{contractLinks} · {monthLabel}</>}
      action={
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            gen.mutate(
              { clientId, month, contractIds: contracts.map((c) => c._id) },
              { onSuccess: (data) => onSuccess(data._id) },
            )
          }
          disabled={gen.isPending}
        >
          {gen.isPending ? 'Generating…' : 'Generate invoice'}
        </Button>
      }
    />
  );
}
