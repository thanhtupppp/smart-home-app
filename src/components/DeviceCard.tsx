import React from 'react';
import { View, Text, StyleSheet, Pressable, Switch } from 'react-native';
import { MaterialIcons, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Typography, BorderRadius, NeuStyles, NeuPalette } from '../theme';
import { Device } from '../types';
import { StatusBadge } from './StatusBadge';

interface DeviceCardProps {
  device: Device;
  onToggle: () => void;
  onPressDetail?: () => void;
  onDelete?: () => void;
}

export const DeviceCard: React.FC<DeviceCardProps> = React.memo(({
  device,
  onToggle,
  onPressDetail,
  onDelete,
}) => {
  const getDeviceAccentColor = () => {
    switch (device.type) {
      case 'rgb_light':
        return device.color || '#38BDF8';
      case 'light':
        return '#F59E0B';
      case 'ac':
        return '#06B6D4';
      case 'sensor':
        return '#10B981';
      default:
        return '#3B82F6';
    }
  };

  const accentColor = getDeviceAccentColor();
  const hasDetailButton =
    (device.type === 'ac' || device.type === 'rgb_light' || device.type === 'camera') &&
    !!onPressDetail;

  const renderDeviceIcon = () => {
    const iconColor = device.isOn ? accentColor : '#64748B';
    switch (device.type) {
      case 'rgb_light':
        return <MaterialCommunityIcons name="palette" size={24} color={device.isOn ? accentColor : '#64748B'} />;
      case 'light':
        return <MaterialIcons name="lightbulb" size={24} color={device.isOn ? '#F59E0B' : '#64748B'} />;
      case 'ac':
        return <MaterialIcons name="ac-unit" size={24} color={device.isOn ? '#06B6D4' : '#64748B'} />;
      case 'switch':
        return <MaterialCommunityIcons name="power-socket-eu" size={24} color={iconColor} />;
      case 'curtain':
        return <MaterialCommunityIcons name="curtains" size={24} color={iconColor} />;
      case 'camera':
        return <Ionicons name="videocam" size={24} color={iconColor} />;
      case 'sensor':
        return <MaterialIcons name="thermostat" size={24} color="#EA580C" />;
      default:
        return <Ionicons name="hardware-chip" size={24} color={iconColor} />;
    }
  };

  const getSubStatusText = () => {
    if (!device.isOnline) return 'Ngoại tuyến (Offline)';
    if (device.type === 'sensor') {
      return `${device.currentTemperature || 25}°C • ${device.humidity || 60}%`;
    }
    if (device.type === 'ac') {
      return device.isOn ? `${device.temperature}°C • ${device.acMode?.toUpperCase()}` : 'Đã tắt';
    }
    if (device.type === 'rgb_light') {
      return device.isOn ? `Độ sáng ${device.brightness || 80}%` : 'Đã tắt';
    }
    if (device.type === 'light') {
      return device.isOn ? `Độ sáng ${device.brightness || 100}%` : 'Đã tắt';
    }
    return device.isOn ? 'Đang bật' : 'Đã tắt';
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        NeuStyles.raised,
        device.isOn && [styles.cardActive, { borderColor: accentColor }],
        !device.isOnline && styles.cardOffline,
        pressed && styles.cardPressed,
      ]}
      onPress={onPressDetail ? onPressDetail : onToggle}
      accessibilityRole="button"
      accessibilityLabel={`Thiết bị ${device.name}`}
    >
      <View style={styles.topRow}>
        <View
          style={[
            styles.iconBox,
            device.isOn ? [NeuStyles.cavity, styles.iconBoxActive] : NeuStyles.raisedSoft,
          ]}
        >
          {renderDeviceIcon()}
          {device.isOn && (
            <View
              style={[
                styles.iconGlowDot,
                { backgroundColor: accentColor, boxShadow: `0 0 6px ${accentColor}` },
              ]}
            />
          )}
        </View>

        {device.type === 'sensor' ? (
          <StatusBadge label="Cảm biến" status="info" />
        ) : (
          <View style={styles.switchWrapper}>
            <Switch
              value={device.isOn}
              onValueChange={onToggle}
              trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
              thumbColor={device.isOn ? '#2563EB' : '#F8FAFC'}
            />
          </View>
        )}
      </View>

      <View style={styles.bottomSection}>
        <Text style={[Typography.titleMedium, styles.deviceName]} numberOfLines={1}>
          {device.name}
        </Text>
        <Text style={[Typography.bodySmall, styles.roomName]} numberOfLines={1}>
          {device.roomName}
        </Text>

        <View style={styles.statusRow}>
          <View style={styles.statusPill}>
            <View
              style={[
                styles.statusLed,
                {
                  backgroundColor: !device.isOnline
                    ? '#94A3B8'
                    : device.isOn
                    ? accentColor
                    : '#CBD5E1',
                  boxShadow: device.isOn ? `0 0 4px ${accentColor}` : 'none',
                },
              ]}
            />
            <Text style={[Typography.bodySmall, styles.subStatusText]}>
              {getSubStatusText()}
            </Text>
          </View>

          {device.powerUsageWatts !== undefined && device.isOn && (
            <View style={[styles.powerBadge, NeuStyles.cavity]}>
              <Text style={styles.powerText}>{device.powerUsageWatts}W</Text>
            </View>
          )}
        </View>
      </View>

      {/* Detail indicator button for complex controllers */}
      {hasDetailButton && (
        <Pressable
          style={({ pressed }) => [
            styles.detailButton,
            pressed ? NeuStyles.circlePressed : NeuStyles.circleRaised,
          ]}
          onPress={onPressDetail}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={`Chi tiết ${device.name}`}
        >
          <Ionicons name="chevron-forward" size={14} color="#475569" />
        </Pressable>
      )}

      {onDelete && (
        <Pressable
          style={({ pressed }) => [
            styles.deleteButton,
            NeuStyles.circleRaised,
            hasDetailButton ? styles.deleteButtonShifted : null,
            pressed && { opacity: 0.7 },
          ]}
          onPress={onDelete}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={`Xóa thiết bị ${device.name}`}
        >
          <Ionicons name="trash-outline" size={13} color="#EF4444" />
        </Pressable>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    padding: 16,
    marginBottom: 14,
    position: 'relative',
    borderRadius: BorderRadius.xl,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  cardActive: {
    borderWidth: 1.5,
  },
  cardOffline: {
    opacity: 0.6,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconBoxActive: {
    backgroundColor: '#DFE5EE',
  },
  iconGlowDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    boxShadow: '0 0 4px rgba(0, 0, 0, 0.2)',
  },
  switchWrapper: {
    transform: [{ scaleX: 0.95 }, { scaleY: 0.95 }],
  },
  bottomSection: {
    marginTop: 2,
  },
  deviceName: {
    color: '#1E293B',
    fontWeight: '800',
    fontSize: 15,
    marginBottom: 2,
  },
  roomName: {
    color: '#64748B',
    fontSize: 12,
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusLed: {
    width: 6,
    height: 6,
    borderRadius: 3,
    boxShadow: '0 0 4px rgba(0, 0, 0, 0.2)',
  },
  subStatusText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  powerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  powerText: {
    fontSize: 11,
    color: '#2563EB',
    fontWeight: '800',
  },
  detailButton: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  deleteButton: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
  },
  deleteButtonShifted: {
    // 14 (right) + 28 (width nút chi tiết) + 8 (khoảng cách)
    right: 50,
  },
});
