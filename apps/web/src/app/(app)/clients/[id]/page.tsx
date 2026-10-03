// Client (OWNER) — the relationship at a glance: what they owe and how late (aging bar), the story
// so far (projects, invoices, payments), and who has portal access. Tabs keep the detail.
'use client';

import { FolderPlus, Mail, MoreHorizontal, Pencil, Phone, Receipt, RotateCw, Trash2, UserPlus, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { use, useMemo, useState } from 'react';

import { Role } from '@agency/shared';

import { formatDate } from '@/lib/formatters';
import { identityColor } from '@/lib/identity';
import { useAuthStore } from '@/store/auth.store';

import { PageHeader, usePageTitle } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/states';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ActivityTimeline,
  Avatar,
  AvatarStack,
  Bento,
  BigNumber,
  formatCompact,
  Legend,
  Price,
  PrivacyChip,
  ProjectChip,
  SegmentBar,
  Tile,
  useCanSeePrices,
  type TimelineItem,
} from '@/components/viz';
import { AGING_COLORS, AGING_LABELS, agingOf, type AgingBuckets } from '@/features/clients/client-signals';
import { ClientFormDialog } from '@/features/clients/client-form-dialog';
import {
  useClient,
  useClientStats,
  useDeleteClient,
  useDisablePortalUser,
  useEnablePortalUser,
  useInvitePortalUser,
  usePortalAccess,
  useResendPortalInvite,
  useRevokePortalInvite,
  type ClientRow,
  type ClientStats,
} from '@/features/clients/clients.hooks';
import { useContracts } from '@/features/contracts/contracts.hooks';
import { useInvoices, type InvoiceRow } from '@/features/invoices/invoices.hooks';
import { ProjectFormDialog } from '@/features/projects/components/project-form-dialog';
import { useProjects, type ProjectRow } from '@/features/projects/projects.hooks';

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const role = useAuthStore((s) => s.user?.role);
  if (role && role !== Role.OWNER) return <OwnerOnly />;
  return <ClientDetail id={id} />;
}

function OwnerOnly() {
  usePageTitle('Client', [{ label: 'Clients', href: '/clients' }]);
  return (
    <div className="rounded-[var(--radius)] border bg-card">
      <EmptyState
        illustration="people"
        title="Clients are managed by the owner"
        description="Client details, invoices and balances are only visible to the studio owner."
        action={
          <Button size="sm" asChild>
            <Link href="/projects">Go to my projects</Link>
          </Button>
        }
      />
    </div>
  );
}

