// Command palette (Ctrl/⌘ K) — jump to any page, project, client or person, or run a quick action.
'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Building2, FolderKanban, Search, UserRound, type LucideIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Role } from '@agency/shared';

import { api, unwrap, unwrapPaginated } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/store/auth.store';
import { useQuickActions } from '@/store/quick-actions.store';

import { navForRole } from './nav-config';
import { useNewActions } from './quick-actions';

interface Item {
  id: string;
  group: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  run: () => void;
  keywords?: string;
}

function useDebounced<T>(value: T, ms = 200): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function CommandPalette() {
  const open = useQuickActions((s) => s.paletteOpen);
  const setOpen = useQuickActions((s) => s.setPaletteOpen);
  const role = useAuthStore((s) => s.user?.role);
  const router = useRouter();
  const actions = useNewActions();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const q = useDebounced(query.trim());
  const searching = open && q.length >= 2;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!useQuickActions.getState().paletteOpen);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const projects = useQuery({
    queryKey: ['palette', 'projects', q],
    enabled: searching,
    queryFn: () =>
      unwrapPaginated<{ _id: string; name: string; code: string }>(
        api.get('/projects', { params: { q, pageSize: 6 } }),
      ),
  });
  const canSeeClients = role === Role.OWNER;
  const clients = useQuery({
    queryKey: ['palette', 'clients', q],
    enabled: searching && canSeeClients,
    queryFn: () => unwrap<{ _id: string; name: string }[]>(api.get('/clients', { params: { search: q } })),
  });
  const canSeePeople = role === Role.OWNER || role === Role.ADMIN || role === Role.LEAD;
  const people = useQuery({
    queryKey: ['palette', 'people', q],
    enabled: searching && canSeePeople,
    queryFn: () =>
      unwrapPaginated<{ _id: string; name: string; email: string }>(
        api.get('/users', { params: { q, pageSize: 6 } }),
      ),
  });

  const go = (href: string) => () => {
    setOpen(false);
    router.push(href);
  };

  const items = useMemo<Item[]>(() => {
    const needle = query.trim().toLowerCase();
    const match = (i: Item) => !needle || `${i.label} ${i.keywords ?? ''}`.toLowerCase().includes(needle);

    const quick: Item[] = actions.map((a) => ({
      id: `a:${a.id}`,
      group: 'Actions',
      label: a.label,
      icon: a.icon,
      keywords: a.keywords,
      run: a.run
        ? () => {
            setOpen(false);
            a.run!();
          }
        : go(a.href!),
    }));
    const pages: Item[] = navForRole(role).flatMap((s) =>
      s.items.map((i) => ({ id: `p:${i.href}`, group: 'Pages', label: i.label, hint: s.label, icon: i.icon, run: go(i.href) })),
    );
    const found: Item[] = [
      ...(projects.data?.items ?? []).map((p) => ({
        id: `pr:${p._id}`,
        group: 'Projects',
        label: p.name,
        hint: p.code,
        icon: FolderKanban,
        run: go(`/projects/${p._id}`),
        keywords: p.code,
      })),
      ...(clients.data ?? []).slice(0, 6).map((c) => ({
        id: `c:${c._id}`,
        group: 'Clients',
        label: c.name,
        icon: Building2,
        run: go(`/clients/${c._id}`),
      })),
      ...(people.data?.items ?? []).map((u) => ({
        id: `u:${u._id}`,
        group: 'People',
        label: u.name,
        hint: u.email,
        icon: UserRound,
        run: go(`/team/${u._id}`),
        keywords: u.email,
      })),
    ];
    return [...quick.filter(match), ...pages.filter(match), ...(searching ? found : [])];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, actions, role, projects.data, clients.data, people.data, searching]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const loading = searching && (projects.isFetching || clients.isFetching || people.isFetching);
  let lastGroup = '';

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-[12vh] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border bg-popover shadow-2xl"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">Search</DialogPrimitive.Title>
          <div className="flex items-center gap-2 border-b px-4">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects, clients, people, pages…"
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActive((a) => Math.min(a + 1, items.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActive((a) => Math.max(a - 1, 0));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  items[active]?.run();
                }
              }}
            />
            {loading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-border border-t-primary" />}
          </div>
          <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-1.5">
            {items.length === 0 && (
              <p className="px-3 py-10 text-center text-sm text-muted-foreground">
                {searching && loading ? 'Searching…' : 'No results'}
              </p>
            )}
            {items.map((item, i) => {
              const header = item.group !== lastGroup ? item.group : null;
              lastGroup = item.group;
              const Icon = item.icon;
              return (
                <div key={item.id}>
                  {header && <p className="px-2.5 pb-1 pt-2.5 text-[11px] font-medium text-muted-foreground">{header}</p>}
                  <button
                    type="button"
                    data-index={i}
                    onMouseEnter={() => setActive(i)}
                    onClick={item.run}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm',
                      i === active && 'bg-accent',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{item.label}</span>
                    {item.hint && <span className="truncate text-xs text-muted-foreground">{item.hint}</span>}
                    {i === active && <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />}
                  </button>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-3 border-t px-4 py-2 text-[11px] text-muted-foreground">
            <span>↑↓ to move</span>
            <span>Enter to open</span>
            <span>Esc to close</span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
