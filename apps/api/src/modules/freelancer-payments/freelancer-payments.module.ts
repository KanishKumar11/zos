import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  FreelancerPayment,
  FreelancerPaymentSchema,
} from './schemas/freelancer-payment.schema';
import { FreelancerPaymentsController } from './freelancer-payments.controller';
import { FreelancerPaymentsService } from './freelancer-payments.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FreelancerPayment.name, schema: FreelancerPaymentSchema },
    ]),
  ],
  controllers: [FreelancerPaymentsController],
  providers: [FreelancerPaymentsService],
  exports: [FreelancerPaymentsService],
})
export class FreelancerPaymentsModule {}
