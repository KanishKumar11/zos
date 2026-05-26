// Settings landing page — links into sub-sections (departments, designations, holidays, general).
import Link from 'next/link';
import { Building2, Tag, CalendarDays, Settings2, ChevronRight } from 'lucide-react';

import { PageHeader } from '@/components/layout/page-header';

const SECTIONS = [
  {
    href: '/settings/departments',
    title: 'Departments',
    desc: 'Manage org-level groupings.',
    icon: Building2,
  },
  {
    href: '/settings/designations',
    title: 'Designations',
    desc: 'Roles inside each department.',
    icon: Tag,
  },
  {
    href: '/settings/holidays',
    title: 'Holidays',
    desc: 'Annual holiday calendar used by attendance.',
    icon: CalendarDays,
  },
  {
    href: '/settings/general',
    title: 'General',
    desc: 'Workspace name, default currency, locale.',
    icon: Settings2,
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage workspace configuration." />
      <div className="grid gap-3 md:grid-cols-2">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.href}
              href={s.href}
              className="group flex items-center gap-4 rounded-lg border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-card"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold">{s.title}</p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">{s.desc}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
