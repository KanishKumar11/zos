// TasksModule.
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { TaskComment, TaskCommentSchema } from './schemas/task-comment.schema';
import { Task, TaskSchema } from './schemas/task.schema';
import { TimeEntry, TimeEntrySchema } from './schemas/time-entry.schema';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Task.name, schema: TaskSchema },
      { name: TaskComment.name, schema: TaskCommentSchema },
      { name: TimeEntry.name, schema: TimeEntrySchema },
    ]),
  ],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
