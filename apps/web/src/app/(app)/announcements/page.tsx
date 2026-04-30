// Announcements feed page.
'use client';

import { useState } from 'react';

import { AudienceType, Role } from '@agency/shared';

import { RoleGate } from '@/components/auth/role-gate';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

import {
  useAnnouncements,
  useCreateAnnouncement,
  useDeleteAnnouncement,
} from '@/features/notifications/notifications.hooks';

export default function AnnouncementsPage() {
  const list = useAnnouncements();
  const remove = useDeleteAnnouncement();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Announcements</h1>

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
              <p className="whitespace-pre-line text-sm">{a.body}</p>
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
            <textarea
              className="min-h-32 w-full rounded border bg-background px-3 py-2 text-sm"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
            />
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
