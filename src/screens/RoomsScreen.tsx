import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  StatusBar,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, NeuStyles, NeuPalette } from '../theme';
import { useHome } from '../context/HomeContext';
import { Header } from '../components/Header';
import { GlassCard } from '../components/GlassCard';
import { RoomCard } from '../components/RoomCard';
import { AppNavigationProp } from '../navigation/types';

// Constants
const MODAL_MAX_WIDTH = 360;
const ADD_BTN_SIZE = 44;
const MODAL_INPUT_HEIGHT = 48;

const ROOM_ICONS = [
  { id: 'meeting-room', name: 'Phòng khách', icon: 'weekend' },
  { id: 'bed', name: 'Phòng ngủ', icon: 'bed' },
  { id: 'kitchen', name: 'Bếp ăn', icon: 'kitchen' },
  { id: 'bathtub', name: 'Phòng tắm', icon: 'bathtub' },
  { id: 'work', name: 'Làm việc', icon: 'computer' },
  { id: 'yard', name: 'Sân vườn', icon: 'grass' },
];

export const RoomsScreen: React.FC = () => {
  const navigation = useNavigation<AppNavigationProp>();
  const { rooms, addRoom } = useHome();
  const [modalVisible, setModalVisible] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('meeting-room');

  // Derived stats
  const totalStats = useMemo(() => {
    const totalDevices = rooms.reduce((sum, r) => sum + r.deviceCount, 0);
    const activeDevices = rooms.reduce((sum, r) => sum + r.activeCount, 0);
    return { totalDevices, activeDevices };
  }, [rooms]);

  const handleOpenModal = useCallback(() => {
    setNewRoomName('');
    setSelectedIcon('meeting-room');
    setModalVisible(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
  }, []);

  const handleAddRoom = useCallback(() => {
    const trimmed = newRoomName.trim();
    if (!trimmed) {
      Alert.alert('Lỗi', 'Vui lòng nhập tên phòng.');
      return;
    }

    if (trimmed.length < 2) {
      Alert.alert('Thông báo', 'Tên phòng phải có ít nhất 2 ký tự.');
      return;
    }

    if (trimmed.length > 40) {
      Alert.alert('Thông báo', 'Tên phòng không được vượt quá 40 ký tự.');
      return;
    }

    addRoom({
      id: `room_${Date.now()}`,
      name: trimmed,
      iconName: selectedIcon,
      deviceCount: 0,
      activeCount: 0,
      temperature: 26,
      humidity: 60,
    });

    setNewRoomName('');
    setModalVisible(false);
  }, [newRoomName, selectedIcon, addRoom]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#E8ECF2" />
      <Header
        title="Quản lý Phòng"
        subtitle={`${rooms.length} khu vực • ${totalStats.totalDevices} thiết bị`}
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Action Bar */}
        <View style={styles.topBar}>
          <Text style={styles.sectionHeading}>TỔNG QUAN KHU VỰC</Text>
          <Pressable
            style={({ pressed }) => [
              styles.addBtn,
              NeuStyles.circleRaised,
              pressed && { opacity: 0.85 },
            ]}
            onPress={handleOpenModal}
            accessibilityRole="button"
            accessibilityLabel="Thêm phòng mới"
          >
            <Ionicons name="add" size={20} color="#2563EB" />
          </Pressable>
        </View>

        {/* Statistics Summary Card */}
        <GlassCard style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={[styles.statCol, NeuStyles.cavity]}>
              <Text style={styles.statVal}>{rooms.length}</Text>
              <Text style={styles.statLbl}>Khu vực</Text>
            </View>

            <View style={[styles.statCol, NeuStyles.cavity]}>
              <Text style={styles.statVal}>{totalStats.totalDevices}</Text>
              <Text style={styles.statLbl}>Tổng thiết bị</Text>
            </View>

            <View style={[styles.statCol, NeuStyles.cavity]}>
              <Text style={[styles.statVal, { color: '#059669' }]}>
                {totalStats.activeDevices}
              </Text>
              <Text style={styles.statLbl}>Đang bật</Text>
            </View>
          </View>
        </GlassCard>

        {/* Room Grid / List */}
        {rooms.length === 0 ? (
          <View style={[styles.emptyState, NeuStyles.raised]}>
            <Ionicons name="home-outline" size={54} color="#94A3B8" />
            <Text style={[Typography.titleMedium, styles.emptyTitle]}>
              Chưa có phòng nào
            </Text>
            <Text style={styles.emptyDesc}>
              Bấm nút (+) ở góc trên bên phải để tạo khu vực đầu tiên cho ngôi nhà của bạn.
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.emptyCTA,
                NeuStyles.raisedSoft,
                pressed && { opacity: 0.85 },
              ]}
              onPress={handleOpenModal}
              accessibilityRole="button"
              accessibilityLabel="Tạo phòng mới ngay"
            >
              <Text style={styles.emptyCTAText}>Tạo phòng ngay</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.grid}>
            {rooms.map((room) => (
              <View key={room.id} style={styles.gridItem}>
                <RoomCard
                  room={room}
                  onPress={() => navigation.navigate('RoomDetail', { roomId: room.id })}
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add Room Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalCard, NeuStyles.raised]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIconWrap, NeuStyles.cavity]}>
                <MaterialIcons name="meeting-room" size={24} color="#2563EB" />
              </View>
              <Text style={[Typography.titleMedium, styles.modalTitle]}>
                Thêm Phòng Mới
              </Text>
              <Text style={styles.modalSubtitle}>
                Tạo khu vực để gán các thiết bị ESP32 tương ứng
              </Text>
            </View>

            <Text style={styles.inputLabel}>TÊN PHÒNG</Text>
            <TextInput
              style={[styles.input, NeuStyles.cavity]}
              placeholder="VD: Phòng khách, Phòng giải trí..."
              placeholderTextColor="#94A3B8"
              value={newRoomName}
              onChangeText={setNewRoomName}
              autoFocus
              maxLength={40}
              returnKeyType="done"
              onSubmitEditing={handleAddRoom}
            />

            <Text style={[styles.inputLabel, { marginTop: 14 }]}>CHỌN BIỂU TƯỢNG</Text>
            <View style={styles.iconGrid}>
              {ROOM_ICONS.map((item) => {
                const isSelected = selectedIcon === item.id;
                return (
                  <Pressable
                    key={item.id}
                    style={({ pressed }) => [
                      styles.iconChoice,
                      isSelected ? [NeuStyles.pressed, styles.iconChoiceActive] : NeuStyles.raisedSoft,
                      pressed && { opacity: 0.85 },
                    ]}
                    onPress={() => setSelectedIcon(item.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Chọn icon ${item.name}`}
                  >
                    <MaterialIcons
                      name={item.icon as any}
                      size={20}
                      color={isSelected ? '#2563EB' : '#64748B'}
                    />
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.modalActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalBtn,
                  NeuStyles.raisedSoft,
                  pressed && { opacity: 0.85 },
                ]}
                onPress={handleCloseModal}
                accessibilityRole="button"
                accessibilityLabel="Hủy tạo phòng"
              >
                <Text style={styles.cancelText}>Hủy</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.modalBtn,
                  styles.modalBtnPrimary,
                  NeuStyles.raisedSoft,
                  pressed && { opacity: 0.85 },
                ]}
                onPress={handleAddRoom}
                accessibilityRole="button"
                accessibilityLabel="Xác nhận thêm phòng"
              >
                <Text style={styles.submitText}>Thêm Phòng</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 4,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsCard: {
    marginBottom: 16,
    padding: 14,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
  },
  statVal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2563EB',
  },
  statLbl: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  gridItem: {
    width: '50%',
    paddingHorizontal: 6,
    marginBottom: 12,
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
    marginBottom: 18,
    lineHeight: 18,
  },
  emptyCTA: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: BorderRadius.lg,
  },
  emptyCTAText: {
    color: '#2563EB',
    fontWeight: '800',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.marginMobile,
  },
  modalCard: {
    width: '100%',
    maxWidth: MODAL_MAX_WIDTH,
    padding: 22,
    borderRadius: BorderRadius.xxl,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    color: '#1E293B',
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 2,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    height: MODAL_INPUT_HEIGHT,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
  },
  iconGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  iconChoice: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconChoiceActive: {
    backgroundColor: '#E8ECF2',
    borderWidth: 1.5,
    borderColor: '#2563EB',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
  },
  modalBtnPrimary: {
    backgroundColor: '#1E293B',
  },
  cancelText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '700',
  },
  submitText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
