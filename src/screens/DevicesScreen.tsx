import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, NeuStyles, NeuPalette } from '../theme';
import { useHome } from '../context/HomeContext';
import { DeviceCard } from '../components/DeviceCard';
import { RootStackParamList } from '../navigation/types';
import { Device } from '../types';

export const DevicesScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { devices, rooms, toggleDevice, turnAllDevices, removeDevice } = useHome();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedRoom, setSelectedRoom] = useState<string>('all');

  const categories: { key: string; label: string; icon: any }[] = [
    { key: 'all', label: 'Tất cả', icon: 'apps' },
    { key: 'light', label: 'Đèn chiếu sáng', icon: 'lightbulb' },
    { key: 'rgb_light', label: 'LED RGB', icon: 'palette' },
    { key: 'ac', label: 'Điều hòa', icon: 'ac-unit' },
    { key: 'switch', label: 'Công tắc / Ổ cắm', icon: 'power' },
    { key: 'sensor', label: 'Cảm biến', icon: 'thermostat' },
    { key: 'camera', label: 'Camera', icon: 'videocam' },
  ];

  const filteredDevices = devices.filter((dev) => {
    const matchesSearch =
      dev.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (dev.roomName && dev.roomName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory =
      selectedCategory === 'all' ||
      dev.type === selectedCategory ||
      (selectedCategory === 'light' && (dev.type === 'light' || dev.type === 'rgb_light'));
    const matchesRoom = selectedRoom === 'all' || dev.roomId === selectedRoom;

    return matchesSearch && matchesCategory && matchesRoom;
  });

  const handleDeviceDetail = (dev: Device) => {
    if (dev.type === 'rgb_light') {
      navigation.navigate('RGBController', { deviceId: dev.id });
    } else if (dev.type === 'ac') {
      navigation.navigate('ACController', { deviceId: dev.id });
    } else if (dev.type === 'camera') {
      navigation.navigate('CameraDetail');
    }
  };

  const handleDeleteDevice = useCallback((dev: Device) => {
    Alert.alert(
      'Xóa thiết bị',
      `Bạn có chắc chắn muốn xóa "${dev.name}" khỏi hệ thống?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa thiết bị',
          style: 'destructive',
          onPress: async () => {
            await removeDevice(dev.id);
          },
        },
      ]
    );
  }, [removeDevice]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#E8ECF2" />
      <View style={styles.header}>
        <View>
          <Text style={[Typography.headlineMedium, styles.title]}>Thiết bị</Text>
          <Text style={[Typography.bodySmall, styles.subtitle]}>
            {devices.filter((d) => d.isOn).length}/{devices.length} thiết bị đang hoạt động
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.addButton, NeuStyles.circleRaised]}
          onPress={() => navigation.navigate('AddDevice')}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Thêm thiết bị mới"
        >
          <Ionicons name="add" size={22} color="#2563EB" />
        </TouchableOpacity>
      </View>

      {/* Search Input (Cavity Inset Groove) */}
      <View style={[styles.searchContainer, NeuStyles.cavity]}>
        <Ionicons name="search" size={18} color="#64748B" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm kiếm thiết bị hoặc phòng..."
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color="#64748B" />
          </TouchableOpacity>
        )}
      </View>

      {/* Category Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={styles.categoryContainer}
      >
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.key;
          return (
            <TouchableOpacity
              key={cat.key}
              style={[
                styles.chip,
                isSelected ? [NeuStyles.pressed, styles.chipActive] : NeuStyles.raisedSoft,
              ]}
              onPress={() => setSelectedCategory(cat.key)}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.chipText,
                  isSelected && styles.chipTextActive,
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Room Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.roomScroll}
        contentContainerStyle={styles.roomContainer}
      >
        <TouchableOpacity
          style={[
            styles.roomChip,
            selectedRoom === 'all' ? [NeuStyles.pressed, styles.roomChipActive] : NeuStyles.raisedSoft,
          ]}
          onPress={() => setSelectedRoom('all')}
          activeOpacity={0.85}
        >
          <Text
            style={[
              styles.roomChipText,
              selectedRoom === 'all' && styles.roomChipTextActive,
            ]}
          >
            Tất cả phòng
          </Text>
        </TouchableOpacity>
        {rooms.map((room) => {
          const isSelected = selectedRoom === room.id;
          return (
            <TouchableOpacity
              key={room.id}
              style={[
                styles.roomChip,
                isSelected ? [NeuStyles.pressed, styles.roomChipActive] : NeuStyles.raisedSoft,
              ]}
              onPress={() => setSelectedRoom(room.id)}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.roomChipText,
                  isSelected && styles.roomChipTextActive,
                ]}
              >
                {room.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Quick Master Controls */}
      {devices.length > 0 && (
        <View style={styles.masterControlBar}>
          <Text style={styles.deviceCountText}>
            Danh sách ({filteredDevices.length})
          </Text>
          <View style={styles.masterButtons}>
            <TouchableOpacity
              style={[styles.masterBtn, NeuStyles.raisedSoft]}
              onPress={() => turnAllDevices(true, selectedRoom === 'all' ? undefined : selectedRoom)}
              activeOpacity={0.85}
            >
              <View style={styles.greenLed} />
              <Text style={styles.masterBtnTextOn}>Bật tất cả</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.masterBtn, NeuStyles.raisedSoft]}
              onPress={() => turnAllDevices(false, selectedRoom === 'all' ? undefined : selectedRoom)}
              activeOpacity={0.85}
            >
              <View style={styles.redLed} />
              <Text style={styles.masterBtnTextOff}>Tắt tất cả</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Devices List */}
      <ScrollView
        style={styles.deviceList}
        contentContainerStyle={styles.deviceListContent}
        showsVerticalScrollIndicator={false}
      >
        {devices.length === 0 ? (
          <View style={[styles.emptyState, NeuStyles.raised]}>
            <Ionicons name="hardware-chip-outline" size={54} color="#94A3B8" />
            <Text style={styles.emptyStateTitle}>Chưa có thiết bị nào</Text>
            <Text style={styles.emptyStateDesc}>
              Toàn bộ dữ liệu mẫu đã được dọn dẹp. Hãy bấm nút dưới đây để bắt đầu ghép nối và thêm thiết bị ESP32 thực tế của bạn.
            </Text>
            <TouchableOpacity
              style={[styles.addDeviceCTA, NeuStyles.raised]}
              onPress={() => navigation.navigate('AddDevice')}
              activeOpacity={0.85}
            >
              <Ionicons name="add-circle" size={20} color="#FFFFFF" />
              <Text style={styles.addDeviceCTAText}>Thêm thiết bị ESP32 ngay</Text>
            </TouchableOpacity>
          </View>
        ) : filteredDevices.length === 0 ? (
          <View style={[styles.emptyState, NeuStyles.raised]}>
            <MaterialIcons name="devices-other" size={44} color="#94A3B8" />
            <Text style={styles.emptyStateTitle}>Không tìm thấy thiết bị</Text>
            <Text style={styles.emptyStateDesc}>
              Hãy thử tìm kiếm với từ khóa khác hoặc chuyển bộ lọc danh mục.
            </Text>
          </View>
        ) : (
          filteredDevices.map((dev) => (
            <DeviceCard
              key={dev.id}
              device={dev}
              onToggle={() => toggleDevice(dev.id)}
              onPressDetail={
                ['rgb_light', 'ac', 'camera'].includes(dev.type)
                  ? () => handleDeviceDetail(dev)
                  : undefined
              }
              onDelete={() => handleDeleteDevice(dev)}
            />
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.marginMobile,
    paddingTop: Spacing.md,
    paddingBottom: 6,
  },
  title: {
    color: '#1E293B',
    fontWeight: '800',
  },
  subtitle: {
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.marginMobile,
    marginTop: 10,
    marginBottom: 10,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: BorderRadius.lg,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
  },
  categoryScroll: {
    maxHeight: 40,
    marginBottom: 6,
  },
  categoryContainer: {
    paddingHorizontal: Spacing.marginMobile,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  chipActive: {
    backgroundColor: '#1E293B',
    borderColor: '#1E293B',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  roomScroll: {
    maxHeight: 36,
    marginBottom: 10,
  },
  roomContainer: {
    paddingHorizontal: Spacing.marginMobile,
    gap: 6,
    alignItems: 'center',
  },
  roomChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: BorderRadius.md,
  },
  roomChipActive: {
    backgroundColor: '#2563EB',
  },
  roomChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  roomChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  masterControlBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.marginMobile,
    marginBottom: 8,
    marginTop: 2,
  },
  deviceCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  masterButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  masterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  greenLed: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  redLed: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  masterBtnTextOn: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  masterBtnTextOff: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  deviceList: {
    flex: 1,
  },
  deviceListContent: {
    paddingHorizontal: Spacing.marginMobile,
    paddingBottom: 40,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    marginTop: 20,
    borderRadius: BorderRadius.xxl,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 12,
  },
  emptyStateDesc: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    marginBottom: 18,
  },
  addDeviceCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: BorderRadius.xl,
  },
  addDeviceCTAText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
