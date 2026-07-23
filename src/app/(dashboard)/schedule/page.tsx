import type { Metadata } from 'next';
import { MySchedule } from '@/components/features/schedule/MySchedule';

export const metadata: Metadata = {
  title: 'Jadwal Saya',
};

export default function SchedulePage() {
  return <MySchedule />;
}
