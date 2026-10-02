// Client — the full picture: money owed, projects, invoices, contracts, contacts and portal access.
'use client';

import { FolderPlus, Mail, MoreHorizontal, Pencil, Phone, Receipt, RotateCw, Trash2, UserPlus, Users, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { use, useState } from 'react';

import { formatDate, formatPaise } from '@/lib/formatters';

import { PageHeader } from '@/components/layout/page-header';
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
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState, ErrorState, PageSkeleton } from '@/components/ui/states';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
} from '@/features/clients/clients.hooks';
import { useContracts } from '@/features/contracts/contracts.hooks';
import { useInvoices } from '@/features/invoices/invoices.hooks';
import { ProjectFormDialog } from '@/features/projects/components/project-form-dialog';
import { useProjects } from '@/features/projects/projects.hooks';

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const client = useClient(id);
  const stats = useClientStats(id);
  const router = useRouter();
  const pathname = usePathname();
  const tab = useSearchParams().get('tab') ?? 'overview';
  const del = useDeleteClient();
  const confirm = useConfirm();
  const [editOpen, setEditOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);

  if (client.isLoading) return <PageSkeleton />;
  if (client.isError || !client.data) return <ErrorState title="Couldn't open this client" error={client.error} onRetry={() => client.refetch()} />;
  const c = client.data;
  const s = stats.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={c.name}
        crumbs={[{ label: 'Clients', href: '/clients' }]}
        description={[c.state, c.gstin && `GSTIN ${c.gstin}`].filter(Boolean).join(' · ') || undefined}
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Outstanding" tone={s?.outstandingPaise ? 'warning' : 'default'} loading={stats.isLoading} value={formatPaise(s?.outstandingPaise ?? 0)} hint={s?.overduePaise ? `${formatPaise(s.overduePaise)} overdue` : 'Nothing overdue'} />
        <StatCard label="Invoiced" loading={stats.isLoading} value={formatPaise(s?.invoicedPaise ?? 0)} hint={s?.lastPaymentAt ? `Last paid ${formatDate(s.lastPaymentAt)}` : undefined} />
        <StatCard label="Collected" tone="success" loading={stats.isLoading} value={formatPaise(s?.collectedPaise ?? 0)} />
        <StatCard label="Projects" loading={stats.isLoading} value={`${s?.activeProjects ?? 0} active`} hint={`${s?.totalProjects ?? 0} total`} />
      </div>

      <Tabs value={tab} onValueChange={(t) => router.replace(`${pathname}${t === 'overview' ? '' : `?tab=${t}`}`, { scroll: false })}>
        <TabsList>
          <TabsTrigger value="overview">Projects &amp; billing</TabsTrigger>
          <TabsTrigger value="people">
            Contacts &amp; portal{s?.portalUsers ? ` (${s.portalUsers})` : ''}
          </TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-6">
          <ClientProjects clientId={c._id} onNew={() => setProjectOpen(true)} />
          <ClientInvoices clientId={c._id} />
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

function ClientProjects({ clientId, onNew }: { clientId: string; onNew: () => void }) {
  const projects = useProjects({ clientId, pageSize: 100 });
  const items = projects.data?.items ?? [];
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Projects</CardTitle>
        <Button size="sm" variant="ghost" onClick={onNew}>
          <FolderPlus className="mr-1 h-3.5 w-3.5" /> New
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <EmptyState title="No projects yet" className="py-8" />
        ) : (
          <ul className="divide-y">
            {items.map((p) => (
              <li key={p._id}>
                <Link href={`/projects/${p._id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/30">
                  <span className="flex-1 truncate text-sm font-medium">{p.name}</span>
                  {p.portalVisible === false && <Badge variant="outline">Hidden from portal</Badge>}
                  <span className="hidden text-xs text-muted-foreground sm:inline">{p.clientBudgetPaise ? formatPaise(p.clientBudgetPaise, p.currency ?? 'INR') : ''}</span>
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

function ClientInvoices({ clientId }: { clientId: string }) {
  const invoices = useInvoices({ clientId });
  const items = invoices.data ?? [];
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Invoices</CardTitle>
        <Link href={`/invoices?clientId=${clientId}`} className="text-xs text-primary hover:underline">
          Open in Invoices
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <EmptyState title="No invoices yet" className="py-8" />
        ) : (
          <ul className="divide-y">
            {items.slice(0, 10).map((i) => {
              const balance = i.totalPaise - i.paidPaise;
              return (
                <li key={i._id}>
                  <Link href={`/invoices/${i._id}`} className="flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-muted/30">
                    <span className="w-28 font-medium">{i.number}</span>
                    <span className="hidden flex-1 text-xs text-muted-foreground sm:block">
                      {i.issueDate ? formatDate(i.issueDate) : '—'}
                      {i.dueDate ? ` · due ${formatDate(i.dueDate)}` : ''}
                    </span>
                    <span className="ml-auto tabular-nums">{formatPaise(i.totalPaise, i.currency)}</span>
                    <span className="hidden w-28 text-right text-xs tabular-nums text-muted-foreground md:block">{balance > 0 ? `${formatPaise(balance, i.currency)} due` : 'Settled'}</span>
                    <StatusBadge status={i.status} />
                  </Link>
                </li>
              );
            })}
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
                <span className="text-xs text-muted-foreground">{formatPaise(k.monthlyAmountPaise, k.currency)}/month</span>
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

        {access.isLoading ? null : users.length === 0 && invites.length === 0 ? (
          <EmptyState icon={Users} title="No one has portal access yet" description="Invite a contact — they'll get an email to set their password." className="py-6" />
        ) : (
          <ul className="divide-y rounded-md border">
            {users.map((u) => (
              <li key={u._id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
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
          <EmptyState title="No contacts" className="py-6" />
        ) : (
          <ul className="divide-y">
            {client.contacts.map((c, i) => (
              <li key={i} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-2.5 text-sm">
                <span className="font-medium">
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
