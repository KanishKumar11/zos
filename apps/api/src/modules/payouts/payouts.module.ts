import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { FreelancerPayment, FreelancerPaymentSchema } from '../freelancer-payments/schemas/freelancer-payment.schema';
import { Freelancer, FreelancerSchema } from '../freelancers/schemas/freelancer.schema';
import { Project, ProjectSchema } from '../projects/schemas/project.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { MeEarningsController, PayoutsController } from './payouts.controller';
import { PayoutsService } from './payouts.service';
import { Payout, PayoutSchema } from './schemas/payout.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Payout.name, schema: PayoutSchema },
      { name: Project.name, schema: ProjectSchema },
      { name: User.name, schema: UserSchema },
      { name: Freelancer.name, schema: FreelancerSchema },
      { name: FreelancerPayment.name, schema: FreelancerPaymentSchema },
    ]),
  ],
  controllers: [PayoutsController, MeEarningsController],
  providers: [PayoutsService],
  exports: [PayoutsService, MongooseModule],
})
export class PayoutsModule {}
