// Project updates feed + files, with a clear "Shared with client" marker everywhere.
'use client';

import { Download, Eye, EyeOff, FileText, Lock, MoreHorizontal, Paperclip, Trash2, Upload, Users } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { PROJECT_FILE_MAX_BYTES, Role, type ContentVisibility } from '@agency/shared';

import { getErrorMessage } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { formatDate, formatDateTime } from '@/lib/formatters';
import { identityColor } from '@/lib/identity';
import { useAuthStore } from '@/store/auth.store';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useConfirm } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/states';
import { Textarea } from '@/components/ui/textarea';
import { isNewSince, useLastVisit } from '@/lib/last-visit';
import { ActivityTimeline, Avatar, NewDot } from '@/components/viz';
import { useQueryClient } from '@tanstack/react-query';

import {
  collabApi,
  formatBytes,
  useCreateProjectUpdate,
  useEditProjectFile,
  useEditProjectUpdate,
  useProjectFiles,
  useProjectUpdates,
  useRemoveProjectFile,
  useRemoveProjectUpdate,
  type ProjectFileRow,
} from './collab.hooks';

const CAN_SHARE = new Set<string>([Role.OWNER, Role.ADMIN, Role.LEAD]);

export function VisibilityBadge({ visibility }: { visibility: ContentVisibility }) {
  return visibility === 'CLIENT' ? (
    <Badge variant="info">
      <Users className="h-3 w-3" /> Shared with client
    </Badge>
  ) : (
    <Badge variant="muted">
      <Lock className="h-3 w-3" /> Internal
    </Badge>
  );
}

