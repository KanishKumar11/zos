// Client portal API hooks (CLIENT role), plus the owner's "preview as client".
import { useQuery } from '@tanstack/react-query';

import type { ContentVisibility } from '@agency/shared';

import { api, unwrap } from '@/lib/api-client';

export interface PortalFile {
  _id: string;
  name: string;
  contentType?: string;
  sizeBytes?: number;
  description?: string;
  visibility: ContentVisibility;
  createdAt: string;
}

export interface PortalUpdate {
  _id: string;
  projectId: string;
  projectName?: string;
  title: string;
  body: string;
  authorName: string;
  files: PortalFile[];
  createdAt: string;
  editedAt?: string;
}

export interface PortalProjectSummary {
  _id: string;
  name: string;
  code: string;
  status: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  milestoneCount: number;
  milestonesDone: number;
  nextMilestone: { name: string; dueDate?: string } | null;
  /** Journey steps only (no amounts). */
  milestones?: { name: string; dueDate?: string; status: string }[];
  /** The project lead — the client's contact. */
  lead?: { name: string; email: string; title?: string } | null;
}

export interface PortalProject {
  _id: string;
  name: string;
  code: string;
  status: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  currency: string;
  lead: { name: string; email: string } | null;
  /** Who's on the project — names and titles only, never pay. */
  team?: { name: string; title?: string; lead: boolean }[];
  milestones: {
    _id: string;
    name: string;
    amountPaise: number;
    dueDate?: string;
    status: string;
    invoice: { _id: string; number: string; status: string } | null;
  }[];
  updates: PortalUpdate[];
  files: PortalFile[];
  portalVisible?: boolean;
  noClient?: boolean;
}

export interface PortalInvoice {
  _id: string;
  number: string;
  status: string;
  issueDate?: string;
  dueDate?: string;
  currency: string;
  subTotalPaise: number;
  gstPercent: number;
  gstPaise: number;
  totalPaise: number;
  paidPaise: number;
  balancePaise: number;
  projects: string[];
  lineItems?: { description: string; qty: number; unitPaise: number; amountPaise: number }[];
  payments?: { paidAt: string; amountPaise: number; reference?: string; method?: string }[];
  notes?: string;
}

export interface PortalMe {
  user: { id: string; name: string; email: string; phone?: string; title?: string };
  client: { id: string; name: string };
  colleagues: { name: string; email: string; title?: string }[];
}

export interface PortalSummary {
  activeProjects: number;
  totalProjects: number;
  outstandingPaise: number;
  overduePaise: number;
  overdueCount: number;
  paidThisFyPaise: number;
  nextDue: { invoiceId: string; number: string; dueDate: string; balancePaise: number; currency: string } | null;
  recentUpdates: PortalUpdate[];
}

export const portalApi = {
  me: () => unwrap<PortalMe>(api.get('/portal/me')),
  summary: () => unwrap<PortalSummary>(api.get('/portal/summary')),
  projects: () => unwrap<PortalProjectSummary[]>(api.get('/portal/projects')),
  project: (id: string) => unwrap<PortalProject>(api.get(`/portal/projects/${id}`)),
  preview: (id: string) => unwrap<PortalProject>(api.get(`/portal/preview/projects/${id}`)),
  fileUrl: (projectId: string, fileId: string) =>
    unwrap<{ url: string; name: string }>(api.get(`/portal/projects/${projectId}/files/${fileId}/url`)),
  invoices: () => unwrap<PortalInvoice[]>(api.get('/portal/invoices')),
  invoice: (id: string) => unwrap<PortalInvoice>(api.get(`/portal/invoices/${id}`)),
};

export const usePortalMe = () => useQuery({ queryKey: ['portal', 'me'], queryFn: portalApi.me, staleTime: 5 * 60_000 });
export const usePortalSummary = () => useQuery({ queryKey: ['portal', 'summary'], queryFn: portalApi.summary });
export const usePortalProjects = () => useQuery({ queryKey: ['portal', 'projects'], queryFn: portalApi.projects });
export const usePortalProject = (id: string) =>
  useQuery({ queryKey: ['portal', 'project', id], queryFn: () => portalApi.project(id) });
export const usePortalPreview = (id: string) =>
  useQuery({ queryKey: ['portal', 'preview', id], queryFn: () => portalApi.preview(id) });
export const usePortalInvoices = () => useQuery({ queryKey: ['portal', 'invoices'], queryFn: portalApi.invoices });
export const usePortalInvoice = (id: string) =>
  useQuery({ queryKey: ['portal', 'invoice', id], queryFn: () => portalApi.invoice(id) });
