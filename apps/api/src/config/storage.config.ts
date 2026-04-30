// S3-compatible storage configuration. Endpoint optional (set for MinIO/R2).
import { registerAs } from '@nestjs/config';

export interface StorageConfig {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  forcePathStyle: boolean;
  presignTtlSeconds: number;
}

export default registerAs<StorageConfig>('storage', () => ({
  endpoint: process.env.S3_ENDPOINT || undefined,
  region: process.env.S3_REGION ?? 'us-east-1',
  bucket: process.env.S3_BUCKET ?? 'agency',
  accessKey: process.env.S3_ACCESS_KEY ?? '',
  secretKey: process.env.S3_SECRET_KEY ?? '',
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  presignTtlSeconds: Number(process.env.S3_PRESIGN_TTL_SECONDS ?? 900),
}));
