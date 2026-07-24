import { useState } from 'react';
import { View } from 'react-native';
import { Segmented } from '../components/ui';
import { ScheduleScreen } from './ScheduleScreen';
import { LeavesScreen } from './LeavesScreen';
import { colors, spacing } from '../theme';

/** Satu tab untuk Jadwal Shift + Izin & Libur (dipilih via segmented). */
export function PlanningScreen() {
  const [tab, setTab] = useState<'jadwal' | 'izin'>('jadwal');
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm }}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'jadwal', label: 'Jadwal Shift' },
            { value: 'izin', label: 'Izin & Libur' },
          ]}
        />
      </View>
      <View style={{ flex: 1 }}>{tab === 'jadwal' ? <ScheduleScreen /> : <LeavesScreen />}</View>
    </View>
  );
}
