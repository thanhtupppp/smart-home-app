import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, NeuStyles, NeuPalette } from '../theme';
import { useHome } from '../context/HomeContext';
import { Header } from '../components/Header';
import { AppNavigationProp } from '../navigation/types';
import { firebaseService } from '../services/firebaseService';

// Constants
const ICON_SIZE = 20;
const UNREAD_DOT_SIZE = 8;

type FilterType = 'all' | 'alert' | 'activity' | 'security';

interface HistoryItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'security' | 'warning' | 'info' | 'device' | 'activity';
  isRead?: boolean;
  actor?: string;
}

const FILTER_CHIPS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'alert', label: 'Cảnh báo' },
  { id: 'activity', label: 'Nhật ký lệnh' },
  { id: 'security', label: 'An ninh' },
] as const;

const getAlertIcon = (type: HistoryItem['type']) => {
  switch (type) {
    case 'security':
      return <MaterialIcons name="security" size={ICON_SIZE} color="#EF4444" />;
    case 'warning':
      return <Ionicons name="warning" size={ICON_SIZE} color="#F59E0B" />;
    case 'activity':
      return <MaterialIcons name="touch-app" size={ICON_SIZE} color="#2563EB" />;
    case 'device':
      return <MaterialIcons name="devices" size={ICON_SIZE} color="#10B981" />;
    case 'info':
    default:
      return <Ionicons name="information-circle" size={ICON_SIZE} color="#3B82F6" />;
  }
};

interface AlertRowItemProps {
  item: HistoryItem;
  onMarkAsRead: (id: string) => void;
}

