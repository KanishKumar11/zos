// useListState — search / filter / sort / page state for list pages.
//
//  • Lives in the URL, so links are shareable and Back/Forward work.
//  • The last filters used on each page are remembered (localStorage) and restored when you come
//    back to the page with a bare URL. Page number is not remembered — you always start at page 1.
//
//   const list = useListState('invoices', { q: '', status: '', sort: 'issueDate:desc' });
//   list.params.status            // current value
//   list.set({ status: 'OVERDUE' }) // update (resets page to 1)
'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef } from 'react';

export type ListParams = Record<string, string>;

const STORAGE_PREFIX = 'zos.list.';

function readSaved(key: string): ListParams | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    return raw ? (JSON.parse(raw) as ListParams) : null;
  } catch {
    return null;
  }
}

function writeSaved(key: string, params: ListParams): void {
  try {
    const { page: _page, ...rest } = params;
    window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(rest));
  } catch {
    // storage blocked (private window etc.) — URL state still works
  }
}

export interface SortState {
  by: string;
  dir: 'asc' | 'desc';
}

export function parseSort(value: string | undefined): SortState | undefined {
  if (!value) return undefined;
  const [by, dir] = value.split(':');
  if (!by) return undefined;
  return { by, dir: dir === 'asc' ? 'asc' : 'desc' };
}

export function useListState<D extends ListParams>(pageKey: string, defaults: D) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const restored = useRef(false);
  const defaultsRef = useRef(defaults);

  const params = useMemo(() => {
    const out: ListParams = { ...defaultsRef.current, page: '1' };
    search.forEach((v, k) => {
      out[k] = v;
    });
    return out as D & { page: string };
  }, [search]);

  const replace = useCallback(
    (next: ListParams) => {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(next)) {
        const isDefault = (defaultsRef.current as ListParams)[k] === v || (k === 'page' && v === '1');
        if (v !== '' && v !== undefined && !isDefault) qs.set(k, v);
      }
      const str = qs.toString();
      router.replace(str ? `${pathname}?${str}` : pathname, { scroll: false });
      writeSaved(pageKey, next);
    },
    [pageKey, pathname, router],
  );

  // First visit with a bare URL: bring back the filters used last time on this page.
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    if (search.toString()) return;
    const saved = readSaved(pageKey);
    if (saved && Object.keys(saved).length > 0) replace({ ...defaultsRef.current, ...saved, page: '1' });
  }, [pageKey, replace, search]);

  const set = useCallback(
    (patch: Partial<D> & { page?: string }) => {
      const next: ListParams = { ...params, ...(patch as ListParams) };
      if (!('page' in patch)) next.page = '1';
      replace(next);
    },
    [params, replace],
  );

  const reset = useCallback(() => replace({ ...defaultsRef.current, page: '1' }), [replace]);

  const activeFilterCount = useMemo(
    () =>
      Object.entries(params).filter(
        ([k, v]) => k !== 'page' && k !== 'sort' && v !== '' && (defaultsRef.current as ListParams)[k] !== v,
      ).length,
    [params],
  );

  return {
    params,
    page: Math.max(1, Number(params.page) || 1),
    sort: parseSort(params.sort),
    set,
    reset,
    setPage: (page: number) => set({ page: String(page) } as Partial<D> & { page: string }),
    setSort: (s: SortState | undefined) => set({ sort: s ? `${s.by}:${s.dir}` : '' } as unknown as Partial<D>),
    activeFilterCount,
  };
}
