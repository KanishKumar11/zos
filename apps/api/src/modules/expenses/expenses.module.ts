import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Project, ProjectSchema } from '../projects/schemas/project.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Expense, ExpenseSchema } from './schemas/expense.schema';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Expense.name, schema: ExpenseSchema },
      { name: Project.name, schema: ProjectSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [ExpensesController],
  providers: [ExpensesService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
