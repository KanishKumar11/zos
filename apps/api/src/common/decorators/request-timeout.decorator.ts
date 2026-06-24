import { SetMetadata } from '@nestjs/common';

import { TIMEOUT_METADATA_KEY } from '../constants/app.constants';

export const RequestTimeout = (ms: number) => SetMetadata(TIMEOUT_METADATA_KEY, ms);
