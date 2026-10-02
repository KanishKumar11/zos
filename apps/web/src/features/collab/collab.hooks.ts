// Project updates + files hooks (staff side). The portal has its own read-only hooks.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import type { ContentVisibility, CreateProjectUpdateInput, UpdateProjectFileInput, UpdateProjectUpdateInput } from '@agency/shared';

import { api, unwrap } from '@/lib/api-client';

export interface ProjectFileRow {
  _id: string;
  projectId: string;
  name: string;
  contentType?: string;
  sizeBytes?: number;
  description?: string;
  visibility: ContentVisibility;
  uploadedBy?: string;
  uploadedByName?: string;
  createdAt: string;
}

export interface ProjectUpdateRow {
  _id: string;
  projectId: string;
  title: string;
  body: string;
  visibility: ContentVisibility;
  authorId: string;
  authorName: string;
  files: ProjectFileRow[];
  createdAt: string;
  editedAt?: string;
}

const base = (projectId: string) => `/projects/${projectId}`;

export const collabApi = {
  updates: (projectId: string) => unwrap<ProjectUpdateRow[]>(api.get(`${base(projectId)}/updates`)),
  createUpdate: (projectId: string, body: CreateProjectUpdateInput) =>
    unwrap<ProjectUpdateRow>(api.post(`${base(projectId)}/updates`, body)),
  editUpdate: (projectId: string, id: string, body: UpdateProjectUpdateInput) =>
    unwrap<ProjectUpdateRow>(api.patch(`${base(projectId)}/updates/${id}`, body)),
  removeUpdate: (projectId: string, id: string) => unwrap<{ ok: true }>(api.delete(`${base(projectId)}/updates/${id}`)),
  files: (projectId: string) => unwrap<ProjectFileRow[]>(api.get(`${base(projectId)}/files`)),
  editFile: (projectId: string, id: string, body: UpdateProjectFileInput) =>
    unwrap<ProjectFileRow>(api.patch(`${base(projectId)}/files/${id}`, body)),
  removeFile: (projectId: string, id: string) => unwrap<{ ok: true }>(api.delete(`${base(projectId)}/files/${id}`)),
  fileUrl: (projectId: string, id: string) =>
    unwrap<{ url: string; name: string }>(api.get(`${base(projectId)}/files/${id}/url`)),
  /** Presign → PUT to storage → register. Returns the registered file. */
  upload: async (projectId: string, file: File, visibility: ContentVisibility, onProgress?: (pct: number) => void) => {
    const contentType = file.type || 'application/octet-stream';
    const presign = await unwrap<{ url: string; key: string }>(
      api.post(`${base(projectId)}/files/presign`, { filename: file.name, contentType, sizeBytes: file.size }),
    );
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', presign.url);
      xhr.setRequestHeader('Content-Type', contentType);
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
      xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
      xhr.onerror = () => reject(new Error('Upload failed — check your connection and try again'));
      xhr.send(file);
    });
    return unwrap<ProjectFileRow>(
      api.post(`${base(projectId)}/files`, { key: presign.key, name: file.name, contentType, sizeBytes: file.size, visibility }),
    );
  },
};

export function useProjectUpdates(projectId: string | undefined) {
  return useQuery({ queryKey: ['collab', projectId, 'updates'], queryFn: () => collabApi.updates(projectId!), enabled: !!projectId });
}

export function useProjectFiles(projectId: string | undefined) {
  return useQuery({ queryKey: ['collab', projectId, 'files'], queryFn: () => collabApi.files(projectId!), enabled: !!projectId });
}

function useCollabMutation<V, R>(projectId: string, fn: (v: V) => Promise<R>, success?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collab', projectId] });
      if (success) toast.success(success);
    },
  });
}

export const useCreateProjectUpdate = (projectId: string) =>
  useCollabMutation(projectId, (body: CreateProjectUpdateInput) => collabApi.createUpdate(projectId, body), 'Update posted');
export const useEditProjectUpdate = (projectId: string) =>
  useCollabMutation(projectId, (v: { id: string; body: UpdateProjectUpdateInput }) => collabApi.editUpdate(projectId, v.id, v.body), 'Update saved');
export const useRemoveProjectUpdate = (projectId: string) =>
  useCollabMutation(projectId, (id: string) => collabApi.removeUpdate(projectId, id), 'Update deleted');
export const useEditProjectFile = (projectId: string) =>
  useCollabMutation(projectId, (v: { id: string; body: UpdateProjectFileInput }) => collabApi.editFile(projectId, v.id, v.body), 'File updated');
export const useRemoveProjectFile = (projectId: string) =>
  useCollabMutation(projectId, (id: string) => collabApi.removeFile(projectId, id), 'File deleted');

export const formatBytes = (n?: number): string => {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};