function VisibilityToggle({
  value,
  onChange,
  disabled,
  hasClient,
}: {
  value: ContentVisibility;
  onChange: (v: ContentVisibility) => void;
  disabled?: boolean;
  hasClient: boolean;
}) {
  return (
    <div className="inline-flex rounded-md border p-0.5 text-xs" role="radiogroup" aria-label="Who can see this">
      {(['INTERNAL', 'CLIENT'] as const).map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          disabled={disabled || (v === 'CLIENT' && !hasClient)}
          title={v === 'CLIENT' && !hasClient ? 'This project has no client' : undefined}
          onClick={() => onChange(v)}
          className={cn(
            'flex items-center gap-1 rounded px-2 py-1 transition-colors disabled:cursor-not-allowed disabled:opacity-50',
            value === v ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {v === 'CLIENT' ? <Users className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
          {v === 'CLIENT' ? 'Share with client' : 'Team only'}
        </button>
      ))}
    </div>
  );
}

async function openFile(projectId: string, fileId: string) {
  try {
    const { url } = await collabApi.fileUrl(projectId, fileId);
    window.open(url, '_blank', 'noopener');
  } catch (err) {
    toast.error(getErrorMessage(err));
  }
}

// ── Updates ──────────────────────────────────────────────────────────────────────

export function ProjectUpdates({ projectId, hasClient }: { projectId: string; hasClient: boolean }) {
  const me = useAuthStore((s) => s.user);
  const canShare = !!me && CAN_SHARE.has(me.role);
  const updates = useProjectUpdates(projectId);
  const since = useLastVisit(`project-updates:${projectId}`);
  const create = useCreateProjectUpdate(projectId);
  const edit = useEditProjectUpdate(projectId);
  const remove = useRemoveProjectUpdate(projectId);
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState<ContentVisibility>('INTERNAL');
  const [attachments, setAttachments] = useState<ProjectFileRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; body?: string }>({});
  const fileInput = useRef<HTMLInputElement>(null);

  const post = async () => {
    const e: typeof errors = {};
    if (title.trim().length < 2) e.title = 'Add a short title';
    if (!body.trim()) e.body = 'Write the update';
    setErrors(e);
    if (Object.keys(e).length) return;
    if (visibility === 'CLIENT') {
      const ok = await confirm({
        title: 'Share this update with the client?',
        description: `Everyone with portal access for this client will see it${attachments.length ? ', along with the attached files' : ''}, and they'll get an email.`,
        confirmText: 'Share',
      });
      if (!ok) return;
    }
    await create.mutateAsync({ title, body, visibility, fileIds: attachments.map((a) => a._id) });
    setTitle('');
    setBody('');
    setAttachments([]);
    setVisibility('INTERNAL');
  };

  const attach = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        if (f.size > PROJECT_FILE_MAX_BYTES) {
          toast.error(`${f.name} is larger than 50 MB`);
          continue;
        }
        const row = await collabApi.upload(projectId, f, 'INTERNAL');
        setAttachments((a) => [...a, row]);
      }
      qc.invalidateQueries({ queryKey: ['collab', projectId, 'files'] });
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4">
          <FormField error={errors.title}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Update title — e.g. Homepage design ready for review" />
          </FormField>
          <FormField error={errors.body}>
            <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="What happened, what's next, anything blocked?" />
          </FormField>
          {attachments.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {attachments.map((a) => (
                <li key={a._id} className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs">
                  <Paperclip className="h-3 w-3" /> {a.name}
                  <button type="button" aria-label={`Remove ${a.name}`} className="text-muted-foreground hover:text-destructive" onClick={() => setAttachments((x) => x.filter((y) => y._id !== a._id))}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <input ref={fileInput} type="file" multiple hidden onChange={(e) => void attach(e.target.files)} />
              <Button type="button" variant="ghost" size="sm" disabled={uploading} onClick={() => fileInput.current?.click()}>
                <Paperclip className="mr-1.5 h-3.5 w-3.5" />
                {uploading ? 'Uploading…' : 'Attach'}
              </Button>
              {canShare && <VisibilityToggle value={visibility} onChange={setVisibility} hasClient={hasClient} />}
            </div>
            <Button size="sm" onClick={() => void post()} disabled={create.isPending || uploading}>
              {create.isPending ? 'Posting…' : 'Post update'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {updates.isLoading ? (
        <TableSkeleton rows={3} columns={1} />
      ) : updates.isError ? (
        <ErrorState error={updates.error} onRetry={() => updates.refetch()} />
      ) : (updates.data ?? []).length === 0 ? (
        <EmptyState
          illustration="inbox"
          title="No updates yet"
          description={canShare ? 'Post progress here. Choose “Share with client” to show it in their portal.' : 'Post progress here so the team knows where things stand.'}
        />
      ) : (
        <ol className="space-y-3">
          {updates.data!.map((u) => {
            const mine = u.authorId === me?.id;
            const canManage = mine || me?.role === Role.OWNER || me?.role === Role.ADMIN;
            return (
              <li key={u._id}>
                <Card>
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <Avatar id={u.authorId} name={u.authorName} size="sm" />
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 font-medium">
                            {u.title}
                            <NewDot show={!mine && isNewSince(u.createdAt, since)} />
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {u.authorName} · {formatDateTime(u.createdAt)}
                            {u.editedAt ? ' · edited' : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <VisibilityBadge visibility={u.visibility} />
                        {canManage && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button type="button" aria-label="Update options" className="rounded p-1 text-muted-foreground hover:bg-accent">
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {canShare && hasClient && (
                                <DropdownMenuItem
                                  onClick={async () => {
                                    const next = u.visibility === 'CLIENT' ? 'INTERNAL' : 'CLIENT';
                                    if (next === 'CLIENT' && !(await confirm({ title: 'Share with the client?', description: 'Their portal users will see this update and be emailed.', confirmText: 'Share' }))) return;
                                    edit.mutate({ id: u._id, body: { visibility: next } });
                                  }}
                                >
                                  {u.visibility === 'CLIENT' ? <EyeOff className="mr-2 h-3.5 w-3.5" /> : <Eye className="mr-2 h-3.5 w-3.5" />}
                                  {u.visibility === 'CLIENT' ? 'Hide from client' : 'Share with client'}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={async () => {
                                  if (await confirm({ title: 'Delete this update?', destructive: true })) remove.mutate(u._id);
                                }}
                              >
                                <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                    <p className="whitespace-pre-line text-sm leading-relaxed">{u.body}</p>
                    {u.files.length > 0 && (
                      <ul className="flex flex-wrap gap-2 pt-1">
                        {u.files.map((f) => (
                          <li key={f._id}>
                            <button
                              type="button"
                              onClick={() => void openFile(projectId, f._id)}
                              className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs hover:bg-accent"
                            >
                              <FileText className="h-3.5 w-3.5" /> {f.name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

// ── Files ────────────────────────────────────────────────────────────────────────

export function ProjectFiles({ projectId, hasClient }: { projectId: string; hasClient: boolean }) {
  const me = useAuthStore((s) => s.user);
  const canShare = !!me && CAN_SHARE.has(me.role);
  const files = useProjectFiles(projectId);
  const edit = useEditProjectFile(projectId);
  const remove = useRemoveProjectFile(projectId);
  const confirm = useConfirm();
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ name: string; pct: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    for (const f of Array.from(list)) {
      if (f.size > PROJECT_FILE_MAX_BYTES) {
        toast.error(`${f.name} is larger than 50 MB`);
        continue;
      }
      try {
        setProgress({ name: f.name, pct: 0 });
        await collabApi.upload(projectId, f, 'INTERNAL', (pct) => setProgress({ name: f.name, pct }));
        toast.success(`${f.name} uploaded`);
      } catch (err) {
        toast.error(`${f.name}: ${getErrorMessage(err)}`);
      }
    }
    setProgress(null);
    if (input.current) input.current.value = '';
    qc.invalidateQueries({ queryKey: ['collab', projectId, 'files'] });
  };

  return (
    <Card
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void upload(e.dataTransfer.files);
      }}
      className={cn(dragging && 'ring-2 ring-primary')}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Files</CardTitle>
        <div className="flex items-center gap-2">
          <input ref={input} type="file" multiple hidden onChange={(e) => void upload(e.target.files)} />
          <Button size="sm" variant="outline" disabled={!!progress} onClick={() => input.current?.click()}>
            <Upload className="mr-1.5 h-3.5 w-3.5" /> Upload
          </Button>
        </div>
      </CardHeader>
      {progress && (
        <div className="border-b px-5 py-2 text-xs text-muted-foreground">
          Uploading {progress.name}… {progress.pct}%
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-[width]" style={{ width: `${progress.pct}%` }} />
          </div>
        </div>
      )}
      <CardContent className="p-0">
        {files.isLoading ? (
          <TableSkeleton rows={3} columns={3} />
        ) : files.isError ? (
          <ErrorState error={files.error} onRetry={() => files.refetch()} />
        ) : (files.data ?? []).length === 0 ? (
          <EmptyState illustration="files" title="No files yet" description="Drop files here or use Upload. Files stay internal until you share them with the client." />
        ) : (
          <ul className="divide-y">
            {files.data!.map((f) => {
              const canManage = f.uploadedBy === me?.id || me?.role === Role.OWNER || me?.role === Role.ADMIN;
              return (
                <li key={f._id} className="flex items-center gap-3 px-5 py-2.5">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <button type="button" className="truncate text-left text-sm font-medium hover:underline" onClick={() => void openFile(projectId, f._id)}>
                      {f.name}
                    </button>
                    <p className="text-xs text-muted-foreground">
                      {[formatBytes(f.sizeBytes), f.uploadedByName, formatDate(f.createdAt)].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <VisibilityBadge visibility={f.visibility} />
                  <button type="button" aria-label={`Download ${f.name}`} className="rounded p-1.5 text-muted-foreground hover:bg-accent" onClick={() => void openFile(projectId, f._id)}>
                    <Download className="h-4 w-4" />
                  </button>
                  {canManage && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button type="button" aria-label="File options" className="rounded p-1.5 text-muted-foreground hover:bg-accent">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canShare && hasClient && (
                          <DropdownMenuItem
                            onClick={async () => {
                              const next = f.visibility === 'CLIENT' ? 'INTERNAL' : 'CLIENT';
                              if (next === 'CLIENT' && !(await confirm({ title: `Share ${f.name} with the client?`, description: 'Their portal users can download it.', confirmText: 'Share' }))) return;
                              edit.mutate({ id: f._id, body: { visibility: next } });
                            }}
                          >
                            {f.visibility === 'CLIENT' ? 'Hide from client' : 'Share with client'}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={async () => {
                            if (await confirm({ title: `Delete ${f.name}?`, destructive: true })) remove.mutate(f._id);
                          }}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ── Recent updates (overview snapshot) ───────────────────────────────────────────

/** The latest few updates as a story feed, for the project overview. */
export function RecentUpdates({ projectId, limit = 3, onOpenAll }: { projectId: string; limit?: number; onOpenAll?: () => void }) {
  const updates = useProjectUpdates(projectId);
  if (updates.isLoading) return <TableSkeleton rows={2} columns={1} />;
  if (updates.isError) return <ErrorState error={updates.error} onRetry={() => updates.refetch()} />;
  const items = (updates.data ?? []).slice(0, limit);
  return (
    <div className="space-y-3">
      <ActivityTimeline
        items={items.map((u) => ({
          key: u._id,
          date: u.createdAt,
          color: identityColor(u.authorId),
          title: u.title,
          meta: (
            <>
              {u.authorName} · {formatDate(u.createdAt)}
              {u.visibility === 'CLIENT' ? ' · shared with client' : ''}
            </>
          ),
          body: <p className="line-clamp-3 whitespace-pre-line text-muted-foreground">{u.body}</p>,
        }))}
        empty={<p className="text-sm text-muted-foreground">No updates yet. Post the first one so everyone knows where things stand.</p>}
      />
      {onOpenAll && (
        <Button variant="ghost" size="sm" onClick={onOpenAll}>
          {(updates.data ?? []).length > limit ? `See all ${(updates.data ?? []).length} updates` : items.length ? 'Open updates' : 'Post an update'}
        </Button>
      )}
    </div>
  );
}
