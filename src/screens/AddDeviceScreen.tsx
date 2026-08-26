import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  StatusBar,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, NeuStyles, NeuPalette } from '../theme';
import { useHome } from '../context/HomeContext';
import { Header } from '../components/Header';
import { GlassCard } from '../components/GlassCard';
import { DeviceType, Device } from '../types';
import { AppNavigationProp } from '../navigation/types';

// Constants
const ESP_AP_BASE_URL = 'http://192.168.4.1';
const SCAN_TIMEOUT = 3000;
const CONFIG_TIMEOUT = 4000;

interface DeviceTypeOption {
  type: DeviceType;
  name: string;
  desc: string;
  icon: any;
}

const DEVICE_TYPES: DeviceTypeOption[] = [
  {
    type: 'light',
    name: 'Công tắc / Đèn thông minh (Relay)',
    desc: 'Đèn trần, đèn chùm, công tắc cơ tường',
    icon: 'lightbulb',
  },
  {
    type: 'rgb_light',
    name: 'Đèn LED Dây RGB NeoPixel (WS2812B)',
    desc: 'Đèn hắt trần, LED trang trí bàn làm việc',
    icon: 'palette',
  },
  {
    type: 'ac',
    name: 'Bộ phát hồng ngoại IR Điều Hòa (AC)',
    desc: 'Điều khiển máy lạnh Daikin, Panasonic...',
    icon: 'ac-unit',
  },
  {
    type: 'camera',
    name: 'Camera AI Giám Sát (ESP32-CAM)',
    desc: 'Nhận diện người, cảnh báo xâm nhập',
    icon: 'videocam',
  },
  {
    type: 'sensor',
    name: 'Cảm biến Môi trường (DHT22/BME280)',
    desc: 'Đo nhiệt độ, độ ẩm, chất lượng không khí',
    icon: 'thermostat',
  },
];

// Sinh thuộc tính mặc định phù hợp với từng loại thiết bị, tránh gán thừa trường
const buildTypeDefaults = (type: DeviceType): Partial<Device> => {
  switch (type) {
    case 'light':
      return { brightness: 80 };
    case 'rgb_light':
      return { brightness: 80, color: '#00E5FF', rgbMode: 'solid' };
    case 'ac':
      return { temperature: 24, acMode: 'cool' };
    case 'sensor':
      return { currentTemperature: undefined, humidity: undefined };
    default:
      return {};
  }
};

