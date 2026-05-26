// Seed script — creates the initial OWNER user from SEED_OWNER_* envs. Idempotent.
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';

import { Role, UserStatus } from '@agency/shared';

import { AppModule } from '../app.module';
import { hashPassword } from '../common/utils/password.util';
import { UsersService } from '../modules/users/users.service';

async function run(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const config = app.get(ConfigService);
    const users = app.get(UsersService);

    const email = config.getOrThrow<string>('seed.seedOwnerEmail');
    const password = config.getOrThrow<string>('seed.seedOwnerPassword');
    const name = config.getOrThrow<string>('seed.seedOwnerName');

    const existing = await users.findByEmail(email);
    const passwordHash = await hashPassword(password);
    if (existing) {
      await users.update(existing.id as string, { passwordHash, status: UserStatus.ACTIVE, role: Role.OWNER });
      // eslint-disable-next-line no-console
      console.log(`[seed] owner already exists — role, password and status updated: ${email}`);
      return;
    }
    await users.create({
      email,
      name,
      role: Role.OWNER,
      status: UserStatus.ACTIVE,
      passwordHash,
    });
    // eslint-disable-next-line no-console
    console.log(`[seed] created owner: ${email}`);
  } finally {
    await app.close();
  }
}

void run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
