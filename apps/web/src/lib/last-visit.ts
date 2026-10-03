// "Since your last visit" — remembers when the viewer last opened a page (per page key, per browser)
// so lists can mark what's new. Purely a convenience: if storage is unavailable nothing is marked.
'use client';

import { useEffect, useState } from 'react';

import { useAuthStore } from '@/store/auth.store';

const PREFIX = 'zos:last-visit:';

function read(key: string): number | null {
  try {
    const v = window.localStorage.getItem(key);
    return v ? Number(v) || null : null;
  } catch {
    return null;
  }
}

function write(key: string, value: number) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    /* storage blocked — markers just won't show */
  }
}

/**
 * Returns the time (ms) of the previous visit to `pageKey`, or null on a first visit. The stored
 * time is moved to "now" after a short delay, so the markers stay visible for this visit and
 * clear on the next one.
 */
export function useLastVisit(pageKey: string): number | null {
  const userId = useAuthStore((s) => s.user?.id);
  const [since, setSince] = useState<number | null>(null);
  useEffect(() => {
    if (!userId) return;
    const key = `${PREFIX}${userId}:${pageKey}`;
    setSince(read(key));
    const t = setTimeout(() => write(key, Date.now()), 4000);
    // No write on cleanup: React strict mode re-runs effects, and an early write would hide the markers.
    return () => clearTimeout(t);
  }, [pageKey, userId]);
  return since;
}

/** True when `date` is after the last visit (never true on a first visit, to avoid marking everything). */
export function isNewSince(date: string | Date | null | undefined, since: number | null): boolean {
  if (!date || since === null) return false;
  const t = typeof date === 'string' ? Date.parse(date) : date.getTime();
  return Number.isFinite(t) && t > since;
}
