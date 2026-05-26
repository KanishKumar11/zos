// Team member detail page — overview + admin actions (role/status), deactivate/reactivate.
'use client';

import { use, useState } from 'react';

import { Role, UserStatus } from '@agency/shared';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { FileUploader } from '@/components/file-uploader';

import { PageHeader } from '@/components/layout/page-header';
import { isOwner } from '@/lib/roles';
import { useAuthStore } from '@/store/auth.store';

import {
  useAddMemberDocument,
  useAdminUpdateUser,
  useDeactivateUser,
  useReactivateUser,
  useRemoveMemberDocument,
  useSetOnboarding,
  useTeamMember,
  useToggleOnboarding,
} from '@/features/team/team.hooks';
import { teamApi } from '@/features/team/team.api';

export default function TeamMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const me = useAuthStore((s) => s.user);
  const member = useTeamMember(id);
  const adminUpdate = useAdminUpdateUser();
  const deactivate = useDeactivateUser();
  const reactivate = useReactivateUser();

  const [role, setRole] = useState<Role | ''>('');
  const [status, setStatus] = useState<UserStatus | ''>('');
  const [docKind, setDocKind] = useState<'OFFER_LETTER' | 'NDA' | 'CONTRACT' | 'ID_PROOF' | 'OTHER'>('OFFER_LETTER');
  const [docName, setDocName] = useState('');
  const [newOnboardItem, setNewOnboardItem] = useState('');

  const addDoc = useAddMemberDocument();
  const removeDoc = useRemoveMemberDocument();
  const setOnboarding = useSetOnboarding();
  const toggleOnboard = useToggleOnboarding();

  if (member.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!member.data) return <p className="text-sm text-muted-foreground">Member not found.</p>;
  const u = member.data;
  const canManage = me?.role === Role.OWNER || me?.role === Role.ADMIN;
  const isSelf = me?.id === u._id;
  const docs = u.documents ?? [];
  const checklist = u.onboardingChecklist ?? [];

  async function openDocument(docId: string) {
    const { url } = await teamApi.documentUrl(u._id, docId);
    window.open(url, '_blank', 'noopener');
  }

  return (
    <div className="space-y-6">
      <PageHeader title={u.name} description={u.email} />

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3 text-sm">
          <Field label="Role" value={<Badge variant="outline">{u.role}</Badge>} />
          <Field
            label="Status"
            value={<Badge variant={u.status === UserStatus.ACTIVE ? 'default' : 'secondary'}>{u.status}</Badge>}
          />
          <Field label="Phone" value={u.phone ?? '—'} />
          <Field label="Joined" value={u.dateOfJoining ? new Date(u.dateOfJoining).toLocaleDateString() : '—'} />
          <Field label="Last login" value={u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '—'} />
        </CardContent>
      </Card>

      {(me?.role === Role.OWNER || me?.role === Role.ADMIN) && (
        <Card>
          <CardHeader>
            <CardTitle>Admin actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label>Change role</Label>
                <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                  <option value="">Select…</option>
                  {Object.values(Role).map((r) => (
                    <option key={r} value={r} disabled={r === Role.OWNER && !isOwner(me?.role)}>
                      {r}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Change status</Label>
                <Select value={status} onChange={(e) => setStatus(e.target.value as UserStatus)}>
                  <option value="">Select…</option>
                  {Object.values(UserStatus).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                disabled={!role && !status}
                onClick={() => {
                  adminUpdate.mutate({
                    id: u._id,
                    body: {
                      ...(role ? { role } : {}),
                      ...(status ? { status } : {}),
                    },
                  });
                }}
              >
                Save changes
              </Button>
              {u.status === UserStatus.ACTIVE ? (
                <Button variant="destructive" onClick={() => deactivate.mutate(u._id)}>
                  Deactivate
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => reactivate.mutate(u._id)}>
                  Reactivate
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {(canManage || isSelf) && (
        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {docs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents yet.</p>
            ) : (
              <ul className="divide-y">
                {docs.map((d) => (
                  <li key={d._id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <p className="font-medium">{d.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.kind} · {d.uploadedAt ? new Date(d.uploadedAt).toLocaleDateString() : ''}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openDocument(d._id)}>
                        Open
                      </Button>
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeDoc.mutate({ id: u._id, docId: d._id })}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {canManage && (
              <div className="grid gap-2 md:grid-cols-3">
                <div className="space-y-1">
                  <Label>Kind</Label>
                  <Select value={docKind} onChange={(e) => setDocKind(e.target.value as typeof docKind)}>
                    {(['OFFER_LETTER', 'NDA', 'CONTRACT', 'ID_PROOF', 'OTHER'] as const).map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label>Display name</Label>
                  <Input value={docName} onChange={(e) => setDocName(e.target.value)} placeholder="e.g. Offer letter Q2-26" />
                </div>
                <div className="md:col-span-3">
                  <FileUploader
                    prefix={`users/${u._id}/documents`}
                    accept="application/pdf,image/*"
                    label="Upload document"
                    disabled={!docName.trim()}
                    onUploaded={async (res) => {
                      await addDoc.mutateAsync({
                        id: u._id,
                        body: {
                          kind: docKind,
                          name: docName.trim(),
                          key: res.key,
                          contentType: res.file.type,
                          sizeBytes: res.file.size,
                        },
                      });
                      setDocName('');
                    }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {(canManage || isSelf) && (
        <Card>
          <CardHeader>
            <CardTitle>Onboarding checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {checklist.length === 0 ? (
              <p className="text-sm text-muted-foreground">No checklist yet.</p>
            ) : (
              <ul className="divide-y">
                {checklist.map((it, idx) => (
                  <li key={idx} className="flex items-center gap-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={it.completed}
                      disabled={!isSelf && !canManage}
                      onChange={() => toggleOnboard.mutate({ id: u._id, idx })}
                    />
                    <span className={it.completed ? 'line-through text-muted-foreground' : ''}>{it.item}</span>
                    {it.completedAt && (
                      <span className="ml-auto text-xs text-muted-foreground">
                        {new Date(it.completedAt).toLocaleDateString()}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {canManage && (
              <div className="flex gap-2">
                <Input
                  value={newOnboardItem}
                  onChange={(e) => setNewOnboardItem(e.target.value)}
                  placeholder="Add checklist item"
                />
                <Button
                  type="button"
                  disabled={!newOnboardItem.trim()}
                  onClick={() => {
                    const next = [
                      ...checklist.map((c) => ({ item: c.item, completed: c.completed })),
                      { item: newOnboardItem.trim(), completed: false },
                    ];
                    setOnboarding.mutate(
                      { id: u._id, body: { items: next } },
                      { onSuccess: () => setNewOnboardItem('') },
                    );
                  }}
                >
                  Add
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1">{value}</p>
    </div>
  );
}
