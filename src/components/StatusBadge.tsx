import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, BorderRadius, NeuStyles } from '../theme';

interface StatusBadgeProps {
  label: string;
  status?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  dot?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  status = 'neutral',
  dot = true,
}) => {
  const getBadgeColors = () => {
    switch (status) {
      case 'success':
        return { text: '#059669', dot: '#10B981', glow: 'rgba(16, 185, 129, 0.4)' };
      case 'warning':
        return { text: '#D97706', dot: '#F59E0B', glow: 'rgba(245, 158, 11, 0.4)' };
      case 'error':
        return { text: '#DC2626', dot: '#EF4444', glow: 'rgba(239, 68, 68, 0.4)' };
      case 'info':
        return { text: '#0284C7', dot: '#0EA5E9', glow: 'rgba(14, 165, 233, 0.4)' };
      default:
        return { text: '#64748B', dot: '#94A3B8', glow: 'transparent' };
    }
  };

  const currentTheme = getBadgeColors();

  return (
    <View style={[styles.badge, NeuStyles.cavity]}>
      {dot && (
        <View style={[styles.dotWrapper, { shadowColor: currentTheme.dot }]}>
          <View style={[styles.dot, { backgroundColor: currentTheme.dot }]} />
        </View>
      )}
      <Text style={[Typography.bodySmall, styles.label, { color: currentTheme.text }]}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  dotWrapper: {
    marginRight: 6,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
