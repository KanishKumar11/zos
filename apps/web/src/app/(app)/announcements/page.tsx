// Announcements — company posts targeted at everyone, roles, departments or specific people.
'use client';

import { Megaphone, Pin, PinOff, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { AudienceType, Role, STAFF_ROLES } from '@agency/shared';

import { formatDateTime } from '@/lib/formatters';
import { useAuthStore } from '@/store/auth.store';

import { RoleGate } from '@/components/auth/role-gate';
import { PageHeader } from '@/components/layout/page-header';
import { RichTextEditor, RichTextView } from '@/components/rich-text-editor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/states';
import { useDepartments } from '@/features/org/org.hooks';
import {
  useAnnouncements,
  useCreateAnnouncement,
  useDeleteAnnouncement,
  useMarkAnnouncementRead,
  useUpdateAnnouncement,
  type AnnouncementRow,
} from '@/features/notifications/notifications.hooks';
import { useStaffDirectory } from '@/features/team/team.hooks';

const roleLabel = (r: string) => r.charAt(0) + r.slice(1).toLowerCase();

export default function AnnouncementsPage() {
  const list = useAnnouncements();
  const markRead = useMarkAnnouncementRead();
  const me = useAuthStore((s) => s.user);
  const marked = useRef<Set<string>>(new Set());

  // Viewing the feed marks announcements as read (once each).
  useEffect(() => {
    if (!me?.id || !list.data) return;
    for (const a of list.data) {
      const read = (a.readBy ?? []).some((r) => r.userId === me.id);
      if (!read && !marked.current.has(a._id)) {
        marked.current.add(a._id);
        markRead.mutate(a._id);
      }
    }
  }, [list.data, me?.id, markRead]);

  return (
    <div className="space-y-6">
      <PageHeader title="Announcements" description="Company-wide news and updates." />
      <RoleGate allow={[Role.OWNER, Role.ADMIN]}>
        <ComposeCard />
      </RoleGate>
      {list.isLoading ? (
        <Card>
          <TableSkeleton rows={3} columns={1} />
        </Card>
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : (list.data ?? []).length === 0 ? (
        <Card>
          <EmptyState icon={Megaphone} title="No announcements yet" />
        </Card>
      ) : (
        <div className="space-y-3">
          {list.data!.map((a) => (
            <AnnouncementCard key={a._id} a={a} />
          ))}
        </div>
      )}
    </div>
  );
}

function AudienceLabel({ a }: { a: AnnouncementRow }) {
  const departments = useDepartments();
  if (a.audienceType === AudienceType.ALL) return <>Everyone</>;
  if (a.audienceType === AudienceType.ROLE) return <>{(a.audienceRoles ?? []).map(roleLabel).join(', ') || 'Selected roles'}</>;
  if (a.audienceType === AudienceType.DEPARTMENT) {
    const names = new Map((departments.data ?? []).map((d: { _id: string; name: string }) => [d._id, d.name]));
    return <>{a.audienceIds.map((id) => names.get(id) ?? 'Department').join(', ')}</>;
  }
  return <>{a.audienceIds.length} people</>;
}

function AnnouncementCard({ a }: { a: AnnouncementRow }) {
  const isManager = useAuthStore((s) => s.user?.role === Role.OWNER || s.user?.role === Role.ADMIN);
  const update = useUpdateAnnouncement();
  const remove = useDeleteAnnouncement();
  const confirm = useConfirm();
  return (
    <Card className={a.pinned ? 'border-primary/30' : undefined}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base">
            {a.pinned && <Pin className="h-3.5 w-3.5 text-primary" aria-label="Pinned" />}
            {a.title}
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatDateTime(a.publishedAt ?? a.createdAt)}
            {isManager && (
              <>
                {' '}· To <AudienceLabel a={a} />
                {a.readCount !== undefined && ` · seen by ${a.readCount}`}
              </>
            )}
          </p>
        </div>
        {isManager && (
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={a.pinned ? 'Unpin' : 'Pin to top'} onClick={() => update.mutate({ id: a._id, body: { pinned: !a.pinned } })}>
              {a.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              aria-label="Delete announcement"
              onClick={async () => {
                if (await confirm({ title: `Delete “${a.title}”?`, description: 'It disappears for everyone.', destructive: true })) remove.mutate(a._id);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <RichTextView html={a.body} />
      </CardContent>
    </Card>
  );
}

function ComposeCard() {
  const create = useCreateAnnouncement();
  const departments = useDepartments();
  const staff = useStaffDirectory();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audienceType, setAudienceType] = useState<AudienceType>(AudienceType.ALL);
  const [roles, setRoles] = useState<string[]>([]);
  const [ids, setIds] = useState<string[]>([]);
  const [peopleQuery, setPeopleQuery] = useState('');
  const [pinned, setPinned] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; body?: string; audience?: string }>({});

  const people = useMemo(
    () => (staff.data ?? []).filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(peopleQuery.toLowerCase())),
    [staff.data, peopleQuery],
  );
  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const publish = async () => {
    const e: typeof errors = {};
    if (title.trim().length < 2) e.title = 'Add a title';
    if (!body.replace(/<[^>]*>/g, '').trim()) e.body = 'Write the announcement';
    if (audienceType === AudienceType.ROLE && !roles.length) e.audience = 'Choose at least one role';
    if ((audienceType === AudienceType.DEPARTMENT || audienceType === AudienceType.USERS) && !ids.length)
      e.audience = audienceType === AudienceType.USERS ? 'Choose at least one person' : 'Choose at least one department';
    setErrors(e);
    if (Object.keys(e).length) return;
    await create.mutateAsync({
      title: title.trim(),
      body,
      audienceType,
      pinned,
      ...(audienceType === AudienceType.ROLE ? { audienceRoles: roles as Role[] } : {}),
      ...(audienceType === AudienceType.DEPARTMENT || audienceType === AudienceType.USERS ? { audienceIds: ids } : {}),
    });
    setTitle('');
    setBody('');
    setAudienceType(AudienceType.ALL);
    setRoles([]);
    setIds([]);
    setPinned(false);
    setOpen(false);
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="w-full rounded-lg border border-dashed bg-card px-4 py-3 text-left text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground">
        Write an announcement…
      </button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New announcement</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField label="Title" error={errors.title}>
          <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
        </FormField>
        <FormField label="Message" error={errors.body}>
          <RichTextEditor value={body} onChange={setBody} />
        </FormField>
        <FormField label="Who should see this?" error={errors.audience}>
          <div className="flex flex-wrap gap-1.5">
            {[
              [AudienceType.ALL, 'Everyone'],
              [AudienceType.ROLE, 'Roles'],
              [AudienceType.DEPARTMENT, 'Departments'],
              [AudienceType.USERS, 'Specific people'],
            ].map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => {
                  setAudienceType(v as AudienceType);
                  setIds([]);
                  setErrors((er) => ({ ...er, audience: undefined }));
                }}
                className={`rounded-full border px-3 py-1 text-xs ${audienceType === v ? 'border-primary/40 bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-accent'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {audienceType === AudienceType.ROLE && (
            <div className="flex flex-wrap gap-3 pt-2 text-sm">
              {STAFF_ROLES.map((r) => (
                <label key={r} className="flex items-center gap-1.5">
                  <input type="checkbox" checked={roles.includes(r)} onChange={() => toggle(roles, setRoles, r)} />
                  {roleLabel(r)}
                </label>
              ))}
            </div>
          )}
          {audienceType === AudienceType.DEPARTMENT && (
            <div className="flex flex-wrap gap-3 pt-2 text-sm">
              {(departments.data ?? []).length === 0 && <span className="text-muted-foreground">No departments yet — add them in Settings.</span>}
              {(departments.data ?? []).map((d: { _id: string; name: string }) => (
                <label key={d._id} className="flex items-center gap-1.5">
                  <input type="checkbox" checked={ids.includes(d._id)} onChange={() => toggle(ids, setIds, d._id)} />
                  {d.name}
                </label>
              ))}
            </div>
          )}
          {audienceType === AudienceType.USERS && (
            <div className="space-y-2 pt-2">
              <Input placeholder="Search people" value={peopleQuery} onChange={(e) => setPeopleQuery(e.target.value)} />
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2 text-sm">
                {people.map((u) => (
                  <label key={u._id} className="flex items-center gap-2">
                    <input type="checkbox" checked={ids.includes(u._id)} onChange={() => toggle(ids, setIds, u._id)} />
                    {u.name} <span className="text-xs text-muted-foreground">{u.email}</span>
                  </label>
                ))}
              </div>
              {ids.length > 0 && <Badge variant="info">{ids.length} selected</Badge>}
            </div>
          )}
        </FormField>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
          Pin to the top
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => void publish()} disabled={create.isPending}>
            {create.isPending ? 'Publishing…' : 'Publish'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
