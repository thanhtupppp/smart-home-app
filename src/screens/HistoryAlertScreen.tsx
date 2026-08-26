import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, NeuStyles, NeuPalette } from '../theme';
import { useHome } from '../context/HomeContext';
import { Header } from '../components/Header';
import { AppNavigationProp } from '../navigation/types';

// Constants
const ICON_SIZE = 20;
const ICON_WRAP_SIZE = 40;
const UNREAD_DOT_SIZE = 8;

type FilterType = 'all' | 'security' | 'device';

const FILTER_CHIPS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'security', label: 'An ninh' },
  { id: 'device', label: 'Thiết bị' },
] as const;

export const HistoryAlertScreen: React.FC = () => {
  const navigation = useNavigation<AppNavigationProp>();
  const { alerts, markAlertAsRead, markAllAlertsAsRead } = useHome();
  const [filterType, setFilterType] = useState<FilterType>('all');

  const filteredAlerts = useMemo(() => {
    if (filterType === 'all') return alerts;
    return alerts.filter((a) => a.type === filterType);
  }, [alerts, filterType]);

  const unreadCount = useMemo(() => {
    return alerts.filter((a) => !a.isRead).length;
  }, [alerts]);

  const getAlertIcon = useCallback((type: string) => {
    switch (type) {
      case 'security':
        return <MaterialIcons name="security" size={ICON_SIZE} color="#EF4444" />;
      case 'device':
        return <Ionicons name="hardware-chip" size={ICON_SIZE} color="#2563EB" />;
      default:
        return <Ionicons name="information-circle" size={ICON_SIZE} color="#0284C7" />;
    }
  }, []);

  const handleFilterChange = useCallback((type: FilterType) => {
    setFilterType(type);
  }, []);

  const handleMarkAsRead = useCallback(
    (alertId: string) => {
      markAlertAsRead(alertId);
    },
    [markAlertAsRead]
  );

  const handleMarkAllAsRead = useCallback(() => {
    markAllAlertsAsRead();
  }, [markAllAlertsAsRead]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#E8ECF2" />
      <Header
        showBack
        onBackPress={() => navigation.goBack()}
        title="Lịch sử & Cảnh báo"
        subtitle={
          unreadCount > 0
            ? `${unreadCount} thông báo chưa đọc`
            : 'Đã đọc tất cả thông báo'
        }
      />

      {/* Filter Chips & Mark All Read Bar */}
      <View style={styles.topActionBar}>
        <View style={[styles.filterContainer, NeuStyles.cavity]}>
          {FILTER_CHIPS.map((chip) => {
            const isSelected = filterType === chip.id;
            return (
              <TouchableOpacity
                key={chip.id}
                style={[
                  styles.filterBtn,
                  isSelected ? [NeuStyles.pressed, styles.filterBtnActive] : styles.filterBtnInactive,
                ]}
                onPress={() => handleFilterChange(chip.id)}
                accessibilityRole="button"
                accessibilityLabel={`Lọc theo ${chip.label}`}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.filterText,
                    isSelected && styles.filterTextActive,
                  ]}
                >
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {unreadCount > 0 && (
          <TouchableOpacity
            style={[styles.markAllBtn, NeuStyles.raisedSoft]}
            onPress={handleMarkAllAsRead}
            accessibilityRole="button"
            accessibilityLabel="Đánh dấu tất cả thông báo là đã đọc"
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark-done" size={16} color="#2563EB" />
            <Text style={styles.markAllText}>Đọc tất cả</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {filteredAlerts.length === 0 ? (
          <View style={[styles.emptyState, NeuStyles.raised]}>
            <Ionicons name="notifications-off-outline" size={48} color="#94A3B8" />
            <Text style={[Typography.titleMedium, styles.emptyTitle]}>
              Không có cảnh báo nào
            </Text>
            <Text style={styles.emptyDesc}>
              Hệ thống an ninh và các thiết bị trong ngôi nhà đang hoạt động hoàn toàn bình thường.
            </Text>
          </View>
        ) : (
          filteredAlerts.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.alertCard,
                NeuStyles.raised,
                !item.isRead && styles.alertCardUnread,
              ]}
              onPress={() => handleMarkAsRead(item.id)}
              accessibilityRole="button"
              accessibilityLabel={`Thông báo: ${item.title}`}
              activeOpacity={0.85}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.iconWrap, NeuStyles.cavity]}>
                  {getAlertIcon(item.type)}
                </View>

                <View style={styles.infoCol}>
                  <View style={styles.titleRow}>
                    <Text style={[Typography.titleMedium, styles.alertTitle]}>
                      {item.title}
                    </Text>
                    {!item.isRead && <View style={styles.unreadDot} />}
                  </View>
                  <Text style={styles.timestamp}>{item.timestamp}</Text>
                </View>
              </View>

              <Text style={styles.alertMsg}>{item.message}</Text>
            </TouchableOpacity>
          ))
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
  topActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.marginMobile,
    marginBottom: 14,
    gap: 10,
  },
  filterContainer: {
    flex: 1,
    flexDirection: 'row',
    padding: 4,
    borderRadius: BorderRadius.xl,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
  },
  filterBtnInactive: {
    backgroundColor: 'transparent',
  },
  filterBtnActive: {
    backgroundColor: '#E8ECF2',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  filterTextActive: {
    color: '#2563EB',
    fontWeight: '800',
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: BorderRadius.lg,
  },
  markAllText: {
    fontSize: 11,
    color: '#2563EB',
    fontWeight: '800',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing.marginMobile,
    paddingBottom: 40,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 36,
    marginVertical: 20,
    borderRadius: BorderRadius.xl,
  },
  emptyTitle: {
    color: '#1E293B',
    fontWeight: '800',
    marginTop: 12,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  alertCard: {
    padding: 16,
    borderRadius: BorderRadius.xl,
    marginBottom: 12,
  },
  alertCardUnread: {
    borderWidth: 1.5,
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconWrap: {
    width: ICON_WRAP_SIZE,
    height: ICON_WRAP_SIZE,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoCol: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  alertTitle: {
    color: '#1E293B',
    fontWeight: '800',
    flex: 1,
    paddingRight: 6,
  },
  unreadDot: {
    width: UNREAD_DOT_SIZE,
    height: UNREAD_DOT_SIZE,
    borderRadius: UNREAD_DOT_SIZE / 2,
    backgroundColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 3,
  },
  timestamp: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  alertMsg: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
    fontWeight: '500',
  },
});
