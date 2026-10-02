import { Module } from '@nestjs/common';

import { PayoutsModule } from '../payouts/payouts.module';
import { FreelancersController } from './freelancers.controller';
import { FreelancersService } from './freelancers.service';

@Module({
  imports: [PayoutsModule],
  controllers: [FreelancersController],
  providers: [FreelancersService],
})
export class FreelancersModule {}
