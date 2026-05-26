// SOW detail (OWNER-only).
'use client';

import { use, useEffect, useState } from 'react';

import { Role } from '@agency/shared';

import { RoleGate } from '@/components/auth/role-gate';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { FileUploader } from '@/components/file-uploader';
import { PageHeader } from '@/components/layout/page-header';
import { formatPaise } from '@/lib/formatters';

import {
  usePublishSowBrief,
  useSetSowDocument,
  useSow,
} from '@/features/sow/sow.hooks';

export default function SowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <RoleGate allow={[Role.OWNER]} fallback={<p className="text-sm text-muted-foreground">Restricted.</p>}>
      <SowDetailInner id={id} />
    </RoleGate>
  );
}

function SowDetailInner({ id }: { id: string }) {
  const sow = useSow(id);
  const publishBrief = usePublishSowBrief();
  const setDocument = useSetSowDocument();

  const [scopeSummary, setScopeSummary] = useState('');
  const [deliverables, setDeliverables] = useState('');
  const [timelineStart, setTimelineStart] = useState('');
  const [timelineEnd, setTimelineEnd] = useState('');
  const [revisionRounds, setRevisionRounds] = useState<number>(0);

  useEffect(() => {
    const b = sow.data?.brief;
    if (b) {
      setScopeSummary(b.scopeSummary ?? '');
      setDeliverables((b.deliverables ?? []).join('\n'));
      setTimelineStart(b.timelineStart ? b.timelineStart.slice(0, 10) : '');
      setTimelineEnd(b.timelineEnd ? b.timelineEnd.slice(0, 10) : '');
      setRevisionRounds(b.revisionRounds ?? 0);
    }
  }, [sow.data?.brief]);

  if (sow.isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!sow.data) return <p className="text-sm text-muted-foreground">Not found.</p>;
  const s = sow.data;
  return (
    <div className="space-y-6">
      <PageHeader title={s.title} description={`${formatPaise(s.totalValuePaise, s.currency)} · ${s.milestones.length} milestones`} />

      <Card>
        <CardHeader>
          <CardTitle>Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-line text-sm">{s.description || '—'}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Milestones</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Title</TH>
                <TH>Amount</TH>
                <TH>Due</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {s.milestones.map((m, i) => (
                <TR key={i}>
                  <TD>{m.title}</TD>
                  <TD>{formatPaise(m.amountPaise, s.currency)}</TD>
                  <TD>{m.dueDate ? new Date(m.dueDate).toLocaleDateString() : '—'}</TD>
                  <TD>{m.status}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Brief</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {s.brief?.publishedAt && (
            <p className="text-xs text-muted-foreground">
              Published {new Date(s.brief.publishedAt).toLocaleString()}
            </p>
          )}
          <div className="space-y-1">
            <Label>Scope summary</Label>
            <Textarea value={scopeSummary} onChange={(e) => setScopeSummary(e.target.value)} rows={4} />
          </div>
          <div className="space-y-1">
            <Label>Deliverables (one per line)</Label>
            <Textarea
              value={deliverables}
              onChange={(e) => setDeliverables(e.target.value)}
              rows={4}
              placeholder={'Deliverable 1\nDeliverable 2'}
            />
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            <div className="space-y-1">
              <Label>Timeline start</Label>
              <Input type="date" value={timelineStart} onChange={(e) => setTimelineStart(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Timeline end</Label>
              <Input type="date" value={timelineEnd} onChange={(e) => setTimelineEnd(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Revision rounds</Label>
              <Input
                type="number"
                value={revisionRounds}
                onChange={(e) => setRevisionRounds(Number(e.target.value) || 0)}
              />
            </div>
          </div>
          <Button
            disabled={!scopeSummary.trim() || publishBrief.isPending}
            onClick={() => {
              const items = deliverables
                .split('\n')
                .map((d) => d.trim())
                .filter(Boolean);
              publishBrief.mutate({
                id,
                body: {
                  scopeSummary: scopeSummary.trim(),
                  deliverables: items,
                  ...(timelineStart ? { timelineStart } : {}),
                  ...(timelineEnd ? { timelineEnd } : {}),
                  revisionRounds,
                } as never,
              });
            }}
          >
            {publishBrief.isPending ? 'Publishing…' : 'Publish brief'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Signed document</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {s.documentKey ? (
            <p className="text-sm text-muted-foreground">
              Attached key: <code className="text-xs">{s.documentKey}</code>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No document attached yet.</p>
          )}
          <FileUploader
            prefix={`sows/${id}`}
            accept="application/pdf"
            label="Upload signed PDF"
            onUploaded={async (res) => {
              await setDocument.mutateAsync({
                id,
                body: { key: res.key, contentType: res.file.type },
              });
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
