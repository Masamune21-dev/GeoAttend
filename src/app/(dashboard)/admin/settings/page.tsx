'use client';

import { useState } from 'react';
import { Clock, DatabaseBackup, MapPin, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GeneralSettings } from '@/components/features/admin/GeneralSettings';
import { GeofenceSettings } from '@/components/features/admin/GeofenceSettings';
import { ShiftSettingsForm } from '@/components/features/admin/ShiftSettingsForm';
import { DataSettings } from '@/components/features/admin/DataSettings';

const TABS = [
  { id: 'general', label: 'General', icon: Settings2 },
  { id: 'area', label: 'Area Absensi', icon: MapPin },
  { id: 'sop', label: 'SOP Absensi', icon: Clock },
  { id: 'data', label: 'Backup & Data', icon: DatabaseBackup },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('general');

  return (
    <div className="flex flex-col gap-4">
      {/* Tab bar (segmented control, scrollable di mobile) */}
      <div
        role="tablist"
        aria-label="Kategori pengaturan"
        className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-lg bg-secondary p-1"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-surface text-primary shadow-card'
                  : 'text-text-secondary hover:text-text-primary'
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'general' && <GeneralSettings />}
      {activeTab === 'area' && <GeofenceSettings />}
      {activeTab === 'sop' && <ShiftSettingsForm />}
      {activeTab === 'data' && <DataSettings />}
    </div>
  );
}
