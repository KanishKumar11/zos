// Announcements — company posts targeted at everyone, roles, departments or specific people,
// told as a story feed: pinned posts first, then newest first along a dated rail.
'use client';

import { Megaphone, Pin, PinOff, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { AudienceType, Role, STAFF_ROLES } from '@agency/shared';

import { cn } from '@/lib/cn';
import { formatDate, formatDateTime } from '@/lib/formatters';
import { useAuthStore } from '@/store/auth.store';

import { RoleGate } from '@/components/auth/role-gate';
import { RichTextEditor, RichTextView } from '@/components/rich-text-editor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/states';
import { Avatar, Hero, HeroFigure } from '@/components/viz';
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

const WEEK_MS = 7 * 86_400_000;

export default function AnnouncementsPage() {
  const list = useAnnouncements();
  const markRead = useMarkAnnouncementRead();
  const me = useAuthStore((s) => s.user);
  const canBrowsePeople = !!me?.role && [Role.OWNER, Role.ADMIN, Role.LEAD].includes(me.role);
  // Author names come from the staff directory, which only OWNER/ADMIN/LEAD may read.
  const staff = useStaffDirectory({ enabled: canBrowsePeople });
  const authors = useMemo(() => new Map((staff.data ?? []).map((u) => [u._id, u.name])), [staff.data]);
  const marked = useRef<Set<string>>(new Set());
  // Which posts were unread when the page opened — they keep a "New" tag while you're here.
  const [freshIds, setFreshIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    if (!me?.id || !list.data || freshIds) return;
    setFreshIds(new Set(list.data.filter((a) => !(a.readBy ?? []).some((r) => r.userId === me.id)).map((a) => a._id)));
  }, [list.data, me?.id, freshIds]);

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

  const rows = list.data ?? [];
  const pinned = rows.filter((a) => a.pinned);
  const rest = rows.filter((a) => !a.pinned);
  const freshCount = freshIds?.size ?? 0;
  const thisWeek = rows.filter((a) => Date.now() - new Date(a.publishedAt ?? a.createdAt).getTime() < WEEK_MS).length;

  return (
    <div className="space-y-6">
      <Hero pageTitle="Announcements" eyebrow="Company news" loading={list.isLoading} lede={list.isError ? undefined : 'Company-wide news and updates.'}>
        {list.isError ? (
          <>Company-wide news and updates.</>
        ) : rows.length === 0 ? (
          <>Nothing has been announced yet.</>
        ) : freshCount > 0 ? (
          <>
            <HeroFigure>
              {freshCount} new {freshCount === 1 ? 'announcement' : 'announcements'}
            </HeroFigure>{' '}
            since you last looked.
          </>
        ) : thisWeek > 0 ? (
          <>
            <HeroFigure>{thisWeek}</HeroFigure> {thisWeek === 1 ? 'post' : 'posts'} this week. You&apos;re up to date.
          </>
        ) : (
          <>You&apos;re up to date.</>
        )}
      </Hero>
      <RoleGate allow={[Role.OWNER, Role.ADMIN]}>
        <ComposeCard />
      </RoleGate>
      {list.isLoading ? (
        <Card>
          <TableSkeleton rows={3} columns={1} />
        </Card>
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState icon={Megaphone} title="No announcements yet" description="Company news will show up here." />
        </Card>
      ) : (
        <div className="space-y-6">
          {pinned.length > 0 && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-1.5 px-1 text-[13px] font-semibold text-muted-foreground">
                <Pin className="h-3.5 w-3.5 text-brand" /> Pinned
              </h2>
              {pinned.map((a) => (
                <AnnouncementCard key={a._id} a={a} author={authors.get(a.createdBy)} fresh={!!freshIds?.has(a._id)} />
              ))}
            </section>
          )}
          {rest.length > 0 && (
            <ol className="relative space-y-4 pl-7 before:absolute before:bottom-2 before:left-[9px] before:top-2 before:w-0.5 before:rounded before:bg-border">
              {rest.map((a) => (
                <li key={a._id} className="relative">
                  <span
                    className={cn(
                      'absolute -left-7 top-5 h-[20px] w-[20px] rounded-full border-4 border-background',
                      freshIds?.has(a._id) ? 'bg-brand' : 'bg-muted-foreground/40',
                    )}
                    aria-hidden
                  />
                  <AnnouncementCard a={a} author={authors.get(a.createdBy)} fresh={!!freshIds?.has(a._id)} />
                </li>
              ))}
            </ol>
          )}
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

function AnnouncementCard({ a, author, fresh }: { a: AnnouncementRow; author?: string; fresh?: boolean }) {
  const isManager = useAuthStore((s) => s.user?.role === Role.OWNER || s.user?.role === Role.ADMIN);
  const update = useUpdateAnnouncement();
  const remove = useDeleteAnnouncement();
  const confirm = useConfirm();
  const when = a.publishedAt ?? a.createdAt;
  return (
    <article
      className={cn(
        'animate-rise rounded-[var(--radius)] border bg-card p-4 sm:p-6',
        a.pinned && 'border-brand/25 bg-brand-wash/50',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {author ? (
            <Avatar id={a.createdBy} name={author} size="md" />
          ) : (
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-wash text-brand-ink" aria-hidden>
              <Megaphone className="h-4 w-4" />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{author ?? 'Team announcement'}</p>
            <p className="text-xs text-muted-foreground" title={formatDateTime(when)}>
              {formatDate(when, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              {isManager && (
                <>
                  {' '}· To <AudienceLabel a={a} />
                  {a.readCount !== undefined && ` · seen by ${a.readCount}`}
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {fresh && <Badge variant="default" className="bg-brand text-primary-foreground">New</Badge>}
          {isManager && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label={a.pinned ? 'Unpin' : 'Pin to top'}
                disabled={update.isPending}
                onClick={() => update.mutate({ id: a._id, body: { pinned: !a.pinned } })}
              >
                {a.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                aria-label="Delete announcement"
                disabled={remove.isPending}
                onClick={async () => {
                  if (await confirm({ title: `Delete “${a.title}”?`, description: 'It disappears for everyone.', destructive: true })) remove.mutate(a._id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
      <h3 className="mt-4 font-display text-xl font-bold leading-snug sm:text-2xl">{a.title}</h3>
      <div className="mt-2 text-[15px] leading-relaxed">
        <RichTextView html={a.body} />
      </div>
    </article>
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
    try {
      await create.mutateAsync({
        title: title.trim(),
        body,
        audienceType,
        pinned,
        ...(audienceType === AudienceType.ROLE ? { audienceRoles: roles as Role[] } : {}),
        ...(audienceType === AudienceType.DEPARTMENT || audienceType === AudienceType.USERS ? { audienceIds: ids } : {}),
      });
    } catch {
      return; // the hook already showed the server's reason; keep the draft so nothing is lost
    }
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
      <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center gap-3 rounded-[var(--radius)] border border-dashed bg-card px-4 py-3.5 text-left text-sm text-muted-foreground hover:border-brand/40 hover:text-foreground">
        <Megaphone className="h-4 w-4 text-brand" /> Write an announcement…
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
