'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, Calendar, DollarSign, FileText, Plus } from 'lucide-react';

import { ContractStatus, Role } from '@agency/shared';

import { RoleGate } from '@/components/auth/role-gate';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { formatPaise, formatDate } from '@/lib/formatters';

import { PageHeader } from '@/components/layout/page-header';
import { useContract, useGenerateContractInvoice } from '@/features/contracts/contracts.hooks';
import { useClients } from '@/features/clients/clients.hooks';
import { useInvoices } from '@/features/invoices/invoices.hooks';

const STATUS_COLORS: Record<ContractStatus, string> = {
  [ContractStatus.ACTIVE]: 'bg-green-100 text-green-800',
  [ContractStatus.PAUSED]: 'bg-yellow-100 text-yellow-800',
  [ContractStatus.COMPLETED]: 'bg-gray-100 text-gray-800',
};

const STATUS_LABELS: Record<ContractStatus, string> = {
  [ContractStatus.ACTIVE]: 'Active',
  [ContractStatus.PAUSED]: 'Paused',
  [ContractStatus.COMPLETED]: 'Completed',
};

export default function ContractDetailPage() {
  const params = useParams();
  const contractId = params.id as string;

  return (
    <RoleGate
      allow={[Role.OWNER]}
      fallback={<p className="text-sm text-muted-foreground">Restricted.</p>}
    >
      <Inner contractId={contractId} />
    </RoleGate>
  );
}

function Inner({ contractId }: { contractId: string }) {
  const router = useRouter();
  const contract = useContract(contractId);
  const clients = useClients();
  const invoices = useInvoices({ contractId });
  const generateInvoice = useGenerateContractInvoice();
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const clientName = clients.data?.find((c) => c._id === contract.data?.clientId)?.name;
  const contractInvoices = invoices.data || [];
  const totalBilled = contractInvoices.reduce((sum, inv) => sum + inv.totalPaise, 0);
  const totalPaid = contractInvoices.reduce((sum, inv) => sum + inv.paidPaise, 0);
  const totalOutstanding = totalBilled - totalPaid;

  if (contract.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!contract.data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-800">Contract not found</p>
      </div>
    );
  }

  const c = contract.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={c.name}
        description={c.description}
        action={
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            />
            <Button
              onClick={() =>
                generateInvoice.mutate(
                  { id: contractId, month: selectedMonth },
                  { onSuccess: (data) => router.push(`/invoices/${data._id}`) },
                )
              }
              disabled={generateInvoice.isPending}
              size="sm"
            >
              <Plus className="mr-1 h-4 w-4" />
              {generateInvoice.isPending ? 'Generating…' : 'Generate Invoice'}
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={STATUS_COLORS[c.status]}>
              {STATUS_LABELS[c.status]}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Client</CardTitle>
          </CardHeader>
          <CardContent>
            <Link href={`/clients/${c.clientId}`} className="font-semibold hover:underline">
              {clientName}
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">{formatPaise(c.monthlyAmountPaise)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Start Date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">{c.startDate ? formatDate(c.startDate) : '—'}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Contract Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {c.notes && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Notes</p>
              <p className="mt-1 text-sm">{c.notes}</p>
            </div>
          )}
          {c.endDate && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">End Date</p>
              <p className="mt-1 text-sm">{formatDate(c.endDate)}</p>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-muted-foreground">Currency</p>
            <p className="mt-1 text-sm">{c.currency}</p>
          </div>
        </CardContent>
      </Card>

      {contractInvoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contract Financials</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium text-muted-foreground">Total Billed</p>
                <p className="mt-2 text-2xl font-bold">{formatPaise(totalBilled)}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium text-muted-foreground">Paid</p>
                <p className="mt-2 text-2xl font-bold text-green-600">{formatPaise(totalPaid)}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium text-muted-foreground">Outstanding</p>
                <p className="mt-2 text-2xl font-bold text-orange-600">{formatPaise(totalOutstanding)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {contractInvoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Linked Invoices ({contractInvoices.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Invoice #</TH>
                    <TH>Project</TH>
                    <TH>Amount</TH>
                    <TH>Paid</TH>
                    <TH>Status</TH>
                    <TH></TH>
                  </TR>
                </THead>
                <TBody>
                  {contractInvoices.map((inv) => (
                    <TR key={inv._id}>
                      <TD className="font-mono text-sm">{inv.number}</TD>
                      <TD className="text-sm">
                        {inv.projectId ? (
                          <Link
                            href={`/projects/${inv.projectId}`}
                            className="text-blue-600 hover:underline"
                          >
                            View Project
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TD>
                      <TD className="font-semibold">{formatPaise(inv.totalPaise)}</TD>
                      <TD>{formatPaise(inv.paidPaise)}</TD>
                      <TD>
                        <Badge variant="outline">{inv.status}</Badge>
                      </TD>
                      <TD>
                        <Link
                          href={`/invoices/${inv._id}`}
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                        >
                          View <ArrowRight className="h-3 w-3" />
                        </Link>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {contractInvoices.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-muted-foreground">No invoices linked to this contract</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
