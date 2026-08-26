import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Animated, ViewStyle, StyleProp } from 'react-native';
import { BorderRadius, NeuStyles } from '../theme';

interface NeuSkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export const NeuSkeleton: React.FC<NeuSkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius = BorderRadius.md,
  style,
}) => {
  const [opacity] = useState(() => new Animated.Value(0.4));

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.85,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();

    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        NeuStyles.cavity,
        {
          width: width as any,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
};

const CockpitSkeleton: React.FC = () => {
  return (
    <View style={[styles.cardWrapper, NeuStyles.raised]}>
      <View style={styles.headerRow}>
        <NeuSkeleton width={160} height={20} borderRadius={8} />
        <NeuSkeleton width={60} height={20} borderRadius={10} />
      </View>
      <View style={styles.metricsGrid}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={[styles.metricItem, NeuStyles.cavity]}>
            <NeuSkeleton width={28} height={28} borderRadius={14} style={{ marginBottom: 6 }} />
            <NeuSkeleton width={45} height={14} borderRadius={6} style={{ marginBottom: 4 }} />
            <NeuSkeleton width={35} height={10} borderRadius={4} />
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#DDE3EC',
  },
  cardWrapper: {
    padding: 16,
    borderRadius: BorderRadius.xl,
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  metricItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 14,
  },
});
