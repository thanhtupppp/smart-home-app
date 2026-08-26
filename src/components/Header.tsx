import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, NeuStyles, NeuPalette } from '../theme';
import { useHome } from '../context/HomeContext';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  onNotificationPress?: () => void;
  onSettingsPress?: () => void;
  showBack?: boolean;
  onBackPress?: () => void;
  rightAction?: React.ReactNode;
}

/** Cấu hình badge theo trạng thái kết nối thật */
const CONNECTION_BADGE = {
  connected: {
    led: '#10B981',
    ledShadow: '#10B981',
    icon: 'cloud-done' as const,
    iconColor: '#059669',
    text: 'Online',
  },
  reconnecting: {
    led: '#F59E0B',
    ledShadow: '#F59E0B',
    icon: 'cloud-upload-outline' as const,
    iconColor: '#D97706',
    text: 'Đồng bộ…',
  },
  offline: {
    led: '#EF4444',
    ledShadow: '#EF4444',
    icon: 'cloud-offline-outline' as const,
    iconColor: '#DC2626',
    text: 'Offline',
  },
} as const;

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  onNotificationPress,
  onSettingsPress,
  showBack = false,
  onBackPress,
  rightAction,
}) => {
  const { overview, unreadAlertCount, firebaseConfig, connectionStatus } = useHome();

  const badge = firebaseConfig.isDemoMode
    ? {
        led: '#94A3B8',
        ledShadow: 'transparent',
        icon: 'cloud-offline' as const,
        iconColor: '#64748B',
        text: 'Demo',
      }
    : CONNECTION_BADGE[connectionStatus];

  return (
    <View style={styles.container}>
      <View style={styles.leftSection}>
        {showBack ? (
          <Pressable
            onPress={onBackPress}
            style={({ pressed }) => [
              styles.circleBtn,
              NeuStyles.circleRaised,
              pressed && { opacity: 0.8 },
            ]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={20} color="#1E293B" />
          </Pressable>
        ) : (
          <View>
            <Text style={[Typography.titleMedium, styles.subtitle]}>
              {subtitle || 'Xin chào 👋'}
            </Text>
            <Text style={[Typography.headlineMedium, styles.title]}>
              {title || overview.homeName}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.rightSection}>
        {/* Trạng thái kết nối thật — không phải badge giả */}
        <View style={[styles.cloudBadge, NeuStyles.cavity]}>
          <View
            style={[
              styles.statusLed,
              {
                backgroundColor: badge.led,
                boxShadow: badge.ledShadow === 'transparent' ? 'none' : `0 0 6px ${badge.ledShadow}`,
              },
            ]}
          />
          <Ionicons name={badge.icon} size={15} color={badge.iconColor} />
          <Text style={styles.cloudText}>{badge.text}</Text>
        </View>

        {rightAction}

        {onNotificationPress && (
          <Pressable
            style={({ pressed }) => [
              styles.circleBtn,
              NeuStyles.circleRaised,
              pressed && { opacity: 0.8 },
            ]}
            onPress={onNotificationPress}
          >
            <Ionicons name="notifications-outline" size={20} color="#334155" />
            {unreadAlertCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadAlertCount}</Text>
              </View>
            )}
          </Pressable>
        )}

        {onSettingsPress && (
          <Pressable
            style={({ pressed }) => [
              styles.circleBtn,
              NeuStyles.circleRaised,
              pressed && { opacity: 0.8 },
            ]}
            onPress={onSettingsPress}
          >
            <Ionicons name="settings-outline" size={20} color="#334155" />
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.marginMobile,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: '#E8ECF2',
  },
  leftSection: {
    flex: 1,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  subtitle: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '500',
  },
  title: {
    color: '#1E293B',
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  circleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cloudBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 5,
  },
  statusLed: {
    width: 6,
    height: 6,
    borderRadius: 3,
    boxShadow: '0 0 4px rgba(0, 0, 0, 0.2)',
  },
  cloudText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '700',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#EF4444',
    borderRadius: 9,
    minWidth: 17,
    height: 17,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    boxShadow: '0 0 4px #EF4444',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
});
