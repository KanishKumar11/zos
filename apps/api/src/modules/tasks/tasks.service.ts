// TasksService — task CRUD, kanban move, comments, time entries.
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { type FilterQuery, Model, Types } from 'mongoose';

import {
  EVENT_NAMES,
  Role,
  TaskStatus,
  type CreateCommentInput,
  type CreateTaskInput,
  type CreateTimeEntryInput,
  type ListTasksQuery,
  type MoveTaskInput,
  type UpdateTaskInput,
} from '@agency/shared';

import { ErrorCodes } from '@/common/constants/error-codes';

import { ProjectsService } from '../projects/projects.service';
import { TaskComment, type TaskCommentDocument } from './schemas/task-comment.schema';
import { Task, type TaskDocument } from './schemas/task.schema';
import { TimeEntry, type TimeEntryDocument } from './schemas/time-entry.schema';

@Injectable()
export class TasksService {
  constructor(
    @InjectModel(Task.name) private readonly tasks: Model<TaskDocument>,
    @InjectModel(TaskComment.name) private readonly comments: Model<TaskCommentDocument>,
    @InjectModel(TimeEntry.name) private readonly time: Model<TimeEntryDocument>,
    private readonly projects: ProjectsService,
    private readonly events: EventEmitter2,
  ) {}

  // -- tasks ---------------------------------------------------------------

  async list(q: ListTasksQuery, viewer: { sub: string; role: Role }): Promise<TaskDocument[]> {
    const filter: FilterQuery<TaskDocument> = { deletedAt: { $exists: false } };
    if (q.projectId) {
      await this.projects.byId(q.projectId, viewer); // membership check side-effect
      filter.projectId = new Types.ObjectId(q.projectId);
    }
    if (q.status) filter.status = q.status;
    if (q.assigneeId) filter.assigneeId = new Types.ObjectId(q.assigneeId);
    if (q.mine) filter.assigneeId = new Types.ObjectId(viewer.sub);
    return this.tasks.find(filter).sort({ position: 1, createdAt: -1 }).limit(500).exec();
  }

  async byId(id: string, viewer: { sub: string; role: Role }): Promise<TaskDocument> {
    const doc = await this.tasks.findOne({ _id: id, deletedAt: { $exists: false } }).exec();
    if (!doc) throw new NotFoundException({ code: ErrorCodes.TASK_NOT_FOUND, message: 'Task not found' });
    await this.projects.byId(doc.projectId.toString(), viewer);
    return doc;
  }

  async create(input: CreateTaskInput, actor: { sub: string; role: Role }): Promise<TaskDocument> {
    await this.projects.byId(input.projectId, actor);
    const last = await this.tasks
      .findOne({ projectId: input.projectId, status: input.status ?? TaskStatus.TODO })
      .sort({ position: -1 })
      .exec();
    const doc = await this.tasks.create({
      ...input,
      projectId: new Types.ObjectId(input.projectId),
      assigneeId: input.assigneeId ? new Types.ObjectId(input.assigneeId) : undefined,
      parentId: input.parentId ? new Types.ObjectId(input.parentId) : undefined,
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      createdBy: new Types.ObjectId(actor.sub),
      position: last ? last.position + 1024 : 1024,
    });
    if (doc.assigneeId) {
      this.events.emit(EVENT_NAMES.task.assigned, {
        taskId: doc.id,
        userId: doc.assigneeId.toString(),
      });
    }
    return doc;
  }

  async update(
    id: string,
    input: UpdateTaskInput,
    actor: { sub: string; role: Role },
  ): Promise<TaskDocument> {
    const existing = await this.byId(id, actor);
    const patch: Record<string, unknown> = { ...input };
    if (input.assigneeId !== undefined) {
      patch.assigneeId = input.assigneeId ? new Types.ObjectId(input.assigneeId) : null;
    }
    if (input.dueDate !== undefined) {
      patch.dueDate = input.dueDate ? new Date(input.dueDate) : null;
    }
    if (input.status === TaskStatus.DONE && existing.status !== TaskStatus.DONE) {
      patch.completedAt = new Date();
    }
    const doc = await this.tasks.findByIdAndUpdate(id, patch, { new: true }).exec();
    if (!doc) throw new NotFoundException({ code: ErrorCodes.TASK_NOT_FOUND, message: 'Task not found' });
    if (input.status && input.status !== existing.status) {
      this.events.emit(EVENT_NAMES.task.statusChanged, {
        taskId: doc.id,
        previousStatus: existing.status,
        status: input.status,
      });
    }
    if (
      input.assigneeId &&
      input.assigneeId !== existing.assigneeId?.toString()
    ) {
      this.events.emit(EVENT_NAMES.task.assigned, { taskId: doc.id, userId: input.assigneeId });
    }
    return doc;
  }

  async move(id: string, input: MoveTaskInput, actor: { sub: string; role: Role }): Promise<TaskDocument> {
    const existing = await this.byId(id, actor);
    existing.status = input.status;
    existing.position = input.position;
    if (input.status === TaskStatus.DONE && !existing.completedAt) existing.completedAt = new Date();
    return existing.save();
  }

  async remove(id: string, actor: { sub: string; role: Role }): Promise<void> {
    const existing = await this.byId(id, actor);
    if (
      actor.role !== Role.OWNER &&
      actor.role !== Role.ADMIN &&
      actor.role !== Role.LEAD &&
      existing.createdBy.toString() !== actor.sub
    ) {
      throw new ForbiddenException({ code: ErrorCodes.FORBIDDEN, message: 'Cannot delete this task' });
    }
    existing.deletedAt = new Date();
    await existing.save();
  }

  // -- comments ------------------------------------------------------------

  commentsFor(taskId: string): Promise<TaskCommentDocument[]> {
    return this.comments.find({ taskId }).sort({ createdAt: 1 }).exec();
  }

  async addComment(
    taskId: string,
    input: CreateCommentInput,
    actor: { sub: string; role: Role },
  ): Promise<TaskCommentDocument> {
    await this.byId(taskId, actor);
    return this.comments.create({
      taskId: new Types.ObjectId(taskId),
      authorId: new Types.ObjectId(actor.sub),
      body: input.body,
      mentions: (input.mentions ?? []).map((id) => new Types.ObjectId(id)),
    });
  }

  // -- time entries --------------------------------------------------------

  myTimeEntries(userId: string, dateRange?: { from: string; to: string }): Promise<TimeEntryDocument[]> {
    const filter: FilterQuery<TimeEntryDocument> = { userId };
    if (dateRange) filter.date = { $gte: dateRange.from, $lte: dateRange.to };
    return this.time.find(filter).sort({ date: -1 }).exec();
  }

  async addTimeEntry(
    actor: { sub: string; role: Role },
    input: CreateTimeEntryInput,
  ): Promise<TimeEntryDocument> {
    await this.projects.byId(input.projectId, actor);
    if (input.taskId) await this.byId(input.taskId, actor);
    return this.time.create({
      ...input,
      userId: new Types.ObjectId(actor.sub),
      projectId: new Types.ObjectId(input.projectId),
      taskId: input.taskId ? new Types.ObjectId(input.taskId) : undefined,
    });
  }
}
