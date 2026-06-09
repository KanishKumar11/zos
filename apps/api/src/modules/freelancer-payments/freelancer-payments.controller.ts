// FreelancerPaymentsController — OWNER-only.
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';

import { Role } from '@agency/shared';

import { Roles } from '@/common/decorators/roles.decorator';
import { ObjectIdPipe } from '@/common/pipes/object-id.pipe';

import {
  AddFreelancerPaymentEntryDto,
  CreateFreelancerPaymentDto,
  UpdateFreelancerPaymentDto,
} from './dto/freelancer-payment.dto';
import { FreelancerPaymentsService } from './freelancer-payments.service';

@Controller('freelancer-payments')
@Roles(Role.OWNER)
export class FreelancerPaymentsController {
  constructor(private readonly svc: FreelancerPaymentsService) {}

  @Get()
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.svc.list({
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
      status,
    });
  }

  @Get(':id')
  byId(@Param('id', ObjectIdPipe) id: string) {
    return this.svc.byId(id);
  }

  @Get('project/:projectId')
  byProjectId(@Param('projectId', ObjectIdPipe) projectId: string) {
    return this.svc.byProjectId(projectId);
  }

  @Post()
  create(@Body() body: CreateFreelancerPaymentDto) {
    return this.svc.create(body);
  }

  @Patch(':id')
  update(@Param('id', ObjectIdPipe) id: string, @Body() body: UpdateFreelancerPaymentDto) {
    return this.svc.update(id, body);
  }

  @Post(':id/pay')
  addPayment(@Param('id', ObjectIdPipe) id: string, @Body() body: AddFreelancerPaymentEntryDto) {
    return this.svc.addPayment(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ObjectIdPipe) id: string) {
    return this.svc.remove(id).then(() => ({ ok: true }));
  }
}
