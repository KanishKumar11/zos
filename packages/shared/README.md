# @agency/shared

[SHARED] Cross-app package containing Zod schemas, enums, constants, and types used by both
`apps/web` and `apps/api`. Single source of truth for validation contracts and RBAC enums.

## Usage

```ts
import { Role, loginSchema, type ApiResponse } from '@agency/shared';
```

Subpath imports also work:

```ts
import { Role } from '@agency/shared/enums';
import { loginSchema } from '@agency/shared/schemas';
```

## Conventions

- Enums are `UPPER_SNAKE` string enums.
- Schemas live in `src/schemas/<resource>.schema.ts` and export both the Zod schema and a TS type via `z.infer`.
- Owner-only fields are documented in `constants/owner-only-fields.const.ts`.
