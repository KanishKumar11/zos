// Invoices controller (OWNER only).
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';

import {
  Role,
  createInvoiceSchema,
  listInvoicesQuerySchema,
  recordPaymentSchema,
  updateInvoiceSchema,
  writeOffInvoiceSchema,
  type CreateInvoiceInput,
  type ListInvoicesQuery,
  type RecordPaymentInput,
  type UpdateInvoiceInput,
  type WriteOffInvoiceInput,
} from '@agency/shared';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequestTimeout } from '@/common/decorators/request-timeout.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import type { JwtPayload } from '@/common/interfaces/jwt-payload.interface';
import { ObjectIdPipe } from '@/common/pipes/object-id.pipe';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';

import { InvoicesService } from './invoices.service';

@Controller('invoices')
@Roles(Role.OWNER)
export class InvoicesController {
  constructor(private readonly svc: InvoicesService) {}

  /** Without `page`: plain array of every match. With `page`: paginated `{ items, meta }` + filtered totals. */
  @Get()
  list(@Query(new ZodValidationPipe(listInvoicesQuerySchema)) q: ListInvoicesQuery) {
    return this.svc.list(q);
  }

  @Get('dashboard')
  dashboard() {
    return this.svc.dashboard();
  }

  @Get('aging')
  aging() {
    return this.svc.aging();
  }

  @Get('next-number')
  async nextNumber() {
    return { number: await this.svc.nextInvoiceNumber(new Date()) };
  }

  @Get(':id')
  byId(@Param('id', ObjectIdPipe) id: string) {
    return this.svc.view(id);
  }

  @Get(':id/pdf')
  @RequestTimeout(60_000)
  async pdf(@Param('id', ObjectIdPipe) id: string, @Res() res: Response) {
    const { buffer, filename } = await this.svc.invoicePdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(buffer);
  }

  @Post()
  async create(
    @CurrentUser() actor: JwtPayload,
    @Body(new ZodValidationPipe(createInvoiceSchema)) body: CreateInvoiceInput,
  ) {
    return this.svc.presentOne(await this.svc.create(body, actor));
  }

  @Patch(':id')
  async update(
    @Param('id', ObjectIdPipe) id: string,
    @CurrentUser() actor: JwtPayload,
    @Body(new ZodValidationPipe(updateInvoiceSchema)) body: UpdateInvoiceInput,
  ) {
    return this.svc.presentOne(await this.svc.update(id, body, actor));
  }

  @Post(':id/send')
  async send(@Param('id', ObjectIdPipe) id: string, @CurrentUser() actor: JwtPayload) {
    return this.svc.presentOne(await this.svc.send(id, actor));
  }

  @Post(':id/write-off')
  async writeOff(
    @Param('id', ObjectIdPipe) id: string,
    @CurrentUser() actor: JwtPayload,
    @Body(new ZodValidationPipe(writeOffInvoiceSchema)) body: WriteOffInvoiceInput,
  ) {
    return this.svc.presentOne(await this.svc.writeOff(id, body.reason, actor));
  }

  @Post(':id/reopen')
  async reopen(@Param('id', ObjectIdPipe) id: string, @CurrentUser() actor: JwtPayload) {
    return this.svc.presentOne(await this.svc.reopen(id, actor));
  }

  @Post(':id/duplicate')
  async duplicate(@Param('id', ObjectIdPipe) id: string, @CurrentUser() actor: JwtPayload) {
    return this.svc.presentOne(await this.svc.duplicate(id, actor));
  }

  @Post(':id/payments')
  async pay(
    @Param('id', ObjectIdPipe) id: string,
    @CurrentUser() actor: JwtPayload,
    @Body(new ZodValidationPipe(recordPaymentSchema)) body: RecordPaymentInput,
  ) {
    return this.svc.presentOne(await this.svc.recordPayment(id, body, actor));
  }

  @Delete(':id/payments/:paymentId')
  async removePayment(
    @Param('id', ObjectIdPipe) id: string,
    @Param('paymentId', ObjectIdPipe) paymentId: string,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.svc.presentOne(await this.svc.removePayment(id, paymentId, actor));
  }

  @Delete(':id')
  remove(@Param('id', ObjectIdPipe) id: string, @CurrentUser() actor: JwtPayload) {
    return this.svc.remove(id, actor).then(() => ({ ok: true }));
  }
}
