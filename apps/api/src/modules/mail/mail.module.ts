// MailModule — global so any feature module can inject MailService directly.
import { Global, Module } from '@nestjs/common';

import { MailService } from './mail.service';

@Global()
@Module({ providers: [MailService], exports: [MailService] })
export class MailModule {}
