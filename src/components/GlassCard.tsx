import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Colors, NeuStyles, BorderRadius } from '../theme';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'default' | 'elevated' | 'tinted' | 'dark' | 'pressed' | 'cavity' | 'flat';
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  style,
  variant = 'default',
}) => {
  const getVariantStyle = () => {
    switch (variant) {
      case 'pressed':
        return NeuStyles.pressed;
      case 'cavity':
        return NeuStyles.cavity;
      case 'elevated':
        return [NeuStyles.raised, styles.elevated];
      case 'tinted':
        return [NeuStyles.raised, styles.tinted];
      case 'dark':
        return styles.dark;
      case 'flat':
        return styles.flat;
      default:
        return NeuStyles.raised;
    }
  };

  return (
    <View style={[styles.baseCard, getVariantStyle(), style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  baseCard: {
    padding: 16,
    borderRadius: BorderRadius.xl,
  },
  elevated: {
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#FFFFFF',
  },
  tinted: {
    backgroundColor: '#E2E8F0',
  },
  dark: {
    backgroundColor: '#1E293B',
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  flat: {
    backgroundColor: Colors.surfaceContainer,
    borderRadius: BorderRadius.xl,
  },
});
