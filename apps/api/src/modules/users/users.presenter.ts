// Users presenter — trims a user record to what the viewer may see. Secrets (password hash,
// encrypted account number, storage keys) are already removed by the schema's toJSON transform.
import { Role } from '@agency/shared';

import type { Paginated } from '@/common/utils/pagination.util';

import type { UserDocument } from './schemas/user.schema';

export interface UserViewer {
  sub: string;
  role: Role;
}

type Plain = Record<string, any>;

export function presentUser(doc: UserDocument, viewer: UserViewer): Plain {
  const u = doc.toJSON() as Plain;
  const isSelf = String(u._id) === viewer.sub;
  if (!isSelf && viewer.role !== Role.OWNER) delete u.bankDetails;
  if (!isSelf && viewer.role !== Role.OWNER && viewer.role !== Role.ADMIN) {
    delete u.documents;
    delete u.dateOfBirth;
  }
  return u;
}

export function presentUsers(page: Paginated<UserDocument>, viewer: UserViewer): Paginated<Plain> {
  return { ...page, items: page.items.map((d) => presentUser(d, viewer)) };
}
