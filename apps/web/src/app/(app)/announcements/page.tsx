// Announcements feed page.
'use client';

import { useEffect, useRef, useState } from 'react';

import { AudienceType, Role } from '@agency/shared';

import { PageHeader } from '@/components/layout/page-header';
import { RoleGate } from '@/components/auth/role-gate';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { RichTextEditor } from '@/components/rich-text-editor';

import {
  useAnnouncements,
  useCreateAnnouncement,
  useDeleteAnnouncement,
  useMarkAnnouncementRead,
} from '@/features/notifications/notifications.hooks';
import { useAuthStore } from '@/store/auth.store';

export default function AnnouncementsPage() {
  const list = useAnnouncements();
  const remove = useDeleteAnnouncement();
  const markRead = useMarkAnnouncementRead();
  const me = useAuthStore((s) => s.user);
  const markedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!me?.id || !list.data) return;
    for (const a of list.data) {
      const isRead = (a.readBy ?? []).some((r) => r.userId === me.id);
      if (!isRead && !markedRef.current.has(a._id)) {
        markedRef.current.add(a._id);
        markRead.mutate(a._id);
      }
    }
  }, [list.data, me?.id, markRead]);

  return (
    <div className="space-y-6">
      <PageHeader title="Announcements" description="Company-wide posts and updates." />

      <RoleGate allow={[Role.OWNER, Role.ADMIN]}>
        <ComposeCard />
      </RoleGate>

      <div className="space-y-3">
        {list.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {(list.data ?? []).map((a) => (
          <Card key={a._id}>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {a.pinned && <span className="text-xs text-amber-600">📌</span>}
                  {a.title}
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {a.audienceType} · {new Date(a.publishedAt ?? a.createdAt).toLocaleString()}
                </p>
              </div>
              <RoleGate allow={[Role.OWNER, Role.ADMIN]}>
                <Button variant="ghost" size="sm" onClick={() => remove.mutate(a._id)}>
                  Delete
                </Button>
              </RoleGate>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: a.body }} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ComposeCard() {
  const create = useCreateAnnouncement();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audienceType, setAudienceType] = useState<AudienceType>(AudienceType.ALL);
  const [pinned, setPinned] = useState(false);

  function reset() {
    setTitle('');
    setBody('');
    setAudienceType(AudienceType.ALL);
    setPinned(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Publish</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim() || !body.trim()) return;
            create.mutate(
              { title, body, audienceType, pinned },
              { onSuccess: reset },
            );
          }}
          className="grid gap-4 md:grid-cols-2"
        >
          <div className="space-y-1 md:col-span-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Body</Label>
            <RichTextEditor value={body} onChange={setBody} />
          </div>
          <div className="space-y-1">
            <Label>Audience</Label>
            <Select value={audienceType} onChange={(e) => setAudienceType(e.target.value as AudienceType)}>
              {Object.values(AudienceType).map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
          </div>
          <label className="flex items-end gap-2 text-sm">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
            Pin to top
          </label>
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Publishing…' : 'Publish'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
