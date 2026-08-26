import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
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

const CATEGORIES: { key: string; label: string; icon: any }[] = [
  { key: 'all', label: 'Tất cả', icon: 'apps' },
  { key: 'light', label: 'Đèn chiếu sáng', icon: 'lightbulb' },
  { key: 'rgb_light', label: 'LED RGB', icon: 'palette' },
  { key: 'ac', label: 'Điều hòa', icon: 'ac-unit' },
  { key: 'switch', label: 'Công tắc / Ổ cắm', icon: 'power' },
  { key: 'sensor', label: 'Cảm biến', icon: 'thermostat' },
  { key: 'camera', label: 'Camera', icon: 'videocam' },
];

interface CategoryItemProps {
  categoryKey: string;
  label: string;
  isSelected: boolean;
  onSelect: (key: string) => void;
}

const CategoryItem = React.memo<CategoryItemProps>(({ categoryKey, label, isSelected, onSelect }) => {
  const handlePress = useCallback(() => {
    onSelect(categoryKey);
  }, [categoryKey, onSelect]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.chip,
        isSelected ? [NeuStyles.pressed, styles.chipActive] : NeuStyles.raisedSoft,
        pressed && { opacity: 0.85 },
      ]}
      onPress={handlePress}
    >
      <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
});

interface RoomFilterItemProps {
  roomId: string;
  roomName: string;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

const RoomFilterItem = React.memo<RoomFilterItemProps>(({ roomId, roomName, isSelected, onSelect }) => {
  const handlePress = useCallback(() => {
    onSelect(roomId);
  }, [roomId, onSelect]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.roomChip,
        isSelected ? [NeuStyles.pressed, styles.roomChipActive] : NeuStyles.raisedSoft,
        pressed && { opacity: 0.85 },
      ]}
      onPress={handlePress}
    >
      <Text style={[styles.roomChipText, isSelected && styles.roomChipTextActive]}>
        {roomName}
      </Text>
    </Pressable>
  );
});

interface DeviceRowItemProps {
  device: Device;
  onToggle: (id: string) => void;
  onDetail: (dev: Device) => void;
  onDelete: (dev: Device) => void;
}

const DeviceRowItem = React.memo<DeviceRowItemProps>(({ device, onToggle, onDetail, onDelete }) => {
  const handleToggle = useCallback(() => {
    onToggle(device.id);
  }, [device.id, onToggle]);

  const handleDetail = useCallback(() => {
    onDetail(device);
  }, [device, onDetail]);

  const handleDelete = useCallback(() => {
    onDelete(device);
  }, [device, onDelete]);

  const hasDetail = device.type === 'ac' || device.type === 'rgb_light' || device.type === 'camera';

  return (
    <DeviceCard
      device={device}
      onToggle={handleToggle}
      onPressDetail={hasDetail ? handleDetail : undefined}
      onDelete={handleDelete}
    />
  );
});

