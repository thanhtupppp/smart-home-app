import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Switch,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, NeuStyles, NeuPalette } from '../theme';
import { Header } from '../components/Header';
import { AppNavigationProp } from '../navigation/types';
import { notificationService } from '../services/notificationService';

// Constants
const CARD_PADDING = 16;
const SWITCH_ROW_PADDING_V = 4;
const TEXT_WRAP_PADDING_R = 14;
const DIVIDER_MARGIN_V = 12;

interface NotificationSettings {
  pushEnabled: boolean;
  securityAlerts: boolean;
  deviceStateAlerts: boolean;
  quietHours: boolean;
  emergencySound: boolean;
}

export const NotificationSettingsScreen: React.FC = () => {
  const navigation = useNavigation<AppNavigationProp>();

  const [settings, setSettings] = useState<NotificationSettings>({
    pushEnabled: true,
    securityAlerts: true,
    deviceStateAlerts: false,
    quietHours: true,
    emergencySound: true,
  });

  const handleToggle = useCallback((key: keyof NotificationSettings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  const handleTestNotification = useCallback(async () => {
    Alert.alert(
      'Gửi thông báo thử nghiệm',
      'Hệ thống sẽ kích hoạt một thông báo an ninh mẫu để bạn kiểm tra âm thanh và độ trễ.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Gửi ngay',
          onPress: async () => {
            await notificationService.notifySecurityAlert('Ban công phòng khách', 'Cảnh báo mô phỏng');
            Alert.alert('Thành công', 'Đã phát cảnh báo mẫu tới thiết bị.');
          },
        },
      ]
    );
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#E8ECF2" />
      <Header
        showBack
        onBackPress={() => navigation.goBack()}
        title="Cài đặt Thông báo"
        subtitle="Push Alert & Cảnh báo an ninh"
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Master Push Alert */}
        <Text style={styles.sectionHeading}>TỔNG QUAN</Text>
        <View style={[styles.card, NeuStyles.raised]}>
          <View style={styles.switchRow}>
            <View style={styles.textWrap}>
              <Text style={[Typography.titleMedium, styles.title]}>
                Nhận thông báo đẩy (Push Alert)
              </Text>
              <Text style={styles.desc}>
                Bật để nhận cảnh báo tức thời từ camera ESP32 và các cảm biến.
              </Text>
            </View>
            <Switch
              value={settings.pushEnabled}
              onValueChange={() => handleToggle('pushEnabled')}
              trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
              thumbColor={settings.pushEnabled ? '#2563EB' : '#F8FAFC'}
              accessibilityRole="switch"
              accessibilityLabel="Bật tắt nhận thông báo đẩy"
            />
          </View>
        </View>

        {/* Categories */}
        <Text style={styles.sectionHeading}>LOẠI THÔNG BÁO</Text>
        <View style={[styles.card, NeuStyles.raised, !settings.pushEnabled && { opacity: 0.5 }]}>
          <View style={styles.switchRow}>
            <View style={styles.textWrap}>
              <Text style={[Typography.titleMedium, styles.title]}>
                Cảnh báo an ninh khẩn cấp
              </Text>
              <Text style={styles.desc}>
                Phát hiện người, chuyển động lạ hoặc cảm biến cửa mở trái phép.
              </Text>
            </View>
            <Switch
              value={settings.securityAlerts}
              onValueChange={() => handleToggle('securityAlerts')}
              disabled={!settings.pushEnabled}
              trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
              thumbColor={settings.securityAlerts ? '#2563EB' : '#F8FAFC'}
              accessibilityRole="switch"
              accessibilityLabel="Bật tắt cảnh báo an ninh khẩn cấp"
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.switchRow}>
            <View style={styles.textWrap}>
              <Text style={[Typography.titleMedium, styles.title]}>
                Trạng thái thiết bị & Môi trường
              </Text>
              <Text style={styles.desc}>
                Thông báo khi đèn, điều hòa tự động bật tắt theo ngữ cảnh hoặc nhiệt độ cao.
              </Text>
            </View>
            <Switch
              value={settings.deviceStateAlerts}
              onValueChange={() => handleToggle('deviceStateAlerts')}
              disabled={!settings.pushEnabled}
              trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
              thumbColor={settings.deviceStateAlerts ? '#2563EB' : '#F8FAFC'}
              accessibilityRole="switch"
              accessibilityLabel="Bật tắt thông báo trạng thái thiết bị"
            />
          </View>
        </View>

        {/* Quiet Hours & Overrides */}
        <Text style={styles.sectionHeading}>CHẾ ĐỘ KHÔNG LÀM PHIỀN</Text>
        <View style={[styles.card, NeuStyles.raised]}>
          <View style={styles.switchRow}>
            <View style={styles.textWrap}>
              <Text style={[Typography.titleMedium, styles.title]}>
                Giờ yên tĩnh (23:00 - 06:00)
              </Text>
              <Text style={styles.desc}>
                Tắt âm thanh thông báo thường trong khoảng thời gian nghỉ ngơi.
              </Text>
            </View>
            <Switch
              value={settings.quietHours}
              onValueChange={() => handleToggle('quietHours')}
              trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
              thumbColor={settings.quietHours ? '#2563EB' : '#F8FAFC'}
              accessibilityRole="switch"
              accessibilityLabel="Bật tắt chế độ giờ yên tĩnh"
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.switchRow}>
            <View style={styles.textWrap}>
              <Text style={[Typography.titleMedium, styles.title]}>
                Vượt qua chế độ im lặng
              </Text>
              <Text style={styles.desc}>
                Vẫn phát chuông báo động an ninh ngay cả khi điện thoại đang để chế độ Im lặng.
              </Text>
            </View>
            <Switch
              value={settings.emergencySound}
              onValueChange={() => handleToggle('emergencySound')}
              trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
              thumbColor={settings.emergencySound ? '#2563EB' : '#F8FAFC'}
              accessibilityRole="switch"
              accessibilityLabel="Bật tắt vượt qua chế độ im lặng"
            />
          </View>
        </View>

        {/* Test Notification Trigger */}
        <TouchableOpacity
          style={[styles.testBtn, NeuStyles.raisedSoft]}
          onPress={handleTestNotification}
          accessibilityRole="button"
          accessibilityLabel="Gửi thông báo thử nghiệm"
          activeOpacity={0.85}
        >
          <Ionicons name="notifications-outline" size={18} color="#2563EB" />
          <Text style={styles.testBtnText}>Gửi thông báo thử nghiệm</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#E8ECF2',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing.marginMobile,
    paddingBottom: 40,
  },
  card: {
    padding: CARD_PADDING,
    borderRadius: BorderRadius.xl,
    marginBottom: 16,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SWITCH_ROW_PADDING_V,
  },
  textWrap: {
    flex: 1,
    paddingRight: TEXT_WRAP_PADDING_R,
  },
  title: {
    color: '#1E293B',
    fontWeight: '800',
  },
  desc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    marginVertical: DIVIDER_MARGIN_V,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 6,
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: BorderRadius.xl,
    marginTop: 8,
  },
  testBtnText: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '700',
  },
});
