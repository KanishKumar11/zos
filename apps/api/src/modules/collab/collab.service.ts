// CollabService — project updates and files for the team, with an opt-in "share with client" flag
// that the client portal reads. Every read/write checks project access first.
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import {
  AuditAction,
  EVENT_NAMES,
  NotificationType,
  Role,
  type ContentVisibility,
  type CreateProjectUpdateInput,
  type PresignProjectFileInput,
  type RegisterProjectFileInput,
  type UpdateProjectFileInput,
  type UpdateProjectUpdateInput,
} from '@agency/shared';

import { ErrorCodes } from '@/common/constants/error-codes';
import { emitAudit } from '@/common/utils/audit.util';

import { Project, type ProjectDocument } from '../projects/schemas/project.schema';
import { StorageService } from '../storage/storage.service';
import { User, type UserDocument } from '../users/schemas/user.schema';
import { ProjectFile, type ProjectFileDocument } from './schemas/project-file.schema';
import { ProjectUpdate, type ProjectUpdateDocument } from './schemas/project-update.schema';

export interface Viewer {
  sub: string;
  role: Role;
}

/** Who may share things with the client. */
const CAN_SHARE = new Set<Role>([Role.OWNER, Role.ADMIN, Role.LEAD]);

@Injectable()
export class CollabService {
  constructor(
    @InjectModel(ProjectUpdate.name) private readonly updates: Model<ProjectUpdateDocument>,
    @InjectModel(ProjectFile.name) private readonly files: Model<ProjectFileDocument>,
    @InjectModel(Project.name) private readonly projects: Model<ProjectDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    private readonly storage: StorageService,
    private readonly events: EventEmitter2,
  ) {}

  // ── Access ───────────────────────────────────────────────────────────────────────

  async projectForStaff(projectId: string, viewer: Viewer): Promise<ProjectDocument> {
    const project = await this.projects.findOne({ _id: projectId, deletedAt: { $exists: false } }).exec();
    if (!project) throw new NotFoundException({ code: ErrorCodes.PROJECT_NOT_FOUND, message: 'Project not found' });
    if (viewer.role === Role.OWNER || viewer.role === Role.ADMIN) return project;
    if (!project.members.some((m) => m.userId.toString() === viewer.sub)) {
      throw new ForbiddenException({ code: ErrorCodes.FORBIDDEN, message: 'Not a project member' });
    }
    return project;
  }

  /** Portal access: the project must belong to the client and be visible in the portal. */
  async projectForClient(projectId: string, clientId: string): Promise<ProjectDocument> {
    const project = await this.projects
      .findOne({ _id: projectId, clientId: new Types.ObjectId(clientId), portalVisible: { $ne: false }, deletedAt: { $exists: false } })
      .exec();
    if (!project) throw new NotFoundException({ code: ErrorCodes.PROJECT_NOT_FOUND, message: 'Project not found' });
    return project;
  }

  private assertCanShare(visibility: ContentVisibility | undefined, viewer: Viewer) {
    if (visibility === 'CLIENT' && !CAN_SHARE.has(viewer.role)) {
      throw new ForbiddenException({ code: ErrorCodes.FORBIDDEN, message: 'Only leads, admins and the owner can share with the client' });
    }
  }

  // ── Updates ──────────────────────────────────────────────────────────────────────

  async listUpdates(projectId: string, opts: { clientOnly?: boolean } = {}) {
    const docs = await this.updates
      .find({
        projectId: new Types.ObjectId(projectId),
        deletedAt: { $exists: false },
        ...(opts.clientOnly ? { visibility: 'CLIENT' } : {}),
      })
      .sort({ createdAt: -1 })
      .limit(200)
      .exec();
    const [authors, files] = await Promise.all([
      this.users.find({ _id: { $in: docs.map((d) => d.authorId) } }).select('name role').exec(),
      this.files
        .find({
          _id: { $in: docs.flatMap((d) => d.fileIds) },
          deletedAt: { $exists: false },
          ...(opts.clientOnly ? { visibility: 'CLIENT' } : {}),
        })
        .exec(),
    ]);
    const authorMap = new Map(authors.map((a) => [a.id as string, a]));
    const fileMap = new Map(files.map((f) => [f.id as string, f]));
    return docs.map((d) => ({
      _id: d.id,
      projectId: d.projectId.toString(),
      title: d.title,
      body: d.body,
      visibility: d.visibility,
      authorId: d.authorId.toString(),
      authorName: authorMap.get(d.authorId.toString())?.name ?? 'Former team member',
      files: d.fileIds.flatMap((id) => {
        const f = fileMap.get(id.toString());
        return f ? [this.presentFile(f as unknown as ProjectFileDocument)] : [];
      }),
      createdAt: (d as unknown as { createdAt: Date }).createdAt,
      editedAt: d.editedAt,
    }));
  }

