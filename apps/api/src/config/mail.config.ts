// SMTP configuration for transactional email.
import { registerAs } from '@nestjs/config';

export interface MailConfig {
  host: string;
  port: number;
  user?: string;
  pass?: string;
  from: string;
}

export default registerAs<MailConfig>('mail', () => ({
  host: process.env.SMTP_HOST ?? 'localhost',
  port: Number(process.env.SMTP_PORT ?? 1025),
  user: process.env.SMTP_USER || undefined,
  pass: process.env.SMTP_PASS || undefined,
  from: process.env.SMTP_FROM ?? 'Agency Panel <noreply@agency.local>',
}));
