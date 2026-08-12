import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider, useSession } from './src/auth/session';
import { AuthScreen } from './src/screens/AuthScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { CheckInScreen } from './src/screens/CheckInScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { StockScreen } from './src/screens/StockScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { ScheduleScreen } from './src/screens/ScheduleScreen';
import { LeavesScreen } from './src/screens/LeavesScreen';
import { ApprovalsScreen } from './src/screens/ApprovalsScreen';
import { TeamMapScreen } from './src/screens/TeamMapScreen';
import { ManageUsersScreen } from './src/screens/ManageUsersScreen';
import { TabBar } from './src/components/TabBar';
import { AppAlertHost } from './src/components/AppAlert';
import { useNotificationRouting } from './src/push/routing';
import { colors } from './src/theme';
import type { AdminTabParamList, RootStackParamList, TabParamList } from './src/navigation';

const Tab = createBottomTabNavigator<TabParamList>();
const AdminTab = createBottomTabNavigator<AdminTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Urutan tab menentukan posisi tombol mengambang: "Absen" sengaja diletakkan
 * di tengah agar digambar sebagai tombol bundar oleh TabBar.
 */
function Tabs() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Riwayat" component={HistoryScreen} />
      <Tab.Screen name="Absen" component={CheckInScreen} />
      <Tab.Screen name="Stok" component={StockScreen} />
      <Tab.Screen name="Profil" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

/**
 * Kerangka administrator: panel pengelolaan saja.
 *
 * Tidak ada Absen maupun Riwayat — administrator tidak pernah absen, jadi
 * keduanya selalu kosong dan hanya menyita slot. Karena rute "Absen" tidak ada,
 * TabBar otomatis menggambar bar rata tanpa tombol mengambang.
 *
 * Stok tetap ada: administrator sistem juga pengelola inventaris (lihat
 * `isStockManager` di web).
 */
function AdminTabs() {
  return (
    <AdminTab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <TabBar {...props} />}
    >
      <AdminTab.Screen name="Dashboard" component={DashboardScreen} />
      <AdminTab.Screen name="Persetujuan" component={ApprovalsScreen} />
      <AdminTab.Screen name="Peta" component={TeamMapScreen} />
      <AdminTab.Screen name="Stok" component={StockScreen} />
      <AdminTab.Screen name="Profil" component={ProfileScreen} />
    </AdminTab.Navigator>
  );
}

function Root() {
  const { user, initializing } = useSession();
  const isAdministrator = user?.role === 'administrator';

  // Tujuan navigasi berbeda per kerangka, jadi role diteruskan apa adanya:
  // administrator dibawa ke tab Persetujuan, karyawan ke layar Jadwal untuk
  // menanggapi permintaan tukar dari rekan.
  useNotificationRouting(user?.role);

  if (initializing) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user) return <AuthScreen />;

  // Dua kerangka terpisah, bukan satu kerangka dengan menu disembunyikan:
  // rute yang tidak terdaftar tidak bisa dibuka sama sekali, sengaja maupun
  // tidak sengaja.
  if (isAdministrator) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="AdminTabs" component={AdminTabs} />
        <Stack.Screen name="KelolaKaryawan" component={ManageUsersScreen} />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={Tabs} />
      <Stack.Screen name="Jadwal" component={ScheduleScreen} />
      <Stack.Screen name="Izin" component={LeavesScreen} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <NavigationContainer>
          <StatusBar style="dark" />
          <Root />
          {/* Dipasang sekali; semua appAlert() di aplikasi tampil di sini */}
          <AppAlertHost />
        </NavigationContainer>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
