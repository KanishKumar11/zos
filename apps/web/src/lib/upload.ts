// Browser upload helper — gets a presigned PUT URL from the API, then PUTs the file directly to S3.
import { api, unwrap } from '@/lib/api-client';

export interface UploadInput {
  file: File;
  prefix: string;
}
export interface UploadResult {
  key: string;
  publicUrl: string;
}

export async function uploadFile(input: UploadInput): Promise<UploadResult> {
  const presign = await unwrap<{ url: string; key: string; publicUrl: string }>(
    api.post('/storage/presign-put', {
      prefix: input.prefix,
      filename: input.file.name,
      contentType: input.file.type || 'application/octet-stream',
    }),
  );
  const res = await fetch(presign.url, {
    method: 'PUT',
    headers: { 'Content-Type': input.file.type || 'application/octet-stream' },
    body: input.file,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return { key: presign.key, publicUrl: presign.publicUrl };
}

/** Get a short-lived signed GET URL for a previously uploaded key. */
export async function getDownloadUrl(key: string): Promise<string> {
  const presign = await unwrap<{ url: string; expiresIn: number }>(
    api.post('/storage/presign-get', { key }),
  );
  return presign.url;
}