const AlertRowItem = React.memo<AlertRowItemProps>(({ item, onMarkAsRead }) => {
  const handlePress = useCallback(() => {
    onMarkAsRead(item.id);
  }, [item.id, onMarkAsRead]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.alertCard,
        NeuStyles.raised,
        item.isRead === false && styles.alertCardUnread,
        pressed && { opacity: 0.85 },
      ]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Thông báo: ${item.title}`}
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
            {item.isRead === false && <View style={styles.unreadDot} />}
          </View>
          <View style={styles.metaRow}>
            <Text style={styles.timestamp}>{item.timestamp}</Text>
            {item.actor && (
              <Text style={styles.actorTag}>• Bởi {item.actor}</Text>
            )}
          </View>
        </View>
      </View>

      <Text style={styles.alertMsg}>{item.message}</Text>
    </Pressable>
  );
});

export const HistoryAlertScreen: React.FC = () => {
  const navigation = useNavigation<AppNavigationProp>();
  const { alerts, markAlertAsRead, markAllAlertsAsRead, activeHomeId } = useHome();
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [logs, setLogs] = useState<HistoryItem[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Fetch real audit logs from Firebase
  // react-doctor-disable-next-line react-doctor/no-set-state-after-await-in-effect
  useEffect(() => {
    let isMounted = true;
    const fetchAuditLogs = async () => {
      setIsLoadingLogs(true);
      try {
        const rawLogs = await firebaseService.fetchLogs(30);
        if (rawLogs && isMounted) {
          const mappedLogs: HistoryItem[] = rawLogs.map((l: any, idx: number) => ({
            id: l.id || `log_${idx}_${l.timestamp || Date.now()}`,
            title: l.title || 'Hoạt động thiết bị',
            message: l.description || 'Lệnh điều khiển được gửi',
            timestamp: l.timestamp ? new Date(l.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : 'Vừa xong',
            type: l.type === 'alert' ? 'warning' : 'activity',
            isRead: true,
            actor: l.user || 'Ứng dụng',
          }));
          setLogs(mappedLogs);
        }
      } catch {
        // Fallback
      } finally {
        if (isMounted) setIsLoadingLogs(false);
      }
    };

    fetchAuditLogs();

    return () => {
      isMounted = false;
    };
  }, [activeHomeId]);

  // Combine static alerts & dynamic logs
  const allItems = useMemo<HistoryItem[]>(() => {
    const staticAlerts: HistoryItem[] = alerts.map((a) => ({
      id: a.id,
      title: a.title,
      message: a.message,
      timestamp: a.timestamp,
      type: a.type,
      isRead: a.isRead,
      actor: 'Cảm biến ESP32',
    }));

    return [...staticAlerts, ...logs];
  }, [alerts, logs]);

  const filteredItems = useMemo(() => {
    if (filterType === 'all') return allItems;
    if (filterType === 'alert') return allItems.filter((i) => i.type === 'warning' || i.type === 'security');
    if (filterType === 'activity') return allItems.filter((i) => i.type === 'activity' || i.type === 'device' || i.type === 'info');
    if (filterType === 'security') return allItems.filter((i) => i.type === 'security');
    return allItems;
  }, [allItems, filterType]);

  const unreadCount = useMemo(
    () => alerts.filter((a) => !a.isRead).length,
    [alerts]
  );

  const handleFilterChange = useCallback((id: FilterType) => {
    setFilterType(id);
  }, []);

  const handleMarkAsRead = useCallback(
    (id: string) => {
      markAlertAsRead(id);
    },
    [markAlertAsRead]
  );

  const renderAlertItem = useCallback(
    ({ item }: { item: HistoryItem }) => (
      <AlertRowItem item={item} onMarkAsRead={handleMarkAsRead} />
    ),
    [handleMarkAsRead]
  );

  const renderHeader = () => (
    <View style={styles.topActionBar}>
      <View style={[styles.filterContainer, NeuStyles.cavity]}>
        {FILTER_CHIPS.map((chip) => {
          const isSelected = filterType === chip.id;
          return (
            <Pressable
              key={chip.id}
              style={({ pressed }) => [
                styles.filterBtn,
                isSelected ? [NeuStyles.pressed, styles.filterBtnActive] : styles.filterBtnInactive,
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => handleFilterChange(chip.id)}
              accessibilityRole="button"
              accessibilityLabel={`Lọc theo ${chip.label}`}
            >
              <Text
                style={[
                  styles.filterText,
                  isSelected && styles.filterTextActive,
                ]}
              >
                {chip.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {unreadCount > 0 && (
        <Pressable
          style={({ pressed }) => [
            styles.markAllBtn,
            NeuStyles.raisedSoft,
            pressed && { opacity: 0.85 },
          ]}
          onPress={markAllAlertsAsRead}
          accessibilityRole="button"
          accessibilityLabel="Đánh dấu tất cả thông báo là đã đọc"
        >
          <Ionicons name="checkmark-done" size={16} color="#2563EB" />
          <Text style={styles.markAllText}>Đọc tất cả</Text>
        </Pressable>
      )}
    </View>
  );

  const renderEmpty = () => {
    if (isLoadingLogs && allItems.length === 0) {
      return (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      );
    }
    return (
      <View style={[styles.emptyState, NeuStyles.raised]}>
        <Ionicons name="notifications-off-outline" size={48} color="#94A3B8" />
        <Text style={[Typography.titleMedium, styles.emptyTitle]}>
          Không có sự kiện nào
        </Text>
        <Text style={styles.emptyDesc}>
          Hệ thống an ninh và các thiết bị trong ngôi nhà đang hoạt động hoàn toàn bình thường.
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#E8ECF2" />
      <Header
        showBack
        onBackPress={() => navigation.goBack()}
        title="Lịch sử & Cảnh báo"
        subtitle={
          unreadCount > 0
            ? `${unreadCount} cảnh báo chưa xem`
            : 'Tất cả trạng thái bình thường'
        }
      />

      <FlatList
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        data={filteredItems}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        renderItem={renderAlertItem}
      />
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
    gap: 8,
  },
  filterContainer: {
    flex: 1,
    flexDirection: 'row',
    padding: 3,
    borderRadius: BorderRadius.xl,
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.lg,
  },
  filterBtnActive: {
    backgroundColor: '#2563EB',
  },
  filterBtnInactive: {
    backgroundColor: 'transparent',
  },
  filterText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: BorderRadius.lg,
    gap: 4,
  },
  markAllText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing.marginMobile,
    paddingBottom: 40,
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyState: {
    borderRadius: BorderRadius.xxl,
    padding: 32,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyTitle: {
    color: '#1E293B',
    marginTop: 12,
    marginBottom: 6,
  },
  emptyDesc: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  alertCard: {
    borderRadius: BorderRadius.xl,
    padding: 16,
    marginBottom: 12,
  },
  alertCardUnread: {
    borderLeftWidth: 3.5,
    borderLeftColor: '#2563EB',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  unreadDot: {
    width: UNREAD_DOT_SIZE,
    height: UNREAD_DOT_SIZE,
    borderRadius: UNREAD_DOT_SIZE / 2,
    backgroundColor: '#EF4444',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  timestamp: {
    fontSize: 11,
    color: '#64748B',
  },
  actorTag: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '600',
  },
  alertMsg: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
  },
});
