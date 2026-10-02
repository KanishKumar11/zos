// The client's view of one project — used by the portal and by the owner's "Preview as client".
'use client';

import { CalendarDays, Download, FileText, Mail } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

import { getErrorMessage } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatDate, formatDateTime, formatPaise } from '@/lib/formatters';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/states';
import { formatBytes } from '@/features/collab/collab.hooks';

import { portalApi, type PortalProject } from './portal.hooks';

export function PortalProjectView({ project: p, preview = false }: { project: PortalProject; preview?: boolean }) {
  const billed = p.milestones.filter((m) => m.status !== 'PENDING').reduce((s, m) => s + m.amountPaise, 0);
  const total = p.milestones.reduce((s, m) => s + m.amountPaise, 0);

  const openFile = async (fileId: string) => {
    if (preview) {
      toast.info('In the client portal this downloads the file.');
      return;
    }
    try {
      const { url } = await portalApi.fileUrl(p._id, fileId);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{p.name}</h1>
          <StatusBadge status={p.status} />
        </div>
        {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
          {(p.startDate || p.endDate) && (
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              {p.startDate ? formatDate(p.startDate) : '—'} → {p.endDate ? formatDate(p.endDate) : 'Ongoing'}
            </span>
          )}
          {p.lead && (
            <a href={`mailto:${p.lead.email}`} className="flex items-center gap-1.5 hover:text-foreground">
              <Mail className="h-3.5 w-3.5" /> Your contact: {p.lead.name}
            </a>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section aria-labelledby="updates-h" className="space-y-3">
            <h2 id="updates-h" className="text-base font-semibold">Updates</h2>
            {p.updates.length === 0 ? (
              <Card>
                <EmptyState title="No updates yet" description="Progress updates from the team will appear here." />
              </Card>
            ) : (
              <ol className="space-y-3">
                {p.updates.map((u) => (
                  <li key={u._id}>
                    <Card>
                      <CardContent className="space-y-2 p-4">
                        <div>
                          <p className="font-medium">{u.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {u.authorName} · {formatDateTime(u.createdAt)}
                          </p>
                        </div>
                        <p className="whitespace-pre-line text-sm leading-relaxed">{u.body}</p>
                        {u.files.length > 0 && (
                          <ul className="flex flex-wrap gap-2 pt-1">
                            {u.files.map((f) => (
                              <li key={f._id}>
                                <button type="button" onClick={() => void openFile(f._id)} className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:bg-accent">
                                  <FileText className="h-3.5 w-3.5" /> {f.name}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Milestones</CardTitle>
              {total > 0 && (
                <div className="pt-1">
                  <ProgressBar value={billed} max={total} />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatPaise(billed, p.currency)} of {formatPaise(total, p.currency)} billed
                  </p>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {p.milestones.length === 0 ? (
                <EmptyState title="No milestones yet" className="py-8" />
              ) : (
                <ol className="divide-y">
                  {p.milestones.map((m, i) => (
                    <li key={m._id} className="flex gap-3 px-5 py-3">
                      <span
                        className={cn(
                          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold',
                          m.status === 'COLLECTED' ? 'border-transparent bg-[hsl(var(--success))] text-white' : m.status === 'INVOICED' ? 'border-sky-600 text-sky-700' : 'text-muted-foreground',
                        )}
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1 text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium">{m.name}</p>
                          <span className="tabular-nums">{formatPaise(m.amountPaise, p.currency)}</span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <StatusBadge status={m.status} />
                          {m.dueDate && <span>Due {formatDate(m.dueDate)}</span>}
                          {m.invoice &&
                            (preview ? (
                              <span>{m.invoice.number}</span>
                            ) : (
                              <Link href={`/portal/invoices/${m.invoice._id}`} className="text-primary hover:underline">
                                {m.invoice.number}
                              </Link>
                            ))}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Files</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {p.files.length === 0 ? (
                <EmptyState title="No shared files yet" className="py-8" />
              ) : (
                <ul className="divide-y">
                  {p.files.map((f) => (
                    <li key={f._id}>
                      <button type="button" onClick={() => void openFile(f._id)} className="flex w-full items-center gap-3 px-5 py-2.5 text-left hover:bg-muted/30">
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">{f.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {[formatBytes(f.sizeBytes), formatDate(f.createdAt)].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                        <Download className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
