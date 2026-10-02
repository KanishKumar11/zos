// Member documents (offer letter, NDA, ID proof…) — view via a short-lived signed link,
// OWNER/ADMIN can upload and remove. The person themselves can view their own.
'use client';

import { ExternalLink, FileText, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { getErrorMessage } from '@/lib/api-client';
import { formatDate } from '@/lib/formatters';

import { FileUploader } from '@/components/file-uploader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { DOCUMENT_KIND_LABEL, teamApi, type UserDocumentRow, type UserRow } from './team.api';
import { useAddMemberDocument, useRemoveMemberDocument } from './team.hooks';

const KINDS = Object.keys(DOCUMENT_KIND_LABEL) as UserDocumentRow['kind'][];

const formatSize = (bytes?: number) =>
  !bytes ? '' : bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function MemberDocuments({ user, canManage }: { user: UserRow; canManage: boolean }) {
  const confirm = useConfirm();
  const addDoc = useAddMemberDocument();
  const removeDoc = useRemoveMemberDocument();
  const [kind, setKind] = useState<UserDocumentRow['kind']>('OFFER_LETTER');
  const [name, setName] = useState('');
  const [opening, setOpening] = useState<string>();
  const docs = user.documents ?? [];

  const view = async (doc: UserDocumentRow) => {
    // Open the tab synchronously (popup blockers), then point it at the signed URL.
    const win = window.open('', '_blank');
    setOpening(doc._id);
    try {
      const { url } = await teamApi.documentUrl(user._id, doc._id);
      if (win) {
        win.opener = null;
        win.location.href = url;
      } else {
        window.location.href = url;
      }
    } catch (err) {
      win?.close();
      toast.error(getErrorMessage(err, "Couldn't open this document"));
    } finally {
      setOpening(undefined);
    }
  };

  const onRemove = async (doc: UserDocumentRow) => {
    const ok = await confirm({
      title: `Remove “${doc.name}”?`,
      description: 'The file is deleted from storage. This can’t be undone.',
      confirmText: 'Remove',
      destructive: true,
    });
    if (ok) removeDoc.mutate({ id: user._id, docId: doc._id });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Documents</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {docs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {canManage ? 'No documents yet. Upload an offer letter, NDA or ID proof below.' : 'No documents yet.'}
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {docs.map((d) => (
              <li key={d._id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{d.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[DOCUMENT_KIND_LABEL[d.kind] ?? d.kind, d.uploadedAt || d.createdAt ? formatDate((d.uploadedAt || d.createdAt)!) : '', formatSize(d.sizeBytes)]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <Button variant="ghost" size="sm" disabled={opening === d._id} onClick={() => void view(d)}>
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  {opening === d._id ? 'Opening…' : 'View'}
                </Button>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove ${d.name}`}
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => void onRemove(d)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {canManage && (
          <div className="grid gap-3 rounded-md border border-dashed p-3 md:grid-cols-3">
            <FormField label="Kind">
              <Select value={kind} onChange={(e) => setKind(e.target.value as UserDocumentRow['kind'])}>
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {DOCUMENT_KIND_LABEL[k]}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Name" className="md:col-span-2" hint={!name.trim() ? 'Give it a name first, then upload.' : undefined}>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Offer letter 2026" />
            </FormField>
            <div className="md:col-span-3">
              <FileUploader
                prefix={`users/${user._id}/documents`}
                accept="application/pdf,image/*"
                label={addDoc.isPending ? 'Saving…' : 'Upload document'}
                disabled={!name.trim() || addDoc.isPending}
                onUploaded={async (res) => {
                  await addDoc.mutateAsync({
                    id: user._id,
                    body: { kind, name: name.trim(), key: res.key, contentType: res.file.type, sizeBytes: res.file.size },
                  });
                  setName('');
                }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
