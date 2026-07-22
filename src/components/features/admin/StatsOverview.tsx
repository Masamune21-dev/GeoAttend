'use client';

import { CheckCircle2, MapPinOff, UserCheck, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface StatsOverviewProps {
  totalUsers: number;
  todayCount: number;
  withinCount: number;
  outsideCount: number;
}

const STAT_CONFIG = [
  {
    key: 'totalUsers',
    label: 'Total Pengguna',
    icon: Users,
    color: 'text-primary bg-primary-subtle',
  },
  {
    key: 'todayCount',
    label: 'Absensi Hari Ini',
    icon: UserCheck,
    color: 'text-accent bg-sky-50',
  },
  {
    key: 'withinCount',
    label: 'Dalam Area',
    icon: CheckCircle2,
    color: 'text-success bg-success-subtle',
  },
  {
    key: 'outsideCount',
    label: 'Luar Area',
    icon: MapPinOff,
    color: 'text-destructive bg-destructive-subtle',
  },
] as const;

export function StatsOverview(props: StatsOverviewProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {STAT_CONFIG.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.key}>
            <CardContent className="flex items-center gap-3 p-4 md:p-4">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${stat.color}`}
                aria-hidden="true"
              >
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-2xl font-bold tracking-tight text-text-primary tabular-nums">
                  {props[stat.key]}
                </p>
                <p className="text-xs text-text-secondary">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
