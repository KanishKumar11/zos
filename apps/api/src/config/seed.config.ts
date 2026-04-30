// Seed-only config (separate namespace so production can omit it).
import { registerAs } from '@nestjs/config';

export interface SeedConfig {
  seedOwnerEmail: string;
  seedOwnerPassword: string;
  seedOwnerName: string;
}

export default registerAs<SeedConfig>('seed', () => ({
  seedOwnerEmail: process.env.SEED_OWNER_EMAIL ?? 'owner@local.test',
  seedOwnerPassword: process.env.SEED_OWNER_PASSWORD ?? 'ChangeMe!123',
  seedOwnerName: process.env.SEED_OWNER_NAME ?? 'Owner',
}));
