// Turns task events into notifications for the person concerned.
import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { EVENT_NAMES, NotificationType } from '@agency/shared';

import { Task, type TaskDocument } from './schemas/task.schema';

@Injectable()
export class TaskNotificationsListener {
  constructor(
    @InjectModel(Task.name) private readonly tasks: Model<TaskDocument>,
    private readonly events: EventEmitter2,
  ) {}

  @OnEvent(EVENT_NAMES.task.assigned, { async: true })
  async onAssigned(payload: { taskId: string; userId: string; actorId?: string }): Promise<void> {
    if (!payload?.userId || payload.userId === payload.actorId) return;
    const task = await this.tasks.findById(payload.taskId).select('title dueDate').exec();
    if (!task) return;
    this.events.emit(EVENT_NAMES.notification.create, {
      userId: payload.userId,
      type: NotificationType.TASK_ASSIGNED,
      title: `New task: ${task.title}`,
      body: task.dueDate ? `Due ${task.dueDate.toISOString().slice(0, 10)}` : undefined,
      linkPath: `/tasks/${payload.taskId}`,
      data: { taskId: payload.taskId },
    });
  }
}
