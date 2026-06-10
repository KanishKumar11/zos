// Team member detail page — overview + admin actions (role/status), deactivate/reactivate.
'use client';

import Link from 'next/link';
import { use, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { Role, UserStatus } from '@agency/shared';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { FileUploader } from '@/components/file-uploader';

import { PageHeader } from '@/components/layout/page-header';
import { formatPaise } from '@/lib/formatters';
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
import { useMemberStats } from '@/features/dashboard/dashboard.hooks';

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
  const stats = useMemberStats(id, me?.role === Role.OWNER);

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
          <Field label="Birthday" value={u.dateOfBirth ? new Date(u.dateOfBirth).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'} />
          <Field label="Last login" value={u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '—'} />
        </CardContent>
      </Card>

      {/* Earnings & Projects — OWNER only */}
      {me?.role === Role.OWNER && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Monthly Earnings — Last 12 Months</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.isLoading ? (
                <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
              ) : (
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={(stats.data?.earnings ?? []).map((e) => ({
                        month: e.month.slice(5),
                        Net: Math.round(e.netPaise / 100),
                        Gross: Math.round(e.grossPaise / 100),
                      }))}
                      margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
                      barSize={14}
                      barGap={2}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={48}
                        tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                        formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, '']}
                      />
                      <Bar dataKey="Gross" fill="var(--muted-foreground)" opacity={0.3} radius={[2, 2, 0, 0]} />
                      <Bar dataKey="Net" fill="var(--foreground)" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {!stats.isLoading && stats.data && (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm border-t pt-4">
                  {(() => {
                    const withData = stats.data.earnings.filter((e) => e.netPaise > 0);
                    const total = withData.reduce((s, e) => s + e.netPaise, 0);
                    const avg = withData.length ? Math.round(total / withData.length) : 0;
                    const last = stats.data.earnings.at(-1);
                    return (
                      <>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Last Month Net</p>
                          <p className="font-semibold mt-1">{last?.netPaise ? formatPaise(last.netPaise, 'INR') : '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">12M Average</p>
                          <p className="font-semibold mt-1">{avg ? formatPaise(avg, 'INR') : '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">12M Total</p>
                          <p className="font-semibold mt-1">{total ? formatPaise(total, 'INR') : '—'}</p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Projects</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (stats.data?.projects ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No projects assigned.</p>
              ) : (
                <div className="space-y-4">
                  {(stats.data?.projects ?? []).map((p) => (
                    <div key={p.projectId} className="border border-border rounded-lg p-4">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <Link href={`/projects/${p.projectId}`} className="font-semibold text-sm hover:underline">
                            {p.projectName}
                          </Link>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            <span className="font-mono">{p.projectCode}</span>
                            {p.role && ` · ${p.role}`}
                            {' · '}
                            <span className={p.status === 'ACTIVE' ? 'text-emerald-600' : 'text-muted-foreground'}>{p.status}</span>
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-muted-foreground">Monthly Rate</p>
                          <p className="text-sm font-semibold">{p.amountPaise ? formatPaise(p.amountPaise, 'INR') : '—'}</p>
                        </div>
                      </div>
                      {p.payments.length > 0 && (
                        <div className="border-t pt-3 space-y-1">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Payment History</p>
                          {p.payments.slice(-5).map((pay, i) => (
                            <div key={i} className="flex justify-between text-xs">
                              <span className="text-muted-foreground">
                                {new Date(pay.paidAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                {pay.note && ` · ${pay.note}`}
                              </span>
                              <span className="font-semibold text-emerald-600">+{formatPaise(pay.amountPaise, 'INR')}</span>
                            </div>
                          ))}
                          {p.payments.length > 5 && (
                            <p className="text-xs text-muted-foreground">+{p.payments.length - 5} more</p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

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
