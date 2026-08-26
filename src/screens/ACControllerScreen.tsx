import React, { useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  StatusBar,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, NeuStyles, NeuPalette } from '../theme';
import { useHome } from '../context/HomeContext';
import { Header } from '../components/Header';
import { GlassCard } from '../components/GlassCard';
import { NeuSkeleton } from '../components/NeuSkeleton';
import { RootStackParamList, AppNavigationProp } from '../navigation/types';

// Constants
const TEMP_MIN = 16;
const TEMP_MAX = 30;
const DIAL_SIZE = 228;
const STEPPER_BUTTON_SIZE = 52;

const modeColors: Record<'cool' | 'heat' | 'dry' | 'fan' | 'eco', string> = {
  cool: '#06B6D4', // Cold cyan
  heat: '#EA580C', // Warm orange/red
  dry: '#0284C7',  // Water blue
  fan: '#64748B',  // Slate gray
  eco: '#059669',  // Eco green
};

const MODES: { id: 'cool' | 'heat' | 'dry' | 'fan' | 'eco'; name: string; icon: any }[] = [
  { id: 'cool', name: 'Làm lạnh', icon: 'ac-unit' },
  { id: 'heat', name: 'Sưởi ấm', icon: 'local-fire-department' },
  { id: 'dry', name: 'Hút ẩm', icon: 'water-drop' },
  { id: 'fan', name: 'Quạt gió', icon: 'toys' },
  { id: 'eco', name: 'Tiết kiệm', icon: 'eco' },
];

const FAN_SPEEDS: { id: 'auto' | 'low' | 'medium' | 'high'; name: string }[] = [
  { id: 'auto', name: 'Tự động' },
  { id: 'low', name: 'Thấp' },
  { id: 'medium', name: 'Vừa' },
  { id: 'high', name: 'Mạnh' },
];

