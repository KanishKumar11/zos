// StorageService — wraps S3 (or MinIO) presigned PUT/GET URL generation. Files are uploaded
// directly from browser via presigned PUT, then a small "confirm" API records the key.
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand, PutObjectCommand, S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

export interface PresignPutInput {
  prefix: string;
  filename: string;
  contentType: string;
  expiresInSeconds?: number;
}
export interface PresignPutOutput {
  url: string;
  key: string;
  publicUrl: string;
  expiresIn: number;
}
export interface PresignGetOutput {
  url: string;
  expiresIn: number;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private s3!: S3Client;
  private bucket!: string;
  private endpoint!: string;
  private defaultTtl!: number;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.bucket = this.config.getOrThrow<string>('storage.bucket');
    this.endpoint = this.config.get<string>('storage.endpoint') ?? '';
    this.defaultTtl = this.config.get<number>('storage.presignTtl') ?? 900;
    this.s3 = new S3Client({
      region: this.config.getOrThrow<string>('storage.region'),
      endpoint: this.endpoint || undefined,
      forcePathStyle: this.config.get<boolean>('storage.forcePathStyle') ?? false,
      credentials: {
        accessKeyId: this.config.getOrThrow<string>('storage.accessKey'),
        secretAccessKey: this.config.getOrThrow<string>('storage.secretKey'),
      },
    });
  }

  async presignPut(input: PresignPutInput): Promise<PresignPutOutput> {
    const safeName = input.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `${input.prefix.replace(/^\/+|\/+$/g, '')}/${randomUUID()}-${safeName}`;
    const expiresIn = input.expiresInSeconds ?? this.defaultTtl;
    const url = await getSignedUrl(
      this.s3,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: input.contentType }),
      { expiresIn },
    );
    return { url, key, publicUrl: this.publicUrlFor(key), expiresIn };
  }

  async presignGet(key: string, expiresInSeconds?: number): Promise<PresignGetOutput> {
    const expiresIn = expiresInSeconds ?? this.defaultTtl;
    const url = await getSignedUrl(this.s3, new GetObjectCommand({ Bucket: this.bucket, Key: key }), { expiresIn });
    return { url, expiresIn };
  }

  async putBuffer(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.s3.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
  }

  async delete(key: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  publicUrlFor(key: string): string {
    if (!this.endpoint) return `https://${this.bucket}.s3.amazonaws.com/${key}`;
    return `${this.endpoint.replace(/\/+$/, '')}/${this.bucket}/${key}`;
  }
}