function ClientDetail({ id }: { id: string }) {
  const client = useClient(id);
  const stats = useClientStats(id);
  const invoices = useInvoices({ clientId: id });
  const projects = useProjects({ clientId: id, pageSize: 100 });
  const portal = usePortalAccess(id);
  const router = useRouter();
  const pathname = usePathname();
  const tab = useSearchParams().get('tab') ?? 'overview';
  const setTab = (t: string) => router.replace(`${pathname}${t === 'overview' ? '' : `?tab=${t}`}`, { scroll: false });
  const del = useDeleteClient();
  const confirm = useConfirm();
  const [editOpen, setEditOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);

  if (client.isLoading) return <PageSkeleton />;
  if (client.isError || !client.data) return <ErrorState title="Couldn't open this client" error={client.error} onRetry={() => client.refetch()} />;
  const c = client.data;
  const s = stats.data;
  const portalUsers = (portal.data?.users ?? []).filter((u) => u.status === 'ACTIVE');

  return (
    <div className="space-y-6">
      <PageHeader
        title={c.name}
        crumbs={[{ label: 'Clients', href: '/clients' }]}
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <Avatar id={c._id} name={c.name} size="xs" />
            Client since {formatDate(c.createdAt, { month: 'long', year: 'numeric' })}
          </span>
        }
        description={[c.state, c.gstin && `GSTIN ${c.gstin}`].filter(Boolean).join(' · ') || undefined}
        meta={
          portalUsers.length > 0 ? (
            <button type="button" onClick={() => setTab('people')} className="inline-flex items-center gap-2 rounded-full border bg-card py-0.5 pl-1 pr-2.5 text-xs text-muted-foreground hover:text-foreground" title="People with portal access">
              <AvatarStack people={portalUsers.map((u) => ({ id: u._id, name: u.name }))} size="xs" max={4} />
              {portalUsers.length} on portal
            </button>
          ) : undefined
        }
        action={
          <>
            <Button size="sm" variant="outline" onClick={() => setProjectOpen(true)}>
              <FolderPlus className="mr-1.5 h-3.5 w-3.5" /> New project
            </Button>
            <Button size="sm" asChild>
              <Link href={`/invoices?new=1&clientId=${c._id}`}>
                <Receipt className="mr-1.5 h-3.5 w-3.5" /> New invoice
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="outline" className="h-8 w-8" aria-label="More">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  <Pencil className="mr-2 h-3.5 w-3.5" /> Edit client
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/contracts?clientId=${c._id}`}>Contracts</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={async () => {
                    const ok = await confirm({
                      title: `Delete ${c.name}?`,
                      description: 'Only clients with no projects or invoices can be deleted. Their portal users lose access.',
                      destructive: true,
                    });
                    if (!ok) return;
                    await del.mutateAsync(c._id);
                    router.push('/clients');
                  }}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete client
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <Bento>
        <OutstandingTile clientId={c._id} stats={s} statsLoading={stats.isLoading} invoices={invoices.data} invoicesLoading={invoices.isLoading} />
        <Tile span={7} title="The relationship so far" action={<PrivacyChip>Only you see these figures</PrivacyChip>}>
          <RelationshipTimeline
            projects={projects.data?.items}
            invoices={invoices.data}
            loading={projects.isLoading || invoices.isLoading}
            error={projects.isError || invoices.isError}
            createdAt={c.createdAt}
            clientName={c.name}
          />
        </Tile>
      </Bento>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Projects &amp; billing</TabsTrigger>
          <TabsTrigger value="people">
            Contacts &amp; portal{s?.portalUsers ? ` (${s.portalUsers})` : ''}
          </TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-6">
          <ClientProjects projects={projects.data?.items} loading={projects.isLoading} error={projects.error} onRetry={() => projects.refetch()} onNew={() => setProjectOpen(true)} />
          <ClientInvoices clientId={c._id} invoices={invoices.data} loading={invoices.isLoading} error={invoices.error} onRetry={() => invoices.refetch()} />
          <ClientContracts clientId={c._id} />
        </TabsContent>
        <TabsContent value="people" className="space-y-6">
          <PortalAccessCard client={c} />
          <ContactsCard client={c} onEdit={() => setEditOpen(true)} />
        </TabsContent>
        <TabsContent value="details">
          <DetailsCard client={c} onEdit={() => setEditOpen(true)} />
        </TabsContent>
      </Tabs>

      <ClientFormDialog open={editOpen} onOpenChange={setEditOpen} client={c} />
      <ProjectFormDialog open={projectOpen} onOpenChange={setProjectOpen} defaultClientId={c._id} onSaved={(p) => router.push(`/projects/${p._id}`)} />
    </div>
  );
}

function OutstandingTile({
  clientId,
  stats: s,
  statsLoading,
  invoices,
  invoicesLoading,
}: {
  clientId: string;
  stats: ClientStats | null | undefined;
  statsLoading: boolean;
  invoices: InvoiceRow[] | undefined;
  invoicesLoading: boolean;
}) {
  const router = useRouter();
  const canSee = useCanSeePrices();
  const aging = useMemo(() => agingOf(invoices ?? []), [invoices]);
  const keys = Object.keys(AGING_LABELS) as (keyof AgingBuckets)[];
  const owed = keys.reduce((t, k) => t + aging[k], 0);
  return (
    <Tile span={5} title="They owe you">
      {statsLoading ? (
        <Skeleton className="h-10 w-40" />
      ) : (
        <BigNumber caption={s?.overduePaise ? <span className="text-destructive">{<Price paise={s.overduePaise} />} of it is overdue</span> : s?.outstandingPaise ? 'Nothing overdue' : 'All settled up'}>
          {s?.outstandingPaise ? <Price paise={s.outstandingPaise} /> : <span className="text-success">Nothing</span>}
        </BigNumber>
      )}
      <div className="mt-4">
        {invoicesLoading ? (
          <Skeleton className="h-9 w-full" />
        ) : owed > 0 ? (
          <>
            <SegmentBar
              segments={keys.map((k) => ({
                value: aging[k],
                color: AGING_COLORS[k],
                label: AGING_LABELS[k],
                display: canSee ? formatCompact(aging[k]) : '',
                onClick: () => router.push(`/invoices?clientId=${clientId}${k === 'notDue' ? '&status=open' : '&status=OVERDUE'}`),
              }))}
            />
            <Legend className="mt-2" items={keys.filter((k) => aging[k] > 0).map((k) => ({ color: AGING_COLORS[k], label: AGING_LABELS[k] }))} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No open invoices.</p>
        )}
      </div>
      <dl className="mt-5 grid grid-cols-3 gap-3 border-t pt-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Invoiced</dt>
          <dd className="font-figures font-semibold">{statsLoading ? '…' : <Price paise={s?.invoicedPaise ?? 0} compact />}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Collected</dt>
          <dd className="font-figures font-semibold text-success">{statsLoading ? '…' : <Price paise={s?.collectedPaise ?? 0} compact />}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Projects</dt>
          <dd className="font-figures font-semibold">
            {s?.activeProjects ?? 0}
            <span className="font-normal text-muted-foreground"> / {s?.totalProjects ?? 0}</span>
          </dd>
        </div>
      </dl>
      {s?.lastPaymentAt && <p className="mt-2 text-xs text-muted-foreground">Last paid {formatDate(s.lastPaymentAt)}</p>}
    </Tile>
  );
}

function RelationshipTimeline({
  projects,
  invoices,
  loading,
  error,
  createdAt,
  clientName,
}: {
  projects: ProjectRow[] | undefined;
  invoices: InvoiceRow[] | undefined;
  loading: boolean;
  error: boolean;
  createdAt: string;
  clientName: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const items = useMemo(() => {
    const out: TimelineItem[] = [];
    for (const p of projects ?? []) {
      out.push({
        key: `p-${p._id}`,
        date: p.startDate ?? p.createdAt ?? createdAt,
        color: identityColor(p._id),
        title: (
          <>
            Project started: <ProjectChip id={p._id} name={p.name} href={`/projects/${p._id}`} className="align-bottom" />
          </>
        ),
        meta: (
          <>
            {formatDate(p.startDate ?? p.createdAt ?? createdAt)} · <StatusBadge status={p.status} className="align-middle" />
            {p.clientBudgetPaise ? (
              <>
                {' '}· budget <Price paise={p.clientBudgetPaise} currency={p.currency ?? 'INR'} compact />
              </>
            ) : null}
          </>
        ),
      });
    }
    for (const i of invoices ?? []) {
      if (i.status !== 'DRAFT') {
        const issued = i.issueDate ?? i.createdAt ?? createdAt;
        out.push({
          key: `i-${i._id}`,
          date: issued,
          color: i.isOverdue ? 'hsl(var(--destructive))' : 'hsl(var(--info))',
          title: (
            <>
              Invoice{' '}
              <Link href={`/invoices/${i._id}`} className="font-figures hover:underline">
                {i.number}
              </Link>{' '}
              sent
            </>
          ),
          meta: (
            <>
              {formatDate(issued)} · <Price paise={i.totalPaise} currency={i.currency} />
              {i.isOverdue ? ` · ${i.daysOverdue ?? ''}${i.daysOverdue ? ' days ' : ''}overdue` : i.status === 'PAID' ? ' · paid' : ''}
            </>
          ),
        });
      }
      for (const pay of i.payments ?? []) {
        out.push({
          key: `pay-${pay._id}`,
          date: pay.paidAt,
          color: 'hsl(var(--success))',
          title: (
            <>
              Payment received · <Price paise={pay.amountPaise} currency={i.currency} />
            </>
          ),
          meta: (
            <>
              {formatDate(pay.paidAt)} · for {i.number}
              {pay.methodLabel || pay.method ? ` · ${pay.methodLabel ?? pay.method}` : ''}
            </>
          ),
        });
      }
    }
    out.sort((a, b) => b.date.localeCompare(a.date));
    out.push({ key: 'joined', date: createdAt, color: 'hsl(var(--muted-foreground))', title: `${clientName} became a client`, meta: formatDate(createdAt) });
    return out;
  }, [projects, invoices, createdAt, clientName]);

  if (loading) return <Skeleton className="h-40 w-full" />;
  if (error) return <p className="text-sm text-destructive">Couldn&apos;t load the full history. Refresh to try again.</p>;
  const shown = showAll ? items : items.slice(0, 7);
  return (
    <div className="space-y-3">
      <ActivityTimeline items={shown} />
      {items.length > shown.length && (
        <Button size="sm" variant="ghost" onClick={() => setShowAll(true)}>
          Show all {items.length} events
        </Button>
      )}
    </div>
  );
}

function ClientProjects({
  projects,
  loading,
  error,
  onRetry,
  onNew,
}: {
  projects: ProjectRow[] | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  onNew: () => void;
}) {
  const items = projects ?? [];
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Projects</CardTitle>
        <Button size="sm" variant="ghost" onClick={onNew}>
          <FolderPlus className="mr-1 h-3.5 w-3.5" /> New
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-2 p-5">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-2/3" />
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={onRetry} />
        ) : items.length === 0 ? (
          <EmptyState illustration="projects" title="No projects yet" className="py-8" action={<Button size="sm" variant="outline" onClick={onNew}>Start a project</Button>} />
        ) : (
          <ul className="divide-y">
            {items.map((p) => (
              <li key={p._id}>
                <Link href={`/projects/${p._id}`} className="flex items-center gap-3 border-l-[3px] px-5 py-2.5 hover:bg-muted/30" style={{ borderLeftColor: identityColor(p._id) }}>
                  <ProjectChip id={p._id} name={p.name} className="flex-1 text-sm font-medium" />
                  {p.portalVisible === false && <Badge variant="outline">Hidden from portal</Badge>}
                  {p.clientBudgetPaise ? <Price paise={p.clientBudgetPaise} currency={p.currency ?? 'INR'} className="hidden text-xs text-muted-foreground sm:inline" /> : null}
                  <StatusBadge status={p.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ClientInvoices({
  clientId,
  invoices,
  loading,
  error,
  onRetry,
}: {
  clientId: string;
  invoices: InvoiceRow[] | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  const items = invoices ?? [];
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Invoices</CardTitle>
        <Link href={`/invoices?clientId=${clientId}`} className="text-xs text-brand-ink hover:underline">
          Open in Invoices
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="space-y-2 p-5">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-2/3" />
          </div>
        ) : error ? (
          <ErrorState error={error} onRetry={onRetry} />
        ) : items.length === 0 ? (
          <EmptyState
            illustration="money"
            title="No invoices yet"
            className="py-8"
            action={
              <Button size="sm" variant="outline" asChild>
                <Link href={`/invoices?new=1&clientId=${clientId}`}>Create an invoice</Link>
              </Button>
            }
          />
        ) : (
          <ul className="divide-y">
            {items.slice(0, 10).map((i) => {
              const balance = i.balancePaise ?? i.totalPaise - i.paidPaise;
              return (
                <li key={i._id}>
                  <Link href={`/invoices/${i._id}`} className="flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-muted/30">
                    <span className="w-28 font-figures font-medium">{i.number}</span>
                    <span className="hidden flex-1 text-xs text-muted-foreground sm:block">
                      {i.issueDate ? formatDate(i.issueDate) : 'Not issued'}
                      {i.dueDate ? ` · due ${formatDate(i.dueDate)}` : ''}
                    </span>
                    <Price paise={i.totalPaise} currency={i.currency} className="ml-auto" />
                    <span className="hidden w-28 text-right text-xs text-muted-foreground md:block">
                      {balance > 0 && i.status !== 'WRITTEN_OFF' ? (
                        <>
                          <Price paise={balance} currency={i.currency} /> due
                        </>
                      ) : (
                        'Settled'
                      )}
                    </span>
                    <StatusBadge status={i.isOverdue && i.status !== 'PAID' ? 'OVERDUE' : i.status} />
                  </Link>
                </li>
              );
            })}
            {items.length > 10 && (
              <li className="px-5 py-2.5 text-xs text-muted-foreground">
                <Link href={`/invoices?clientId=${clientId}`} className="hover:text-foreground hover:underline">
                  {items.length - 10} more in Invoices
                </Link>
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ClientContracts({ clientId }: { clientId: string }) {
  const contracts = useContracts({ clientId });
  const items = contracts.data ?? [];
  if (items.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Retainers &amp; contracts</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y">
          {items.map((k) => (
            <li key={k._id}>
              <Link href={`/contracts/${k._id}`} className="flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-muted/30">
                <span className="flex-1 truncate font-medium">{k.name}</span>
                <span className="text-xs text-muted-foreground">
                  <Price paise={k.monthlyAmountPaise} currency={k.currency} />
                  /month
                </span>
                <StatusBadge status={k.status} />
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function PortalAccessCard({ client }: { client: ClientRow }) {
  const access = usePortalAccess(client._id);
  const invite = useInvitePortalUser();
  const resend = useResendPortalInvite();
  const revoke = useRevokePortalInvite();
  const disable = useDisablePortalUser();
  const enable = useEnablePortalUser();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [prefill, setPrefill] = useState<{ name: string; email: string; title: string }>({ name: '', email: '', title: '' });

  const users = access.data?.users ?? [];
  const invites = access.data?.invites ?? [];
  const takenEmails = new Set([...users.map((u) => u.email), ...invites.map((i) => i.email)]);
  const invitableContacts = client.contacts.filter((c) => c.email && !takenEmails.has(c.email.toLowerCase()));

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Client portal access</CardTitle>
          <p className="mt-1 text-[13px] text-muted-foreground">
            People here can sign in to see {client.name}&apos;s projects, shared updates and files, and invoices. Never team pay or your margins.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setPrefill({ name: '', email: '', title: '' });
            setOpen(true);
          }}
        >
          <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Invite to portal
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {invitableContacts.length > 0 && (
          <div className="rounded-md bg-muted/40 p-3 text-sm">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Contacts without portal access</p>
            <div className="flex flex-wrap gap-2">
              {invitableContacts.map((c) => (
                <button
                  key={c.email}
                  type="button"
                  onClick={() => {
                    setPrefill({ name: c.name, email: c.email!, title: c.role ?? '' });
                    setOpen(true);
                  }}
                  className="flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs hover:border-primary/40 hover:text-primary"
                >
                  <UserPlus className="h-3 w-3" /> {c.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {access.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : access.isError ? (
          <ErrorState error={access.error} onRetry={() => access.refetch()} />
        ) : users.length === 0 && invites.length === 0 ? (
          <EmptyState illustration="people" title="No one has portal access yet" description="Invite a contact — they'll get an email to set their password." className="py-6" />
        ) : (
          <ul className="divide-y rounded-md border">
            {users.map((u) => (
              <li key={u._id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                <Avatar id={u._id} name={u.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {u.name}
                    {u.title && <span className="font-normal text-muted-foreground"> · {u.title}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {u.email} · {u.lastLoginAt ? `last signed in ${formatDate(u.lastLoginAt)}` : 'never signed in'}
                  </p>
                </div>
                {u.status === 'ACTIVE' ? (
                  <>
                    <Badge variant="success">Active</Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={async () => {
                        if (await confirm({ title: `Turn off portal access for ${u.name}?`, description: "They're signed out immediately. You can turn it back on later.", confirmText: 'Turn off', destructive: true }))
                          disable.mutate({ id: client._id, userId: u._id });
                      }}
                    >
                      Turn off
                    </Button>
                  </>
                ) : (
                  <>
                    <Badge variant="outline">Off</Badge>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => enable.mutate({ id: client._id, userId: u._id })}>
                      Turn on
                    </Button>
                  </>
                )}
              </li>
            ))}
            {invites.map((i) => (
              <li key={i._id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-dashed text-muted-foreground" aria-hidden>
                  <Mail className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {i.name}
                    {i.title && <span className="font-normal text-muted-foreground"> · {i.title}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {i.email} · invited {formatDate(i.lastSentAt)}
                    {i.sendCount > 1 ? ` (sent ${i.sendCount}×)` : ''}
                  </p>
                </div>
                <Badge variant={i.expired ? 'warning' : 'info'}>{i.expired ? 'Invite expired' : 'Invited'}</Badge>
                <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={resend.isPending} onClick={() => resend.mutate({ id: client._id, inviteId: i._id })}>
                  <RotateCw className="mr-1 h-3 w-3" /> Resend
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={async () => {
                    if (await confirm({ title: `Cancel the invite for ${i.email}?`, description: 'The link in their email stops working.', confirmText: 'Cancel invite', destructive: true }))
                      revoke.mutate({ id: client._id, inviteId: i._id });
                  }}
                >
                  <X className="mr-1 h-3 w-3" /> Cancel
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <InviteDialog
        open={open}
        onOpenChange={setOpen}
        clientName={client.name}
        prefill={prefill}
        pending={invite.isPending}
        onSubmit={async (body) => {
          await invite.mutateAsync({ id: client._id, body });
          setOpen(false);
        }}
      />
    </Card>
  );
}

function InviteDialog({
  open,
  onOpenChange,
  clientName,
  prefill,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  clientName: string;
  prefill: { name: string; email: string; title: string };
  pending: boolean;
  onSubmit: (b: { name: string; email: string; title?: string }) => Promise<void>;
}) {
  const [v, setV] = useState(prefill);
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [serverError, setServerError] = useState<string>();
  const [lastPrefill, setLastPrefill] = useState(prefill);
  if (prefill !== lastPrefill) {
    setLastPrefill(prefill);
    setV(prefill);
    setErrors({});
    setServerError(undefined);
  }
  const submit = async () => {
    const e: typeof errors = {};
    if (v.name.trim().length < 2) e.name = 'Enter their name';
    if (!/^\S+@\S+\.\S+$/.test(v.email)) e.email = 'Enter a valid email';
    setErrors(e);
    if (Object.keys(e).length) return;
    try {
      await onSubmit({ name: v.name.trim(), email: v.email.trim().toLowerCase(), title: v.title.trim() || undefined });
    } catch (err) {
      setServerError((err as Error).message);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite to the {clientName} portal</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {serverError && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{serverError}</p>}
          <FormField label="Name" error={errors.name}>
            <Input autoFocus value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
          </FormField>
          <FormField label="Email" error={errors.email} hint="They'll get a link to set their password (valid 72 hours).">
            <Input type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
          </FormField>
          <FormField label="Job title (optional)">
            <Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="e.g. Marketing head" />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Sending…' : 'Send invite'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ContactsCard({ client, onEdit }: { client: ClientRow; onEdit: () => void }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Contacts</CardTitle>
        <Button size="sm" variant="ghost" onClick={onEdit}>
          <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {client.contacts.length === 0 ? (
          <EmptyState illustration="people" title="No contacts yet" className="py-6" action={<Button size="sm" variant="outline" onClick={onEdit}>Add a contact</Button>} />
        ) : (
          <ul className="divide-y">
            {client.contacts.map((c, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5 text-sm">
                <span className="inline-flex items-center gap-2 font-medium">
                  <Avatar name={c.name} size="sm" />
                  {c.name}
                  {c.role && <span className="font-normal text-muted-foreground"> · {c.role}</span>}
                </span>
                {c.email && (
                  <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                    <Mail className="h-3.5 w-3.5" /> {c.email}
                  </a>
                )}
                {c.phone && (
                  <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                    <Phone className="h-3.5 w-3.5" /> {c.phone}
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function DetailsCard({ client: c, onEdit }: { client: ClientRow; onEdit: () => void }) {
  const rows: [string, string | undefined][] = [
    ['GSTIN', c.gstin],
    ['PAN', c.pan],
    ['State (place of supply)', c.state],
    ['Billing email', c.billingEmail],
    ['Phone', c.phone],
    ['Website', c.website],
    ['Payment terms', c.paymentTermsDays === undefined ? undefined : c.paymentTermsDays === 0 ? 'Due on receipt' : `Net ${c.paymentTermsDays}`],
    ['CIN', c.cin],
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Billing details</CardTitle>
          <Button size="sm" variant="ghost" onClick={onEdit}>
            <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
          </Button>
        </CardHeader>
        <CardContent>
          <dl className="space-y-2 text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-right">{value || <span className="text-muted-foreground">—</span>}</dd>
              </div>
            ))}
            <div className="border-t pt-2">
              <dt className="text-muted-foreground">Address</dt>
              <dd className="mt-1 whitespace-pre-line">{c.address || '—'}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Internal notes</CardTitle>
        </CardHeader>
        <CardContent>
          {c.notes ? <p className="whitespace-pre-line text-sm">{c.notes}</p> : <p className="text-sm text-muted-foreground">No notes. Only your team sees these.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
