import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Typography, NeuStyles } from '../theme';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = React.memo(({
  title,
  actionLabel,
  onPress,
  accessibilityLabel,
}) => {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[Typography.headlineSmall, styles.sectionTitle]}>
        {title}
      </Text>
      {actionLabel && onPress && (
        <TouchableOpacity
          style={[styles.pillLink, NeuStyles.cavity]}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel || actionLabel}
          activeOpacity={0.85}
        >
          <Text style={styles.seeAllText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 14,
  },
  sectionTitle: {
    color: '#1E293B',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  pillLink: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  seeAllText: {
    fontSize: 12,
    color: '#2563EB',
    fontWeight: '800',
  },
});
