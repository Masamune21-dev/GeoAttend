import type { Metadata } from 'next';
import { ScheduleManager } from '@/components/features/admin/ScheduleManager';

export const metadata: Metadata = {
  title: 'Jadwal Shift',
};

export default function AdminSchedulePage() {
  return <ScheduleManager />;
}