export const AddDeviceScreen: React.FC = () => {
  const navigation = useNavigation<AppNavigationProp>();
  const { rooms, addDevice, firebaseConfig, activeHomeId } = useHome();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedType, setSelectedType] = useState<DeviceType>('light');
  const [deviceName, setDeviceName] = useState('Đèn trần thông minh');
  const [selectedRoomId, setSelectedRoomId] = useState(rooms[0]?.id || 'room_living');
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPass, setWifiPass] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  // Không tự bịa danh sách mạng: chỉ hiện kết quả quét thật từ ESP32
  const [scannedNetworks, setScannedNetworks] = useState<string[]>([]);
  // Cờ đánh dấu thiết bị được thêm ở chế độ mô phỏng (không kết nối ESP32 thật)
  const [pairingSimulated, setPairingSimulated] = useState(false);

  const handleBack = useCallback(() => {
    if (step > 1 && step < 4) {
      setStep((prev) => (prev - 1) as 1 | 2 | 3);
    } else {
      navigation.goBack();
    }
  }, [step, navigation]);

  const handleTypeSelect = useCallback((type: DeviceType, name: string) => {
    setSelectedType(type);
    setDeviceName(name.split('(')[0].trim());
  }, []);

  const handleScanWifiFromESP = useCallback(async () => {
    setIsScanning(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SCAN_TIMEOUT);

      const res = await fetch(`${ESP_AP_BASE_URL}/scan`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.networks && data.networks.length > 0) {
          setScannedNetworks(data.networks.map((n: any) => n.ssid));
        } else {
          setScannedNetworks([]);
          Alert.alert(
            'Không tìm thấy mạng',
            'ESP32 không quét được mạng WiFi nào xung quanh. Vui lòng nhập tên WiFi thủ công bên dưới.'
          );
        }
      } else {
        setScannedNetworks([]);
        Alert.alert(
          'Quét WiFi thất bại',
          'ESP32 phản hồi nhưng không trả về danh sách mạng. Vui lòng nhập tên WiFi thủ công.'
        );
      }
    } catch {
      setScannedNetworks([]);
      Alert.alert(
        'Không kết nối được ESP32',
        'Không quét được WiFi từ thiết bị. Hãy chắc chắn điện thoại đang kết nối vào WiFi phát từ ESP32 (Tu-SmartHome), hoặc nhập tên WiFi thủ công bên dưới.'
      );
    } finally {
      setIsScanning(false);
    }
  }, []);

  const handleStartPairing = useCallback(async () => {
    if (!wifiSsid.trim()) {
      Alert.alert('Lỗi', 'Vui lòng chọn hoặc nhập tên WiFi');
      return;
    }

    setIsConnecting(true);

    const targetRoom = rooms.find((r) => r.id === selectedRoomId) || rooms[0] || {
      id: 'room_living',
      name: 'Phòng khách',
    };
    const generatedDeviceId = `dev_${selectedType}_${Date.now().toString().slice(-4)}`;

    const payload = {
      ssid: wifiSsid.trim(),
      password: wifiPass.trim(),
      databaseUrl: firebaseConfig.databaseURL,
      apiKey: firebaseConfig.apiKey || '',
      homeId: activeHomeId,
      deviceId: generatedDeviceId,
      deviceName: deviceName.trim(),
      roomName: targetRoom.name,
    };

    let esp32Ok = false;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG_TIMEOUT);

      const res = await fetch(`${ESP_AP_BASE_URL}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      esp32Ok = res.ok;
    } catch {
      esp32Ok = false;
    }

    setIsConnecting(false);

    const addAndFinish = (simulated: boolean) => {
      const typeDefaults = buildTypeDefaults(selectedType);
      const newDev: Device = {
        id: generatedDeviceId,
        name: deviceName.trim(),
        type: selectedType,
        roomId: targetRoom.id,
        roomName: targetRoom.name,
        isOnline: !simulated && esp32Ok,
        isOn: false,
        lastUpdated: new Date().toISOString(),
        ...typeDefaults,
        desired: {
          isOn: false,
          ...typeDefaults,
        },
        reported: {
          isOn: false,
          isOnline: !simulated && esp32Ok,
          lastSeenAt: Date.now(),
        },
      };
      setPairingSimulated(simulated);
      addDevice(newDev);
      setStep(4);
    };

    if (esp32Ok) {
      addAndFinish(false);
      return;
    }

    // ESP32 không phản hồi → hỏi rõ người dùng
    Alert.alert(
      'Không liên lạc được ESP32',
      'Thiết bị không phản hồi lệnh cấu hình. Hãy kiểm tra:\n• Điện thoại đã kết nối WiFi phát từ ESP32 (Tu-SmartHome)?\n• ESP32 đã được cấp nguồn và đang ở chế độ AP?\n\nBạn có thể thêm thiết bị ở chế độ mô phỏng (offline) để dùng thử giao diện, hoặc hủy để thử lại.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Thêm chế độ mô phỏng',
          onPress: () => addAndFinish(true),
        },
      ]
    );
  }, [wifiSsid, wifiPass, selectedRoomId, selectedType, deviceName, rooms, firebaseConfig, activeHomeId, addDevice]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#E8ECF2" />
      <Header
        showBack
        onBackPress={handleBack}
        title="Ghép nối Thiết bị"
        subtitle={`Bước ${step}/4: ${
          step === 1
            ? 'Chọn loại thiết bị'
            : step === 2
            ? 'Đặt tên & Vị trí'
            : step === 3
            ? 'Cấu hình WiFi'
            : 'Hoàn tất'
        }`}
      />

      {/* Neumorphic Step Progress Indicator */}
      <View style={styles.progressRow}>
        {[1, 2, 3, 4].map((s) => (
          <View
            key={s}
            style={[
              styles.progressDot,
              s <= step ? styles.progressDotActive : styles.progressDotInactive,
            ]}
          />
        ))}
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* STEP 1: SELECT DEVICE TYPE */}
        {step === 1 && (
          <View>
            <Text style={styles.sectionHeading}>CHỌN LOẠI THIẾT BỊ ESP32</Text>
            {DEVICE_TYPES.map((dt) => {
              const isSelected = selectedType === dt.type;
              return (
                <Pressable
                  key={dt.type}
                  style={({ pressed }) => [
                    styles.typeCard,
                    isSelected ? [NeuStyles.pressed, styles.typeCardActive] : NeuStyles.raisedSoft,
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={() => handleTypeSelect(dt.type, dt.name)}
                  accessibilityRole="button"
                  accessibilityLabel={`Chọn loại ${dt.name}`}
                >
                  <View style={[styles.typeIconBox, NeuStyles.cavity]}>
                    <MaterialIcons
                      name={dt.icon}
                      size={24}
                      color={isSelected ? '#2563EB' : '#475569'}
                    />
                  </View>
                  <View style={styles.typeInfo}>
                    <Text style={[Typography.titleMedium, styles.typeName]}>
                      {dt.name}
                    </Text>
                    <Text style={styles.typeDesc}>{dt.desc}</Text>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={22} color="#2563EB" />
                  )}
                </Pressable>
              );
            })}

            <Pressable
              style={({ pressed }) => [
                styles.nextBtn,
                NeuStyles.raisedSoft,
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => setStep(2)}
              accessibilityRole="button"
              accessibilityLabel="Tiếp tục sang bước 2"
            >
              <Text style={styles.nextBtnText}>Tiếp tục</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        )}

        {/* STEP 2: NAME & ROOM ASSIGNMENT */}
        {step === 2 && (
          <View>
            <View style={[styles.card, NeuStyles.raised]}>
              <Text style={[Typography.titleMedium, styles.cardTitle]}>
                Thông tin thiết bị
              </Text>
              <Text style={styles.label}>TÊN THIẾT BỊ</Text>
              <TextInput
                style={[styles.input, NeuStyles.cavity]}
                value={deviceName}
                onChangeText={setDeviceName}
                placeholder="VD: Đèn phòng khách"
                placeholderTextColor="#94A3B8"
              />

              <Text style={[styles.label, { marginTop: 14 }]}>VỊ TRÍ PHÒNG</Text>
              <View style={styles.roomsChipGrid}>
                {rooms.map((r) => {
                  const isSelected = selectedRoomId === r.id;
                  return (
                    <Pressable
                      key={r.id}
                      style={({ pressed }) => [
                        styles.roomChip,
                        isSelected ? [NeuStyles.pressed, styles.roomChipActive] : NeuStyles.cavity,
                        pressed && { opacity: 0.85 },
                      ]}
                      onPress={() => setSelectedRoomId(r.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Chọn phòng ${r.name}`}
                    >
                      <Text
                        style={[
                          styles.roomChipText,
                          isSelected && styles.roomChipTextActive,
                        ]}
                      >
                        {r.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.nextBtn,
                NeuStyles.raisedSoft,
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => setStep(3)}
              accessibilityRole="button"
              accessibilityLabel="Tiếp tục sang bước 3"
            >
              <Text style={styles.nextBtnText}>Tiếp tục</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        )}

        {/* STEP 3: WIFI PROVISIONING VIA AP MODE */}
        {step === 3 && (
          <View>
            <View style={[styles.guidanceCard, NeuStyles.cavity]}>
              <Ionicons name="information-circle" size={20} color="#2563EB" />
              <Text style={styles.guidanceText}>
                Kết nối điện thoại vào WiFi phát từ ESP32 (VD: ESP32_Setup_xxxx) trước khi bấm kết nối.
              </Text>
            </View>

            <View style={[styles.card, NeuStyles.raised]}>
              <View style={styles.scanRow}>
                <Text style={[Typography.titleMedium, styles.cardTitle]}>
                  WiFi nhà bạn (2.4GHz)
                </Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.scanBtn,
                    NeuStyles.raisedSoft,
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={handleScanWifiFromESP}
                  disabled={isScanning}
                  accessibilityRole="button"
                  accessibilityLabel="Quét mạng WiFi"
                >
                  {isScanning ? (
                    <ActivityIndicator size="small" color="#2563EB" />
                  ) : (
                    <Text style={styles.scanBtnText}>Quét WiFi</Text>
                  )}
                </Pressable>
              </View>

              <View style={styles.wifiChipGrid}>
                {scannedNetworks.map((net) => {
                  const isSelected = wifiSsid === net;
                  return (
                    <Pressable
                      key={net}
                      style={({ pressed }) => [
                        styles.wifiChip,
                        isSelected ? [NeuStyles.pressed, styles.wifiChipActive] : NeuStyles.cavity,
                        pressed && { opacity: 0.85 },
                      ]}
                      onPress={() => setWifiSsid(net)}
                      accessibilityRole="button"
                      accessibilityLabel={`Chọn mạng WiFi ${net}`}
                    >
                      <Ionicons
                        name="wifi"
                        size={14}
                        color={isSelected ? '#2563EB' : '#64748B'}
                      />
                      <Text
                        style={[
                          styles.wifiChipText,
                          isSelected && styles.wifiChipTextActive,
                        ]}
                      >
                        {net}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.label}>TÊN WIFI (SSID)</Text>
              <TextInput
                style={[styles.input, NeuStyles.cavity]}
                value={wifiSsid}
                onChangeText={setWifiSsid}
                placeholder="Nhập SSID WiFi"
                placeholderTextColor="#94A3B8"
              />

              <Text style={[styles.label, { marginTop: 14 }]}>MẬT KHẨU WIFI</Text>
              <TextInput
                style={[styles.input, NeuStyles.cavity]}
                value={wifiPass}
                onChangeText={setWifiPass}
                placeholder="Nhập mật khẩu WiFi"
                placeholderTextColor="#94A3B8"
                secureTextEntry
              />
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.nextBtn,
                NeuStyles.raisedSoft,
                pressed && { opacity: 0.85 },
              ]}
              onPress={handleStartPairing}
              disabled={isConnecting}
              accessibilityRole="button"
              accessibilityLabel="Gửi cấu hình sang ESP32"
            >
              {isConnecting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.nextBtnText}>Gửi cấu hình sang ESP32</Text>
                  <Ionicons name="cloud-upload" size={18} color="#FFFFFF" />
                </>
              )}
            </Pressable>
          </View>
        )}

        {/* STEP 4: SUCCESS */}
        {step === 4 && (
          <View style={[styles.successCard, NeuStyles.raised]}>
            <View style={[styles.successIconBox, NeuStyles.cavity]}>
              <Ionicons
                name={pairingSimulated ? 'cloud-offline' : 'checkmark-circle'}
                size={56}
                color={pairingSimulated ? '#F59E0B' : '#10B981'}
              />
            </View>
            <Text style={[Typography.displayLarge, styles.successTitle]}>
              {pairingSimulated ? 'Đã thêm (Mô phỏng)' : 'Thành công!'}
            </Text>
            <Text style={styles.successDesc}>
              {pairingSimulated
                ? 'Thiết bị đã được thêm ở chế độ mô phỏng (offline) để bạn dùng thử giao diện. Kết nối ESP32 thật và cấu hình lại để điều khiển thực tế.'
                : 'Thiết bị đã được kết nối vào WiFi nhà bạn và sẵn sàng điều khiển từ xa qua Firebase Realtime Database.'}
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.finishBtn,
                NeuStyles.raisedSoft,
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => navigation.navigate('MainTabs')}
              accessibilityRole="button"
              accessibilityLabel="Hoàn tất và quay lại màn hình chính"
            >
              <Text style={styles.finishBtnText}>Về màn hình chính</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#E8ECF2',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 10,
  },
  progressDot: {
    width: 28,
    height: 6,
    borderRadius: 3,
  },
  progressDotActive: {
    backgroundColor: '#2563EB',
  },
  progressDotInactive: {
    backgroundColor: '#CBD5E1',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing.marginMobile,
    paddingBottom: 40,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: BorderRadius.xl,
    marginBottom: 12,
  },
  typeCardActive: {
    borderWidth: 1.5,
    borderColor: 'rgba(59, 130, 246, 0.5)',
  },
  typeIconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  typeInfo: {
    flex: 1,
  },
  typeName: {
    color: '#1E293B',
    fontWeight: '800',
  },
  typeDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  card: {
    padding: 18,
    borderRadius: BorderRadius.xl,
    marginBottom: 16,
  },
  cardTitle: {
    color: '#1E293B',
    fontWeight: '800',
    marginBottom: 14,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
  },
  roomsChipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roomChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  roomChipActive: {
    backgroundColor: '#E8ECF2',
    borderWidth: 1.5,
    borderColor: '#2563EB',
  },
  roomChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  roomChipTextActive: {
    color: '#2563EB',
  },
  guidanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: BorderRadius.lg,
    marginBottom: 14,
    gap: 10,
  },
  guidanceText: {
    flex: 1,
    fontSize: 12,
    color: '#334155',
    lineHeight: 16,
    fontWeight: '500',
  },
  scanRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  scanBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  scanBtnText: {
    fontSize: 11,
    color: '#2563EB',
    fontWeight: '800',
  },
  wifiChipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  wifiChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  wifiChipActive: {
    borderWidth: 1,
    borderColor: '#2563EB',
  },
  wifiChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  wifiChipTextActive: {
    color: '#2563EB',
    fontWeight: '800',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1E293B',
    paddingVertical: 14,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
    marginTop: 10,
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  successCard: {
    alignItems: 'center',
    padding: 30,
    borderRadius: BorderRadius.xxl,
    marginVertical: 20,
  },
  successIconBox: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 8,
  },
  successDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 28,
  },
  finishBtn: {
    backgroundColor: '#1E293B',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  finishBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