export const DevicesScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { devices, rooms, toggleDevice, turnAllDevices, removeDevice } = useHome();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedRoom, setSelectedRoom] = useState<string>('all');

  const filteredDevices = useMemo(() => {
    return devices.filter((dev) => {
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
  }, [devices, searchQuery, selectedCategory, selectedRoom]);

  const handleDeviceDetail = useCallback((dev: Device) => {
    if (dev.type === 'rgb_light') {
      navigation.navigate('RGBController', { deviceId: dev.id });
    } else if (dev.type === 'ac') {
      navigation.navigate('ACController', { deviceId: dev.id });
    } else if (dev.type === 'camera') {
      navigation.navigate('CameraDetail');
    }
  }, [navigation]);

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

  const roomFilterData = useMemo(() => [
    { id: 'all', name: 'Tất cả phòng' },
    ...rooms,
  ], [rooms]);

  const renderCategoryItem = useCallback(
    ({ item: cat }: { item: typeof CATEGORIES[number] }) => (
      <CategoryItem
        categoryKey={cat.key}
        label={cat.label}
        isSelected={selectedCategory === cat.key}
        onSelect={setSelectedCategory}
      />
    ),
    [selectedCategory]
  );

  const renderRoomItem = useCallback(
    ({ item: room }: { item: { id: string; name: string } }) => (
      <RoomFilterItem
        roomId={room.id}
        roomName={room.name}
        isSelected={selectedRoom === room.id}
        onSelect={setSelectedRoom}
      />
    ),
    [selectedRoom]
  );

  const renderDeviceItem = useCallback(
    ({ item: dev }: { item: Device }) => (
      <DeviceRowItem
        device={dev}
        onToggle={toggleDevice}
        onDetail={handleDeviceDetail}
        onDelete={handleDeleteDevice}
      />
    ),
    [toggleDevice, handleDeviceDetail, handleDeleteDevice]
  );

  const renderHeader = () => (
    <View>
      <View style={styles.header}>
        <View>
          <Text style={[Typography.headlineMedium, styles.title]}>Thiết bị</Text>
          <Text style={[Typography.bodySmall, styles.subtitle]}>
            {devices.filter((d) => d.isOn).length}/{devices.length} thiết bị đang hoạt động
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.addButton,
            NeuStyles.circleRaised,
            pressed && { opacity: 0.85 },
          ]}
          onPress={() => navigation.navigate('AddDevice')}
          accessibilityRole="button"
          accessibilityLabel="Thêm thiết bị mới"
        >
          <Ionicons name="add" size={22} color="#2563EB" />
        </Pressable>
      </View>

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
          <Pressable onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={18} color="#64748B" />
          </Pressable>
        )}
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        contentContainerStyle={styles.categoryContainer}
        data={CATEGORIES}
        keyExtractor={(cat) => cat.key}
        renderItem={renderCategoryItem}
      />

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.roomScroll}
        contentContainerStyle={styles.roomContainer}
        data={roomFilterData}
        keyExtractor={(room) => room.id}
        renderItem={renderRoomItem}
      />

      {devices.length > 0 && (
        <View style={styles.masterControlBar}>
          <Text style={styles.deviceCountText}>
            Danh sách ({filteredDevices.length})
          </Text>
          <View style={styles.masterButtons}>
            <Pressable
              style={({ pressed }) => [
                styles.masterBtn,
                NeuStyles.raisedSoft,
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => turnAllDevices(true, selectedRoom === 'all' ? undefined : selectedRoom)}
            >
              <View style={styles.greenLed} />
              <Text style={styles.masterBtnTextOn}>Bật tất cả</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.masterBtn,
                NeuStyles.raisedSoft,
                pressed && { opacity: 0.85 },
              ]}
              onPress={() => turnAllDevices(false, selectedRoom === 'all' ? undefined : selectedRoom)}
            >
              <View style={styles.redLed} />
              <Text style={styles.masterBtnTextOff}>Tắt tất cả</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );

  const renderEmpty = () => {
    if (devices.length === 0) {
      return (
        <View style={[styles.emptyState, NeuStyles.raised]}>
          <Ionicons name="hardware-chip-outline" size={54} color="#94A3B8" />
          <Text style={styles.emptyStateTitle}>Chưa có thiết bị nào</Text>
          <Text style={styles.emptyStateDesc}>
            Toàn bộ dữ liệu mẫu đã được dọn dẹp. Hãy bấm nút dưới đây để bắt đầu ghép nối và thêm thiết bị ESP32 thực tế của bạn.
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.addDeviceCTA,
              NeuStyles.raised,
              pressed && { opacity: 0.85 },
            ]}
            onPress={() => navigation.navigate('AddDevice')}
          >
            <Ionicons name="add-circle" size={20} color="#FFFFFF" />
            <Text style={styles.addDeviceCTAText}>Thêm thiết bị ESP32 ngay</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <View style={[styles.emptyState, NeuStyles.raised]}>
        <MaterialIcons name="devices-other" size={44} color="#94A3B8" />
        <Text style={styles.emptyStateTitle}>Không tìm thấy thiết bị</Text>
        <Text style={styles.emptyStateDesc}>
          Hãy thử tìm kiếm với từ khóa khác hoặc chuyển bộ lọc danh mục.
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#E8ECF2" />
      <FlatList
        style={styles.deviceList}
        contentContainerStyle={styles.deviceListContent}
        showsVerticalScrollIndicator={false}
        data={filteredDevices}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        renderItem={renderDeviceItem}
      />
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
