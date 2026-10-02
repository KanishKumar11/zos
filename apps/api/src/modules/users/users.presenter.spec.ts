import mongoose from 'mongoose';

import { Role, UserStatus } from '@agency/shared';

import { User, UserSchema, type UserDocument } from './schemas/user.schema';
import { presentUser } from './users.presenter';

// Offline model — no DB connection needed to build documents and call toJSON().
const UserModel = mongoose.model(`${User.name}PresenterSpec`, UserSchema as unknown as mongoose.Schema);

const makeUser = (): UserDocument =>
  new UserModel({
    email: 'alice@example.com',
    passwordHash: '$2b$10$secret-hash',
    name: 'Alice',
    role: Role.MEMBER,
    status: UserStatus.ACTIVE,
    tokenVersion: 3,
    dateOfBirth: new Date('1995-05-05'),
    bankDetails: {
      accountHolderName: 'Alice',
      accountNumberEncrypted: 'cipher-text',
      accountNumberLast4: '1234',
      ifsc: 'HDFC0000001',
      bankName: 'HDFC',
    },
    documents: [{ kind: 'ID_PROOF', name: 'Aadhaar.pdf', key: 'users/x/documents/secret.pdf' }],
  }) as unknown as UserDocument;

describe('presentUser', () => {
  it('never exposes secrets, even to the owner', () => {
    const doc = makeUser();
    const out = presentUser(doc, { sub: 'owner', role: Role.OWNER });
    const json = JSON.stringify(out);
    expect(json).not.toContain('secret-hash');
    expect(json).not.toContain('cipher-text');
    expect(json).not.toContain('secret.pdf');
    expect(out).not.toHaveProperty('tokenVersion');
    expect(out.bankDetails.accountNumberLast4).toBe('1234');
  });

  it('also strips secrets when the raw document is serialized', () => {
    const json = JSON.stringify(makeUser());
    expect(json).not.toContain('secret-hash');
    expect(json).not.toContain('cipher-text');
  });

  it('lets users see their own bank details', () => {
    const doc = makeUser();
    const out = presentUser(doc, { sub: String(doc._id), role: Role.MEMBER });
    expect(out.bankDetails).toBeDefined();
    expect(out.documents).toHaveLength(1);
  });

  it('hides bank details from admins, and documents and birthday from leads', () => {
    const doc = makeUser();
    const admin = presentUser(doc, { sub: 'admin', role: Role.ADMIN });
    expect(admin).not.toHaveProperty('bankDetails');
    expect(admin.documents).toHaveLength(1);

    const lead = presentUser(doc, { sub: 'lead', role: Role.LEAD });
    expect(lead).not.toHaveProperty('bankDetails');
    expect(lead).not.toHaveProperty('documents');
    expect(lead).not.toHaveProperty('dateOfBirth');
  });
});
