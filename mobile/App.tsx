import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Camera, CalendarClock, CalendarOff, History, UserRound } from 'lucide-react-native';
import { SessionProvider, useSession } from './src/auth/session';
import { LoginScreen } from './src/screens/LoginScreen';
import { CheckInScreen } from './src/screens/CheckInScreen';
import { ScheduleScreen } from './src/screens/ScheduleScreen';
import { LeavesScreen } from './src/screens/LeavesScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { colors } from './src/theme';
import type { IconType } from './src/components/ui';

const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, IconType> = {
  Absen: Camera,
  Jadwal: CalendarClock,
  Izin: CalendarOff,
  Riwayat: History,
  Profil: UserRound,
};

function Root() {
  const { user, initializing } = useSession();

  if (initializing) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user) return <LoginScreen />;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerTitleStyle: { fontWeight: '700', color: colors.textPrimary },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarIcon: ({ color, focused }) => {
          const Icon = TAB_ICONS[route.name] ?? Camera;
          return <Icon size={23} color={color} strokeWidth={focused ? 2.4 : 2} />;
        },
      })}
    >
      <Tab.Screen name="Absen" component={CheckInScreen} options={{ title: 'Absensi' }} />
      <Tab.Screen name="Jadwal" component={ScheduleScreen} options={{ title: 'Jadwal Shift' }} />
      <Tab.Screen name="Izin" component={LeavesScreen} options={{ title: 'Izin & Libur' }} />
      <Tab.Screen name="Riwayat" component={HistoryScreen} />
      <Tab.Screen name="Profil" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <NavigationContainer>
          <StatusBar style="auto" />
          <Root />
        </NavigationContainer>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