  async createUpdate(projectId: string, input: CreateProjectUpdateInput, viewer: Viewer) {
    const project = await this.projectForStaff(projectId, viewer);
    const visibility = input.visibility ?? 'INTERNAL';
    this.assertCanShare(visibility, viewer);
    const fileIds = await this.validFileIds(project._id as Types.ObjectId, input.fileIds ?? []);
    const doc = await this.updates.create({
      projectId: project._id,
      authorId: new Types.ObjectId(viewer.sub),
      title: input.title.trim(),
      body: input.body.trim(),
      visibility,
      fileIds,
    });
    if (visibility === 'CLIENT') {
      // Attached files become visible too, otherwise the client would see broken attachments.
      await this.files.updateMany({ _id: { $in: fileIds } }, { $set: { visibility: 'CLIENT' } });
    }
    await this.notifyUpdate(project, doc, viewer.sub, visibility === 'CLIENT');
    emitAudit(this.events, {
      actorId: viewer.sub,
      action: AuditAction.PROJECT_UPDATE_POSTED,
      entity: 'project',
      entityId: project.id,
      summary: `${doc.title}${visibility === 'CLIENT' ? ' (shared with client)' : ''}`,
    });
    return (await this.listUpdates(project.id)).find((u) => u._id === doc.id);
  }

  async editUpdate(projectId: string, updateId: string, input: UpdateProjectUpdateInput, viewer: Viewer) {
    const project = await this.projectForStaff(projectId, viewer);
    const doc = await this.updates.findOne({ _id: updateId, projectId: project._id, deletedAt: { $exists: false } }).exec();
    if (!doc) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Update not found' });
    this.assertAuthorOrManager(doc.authorId.toString(), viewer);
    this.assertCanShare(input.visibility, viewer);
    const becameShared = input.visibility === 'CLIENT' && doc.visibility !== 'CLIENT';
    if (input.title !== undefined) doc.title = input.title;
    if (input.body !== undefined) doc.body = input.body;
    if (input.visibility !== undefined) doc.visibility = input.visibility;
    doc.editedAt = new Date();
    await doc.save();
    if (becameShared) {
      await this.files.updateMany({ _id: { $in: doc.fileIds } }, { $set: { visibility: 'CLIENT' } });
      await this.notifyClient(project, doc.title);
    }
    return (await this.listUpdates(project.id)).find((u) => u._id === doc.id);
  }

