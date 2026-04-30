// Aggregated React Query key factories. Each resource has its own factory below.
export const queryKeys = {
  auth: {
    me: () => ['auth', 'me'] as const,
  },
  users: {
    all: () => ['users'] as const,
    list: (params?: Record<string, unknown>) => ['users', 'list', params] as const,
    byId: (id: string) => ['users', 'detail', id] as const,
  },
  departments: {
    all: ['departments'] as const,
    list: () => ['departments', 'list'] as const,
    byId: (id: string) => ['departments', 'detail', id] as const,
  },
  designations: {
    all: ['designations'] as const,
    list: (params?: Record<string, unknown>) => ['designations', 'list', params] as const,
    byId: (id: string) => ['designations', 'detail', id] as const,
  },
  holidays: {
    all: (year?: number) => ['holidays', year] as const,
  },
  settings: {
    all: () => ['settings'] as const,
  },
  compensation: {
    byUser: (userId: string) => ['compensation', userId] as const,
  },
  attendance: {
    me: (month: string) => ['attendance', 'me', month] as const,
    team: (params: Record<string, unknown>) => ['attendance', 'team', params] as const,
  },
  leaves: {
    me: () => ['leaves', 'me'] as const,
    pending: () => ['leaves', 'pending'] as const,
    balance: (userId: string) => ['leaves', 'balance', userId] as const,
  },
  payroll: {
    runs: (params?: Record<string, unknown>) => ['payroll', 'runs', params] as const,
    run: (id: string) => ['payroll', 'run', id] as const,
    payslips: (userId?: string) => ['payroll', 'payslips', userId] as const,
  },
  announcements: {
    all: () => ['announcements'] as const,
    feed: () => ['announcements', 'feed'] as const,
  },
  notifications: {
    inbox: () => ['notifications', 'inbox'] as const,
    unreadCount: () => ['notifications', 'unread-count'] as const,
  },
  projects: {
    all: () => ['projects'] as const,
    byId: (id: string) => ['projects', id] as const,
  },
  tasks: {
    byProject: (projectId: string, view?: string) => ['tasks', projectId, view] as const,
    byId: (id: string) => ['tasks', 'detail', id] as const,
    mine: () => ['tasks', 'mine'] as const,
  },
  sows: {
    all: () => ['sows'] as const,
    byProject: (projectId: string) => ['sows', 'project', projectId] as const,
    byId: (id: string) => ['sows', 'detail', id] as const,
  },
  dashboard: {
    owner: () => ['dashboard', 'owner'] as const,
    member: () => ['dashboard', 'member'] as const,
  },
  clients: {
    all: () => ['clients'] as const,
    byId: (id: string) => ['clients', id] as const,
  },
  crm: {
    pipeline: () => ['crm', 'pipeline'] as const,
    opp: (id: string) => ['crm', 'opp', id] as const,
  },
  invoices: {
    all: (params?: Record<string, unknown>) => ['invoices', params] as const,
    byId: (id: string) => ['invoices', id] as const,
  },
  audit: {
    list: (params?: Record<string, unknown>) => ['audit', params] as const,
  },
} as const;

/** Short alias for ergonomic imports. */
export const qk = queryKeys;
