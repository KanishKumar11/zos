// Onboarding checklist — the person ticks their own items; OWNER/ADMIN add and remove items.
'use client';

import { Trash2 } from 'lucide-react';
import { useState } from 'react';

import { formatDate } from '@/lib/formatters';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { ProgressBar } from '@/components/ui/progress-bar';

import type { UserRow } from './team.api';
import { useSetOnboarding, useToggleOnboarding } from './team.hooks';

const SUGGESTED = ['Sign offer letter', 'Sign NDA', 'Share ID proof', 'Add bank details', 'Set up work email', 'Meet the team'];

export function MemberOnboarding({ user, canManage, isSelf }: { user: UserRow; canManage: boolean; isSelf: boolean }) {
  const confirm = useConfirm();
  const setOnboarding = useSetOnboarding();
  const toggle = useToggleOnboarding();
  const [text, setText] = useState('');
  const [error, setError] = useState<string>();
  const items = user.onboardingChecklist ?? [];
  const done = items.filter((i) => i.completed).length;

  // Send only item + completed; the server keeps each finished item's original completion date.
  const save = (next: { item: string; completed: boolean }[], onDone?: () => void) =>
    setOnboarding.mutate({ id: user._id, body: { items: next } }, { onSuccess: onDone });

  const add = (raw: string) => {
    const item = raw.trim();
    if (!item) return;
    if (items.some((i) => i.item.toLowerCase() === item.toLowerCase())) {
      setError('That item is already on the list');
      return;
    }
    setError(undefined);
    save([...items.map((c) => ({ item: c.item, completed: c.completed })), { item, completed: false }], () => setText(''));
  };

  const remove = async (idx: number) => {
    const it = items[idx];
    if (!it) return;
    const ok = await confirm({
      title: `Remove “${it.item}”?`,
      description: 'It is taken off this person’s checklist.',
      confirmText: 'Remove',
      destructive: true,
    });
    if (ok) save(items.filter((_, i) => i !== idx).map((c) => ({ item: c.item, completed: c.completed })));
  };

  const suggestions = SUGGESTED.filter((s) => !items.some((i) => i.item.toLowerCase() === s.toLowerCase()));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle>Onboarding checklist</CardTitle>
        {items.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {done} of {items.length} done
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length > 0 && <ProgressBar value={done} max={items.length} />}
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {canManage ? 'No checklist yet. Add the steps this person needs to finish.' : 'Nothing to do here yet.'}
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {items.map((it, idx) => (
              <li key={`${idx}-${it.item}`} className="flex items-center gap-3 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={it.completed}
                  disabled={(!isSelf && !canManage) || toggle.isPending || setOnboarding.isPending}
                  onChange={() => toggle.mutate({ id: user._id, idx })}
                  aria-label={it.item}
                />
                <span className={it.completed ? 'flex-1 text-muted-foreground line-through' : 'flex-1'}>{it.item}</span>
                {it.completed && it.completedAt && (
                  <span className="text-xs text-muted-foreground">Done {formatDate(it.completedAt)}</span>
                )}
                {canManage && (
                  <button
                    type="button"
                    aria-label={`Remove ${it.item}`}
                    className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
                    disabled={setOnboarding.isPending}
                    onClick={() => void remove(idx)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {canManage && (
          <div className="space-y-2">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                add(text);
              }}
            >
              <Input
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setError(undefined);
                }}
                placeholder="Add a checklist item"
                aria-invalid={!!error}
              />
              <Button type="submit" disabled={!text.trim() || setOnboarding.isPending}>
                Add
              </Button>
            </form>
            {error && <p className="text-xs text-destructive">{error}</p>}
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={setOnboarding.isPending}
                    onClick={() => add(s)}
                    className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    + {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
