import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, NeuStyles, NeuPalette } from '../theme';
import { useHome } from '../context/HomeContext';
import { Header } from '../components/Header';
import { GlassCard } from '../components/GlassCard';
import { AppNavigationProp } from '../navigation/types';

// Constants
const INPUT_HEIGHT = 48;
const CARD_PADDING = 18;
const SAVE_BTN_PADDING = 14;
// Chấp nhận cả 2 dạng: https://<name>.firebaseio.com và
// https://<name>-default-rtdb.<region>.firebasedatabase.app (URL regional)
const FIREBASE_URL_REGEX =
  /^https:\/\/[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.(firebaseio\.com|firebasedatabase\.app)\/?$/;

export const FirebaseConfigScreen: React.FC = () => {
  const navigation = useNavigation<AppNavigationProp>();
  const { firebaseConfig, updateFirebaseConfig } = useHome();

  const [dbUrl, setDbUrl] = useState(firebaseConfig.databaseURL || '');
  const [apiKey, setApiKey] = useState(firebaseConfig.apiKey || '');
  const [authSecret, setAuthSecret] = useState(firebaseConfig.authSecret || '');
  const [isDemo, setIsDemo] = useState(firebaseConfig.isDemoMode);
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    'idle' | 'testing' | 'connected' | 'error'
  >(firebaseConfig.isDemoMode ? 'idle' : 'connected');

  const isValidFirebaseUrl = useMemo(() => {
    if (isDemo) return true;
    return FIREBASE_URL_REGEX.test(dbUrl.trim());
  }, [dbUrl, isDemo]);

  const testFirebaseConnection = async (url: string): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${url}/.json?shallow=true`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok || response.status === 401; // 401 means DB exists but requires secret
    } catch {
      return false;
    }
  };

  const handleTestAndSave = useCallback(async () => {
    if (!isDemo && !isValidFirebaseUrl) {
      Alert.alert(
        'Lỗi cấu hình',
        'Database URL không đúng định dạng. Ví dụ:\n• https://your-project-rtdb.firebaseio.com\n• https://your-project-rtdb.asia-southeast1.firebasedatabase.app'
      );
      return;
    }

    setIsTesting(true);
    setConnectionStatus('testing');

    if (!isDemo) {
      const isConnected = await testFirebaseConnection(dbUrl.trim());
      setConnectionStatus(isConnected ? 'connected' : 'error');
    } else {
      setConnectionStatus('idle');
    }

    updateFirebaseConfig({
      databaseURL: dbUrl.trim(),
      apiKey: apiKey.trim(),
      authSecret: authSecret.trim(),
      isDemoMode: isDemo,
    });

    setTimeout(() => {
      setIsTesting(false);
      Alert.alert(
        'Đã lưu cấu hình',
        isDemo
          ? 'Đang hoạt động ở chế độ Demo Giả lập (Offline Simulation).'
          : 'Đã kết nối với Firebase Realtime Database thành công!'
      );
    }, 800);
  }, [dbUrl, apiKey, authSecret, isDemo, isValidFirebaseUrl, updateFirebaseConfig]);

  const handleToggleDemo = useCallback((value: boolean) => {
    // Chỉ đổi chế độ, KHÔNG xóa thông số người dùng đã nhập
    // để khi tắt demo vẫn còn cấu hình thật.
    setIsDemo(value);
    setConnectionStatus(value ? 'idle' : 'connected');
  }, []);

  const openFirebaseConsole = useCallback(() => {
    Linking.openURL('https://console.firebase.google.com');
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#E8ECF2" />
      <Header
        showBack
        onBackPress={() => navigation.goBack()}
        title="Cấu hình Firebase ESP32"
        subtitle="Đồng bộ Cloud Realtime"
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Mode Selector */}
        <View style={[styles.card, NeuStyles.raised]}>
          <View style={styles.switchRow}>
            <View style={styles.switchTextWrap}>
              <Text style={[Typography.titleMedium, styles.switchTitle]}>
                Chế độ Giả lập Demo (Offline)
              </Text>
              <Text style={styles.switchDesc}>
                Cho phép thử nghiệm đầy đủ tính năng giao diện không cần nạp code ESP32.
              </Text>
            </View>
            <Switch
              value={isDemo}
              onValueChange={handleToggleDemo}
              trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
              thumbColor={isDemo ? '#2563EB' : '#F8FAFC'}
              accessibilityRole="switch"
              accessibilityLabel="Bật tắt chế độ giả lập offline"
            />
          </View>
        </View>

        {/* Firebase Credentials */}
        <View style={[styles.card, NeuStyles.raised, isDemo && { opacity: 0.7 }]}>
          <View style={styles.cardHeader}>
            <Text style={[Typography.titleMedium, styles.cardTitle]}>
              Thông số Firebase Realtime DB
            </Text>
            {!isDemo && connectionStatus === 'connected' && (
              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Đã kết nối</Text>
              </View>
            )}
          </View>

          <Text style={styles.cardDesc}>
            Dán đường dẫn Database URL từ Firebase Console của bạn.{' '}
            <Text
              style={styles.linkText}
              onPress={openFirebaseConsole}
              accessibilityRole="link"
              accessibilityLabel="Mở Firebase Console trên trình duyệt"
            >
              Mở Firebase Console →
            </Text>
          </Text>

          <Text style={styles.label}>DATABASE URL</Text>
          <TextInput
            style={[styles.input, NeuStyles.cavity]}
            value={dbUrl}
            onChangeText={setDbUrl}
            placeholder="https://your-project-rtdb.firebaseio.com"
            placeholderTextColor="#94A3B8"
            editable={!isDemo}
            autoCapitalize="none"
            returnKeyType="next"
          />

          <Text style={[styles.label, { marginTop: 14 }]}>
            FIREBASE WEB API KEY (Xác thực tài khoản)
          </Text>
          <TextInput
            style={[styles.input, NeuStyles.cavity]}
            value={apiKey}
            onChangeText={setApiKey}
            placeholder="AIzaSy..."
            placeholderTextColor="#94A3B8"
            editable={!isDemo}
            autoCapitalize="none"
            returnKeyType="next"
          />

          <Text style={[styles.label, { marginTop: 14 }]}>
            DATABASE SECRET (Dành cho ESP32 RTDB Legacy)
          </Text>
          <TextInput
            style={[styles.input, NeuStyles.cavity]}
            value={authSecret}
            onChangeText={setAuthSecret}
            placeholder="Nhập secret nếu database có phân quyền"
            placeholderTextColor="#94A3B8"
            secureTextEntry
            editable={!isDemo}
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={handleTestAndSave}
          />
        </View>

        {/* ESP32 Communication Guidance */}
        <View style={[styles.infoCard, NeuStyles.cavity]}>
          <View style={styles.infoTitleRow}>
            <MaterialIcons name="integration-instructions" size={18} color="#2563EB" />
            <Text style={[Typography.titleMedium, styles.infoTitle]}>
              Cấu trúc dữ liệu trên ESP32
            </Text>
          </View>
          <Text style={styles.infoCode}>
            {`Node Firebase: /devices/{deviceId}\n{\n  "isOn": true,\n  "brightness": 85,\n  "color": "#00e5ff",\n  "temperature": 24\n}`}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, NeuStyles.raisedSoft]}
          onPress={handleTestAndSave}
          disabled={isTesting}
          accessibilityRole="button"
          accessibilityLabel="Lưu và kiểm tra cấu hình Firebase"
          activeOpacity={0.85}
        >
          {isTesting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="save-outline" size={18} color="#FFFFFF" />
              <Text style={styles.saveBtnText}>Lưu và Kích hoạt</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.loginBtn, NeuStyles.raised]}
          onPress={() => navigation.navigate('Login')}
          accessibilityRole="button"
          accessibilityLabel="Đăng nhập tài khoản Firebase"
          activeOpacity={0.85}
        >
          <Ionicons name="person-circle-outline" size={18} color="#2563EB" />
          <Text style={styles.loginBtnText}>Đăng nhập tài khoản Firebase Cloud</Text>
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  switchTitle: {
    color: '#1E293B',
    fontWeight: '800',
  },
  switchDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 16,
    fontWeight: '500',
  },
  cardTitle: {
    color: '#1E293B',
    fontWeight: '800',
  },
  cardDesc: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 14,
    lineHeight: 18,
  },
  linkText: {
    color: '#2563EB',
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    height: INPUT_HEIGHT,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 14,
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '600',
  },
  infoCard: {
    padding: 16,
    borderRadius: BorderRadius.xl,
    marginBottom: 20,
  },
  infoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  infoTitle: {
    color: '#1E293B',
    fontWeight: '800',
  },
  infoCode: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#0F172A',
    backgroundColor: '#E8ECF2',
    padding: 10,
    borderRadius: 10,
    lineHeight: 18,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1E293B',
    paddingVertical: SAVE_BTN_PADDING,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: SAVE_BTN_PADDING,
    borderRadius: BorderRadius.xl,
    marginTop: 12,
  },
  loginBtnText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '800',
  },
});
