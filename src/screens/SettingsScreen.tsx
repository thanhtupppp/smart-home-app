import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  StatusBar,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, NeuStyles, NeuPalette } from '../theme';
import { useHome } from '../context/HomeContext';
import { useAuth } from '../context/AuthContext';
import { AppNavigationProp, RootStackParamList } from '../navigation/types';
import { updateService } from '../services/updateService';
import { safeStorage } from '../services/storageService';
import { firebaseService } from '../services/firebaseService';

// Constants
const AVATAR_SIZE = 52;
const AVATAR_FONT_SIZE = 18;
const MENU_ICON_SIZE = 18;
const MENU_ICON_BOX_SIZE = 38;
const MENU_ITEM_PADDING = 14;
const DIVIDER_MARGIN_LEFT = 64;

interface MenuItem {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap | keyof typeof MaterialIcons.glyphMap;
  iconLibrary: 'Ionicons' | 'MaterialIcons';
  color: string;
  screen?: keyof RootStackParamList;
  onPress?: () => void;
}

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<AppNavigationProp>();
  const { overview, rooms, devices, firebaseConfig } = useHome();
  const { user, isDemoMode, logout } = useAuth();
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [memberCount, setMemberCount] = useState<number>(1);

  useEffect(() => {
    let isMounted = true;
    const fetchMemberCount = async () => {
      try {
        const cached = await safeStorage.getItem('tu_smarthome_members_cache');
        if (cached) {
          const list = JSON.parse(cached);
          if (Array.isArray(list) && isMounted) {
            setMemberCount(Math.max(1, list.length));
          }
        }
        const data = await firebaseService.fetchMembers();
        if (data && isMounted) {
          const list = Object.values(data);
          if (list.length > 0) {
            setMemberCount(list.length);
          }
        }
      } catch {
        // Ignore
      }
    };
    fetchMemberCount();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleNavigate = useCallback(
    (screen?: keyof RootStackParamList) => {
      if (screen) {
        navigation.navigate(screen as any);
      }
    },
    [navigation]
  );

  const handleCheckUpdate = useCallback(async () => {
    setIsCheckingUpdate(true);
    try {
      const update = await updateService.checkForUpdates();
      if (update.isAvailable) {
        Alert.alert('Bản cập nhật mới', 'Đã tìm thấy bản cập nhật mới. Đang tải trong nền...');
        await updateService.fetchAndReload();
      } else {
        Alert.alert(
          'Hệ thống mới nhất',
          'Ứng dụng đang hoạt động với phiên bản mới nhất và firmware ESP32 ổn định.'
        );
      }
    } catch {
      Alert.alert('Kiểm tra OTA', 'Không thể kết nối máy chủ phân phối bản cập nhật OTA.');
    } finally {
      setIsCheckingUpdate(false);
    }
  }, []);

  const handleLogout = useCallback(() => {
    Alert.alert(
      'Đăng xuất tài khoản',
      'Bạn có chắc chắn muốn đăng xuất khỏi hệ thống Firebase?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đăng xuất',
          style: 'destructive',
          onPress: async () => {
            await logout();
            (navigation as any).reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
          },
        },
      ]
    );
  }, [logout, navigation]);

  const initials = useMemo(() => {
    if (!user?.displayName) return 'TH';
    const parts = user.displayName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [user?.displayName]);

  const homeMenuItems: MenuItem[] = useMemo(
    () => [
      {
        id: 'manage_home',
        title: 'Quản lý ngôi nhà',
        subtitle: `${overview.homeName} • ${devices.length} thiết bị • ${rooms.length} phòng`,
        icon: 'home',
        iconLibrary: 'Ionicons',
        color: '#2563EB',
        screen: 'ManageHome',
      },
      {
        id: 'member_roles',
        title: 'Thành viên & Phân quyền',
        subtitle: `${memberCount} tài khoản trong gia đình`,
        icon: 'people',
        iconLibrary: 'Ionicons',
        color: '#059669',
        screen: 'MemberRoles',
      },
    ],
    [overview.homeName, devices.length, rooms.length, memberCount]
  );

  const connectivityMenuItems: MenuItem[] = useMemo(
    () => [
      {
        id: 'firebase_config',
        title: 'Cấu hình Firebase Realtime DB',
        subtitle: firebaseConfig.isDemoMode
          ? 'Chế độ Demo Giả lập (Offline)'
          : 'Đã kết nối cơ sở dữ liệu Cloud',
        icon: 'cloud-done',
        iconLibrary: 'Ionicons',
        color: '#7C3AED',
        screen: 'FirebaseConfig',
      },
      {
        id: 'add_device',
        title: 'Thêm thiết bị ESP32',
        subtitle: 'Ghép nối qua AP Mode & WiFi Provisioning',
        icon: 'hardware-chip-outline',
        iconLibrary: 'Ionicons',
        color: '#0284C7',
        screen: 'AddDevice',
      },
    ],
    [firebaseConfig.isDemoMode]
  );

  const securityMenuItems: MenuItem[] = useMemo(
    () => [
      {
        id: 'history_alert',
        title: 'Nhật ký & Cảnh báo an ninh',
        subtitle: 'Lịch sử phát hiện chuyển động & cảm biến',
        icon: 'notifications-active',
        iconLibrary: 'MaterialIcons',
        color: '#EF4444',
        screen: 'HistoryAlert',
      },
      {
        id: 'notification_settings',
        title: 'Cài đặt thông báo & Giờ yên tĩnh',
        subtitle: 'Tùy chỉnh Push Alert và âm thanh khẩn cấp',
        icon: 'notifications-none',
        iconLibrary: 'MaterialIcons',
        color: '#D97706',
        screen: 'NotificationSettings',
      },
      {
        id: 'camera_ai',
        title: 'Camera AI & PTZ',
        subtitle: 'Xem luồng trực tiếp 1080p ESP32-CAM',
        icon: 'videocam',
        iconLibrary: 'Ionicons',
        color: '#2563EB',
        screen: 'CameraDetail',
      },
    ],
    []
  );

  const renderMenuItemRow = (item: MenuItem, isLast: boolean) => (
    <View key={item.id}>
      <Pressable
        style={({ pressed }) => [
          styles.menuItem,
          pressed && { opacity: 0.85 },
        ]}
        onPress={() => (item.onPress ? item.onPress() : handleNavigate(item.screen))}
        accessibilityRole="button"
        accessibilityLabel={item.title}
      >
        <View style={styles.menuLeft}>
          <View style={[styles.menuIconBox, NeuStyles.cavity]}>
            {item.iconLibrary === 'Ionicons' ? (
              <Ionicons name={item.icon as any} size={MENU_ICON_SIZE} color={item.color} />
            ) : (
              <MaterialIcons name={item.icon as any} size={MENU_ICON_SIZE} color={item.color} />
            )}
          </View>

          <View style={styles.menuTextWrap}>
            <Text style={[Typography.titleMedium, styles.menuTitle]}>{item.title}</Text>
            <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
          </View>
        </View>

        <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
      </Pressable>

      {!isLast && <View style={styles.divider} />}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#E8ECF2" />
      <View style={styles.header}>
        <Text style={[Typography.headlineMedium, styles.title]}>Cài đặt</Text>
        <Text style={[Typography.bodySmall, styles.subtitle]}>
          Hệ thống điều khiển trung tâm & Kết nối ESP32
        </Text>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* User Profile Banner */}
        <Pressable
          style={({ pressed }) => [
            styles.profileCard,
            NeuStyles.raised,
            pressed && { opacity: 0.85 },
          ]}
          onPress={() => navigation.navigate('MemberRoles')}
          accessibilityRole="button"
          accessibilityLabel="Xem thông tin phân quyền tài khoản"
        >
          <View style={[styles.avatarCircle, NeuStyles.circleRaised]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={[Typography.titleMedium, styles.userName]}>
              {user?.displayName || 'Chưa đăng nhập'}
            </Text>
            <Text style={styles.userEmail}>{user?.email || 'Khách (Chưa liên kết Firebase)'}</Text>
            <View style={[styles.roleBadge, NeuStyles.cavity]}>
              <View
                style={[
                  styles.roleLed,
                  { backgroundColor: isDemoMode ? '#D97706' : '#10B981' },
                ]}
              />
              <Text
                style={[
                  styles.roleText,
                  { color: isDemoMode ? '#B45309' : '#059669' },
                ]}
              >
                {isDemoMode
                  ? 'Chế độ Demo (Offline)'
                  : user?.role === 'owner'
                  ? 'Chủ nhà (Firebase Cloud)'
                  : 'Thành viên'}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
        </Pressable>

        {/* Section 1: Home Management */}
        <Text style={styles.sectionHeading}>QUẢN LÝ NGÔI NHÀ</Text>
        <View style={[styles.menuCard, NeuStyles.raised]}>
          {homeMenuItems.map((item, idx) =>
            renderMenuItemRow(item, idx === homeMenuItems.length - 1)
          )}
        </View>

        {/* Section 2: Connectivity */}
        <Text style={styles.sectionHeading}>KẾT NỐI & PHẦN CỨNG ESP32</Text>
        <View style={[styles.menuCard, NeuStyles.raised]}>
          {connectivityMenuItems.map((item, idx) =>
            renderMenuItemRow(item, idx === connectivityMenuItems.length - 1)
          )}
        </View>

        {/* Section 3: Security & Alerts */}
        <Text style={styles.sectionHeading}>AN NINH & THÔNG BÁO</Text>
        <View style={[styles.menuCard, NeuStyles.raised]}>
          {securityMenuItems.map((item, idx) =>
            renderMenuItemRow(item, idx === securityMenuItems.length - 1)
          )}
        </View>

        {/* Section 4: System Actions */}
        <Text style={styles.sectionHeading}>HỆ THỐNG & CẬP NHẬT</Text>
        <View style={[styles.menuCard, NeuStyles.raised]}>
          <Pressable
            style={({ pressed }) => [
              styles.menuItem,
              pressed && { opacity: 0.85 },
            ]}
            onPress={handleCheckUpdate}
            accessibilityRole="button"
            accessibilityLabel="Kiểm tra bản cập nhật hệ thống"
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconBox, NeuStyles.cavity]}>
                <Ionicons name="cloud-download-outline" size={MENU_ICON_SIZE} color="#2563EB" />
              </View>
              <View style={styles.menuTextWrap}>
                <Text style={[Typography.titleMedium, styles.menuTitle]}>
                  Cập nhật Firmware & App
                </Text>
                <Text style={styles.menuSubtitle}>Phiên bản v1.0.0 (Ổn định)</Text>
              </View>
            </View>
            {isCheckingUpdate ? (
              <ActivityIndicator size="small" color="#2563EB" />
            ) : (
              <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
            )}
          </Pressable>

          <View style={styles.divider} />

          <Pressable
            style={({ pressed }) => [
              styles.menuItem,
              pressed && { opacity: 0.85 },
            ]}
            onPress={handleLogout}
            accessibilityRole="button"
            accessibilityLabel="Đăng xuất tài khoản Firebase"
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIconBox, NeuStyles.cavity]}>
                <Ionicons name="log-out-outline" size={MENU_ICON_SIZE} color="#EF4444" />
              </View>
              <View style={styles.menuTextWrap}>
                <Text style={[Typography.titleMedium, styles.menuTitle, { color: '#EF4444' }]}>
                  Đăng xuất
                </Text>
                <Text style={styles.menuSubtitle}>Thoát phiên làm việc Firebase</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
          </Pressable>
        </View>

        {/* Footer info */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>ESP32 Smart Home System • v1.0.0</Text>
          <Text style={styles.footerSub}>
            Tương thích ESP32, ESP8266, FreeRTOS & Firebase RTDB
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#E8ECF2',
  },
  header: {
    paddingHorizontal: Spacing.marginMobile,
    paddingTop: 10,
    paddingBottom: 14,
  },
  title: {
    color: '#1E293B',
    fontWeight: '800',
  },
  subtitle: {
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing.marginMobile,
    paddingBottom: 40,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: BorderRadius.xxl,
    marginBottom: 20,
  },
  avatarCircle: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: {
    fontSize: AVATAR_FONT_SIZE,
    fontWeight: '800',
    color: '#2563EB',
  },
  profileInfo: {
    flex: 1,
  },
  userName: {
    color: '#1E293B',
    fontWeight: '800',
  },
  userEmail: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
    fontWeight: '500',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    marginTop: 6,
    gap: 4,
  },
  roleLed: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  roleText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
  },
  menuCard: {
    borderRadius: BorderRadius.xl,
    marginBottom: 18,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: MENU_ITEM_PADDING,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  menuIconBox: {
    width: MENU_ICON_BOX_SIZE,
    height: MENU_ICON_BOX_SIZE,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuTextWrap: {
    flex: 1,
  },
  menuTitle: {
    color: '#1E293B',
    fontWeight: '800',
    fontSize: 14,
  },
  menuSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    marginLeft: DIVIDER_MARGIN_LEFT,
  },
  footer: {
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 12,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  footerSub: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
    textAlign: 'center',
  },
});
