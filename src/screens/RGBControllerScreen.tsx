import React, { useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Switch,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, NeuStyles, NeuPalette } from '../theme';
import { useHome } from '../context/HomeContext';
import { Header } from '../components/Header';
import { GlassCard } from '../components/GlassCard';
import { NeuSkeleton } from '../components/NeuSkeleton';
import { RootStackParamList, AppNavigationProp } from '../navigation/types';

// Constants
const BRIGHTNESS_STEP = 10;
const BRIGHTNESS_MIN = 0;
const BRIGHTNESS_MAX = 100;
const BULB_SIZE = 116;
const GLOW_SIZE = 170;

const getLuminance = (hex: string): number => {
  const cleanHex = hex.replace('#', '');
  const rgb = parseInt(cleanHex, 16);
  const r = (rgb >> 16) & 0xff;
  const g = (rgb >> 8) & 0xff;
  const b = (rgb >> 0) & 0xff;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const RGBControllerScreen: React.FC = () => {
  const navigation = useNavigation<AppNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'RGBController'>>();
  const { deviceId } = route.params;

  const { devices, updateDevice, toggleDevice } = useHome();

  const device = useMemo(
    () => devices.find((d) => d.id === deviceId),
    [devices, deviceId]
  );

  const currentColor = useMemo(() => device?.color || '#00E5FF', [device]);
  const currentBrightness = useMemo(() => device?.brightness ?? 80, [device]);
  const currentMode = useMemo(() => device?.rgbMode || 'solid', [device]);

  // Dynamic glow pulse animation for breathing mode
  const glowAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    if (device?.isOn && currentMode === 'breathing') {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 0.65,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 0.2,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
    } else {
      glowAnim.setValue((currentBrightness / 100) * 0.35);
    }

    return () => {
      if (animation) animation.stop();
    };
  }, [currentMode, device?.isOn, currentBrightness, glowAnim]);

  const colorPresets = [
    { name: 'Cyan Neon', hex: '#00E5FF' },
    { name: 'Tím Cyber', hex: '#8B5CF6' },
    { name: 'Hồng Neon', hex: '#EC4899' },
    { name: 'Đỏ Lửa', hex: '#EF4444' },
    { name: 'Vàng Nắng', hex: '#F59E0B' },
    { name: 'Xanh Lá', hex: '#10B981' },
    { name: 'Xanh Dương', hex: '#3B82F6' },
    { name: 'Trắng Ấm', hex: '#FFFBEB' },
    { name: 'Trắng Lạnh', hex: '#E0F2FE' },
    { name: 'Cam Hoàng Hôn', hex: '#F97316' },
  ];

  const effectModes: { id: 'solid' | 'rainbow' | 'breathing' | 'strobe'; name: string; icon: any }[] = [
    { id: 'solid', name: 'Đơn sắc', icon: 'palette' },
    { id: 'breathing', name: 'Nhịp thở', icon: 'favorite' },
    { id: 'rainbow', name: 'Cầu vồng', icon: 'looks' },
    { id: 'strobe', name: 'Nhấp nháy', icon: 'flash-on' },
  ];

  const handleColorChange = useCallback(
    (hex: string) => {
      if (!device) return;
      updateDevice(device.id, { color: hex, isOn: true });
    },
    [device, updateDevice]
  );

  const handleBrightnessStep = useCallback(
    (step: number) => {
      if (!device) return;
      const next = Math.max(BRIGHTNESS_MIN, Math.min(BRIGHTNESS_MAX, currentBrightness + step));
      updateDevice(device.id, { brightness: next, isOn: next > 0 });
    },
    [device, currentBrightness, updateDevice]
  );

  const handleModeChange = useCallback(
    (mode: 'solid' | 'rainbow' | 'breathing' | 'strobe') => {
      if (!device) return;
      updateDevice(device.id, { rgbMode: mode, isOn: true });
    },
    [device, updateDevice]
  );

  if (!device) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header showBack onBackPress={() => navigation.goBack()} title="Đang tải thiết bị..." />
        <View style={styles.loadingContainer}>
          <NeuSkeleton width={130} height={130} borderRadius={65} style={{ marginBottom: 20 }} />
          <NeuSkeleton width="90%" height={80} borderRadius={20} />
        </View>
      </SafeAreaView>
    );
  }

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
        {/* Neumorphic 3D Bulb Dome with Animated Pulse Glow */}
        <View style={styles.previewContainer}>
          {device.isOn && (
            <Animated.View
              style={[
                styles.glowAura,
                {
                  backgroundColor: currentColor,
                  opacity: glowAnim,
                  shadowColor: currentColor,
                },
              ]}
            />
          )}
          <View style={[styles.bulbDomeOuter, NeuStyles.circleRaised]}>
            <View
              style={[
                styles.bulbDomeInner,
                NeuStyles.cavity,
                device.isOn && { backgroundColor: currentColor },
              ]}
            >
              <MaterialCommunityIcons
                name="lightbulb-on"
                size={50}
                color={
                  device.isOn
                    ? getLuminance(currentColor) > 180
                      ? '#1E293B'
                      : '#FFFFFF'
                    : '#94A3B8'
                }
              />
            </View>
          </View>

          <View style={[styles.colorHexBadge, NeuStyles.cavity]}>
            <View
              style={[
                styles.hexDot,
                {
                  backgroundColor: device.isOn ? currentColor : '#94A3B8',
                  shadowColor: device.isOn ? currentColor : 'transparent',
                },
              ]}
            />
            <Text style={styles.colorHexText}>
              {device.isOn ? currentColor.toUpperCase() : 'TẮT NGUỒN'}
            </Text>
          </View>
        </View>

        {/* Master Power Toggle */}
        <GlassCard style={styles.toggleCard}>
          <View style={styles.toggleRow}>
            <View>
              <Text style={[Typography.titleMedium, styles.toggleTitle]}>
                Trạng thái nguồn
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

        {/* Brightness Control */}
        <GlassCard style={styles.sectionCard}>
          <View style={styles.sectionTitleRow}>
            <MaterialIcons name="brightness-6" size={18} color="#2563EB" />
            <Text style={[Typography.titleMedium, styles.sectionTitle]}>
              Độ sáng: {currentBrightness}%
            </Text>
          </View>

          <View style={styles.brightnessControlRow}>
            <TouchableOpacity
              style={[styles.stepBtn, NeuStyles.circleRaised]}
              onPress={() => handleBrightnessStep(-BRIGHTNESS_STEP)}
              accessibilityRole="button"
              accessibilityLabel="Giảm 10% độ sáng"
              activeOpacity={0.85}
            >
              <Ionicons name="remove" size={20} color="#1E293B" />
            </TouchableOpacity>

            {/* Visual Brightness Bar Inset Track */}
            <View style={[styles.brightnessBarTrack, NeuStyles.cavity]}>
              <View
                style={[
                  styles.brightnessBarFill,
                  {
                    width: `${currentBrightness}%`,
                    backgroundColor: device.isOn ? currentColor : '#2563EB',
                  },
                ]}
              />
            </View>

            <TouchableOpacity
              style={[styles.stepBtn, NeuStyles.circleRaised]}
              onPress={() => handleBrightnessStep(BRIGHTNESS_STEP)}
              accessibilityRole="button"
              accessibilityLabel="Tăng 10% độ sáng"
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={20} color="#1E293B" />
            </TouchableOpacity>
          </View>

          {/* Quick Brightness Presets */}
          <View style={styles.quickBrightnessRow}>
            {[25, 50, 75, 100].map((val) => (
              <TouchableOpacity
                key={val}
                style={[
                  styles.quickBrightBtn,
                  currentBrightness === val ? [NeuStyles.pressed, styles.quickBrightBtnActive] : NeuStyles.raisedSoft,
                ]}
                onPress={() => updateDevice(device.id, { brightness: val, isOn: true })}
                accessibilityRole="button"
                accessibilityLabel={`Đặt độ sáng ${val}%`}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.quickBrightText,
                    currentBrightness === val && styles.quickBrightTextActive,
                  ]}
                >
                  {val}%
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </GlassCard>

        {/* Color Palette Grid */}
        <GlassCard style={styles.sectionCard}>
          <View style={styles.sectionTitleRow}>
            <MaterialIcons name="palette" size={18} color="#2563EB" />
            <Text style={[Typography.titleMedium, styles.sectionTitle]}>
              Bảng màu yêu thích
            </Text>
          </View>

          <View style={styles.colorsGrid}>
            {colorPresets.map((preset) => {
              const isSelected = currentColor.toLowerCase() === preset.hex.toLowerCase();
              const isLight = getLuminance(preset.hex) > 180;
              return (
                <View key={preset.hex} style={[styles.colorSocket, NeuStyles.cavity]}>
                  <TouchableOpacity
                    style={[
                      styles.colorCircle,
                      { backgroundColor: preset.hex },
                      isSelected && styles.colorCircleSelected,
                    ]}
                    onPress={() => handleColorChange(preset.hex)}
                    accessibilityRole="button"
                    accessibilityLabel={`Chọn màu ${preset.name}`}
                    activeOpacity={0.85}
                  >
                    {isSelected && (
                      <Ionicons
                        name="checkmark"
                        size={18}
                        color={isLight ? '#1E293B' : '#FFFFFF'}
                      />
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </GlassCard>

        {/* Dynamic Effects */}
        <GlassCard style={styles.sectionCard}>
          <View style={styles.sectionTitleRow}>
            <MaterialCommunityIcons name="auto-fix" size={18} color="#2563EB" />
            <Text style={[Typography.titleMedium, styles.sectionTitle]}>
              Hiệu ứng chuyển động
            </Text>
          </View>

          <View style={styles.effectsRow}>
            {effectModes.map((mode) => {
              const isSelected = currentMode === mode.id;
              return (
                <TouchableOpacity
                  key={mode.id}
                  style={[
                    styles.effectBtn,
                    isSelected ? [NeuStyles.pressed, styles.effectBtnActive] : NeuStyles.raisedSoft,
                  ]}
                  onPress={() => handleModeChange(mode.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Hiệu ứng ${mode.name}`}
                  activeOpacity={0.85}
                >
                  <MaterialIcons
                    name={mode.icon}
                    size={20}
                    color={isSelected ? '#FFFFFF' : '#334155'}
                  />
                  <Text
                    style={[
                      styles.effectText,
                      isSelected && styles.effectTextActive,
                    ]}
                  >
                    {mode.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
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
  previewContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 18,
    height: 190,
  },
  glowAura: {
    position: 'absolute',
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    borderRadius: GLOW_SIZE / 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 30,
  },
  bulbDomeOuter: {
    width: BULB_SIZE,
    height: BULB_SIZE,
    borderRadius: BULB_SIZE / 2,
    padding: 8,
  },
  bulbDomeInner: {
    flex: 1,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorHexBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    marginTop: 14,
  },
  hexDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  colorHexText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
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
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    color: '#1E293B',
    fontWeight: '800',
  },
  brightnessControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  stepBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  brightnessBarTrack: {
    flex: 1,
    height: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  brightnessBarFill: {
    height: '100%',
    borderRadius: 8,
  },
  quickBrightnessRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  quickBrightBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    alignItems: 'center',
  },
  quickBrightBtnActive: {
    backgroundColor: '#1E293B',
  },
  quickBrightText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  quickBrightTextActive: {
    color: '#FFFFFF',
  },
  colorsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  colorSocket: {
    width: 48,
    height: 48,
    borderRadius: 24,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorCircleSelected: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.05 }],
  },
  effectsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  effectBtn: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    marginBottom: 4,
  },
  effectBtnActive: {
    backgroundColor: '#1E293B',
    borderColor: 'rgba(59, 130, 246, 0.4)',
    borderWidth: 1.5,
  },
  effectText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  effectTextActive: {
    color: '#FFFFFF',
  },
});
