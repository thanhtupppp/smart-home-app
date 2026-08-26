import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  StatusBar,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, NeuStyles, NeuPalette } from '../theme';
import { useHome } from '../context/HomeContext';
import { Header } from '../components/Header';
import { GlassCard } from '../components/GlassCard';
import { DeviceCard } from '../components/DeviceCard';
import { NeuSkeleton } from '../components/NeuSkeleton';
import { RootStackParamList, AppNavigationProp } from '../navigation/types';
import { Device } from '../types';

// Constants
const SENSOR_ICON_SIZE = 24;
const LED_SIZE = 7;
const ACTION_BTN_PADDING_VERTICAL = 11;

const isControllableDevice = (
  dev: Device
): dev is Device & { type: 'rgb_light' | 'ac' | 'camera' } => {
  return ['rgb_light', 'ac', 'camera'].includes(dev.type);
};

export const RoomDetailScreen: React.FC = () => {
  const navigation = useNavigation<AppNavigationProp>();
  const route = useRoute<RouteProp<RootStackParamList, 'RoomDetail'>>();
  const { roomId } = route.params;

  const { rooms, devices, toggleDevice, turnAllDevices, updateRoom, removeRoom } = useHome();

  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editedName, setEditedName] = useState('');

  const room = useMemo(
    () => rooms.find((r) => r.id === roomId),
    [rooms, roomId]
  );

  const roomDevices = useMemo(
    () => devices.filter((d) => d.roomId === roomId),
    [devices, roomId]
  );

  const handleDeviceDetail = useCallback(
    (dev: Device) => {
      if (dev.type === 'rgb_light') {
        navigation.navigate('RGBController', { deviceId: dev.id });
      } else if (dev.type === 'ac') {
        navigation.navigate('ACController', { deviceId: dev.id });
      } else if (dev.type === 'camera') {
        navigation.navigate('CameraDetail');
      }
    },
    [navigation]
  );

  const handleTurnAllOn = useCallback(() => {
    if (!room) return;
    turnAllDevices(true, room.id);
  }, [room, turnAllDevices]);

  const handleTurnAllOff = useCallback(() => {
    if (!room) return;
    turnAllDevices(false, room.id);
  }, [room, turnAllDevices]);

  const handleOpenEdit = useCallback(() => {
    if (!room) return;
    setEditedName(room.name);
    setIsEditModalVisible(true);
  }, [room]);

  const handleSaveEdit = useCallback(() => {
    if (!room) return;
    const trimmed = editedName.trim();
    if (!trimmed) {
      Alert.alert('Lỗi', 'Tên phòng không được để trống.');
      return;
    }
    updateRoom(room.id, { name: trimmed });
    setIsEditModalVisible(false);
    Alert.alert('Thành công', 'Đã cập nhật tên khu vực.');
  }, [room, editedName, updateRoom]);

  const handleDeleteRoom = useCallback(() => {
    if (!room) return;
    Alert.alert(
      'Xóa khu vực',
      `Bạn có chắc chắn muốn xóa "${room.name}"? Các thiết bị trong phòng sẽ được giữ lại.`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa phòng',
          style: 'destructive',
          onPress: () => {
            removeRoom(room.id);
            navigation.goBack();
          },
        },
      ]
    );
  }, [room, removeRoom, navigation]);

  if (!room) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header showBack onBackPress={() => navigation.goBack()} title="Đang tải phòng..." />
        <View style={styles.loadingContainer}>
          <NeuSkeleton width="100%" height={140} borderRadius={20} style={{ marginBottom: 16 }} />
          <NeuSkeleton width="100%" height={100} borderRadius={18} style={{ marginBottom: 16 }} />
          <NeuSkeleton width="100%" height={100} borderRadius={18} />
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
        title={room.name}
        subtitle={`${room.activeCount}/${room.deviceCount} thiết bị đang bật`}
        rightAction={
          <Pressable
            style={({ pressed }) => [
              styles.headerEditBtn,
              NeuStyles.circleRaised,
              pressed && { opacity: 0.85 },
            ]}
            onPress={handleOpenEdit}
            accessibilityRole="button"
            accessibilityLabel="Đổi tên phòng"
          >
            <Ionicons name="pencil" size={15} color="#2563EB" />
          </Pressable>
        }
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Room Environmental Status */}
        <GlassCard variant="elevated" style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={[styles.sensorBox, NeuStyles.cavity]}>
              <MaterialIcons name="thermostat" size={SENSOR_ICON_SIZE} color="#EA580C" />
              <View>
                <Text style={styles.sensorLabel}>Nhiệt độ phòng</Text>
                <Text style={styles.sensorValue}>{room.temperature || 25}°C</Text>
              </View>
            </View>

            <View style={[styles.sensorBox, NeuStyles.cavity]}>
              <Ionicons name="water" size={SENSOR_ICON_SIZE} color="#0284C7" />
              <View>
                <Text style={styles.sensorLabel}>Độ ẩm</Text>
                <Text style={styles.sensorValue}>{room.humidity || 60}%</Text>
              </View>
            </View>
          </View>

          {/* Quick All On / All Off for this Room */}
          <View style={styles.quickActionsRow}>
            <Pressable
              style={({ pressed }) => [
                styles.actionBtn,
                NeuStyles.raisedSoft,
                pressed && { opacity: 0.85 },
              ]}
              onPress={handleTurnAllOn}
              accessibilityRole="button"
              accessibilityLabel="Bật tất cả thiết bị trong phòng"
            >
              <View style={styles.greenLed} />
              <Text style={styles.btnTextOn}>Bật tất cả</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.actionBtn,
                NeuStyles.raisedSoft,
                pressed && { opacity: 0.85 },
              ]}
              onPress={handleTurnAllOff}
              accessibilityRole="button"
              accessibilityLabel="Tắt tất cả thiết bị trong phòng"
            >
              <View style={styles.redLed} />
              <Text style={styles.btnTextOff}>Tắt tất cả</Text>
            </Pressable>
          </View>
        </GlassCard>

        {/* Room Devices List */}
        <View style={styles.sectionHeader}>
          <Text style={[Typography.headlineSmall, styles.sectionTitle]}>
            Thiết bị trong phòng ({roomDevices.length})
          </Text>
        </View>

        {roomDevices.length === 0 ? (
          <View style={[styles.emptyState, NeuStyles.raised]}>
            <MaterialIcons name="devices" size={44} color="#94A3B8" />
            <Text style={styles.emptyText}>Chưa có thiết bị nào trong phòng này.</Text>
            <Pressable
              style={({ pressed }) => [
                styles.addDeviceBtn,
                NeuStyles.raisedSoft,
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => navigation.navigate('AddDevice')}
              accessibilityRole="button"
              accessibilityLabel="Thêm thiết bị vào phòng"
            >
              <Text style={styles.addDeviceBtnText}>+ Thêm thiết bị vào phòng</Text>
            </Pressable>
          </View>
        ) : (
          roomDevices.map((dev) => (
            <DeviceCard
              key={dev.id}
              device={dev}
              onToggle={() => toggleDevice(dev.id)}
              onPressDetail={
                isControllableDevice(dev)
                  ? () => handleDeviceDetail(dev)
                  : undefined
              }
            />
          ))
        )}

        {/* Delete Room Option */}
        <Pressable
          style={({ pressed }) => [
            styles.deleteRoomBtn,
            NeuStyles.raisedSoft,
            pressed && { opacity: 0.85 },
          ]}
          onPress={handleDeleteRoom}
        >
          <Ionicons name="trash-outline" size={18} color="#EF4444" />
          <Text style={styles.deleteRoomText}>Xóa khu vực này</Text>
        </Pressable>
      </ScrollView>

      {/* Edit Room Name Modal */}
      <Modal
        visible={isEditModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, NeuStyles.raised]}>
            <Text style={styles.modalTitle}>Đổi tên khu vực</Text>
            <View style={[styles.modalInputWrap, NeuStyles.cavity]}>
              <TextInput
                style={styles.modalInput}
                value={editedName}
                onChangeText={setEditedName}
                placeholder="Nhập tên phòng..."
                placeholderTextColor="#94A3B8"
                autoFocus
              />
            </View>
            <View style={styles.modalActionRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalCancelBtn,
                  NeuStyles.raisedSoft,
                  pressed && { opacity: 0.85 },
                ]}
                onPress={() => setIsEditModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Hủy</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalSaveBtn,
                  NeuStyles.raised,
                  pressed && { opacity: 0.85 },
                ]}
                onPress={handleSaveEdit}
              >
                <Text style={styles.modalSaveText}>Lưu</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
    padding: Spacing.marginMobile,
  },
  headerEditBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCard: {
    marginBottom: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sensorBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
  },
  sensorLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  sensorValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 2,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.6)',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: ACTION_BTN_PADDING_VERTICAL,
    borderRadius: BorderRadius.lg,
  },
  greenLed: {
    width: LED_SIZE,
    height: LED_SIZE,
    borderRadius: LED_SIZE / 2,
    backgroundColor: '#10B981',
  },
  redLed: {
    width: LED_SIZE,
    height: LED_SIZE,
    borderRadius: LED_SIZE / 2,
    backgroundColor: '#EF4444',
  },
  btnTextOn: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },
  btnTextOff: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#1E293B',
    fontWeight: '800',
    fontSize: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    borderRadius: BorderRadius.xl,
  },
  emptyText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 16,
    textAlign: 'center',
  },
  addDeviceBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: BorderRadius.lg,
  },
  addDeviceBtnText: {
    color: '#2563EB',
    fontWeight: '700',
    fontSize: 13,
  },
  deleteRoomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 24,
    paddingVertical: 12,
    borderRadius: BorderRadius.xl,
    backgroundColor: '#FEE2E2',
  },
  deleteRoomText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: '#E8ECF2',
    borderRadius: BorderRadius.xxl,
    padding: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 14,
  },
  modalInputWrap: {
    height: 46,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: 14,
    justifyContent: 'center',
    marginBottom: 16,
    backgroundColor: '#DFE5EC',
  },
  modalInput: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '700',
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8ECF2',
  },
  modalCancelText: {
    color: '#64748B',
    fontWeight: '700',
    fontSize: 13,
  },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
  },
  modalSaveText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
});