export const ACControllerScreen: React.FC = () => {
  const navigation = useNavigation<AppNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'ACController'>>();
  const { deviceId } = route.params;

  const { devices, updateDevice, toggleDevice } = useHome();

  const device = useMemo(
    () => devices.find((d) => d.id === deviceId),
    [devices, deviceId]
  );

  const targetTemp = useMemo(() => device?.temperature || 24, [device]);
  const currentTemp = useMemo(() => device?.currentTemperature || 26.2, [device]);
  const acMode = useMemo(() => device?.acMode || 'cool', [device]);
  const fanSpeed = useMemo(() => device?.fanSpeed || 'auto', [device]);

  const handleTempChange = useCallback(
    (delta: number) => {
      if (!device) return;
      const next = Math.max(TEMP_MIN, Math.min(TEMP_MAX, targetTemp + delta));
      updateDevice(device.id, { temperature: next, isOn: true });
    },
    [device, targetTemp, updateDevice]
  );

  const handleModeChange = useCallback(
    (mode: typeof acMode) => {
      if (!device) return;
      updateDevice(device.id, { acMode: mode, isOn: true });
    },
    [device, updateDevice]
  );

  const handleSpeedChange = useCallback(
    (speed: typeof fanSpeed) => {
      if (!device) return;
      updateDevice(device.id, { fanSpeed: speed, isOn: true });
    },
    [device, updateDevice]
  );

  if (!device) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header showBack onBackPress={() => navigation.goBack()} title="Đang tải thiết bị..." />
        <View style={styles.loadingContainer}>
          <NeuSkeleton width={180} height={180} borderRadius={90} style={{ marginBottom: 20 }} />
          <NeuSkeleton width="90%" height={80} borderRadius={20} />
        </View>
      </SafeAreaView>
    );
  }

  const currentModeColor = modeColors[acMode] || '#06B6D4';

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#E8ECF2" />
      <Header
        showBack
        onBackPress={() => navigation.goBack()}
        title={device.name}
        subtitle={device.roomName}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Neumorphic 3D Temperature Dial Knob */}
        <View style={styles.dialContainer}>
          <View style={[styles.dialOuterRing, NeuStyles.circleRaised]}>
            <View style={[styles.dialBezel, NeuStyles.cavity]}>
              <View style={[styles.dialInner, NeuStyles.circleRaised]}>
                <Text style={styles.roomTempLabel}>Hiện tại {currentTemp}°C</Text>
                <View style={styles.tempValueWrap}>
                  <Text style={styles.targetTempDisplay}>{targetTemp}</Text>
                  <Text style={styles.tempUnitText}>°C</Text>
                </View>
                <View style={[styles.modeIndicatorPill, NeuStyles.cavity]}>
                  <View
                    style={[
                      styles.modeLed,
                      {
                        backgroundColor: device.isOn ? currentModeColor : '#94A3B8',
                        boxShadow: device.isOn ? `0 0 6px ${currentModeColor}` : 'none',
                      },
                    ]}
                  />
                  <Text style={[styles.modeSubText, device.isOn && { color: currentModeColor }]}>
                    {device.isOn ? acMode.toUpperCase() : 'TẮT NGUỒN'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Stepper Mechanical Round Buttons */}
          <View style={styles.stepperRow}>
            <Pressable
              style={({ pressed }) => [
                styles.stepperBtn,
                NeuStyles.circleRaised,
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => handleTempChange(-1)}
              accessibilityRole="button"
              accessibilityLabel="Giảm 1 độ"
            >
              <Ionicons name="remove" size={26} color="#1E293B" />
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.stepperBtn,
                NeuStyles.circleRaised,
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => handleTempChange(1)}
              accessibilityRole="button"
              accessibilityLabel="Tăng 1 độ"
            >
              <Ionicons name="add" size={26} color="#1E293B" />
            </Pressable>
          </View>
        </View>

        {/* Master Power Toggle */}
        <GlassCard style={styles.toggleCard}>
          <View style={styles.toggleRow}>
            <View>
              <Text style={[Typography.titleMedium, styles.toggleTitle]}>
                Bật / Tắt điều hòa
              </Text>
              <Text style={styles.toggleSubtitle}>
                {device.isOn ? 'Đang hoạt động' : 'Đã ngắt nguồn'}
              </Text>
            </View>
            <Switch
              value={device.isOn}
              onValueChange={() => toggleDevice(device.id)}
              trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
              thumbColor={device.isOn ? '#2563EB' : '#F8FAFC'}
            />
          </View>
        </GlassCard>

        {/* Working Modes */}
        <GlassCard style={styles.sectionCard}>
          <Text style={[Typography.titleMedium, styles.sectionTitle]}>
            Chế độ hoạt động
          </Text>
          <View style={styles.modesRow}>
            {MODES.map((m) => {
              const isSelected = acMode === m.id;
              const modeItemColor = modeColors[m.id];
              return (
                <Pressable
                  key={m.id}
                  style={({ pressed }) => [
                    styles.modeBtn,
                    isSelected ? [NeuStyles.pressed, styles.modeBtnActive, { borderColor: modeItemColor }] : NeuStyles.raisedSoft,
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={() => handleModeChange(m.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Chế độ ${m.name}`}
                >
                  <MaterialIcons
                    name={m.icon}
                    size={22}
                    color={isSelected ? '#FFFFFF' : '#475569'}
                  />
                  <Text
                    style={[
                      styles.modeBtnText,
                      isSelected && styles.modeBtnTextActive,
                    ]}
                  >
                    {m.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </GlassCard>

        {/* Fan Speed */}
        <GlassCard style={styles.sectionCard}>
          <Text style={[Typography.titleMedium, styles.sectionTitle]}>
            Tốc độ gió
          </Text>
          <View style={styles.speedsRow}>
            {FAN_SPEEDS.map((s) => {
              const isSelected = fanSpeed === s.id;
              return (
                <Pressable
                  key={s.id}
                  style={({ pressed }) => [
                    styles.speedBtn,
                    isSelected ? [NeuStyles.pressed, styles.speedBtnActive] : NeuStyles.raisedSoft,
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={() => handleSpeedChange(s.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Tốc độ gió ${s.name}`}
                >
                  <Text
                    style={[
                      styles.speedBtnText,
                      isSelected && styles.speedBtnTextActive,
                    ]}
                  >
                    {s.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </GlassCard>

        {/* Energy Consumption Telemetry */}
        <GlassCard style={styles.energyCard}>
          <View style={styles.energyHeader}>
            <MaterialIcons name="bolt" size={20} color="#2563EB" />
            <Text style={[Typography.titleMedium, styles.energyTitle]}>
              Thống kê điện năng
            </Text>
          </View>

          <View style={styles.energyGrid}>
            <View style={[styles.energyItem, NeuStyles.cavity]}>
              <Text style={styles.energyVal}>
                {device.isOn ? `${device.powerUsageWatts || 680}W` : '0W'}
              </Text>
              <Text style={styles.energyLbl}>Công suất</Text>
            </View>

            <View style={[styles.energyItem, NeuStyles.cavity]}>
              <Text style={styles.energyVal}>3.4 kWh</Text>
              <Text style={styles.energyLbl}>Hôm nay</Text>
            </View>

            <View style={[styles.energyItem, NeuStyles.cavity]}>
              <Text style={styles.energyVal}>~8.500 đ</Text>
              <Text style={styles.energyLbl}>Ước tính</Text>
            </View>
          </View>
        </GlassCard>
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  dialContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 14,
  },
  dialOuterRing: {
    width: DIAL_SIZE,
    height: DIAL_SIZE,
    borderRadius: DIAL_SIZE / 2,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialBezel: {
    width: 206,
    height: 206,
    borderRadius: 103,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialInner: {
    width: 188,
    height: 188,
    borderRadius: 94,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomTempLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 2,
  },
  tempValueWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  targetTempDisplay: {
    fontSize: 54,
    fontWeight: '800',
    color: '#1E293B',
    lineHeight: 62,
    letterSpacing: -1,
  },
  tempUnitText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 8,
    marginLeft: 2,
  },
  modeIndicatorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    marginTop: 2,
  },
  modeLed: {
    width: 6,
    height: 6,
    borderRadius: 3,
    boxShadow: '0 0 4px rgba(0, 0, 0, 0.2)',
  },
  modeSubText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
    letterSpacing: 0.5,
  },
  stepperRow: {
    flexDirection: 'row',
    gap: 36,
    marginTop: 18,
  },
  stepperBtn: {
    width: STEPPER_BUTTON_SIZE,
    height: STEPPER_BUTTON_SIZE,
    borderRadius: STEPPER_BUTTON_SIZE / 2,
  },
  toggleCard: {
    marginBottom: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleTitle: {
    color: '#1E293B',
    fontWeight: '800',
  },
  toggleSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  sectionCard: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#1E293B',
    fontWeight: '800',
    marginBottom: 14,
  },
  modesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  modeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderRadius: 12,
    gap: 4,
  },
  modeBtnActive: {
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
  },
  modeBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  modeBtnTextActive: {
    color: '#FFFFFF',
  },
  speedsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  speedBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
  },
  speedBtnActive: {
    backgroundColor: '#1E293B',
  },
  speedBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  speedBtnTextActive: {
    color: '#FFFFFF',
  },
  energyCard: {
    marginBottom: 16,
  },
  energyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  energyTitle: {
    color: '#1E293B',
    fontWeight: '800',
  },
  energyGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  energyItem: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
  },
  energyVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2563EB',
    marginBottom: 2,
  },
  energyLbl: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
});
