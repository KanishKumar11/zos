// Invoices controller (OWNER only).
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';

import {
  InvoiceStatus,
  Role,
  createInvoiceSchema,
  recordPaymentSchema,
  updateInvoiceSchema,
  type CreateInvoiceInput,
  type RecordPaymentInput,
  type UpdateInvoiceInput,
} from '@agency/shared';

import { Roles } from '@/common/decorators/roles.decorator';
import { ObjectIdPipe } from '@/common/pipes/object-id.pipe';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';

import { InvoicesService } from './invoices.service';

@Controller('invoices')
@Roles(Role.OWNER)
export class InvoicesController {
  constructor(private readonly svc: InvoicesService) {}

  @Get()
  list(
    @Query('status') status?: InvoiceStatus,
    @Query('clientId') clientId?: string,
  ) {
    return this.svc.list({ status, clientId });
  }

  @Get(':id')
  byId(@Param('id', ObjectIdPipe) id: string) {
    return this.svc.byId(id);
  }

  @Post()
  create(@Body(new ZodValidationPipe(createInvoiceSchema)) body: CreateInvoiceInput) {
    return this.svc.create(body);
  }

  @Patch(':id')
  update(
    @Param('id', ObjectIdPipe) id: string,
    @Body(new ZodValidationPipe(updateInvoiceSchema)) body: UpdateInvoiceInput,
  ) {
    return this.svc.update(id, body);
  }

  @Post(':id/send')
  send(@Param('id', ObjectIdPipe) id: string) {
    return this.svc.send(id);
  }

  @Post(':id/payments')
  pay(
    @Param('id', ObjectIdPipe) id: string,
    @Body(new ZodValidationPipe(recordPaymentSchema)) body: RecordPaymentInput,
  ) {
    return this.svc.recordPayment(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ObjectIdPipe) id: string) {
    return this.svc.remove(id).then(() => ({ ok: true }));
  }
}
