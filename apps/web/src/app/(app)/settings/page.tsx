// Settings landing page — links into sub-sections (departments, designations, holidays, general).
import Link from 'next/link';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const SECTIONS = [
  { href: '/settings/departments', title: 'Departments', desc: 'Manage org-level groupings.' },
  { href: '/settings/designations', title: 'Designations', desc: 'Roles inside each department.' },
  { href: '/settings/holidays', title: 'Holidays', desc: 'Annual holiday calendar used by attendance.' },
  { href: '/settings/general', title: 'General', desc: 'Workspace name, default currency, locale.' },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <div className="grid gap-4 md:grid-cols-2">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} className="transition hover:opacity-80">
            <Card>
              <CardHeader>
                <CardTitle>{s.title}</CardTitle>
                <CardDescription>{s.desc}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">Open →</CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
