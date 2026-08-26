import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { Typography, BorderRadius, NeuStyles } from '../theme';
import { GlassCard } from './GlassCard';
import { HomeOverview } from '../types';

interface EnvironmentalCockpitProps {
  overview: HomeOverview;
}

export const EnvironmentalCockpit: React.FC<EnvironmentalCockpitProps> = React.memo(({ overview }) => {
  return (
    <GlassCard variant="elevated" style={styles.overviewCard}>
      <View style={styles.overviewHeader}>
        <View style={styles.overviewTitleRow}>
          <View style={[styles.cockpitIconWrap, NeuStyles.cavity]}>
            <MaterialIcons name="home-work" size={18} color="#2563EB" />
          </View>
          <Text style={[Typography.titleMedium, styles.overviewTitle]}>
            Môi trường trong nhà
          </Text>
        </View>
        <View style={[styles.liveTag, NeuStyles.cavity]}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Trực tiếp</Text>
        </View>
      </View>

      <View style={styles.metricsGrid}>
        <View style={[styles.metricItem, NeuStyles.cavity]}>
          <View style={styles.metricIconWrap}>
            <MaterialIcons name="thermostat" size={20} color="#EA580C" />
          </View>
          <Text style={styles.metricValue}>{overview.avgTemperature}°C</Text>
          <Text style={styles.metricLabel}>Nhiệt độ</Text>
        </View>

        <View style={[styles.metricItem, NeuStyles.cavity]}>
          <View style={styles.metricIconWrap}>
            <Ionicons name="water" size={20} color="#0284C7" />
          </View>
          <Text style={styles.metricValue}>{overview.avgHumidity}%</Text>
          <Text style={styles.metricLabel}>Độ ẩm</Text>
        </View>

        <View style={[styles.metricItem, NeuStyles.cavity]}>
          <View style={styles.metricIconWrap}>
            <MaterialIcons name="air" size={20} color="#059669" />
          </View>
          <Text style={styles.metricValue}>Tốt (24)</Text>
          <Text style={styles.metricLabel}>AQI</Text>
        </View>

        <View style={[styles.metricItem, NeuStyles.cavity]}>
          <View style={styles.metricIconWrap}>
            <MaterialIcons name="bolt" size={20} color="#7C3AED" />
          </View>
          <Text style={styles.metricValue}>{overview.powerConsumptionWatts}W</Text>
          <Text style={styles.metricLabel}>Công suất</Text>
        </View>
      </View>
    </GlassCard>
  );
});

const styles = StyleSheet.create({
  overviewCard: {
    marginBottom: 20,
  },
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  overviewTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cockpitIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overviewTitle: {
    color: '#1E293B',
    fontWeight: '800',
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 3,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
    textTransform: 'uppercase',
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
  },
  metricIconWrap: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
  },
});
