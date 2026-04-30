// Reusable FileUploader — wraps presign-PUT helper with progress + error UI.
'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { uploadFile, type UploadResult } from '@/lib/upload';

export interface FileUploaderProps {
  prefix: string;
  accept?: string;
  multiple?: boolean;
  label?: string;
  onUploaded: (result: UploadResult & { file: File }) => void | Promise<void>;
  disabled?: boolean;
}

export function FileUploader({
  prefix,
  accept,
  multiple,
  label = 'Upload file',
  onUploaded,
  disabled,
}: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setBusy(true);
    try {
      for (const file of files) {
        const res = await uploadFile({ file, prefix });
        await onUploaded({ ...res, file });
      }
      toast.success(files.length > 1 ? `${files.length} files uploaded` : 'Uploaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={onChange}
        disabled={busy || disabled}
        className="hidden"
        id={`fu-${prefix.replace(/\W/g, '_')}`}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy || disabled}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? 'Uploading…' : label}
      </Button>
    </div>
  );
}
