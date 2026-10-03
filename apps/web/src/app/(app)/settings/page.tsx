// Settings landing page — grouped links into the sub-sections (organisation, calendar, workspace).
import { Building2, CalendarDays, ChevronRight, Settings2, Tag, type LucideIcon } from 'lucide-react';
import Link from 'next/link';

import { PageHeader } from '@/components/layout/page-header';

interface Section {
  href: string;
  title: string;
  desc: string;
  icon: LucideIcon;
}

const GROUPS: { label: string; blurb: string; sections: Section[] }[] = [
  {
    label: 'Organisation',
    blurb: 'How your team is structured. Used on profiles, invites and announcements.',
    sections: [
      { href: '/settings/departments', title: 'Departments', desc: 'Org-level groupings like Design or Engineering.', icon: Building2 },
      { href: '/settings/designations', title: 'Designations', desc: 'Job titles inside each department.', icon: Tag },
    ],
  },
  {
    label: 'Calendar',
    blurb: 'Days off that attendance and payroll respect.',
    sections: [{ href: '/settings/holidays', title: 'Holidays', desc: 'The annual holiday calendar everyone sees.', icon: CalendarDays }],
  },
  {
    label: 'Workspace',
    blurb: 'Company details and the rules the app runs on.',
    sections: [{ href: '/settings/general', title: 'General', desc: 'Workspace details, working week and payroll rules.', icon: Settings2 }],
  },
];

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader title="Settings" eyebrow="Admin" description="Workspace configuration, grouped by what it affects." />
      {GROUPS.map((g) => (
        <section key={g.label} className="grid gap-3 md:grid-cols-[220px_1fr] md:gap-8">
          <div>
            <h2 className="font-display text-lg font-bold">{g.label}</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">{g.blurb}</p>
          </div>
          <div className="divide-y overflow-hidden rounded-[var(--radius)] border bg-card">
            {g.sections.map((s) => {
              const Icon = s.icon;
              return (
                <Link key={s.href} href={s.href} className="group flex items-center gap-4 px-4 py-4 transition-colors hover:bg-muted/40 sm:px-5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-wash text-brand-ink">
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{s.title}</span>
                    <span className="mt-0.5 block text-[13px] text-muted-foreground">{s.desc}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
