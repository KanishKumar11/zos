'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ContractStatus } from '@agency/shared';

import { useContracts } from '@/features/contracts/contracts.hooks';
import { useInvoices } from '@/features/invoices/invoices.hooks';
import { useGenerateContractInvoice } from '@/features/contracts/contracts.hooks';
import { useClients } from '@/features/clients/clients.hooks';

export function BillingReminders() {
  const contracts = useContracts({ status: ContractStatus.ACTIVE });
  const invoices = useInvoices();
  const clients = useClients();
  const router = useRouter();

  const today = new Date();
  const todayDay = today.getDate();
  const currentMonth = today.toISOString().slice(0, 7);

  const clientMap = new Map((clients.data ?? []).map((c) => [c._id, c.name]));

  const reminders = (contracts.data ?? [])
    .filter((c) => c.billingDay !== undefined)
    .map((c) => {
      const alreadyGenerated = (invoices.data ?? []).some(
        (inv) =>
          inv.contractId === c._id &&
          inv.issueDate &&
          inv.issueDate.slice(0, 7) === currentMonth,
      );
      const isDue = todayDay >= (c.billingDay ?? 1);
      return { contract: c, alreadyGenerated, isDue };
    })
    .filter((r) => r.isDue && !r.alreadyGenerated);

  if (reminders.length === 0) return null;

  return (
    <div className="p-6 md:p-12 border-b border-border">
      <p className="text-[10px] uppercase tracking-[0.2em] font-mono text-muted-foreground mb-6">Action Required</p>
      <div className="space-y-3">
        {reminders.map(({ contract }) => (
          <ReminderRow
            key={contract._id}
            contractId={contract._id}
            contractName={contract.name}
            clientName={clientMap.get(contract.clientId) ?? contract.clientId.slice(-6)}
            month={currentMonth}
            onSuccess={(id) => router.push(`/invoices/${id}`)}
          />
        ))}
      </div>
    </div>
  );
}

function ReminderRow({
  contractId, contractName, clientName, month, onSuccess,
}: {
  contractId: string;
  contractName: string;
  clientName: string;
  month: string;
  onSuccess: (invoiceId: string) => void;
}) {
  const gen = useGenerateContractInvoice();
  const [yr, mo] = month.split('-');
  const monthLabel = new Date(Number(yr), Number(mo) - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <div className="flex items-center justify-between border border-orange-200 bg-orange-50 rounded-lg px-4 py-3">
      <div>
        <p className="text-sm font-semibold text-orange-900">
          Generate invoice for <Link href={`/contracts/${contractId}`} className="underline">{contractName}</Link>
        </p>
        <p className="text-xs text-orange-700 mt-0.5">{clientName} · {monthLabel}</p>
      </div>
      <button
        onClick={() =>
          gen.mutate({ id: contractId, month }, { onSuccess: (data) => onSuccess(data._id) })
        }
        disabled={gen.isPending}
        className="ml-4 shrink-0 rounded-md bg-orange-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-orange-700 disabled:opacity-50"
      >
        {gen.isPending ? 'Generating…' : 'Generate →'}
      </button>
    </div>
  );
}