  async removeUpdate(projectId: string, updateId: string, viewer: Viewer) {
    const project = await this.projectForStaff(projectId, viewer);
    const doc = await this.updates.findOne({ _id: updateId, projectId: project._id, deletedAt: { $exists: false } }).exec();
    if (!doc) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'Update not found' });
    this.assertAuthorOrManager(doc.authorId.toString(), viewer);
    doc.deletedAt = new Date();
    await doc.save();
    return { ok: true };
  }

  // ── Files ────────────────────────────────────────────────────────────────────────

  async listFiles(projectId: string, opts: { clientOnly?: boolean } = {}) {
    const docs = await this.files
      .find({
        projectId: new Types.ObjectId(projectId),
        deletedAt: { $exists: false },
        ...(opts.clientOnly ? { visibility: 'CLIENT' } : {}),
      })
      .sort({ createdAt: -1 })
      .exec();
    const uploaders = await this.users.find({ _id: { $in: docs.map((d) => d.uploadedBy).filter(Boolean) } }).select('name').exec();
    const names = new Map(uploaders.map((u) => [u.id as string, u.name]));
    return docs.map((d) => ({ ...this.presentFile(d), uploadedByName: d.uploadedBy ? names.get(d.uploadedBy.toString()) : undefined }));
  }

  async presignFile(projectId: string, input: PresignProjectFileInput, viewer: Viewer) {
    const project = await this.projectForStaff(projectId, viewer);
    return this.storage.presignPut({
      prefix: `projects/${project.id}/files`,
      filename: input.filename,
      contentType: input.contentType,
    });
  }

  async registerFile(projectId: string, input: RegisterProjectFileInput, viewer: Viewer) {
    const project = await this.projectForStaff(projectId, viewer);
    const visibility = input.visibility ?? 'INTERNAL';
    this.assertCanShare(visibility, viewer);
    if (!input.key.startsWith(`projects/${project.id}/files/`) || input.key.includes('..')) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: "That upload doesn't belong to this project" });
    }
    const doc = await this.files.create({
      projectId: project._id,
      key: input.key,
      name: input.name,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      description: input.description ?? '',
      visibility,
      uploadedBy: new Types.ObjectId(viewer.sub),
    });
    if (visibility === 'CLIENT') await this.notifyClient(project, `New file: ${doc.name}`);
    return this.presentFile(doc);
  }

  async editFile(projectId: string, fileId: string, input: UpdateProjectFileInput, viewer: Viewer) {
    const project = await this.projectForStaff(projectId, viewer);
    const doc = await this.fileOrThrow(project._id as Types.ObjectId, fileId);
    this.assertAuthorOrManager(doc.uploadedBy?.toString(), viewer);
    this.assertCanShare(input.visibility, viewer);
    const becameShared = input.visibility === 'CLIENT' && doc.visibility !== 'CLIENT';
    Object.assign(doc, input);
    await doc.save();
    if (becameShared) await this.notifyClient(project, `New file: ${doc.name}`);
    return this.presentFile(doc);
  }

  async removeFile(projectId: string, fileId: string, viewer: Viewer) {
    const project = await this.projectForStaff(projectId, viewer);
    const doc = await this.fileOrThrow(project._id as Types.ObjectId, fileId);
    this.assertAuthorOrManager(doc.uploadedBy?.toString(), viewer);
    doc.deletedAt = new Date();
    await doc.save();
    return { ok: true };
  }

  async fileUrl(projectId: string, fileId: string, opts: { clientOnly?: boolean } = {}) {
    const doc = await this.fileOrThrow(new Types.ObjectId(projectId), fileId);
    if (opts.clientOnly && doc.visibility !== 'CLIENT') {
      throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'File not found' });
    }
    const { url, expiresIn } = await this.storage.presignGet(doc.key, 300);
    return { url, expiresIn, name: doc.name };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────────

  private presentFile(f: ProjectFileDocument) {
    return {
      _id: f.id as string,
      projectId: f.projectId.toString(),
      name: f.name,
      contentType: f.contentType,
      sizeBytes: f.sizeBytes,
      description: f.description,
      visibility: f.visibility,
      uploadedBy: f.uploadedBy?.toString(),
      createdAt: (f as unknown as { createdAt: Date }).createdAt,
    };
  }

  private async fileOrThrow(projectId: Types.ObjectId, fileId: string) {
    const doc = await this.files.findOne({ _id: fileId, projectId, deletedAt: { $exists: false } }).exec();
    if (!doc) throw new NotFoundException({ code: ErrorCodes.NOT_FOUND, message: 'File not found' });
    return doc;
  }

  private async validFileIds(projectId: Types.ObjectId, ids: string[]): Promise<Types.ObjectId[]> {
    if (ids.length === 0) return [];
    const found = await this.files.find({ _id: { $in: ids }, projectId, deletedAt: { $exists: false } }).select('_id').exec();
    if (found.length !== ids.length) {
      throw new BadRequestException({ code: ErrorCodes.VALIDATION_ERROR, message: 'Some attachments are not files on this project' });
    }
    return found.map((f) => f._id as Types.ObjectId);
  }

  private assertAuthorOrManager(authorId: string | undefined, viewer: Viewer) {
    if (authorId === viewer.sub || viewer.role === Role.OWNER || viewer.role === Role.ADMIN) return;
    throw new ForbiddenException({ code: ErrorCodes.FORBIDDEN, message: 'Only the author, an admin or the owner can change this' });
  }

  private async notifyUpdate(project: ProjectDocument, update: ProjectUpdateDocument, authorId: string, shared: boolean) {
    for (const m of project.members) {
      const userId = m.userId.toString();
      if (userId === authorId) continue;
      this.events.emit(EVENT_NAMES.notification.create, {
        userId,
        type: NotificationType.PROJECT_UPDATE,
        title: `${project.name}: ${update.title}`,
        body: update.body.slice(0, 280),
        linkPath: `/projects/${project.id}?tab=updates`,
        data: { projectId: project.id, noEmail: true },
      });
    }
    if (shared) await this.notifyClient(project, update.title);
  }

  /** Tell the client's portal users something new was shared. */
  private async notifyClient(project: ProjectDocument, title: string) {
    if (!project.clientId || project.portalVisible === false) return;
    const clientUsers = await this.users
      .find({ role: Role.CLIENT, clientId: project.clientId, status: 'ACTIVE', deletedAt: { $exists: false } })
      .select('_id')
      .exec();
    for (const u of clientUsers) {
      this.events.emit(EVENT_NAMES.notification.create, {
        userId: u.id,
        type: NotificationType.PROJECT_UPDATE,
        title: `${project.name}: ${title}`,
        linkPath: `/portal/projects/${project.id}`,
        data: { projectId: project.id },
      });
    }
  }
}
