// Receipt upload + "View receipt" — used by the expense and other-income forms and lists.
'use client';

import { FileText, Paperclip, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { getErrorMessage } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { getDownloadUrl } from '@/lib/upload';

import { FileUploader } from '@/components/file-uploader';

/** Opens a stored receipt in a new tab via a short-lived signed link. */
export function ViewReceiptButton({
  receiptKey,
  label = 'View receipt',
  compact,
  className,
}: {
  receiptKey: string;
  label?: string;
  /** Icon only (for table rows). */
  compact?: boolean;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const open = async () => {
    // Open the tab synchronously so pop-up blockers allow it, then point it at the signed URL.
    const win = window.open('', '_blank');
    setBusy(true);
    try {
      const url = await getDownloadUrl(receiptKey);
      if (win) {
        win.opener = null;
        win.location.href = url;
      } else {
        window.location.assign(url);
      }
    } catch (err) {
      win?.close();
      toast.error(`Couldn't open the receipt. ${getErrorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={() => void open()}
      disabled={busy}
      title={label}
      aria-label={label}
      className={cn(
        'inline-flex items-center gap-1.5 text-sm text-primary hover:underline disabled:opacity-60',
        compact && 'rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground hover:no-underline',
        className,
      )}
    >
      {compact ? <Paperclip className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
      {!compact && (busy ? 'Opening…' : label)}
    </button>
  );
}

/** Upload / replace / remove a receipt. `value` is the storage key. */
export function ReceiptField({
  value,
  onChange,
  prefix,
}: {
  value: string | undefined;
  onChange: (key: string | undefined) => void;
  prefix: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <FileUploader
        prefix={prefix}
        accept="application/pdf,image/*"
        label={value ? 'Replace receipt' : 'Upload receipt'}
        onUploaded={(res) => onChange(res.key)}
      />
      {value ? (
        <>
          <ViewReceiptButton receiptKey={value} />
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
          >
            <X className="h-3 w-3" /> Remove
          </button>
        </>
      ) : (
        <span className="text-xs text-muted-foreground">PDF or image</span>
      )}
    </div>
  );
}
