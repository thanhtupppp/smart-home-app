import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
  Modal,
  TextInput,
  Share,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, NeuStyles, NeuPalette } from '../theme';
import { useHome } from '../context/HomeContext';
import { useAuth } from '../context/AuthContext';
import { Header } from '../components/Header';
import { AppNavigationProp } from '../navigation/types';
import { safeStorage } from '../services/storageService';
import { firebaseService } from '../services/firebaseService';

// Constants
const ICON_BOX_SIZE = 48;
const QR_CODE_SIZE = 170;
const QR_PADDING = 16;
const STATS_ROW_GAP = 10;
const HOMES_STORAGE_KEY = 'tu_smarthome_homes_list';

type TabType = 'my_home' | 'qr_share';

const TABS = [
  { id: 'my_home', label: 'Danh sách nhà' },
  { id: 'qr_share', label: 'Mã QR chia sẻ' },
] as const;

interface HomeItem {
  id: string;
  name: string;
  address?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  isCurrent?: boolean;
  devicesCount?: number;
  roomsCount?: number;
  createdAt: string;
}

interface SimpleMember {
  id: string;
  name: string;
  avatarInitials: string;
}

const HOME_ICONS: Array<{ name: keyof typeof Ionicons.glyphMap; label: string }> = [
  { name: 'home', label: 'Nhà phố' },
  { name: 'business', label: 'Căn hộ' },
  { name: 'storefront', label: 'Văn phòng' },
  { name: 'leaf', label: 'Nghỉ dưỡng' },
];

export const ManageHomeScreen: React.FC = () => {
  const navigation = useNavigation<AppNavigationProp>();
  const { overview, rooms, devices, updateHomeName } = useHome();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('my_home');
  const [membersList, setMembersList] = useState<SimpleMember[]>([]);

  // Homes list state
  const [homes, setHomes] = useState<HomeItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Add Home Modal
  const [isAddModalVisible, setIsAddModalVisible] = useState<boolean>(false);
  const [newHomeName, setNewHomeName] = useState<string>('');
  const [newHomeAddress, setNewHomeAddress] = useState<string>('');
  const [newHomeIcon, setNewHomeIcon] = useState<keyof typeof Ionicons.glyphMap>('home');
  const [isCreatingHome, setIsCreatingHome] = useState<boolean>(false);

  // Edit Home Name Modal
  const [isEditModalVisible, setIsEditModalVisible] = useState<boolean>(false);
  const [selectedHomeForEdit, setSelectedHomeForEdit] = useState<HomeItem | null>(null);
  const [editedHomeName, setEditedHomeName] = useState<string>('');
  const [isSavingName, setIsSavingName] = useState<boolean>(false);

  // Load Homes & Members
  const loadHomesAndMembers = useCallback(async () => {
    setIsLoading(true);

    const defaultHome: HomeItem = {
      id: 'home_main',
      name: overview.homeName || 'Tú SmartHome',
      address: 'Hà Nội, Việt Nam',
      icon: 'home',
      isCurrent: true,
      devicesCount: overview.totalDevices || devices.length,
      roomsCount: rooms.length,
      createdAt: new Date().toISOString(),
    };

    let localHomes: HomeItem[] = [defaultHome];

    // 1. Read cached homes
    try {
      const cachedHomes = await safeStorage.getItem(HOMES_STORAGE_KEY);
      if (cachedHomes) {
        const parsed = JSON.parse(cachedHomes);
        if (Array.isArray(parsed) && parsed.length > 0) {
          localHomes = parsed;
          setHomes(localHomes);
        }
      }
    } catch {
      // Ignore
    }

    if (localHomes.length === 1) {
      setHomes(localHomes);
    }

    // 2. Read cached members
    try {
      const cachedMembers = await safeStorage.getItem('tu_smarthome_members_cache');
      if (cachedMembers) {
        const list = JSON.parse(cachedMembers);
        if (Array.isArray(list)) {
          setMembersList(
            list.map((m: any) => ({
              id: m.id,
              name: m.name,
              avatarInitials: m.avatarInitials || m.name?.slice(0, 2)?.toUpperCase() || 'TV',
            }))
          );
        }
      }
    } catch {
      // Ignore
    }

    // 3. Sync with Firebase RTDB
    try {
      const remoteHomes = await firebaseService.fetchHomes();
      if (remoteHomes && Object.keys(remoteHomes).length > 0) {
        const list: HomeItem[] = Object.values(remoteHomes);
        setHomes(list);
        await safeStorage.setItem(HOMES_STORAGE_KEY, JSON.stringify(list));
      } else {
        await safeStorage.setItem(HOMES_STORAGE_KEY, JSON.stringify(localHomes));
        await firebaseService.saveHome(defaultHome);
      }

      const remoteMembers = await firebaseService.fetchMembers();
      if (remoteMembers) {
        const list = Object.values(remoteMembers) as any[];
        if (list.length > 0) {
          setMembersList(
            list.map((m: any) => ({
              id: m.id,
              name: m.name,
              avatarInitials: m.avatarInitials || m.name?.slice(0, 2)?.toUpperCase() || 'TV',
            }))
          );
        }
      }
    } catch {
      // Offline fallback
    } finally {
      setIsLoading(false);
    }
  }, [overview.homeName, overview.totalDevices, devices.length, rooms.length]);

  useEffect(() => {
    loadHomesAndMembers();
  }, [loadHomesAndMembers]);

  // Switch Active Home
  const handleSwitchHome = useCallback(
    async (targetHome: HomeItem) => {
      if (targetHome.isCurrent) return;

      const updated = homes.map((h) => ({
        ...h,
        isCurrent: h.id === targetHome.id,
      }));

      setHomes(updated);
      await safeStorage.setItem(HOMES_STORAGE_KEY, JSON.stringify(updated));
      await updateHomeName(targetHome.name);

      // Sync updated active flags to Firebase
      updated.forEach((h) => firebaseService.saveHome(h));

      Alert.alert('Đã chuyển ngôi nhà', `Bạn đang điều khiển ngôi nhà "${targetHome.name}".`);
    },
    [homes, updateHomeName]
  );

  // Add New Home
  const handleCreateHomeSubmit = useCallback(async () => {
    if (!newHomeName.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên ngôi nhà mới.');
      return;
    }

    setIsCreatingHome(true);
    try {
      const createdHome: HomeItem = {
        id: `home_${Date.now()}`,
        name: newHomeName.trim(),
        address: newHomeAddress.trim() || 'Việt Nam',
        icon: newHomeIcon,
        isCurrent: false,
        devicesCount: 0,
        roomsCount: 0,
        createdAt: new Date().toISOString(),
      };

      const updated = [...homes, createdHome];
      setHomes(updated);
      await safeStorage.setItem(HOMES_STORAGE_KEY, JSON.stringify(updated));
      await firebaseService.saveHome(createdHome);

      setIsAddModalVisible(false);
      setNewHomeName('');
      setNewHomeAddress('');
      setNewHomeIcon('home');
      Alert.alert('Thành công', `Đã thêm ngôi nhà "${createdHome.name}" vào danh sách.`);
    } catch {
      Alert.alert('Lỗi', 'Không thể kết nối lưu ngôi nhà mới vào Firebase.');
    } finally {
      setIsCreatingHome(false);
    }
  }, [newHomeName, newHomeAddress, newHomeIcon, homes]);

  // Save Edited Home Name
  const handleSaveEditedHomeName = useCallback(async () => {
    if (!selectedHomeForEdit || !editedHomeName.trim()) {
      Alert.alert('Lỗi', 'Tên ngôi nhà không được để trống.');
      return;
    }

    setIsSavingName(true);
    try {
      const updated = homes.map((h) =>
        h.id === selectedHomeForEdit.id ? { ...h, name: editedHomeName.trim() } : h
      );

      setHomes(updated);
      await safeStorage.setItem(HOMES_STORAGE_KEY, JSON.stringify(updated));

      const editedObj = updated.find((h) => h.id === selectedHomeForEdit.id);
      if (editedObj) {
        await firebaseService.saveHome(editedObj);
        if (editedObj.isCurrent) {
          await updateHomeName(editedObj.name);
        }
      }

      setIsEditModalVisible(false);
      setSelectedHomeForEdit(null);
      Alert.alert('Thành công', 'Đã cập nhật tên ngôi nhà.');
    } catch {
      Alert.alert('Lỗi', 'Không thể kết nối đến Firebase Cloud.');
    } finally {
      setIsSavingName(false);
    }
  }, [selectedHomeForEdit, editedHomeName, homes, updateHomeName]);

  // Delete Home
  const handleDeleteHome = useCallback(
    (targetHome: HomeItem) => {
      if (homes.length <= 1) {
        Alert.alert('Không thể xóa', 'Bạn phải giữ lại ít nhất một ngôi nhà chính.');
        return;
      }

      Alert.alert(
        'Xóa ngôi nhà',
        `Bạn có chắc chắn muốn xóa "${targetHome.name}" khỏi danh sách?`,
        [
          { text: 'Hủy bỏ', style: 'cancel' },
          {
            text: 'Xóa nhà',
            style: 'destructive',
            onPress: async () => {
              const remaining = homes.filter((h) => h.id !== targetHome.id);
              // If deleted home was current, set first remaining as current
              if (targetHome.isCurrent && remaining.length > 0) {
                remaining[0].isCurrent = true;
                await updateHomeName(remaining[0].name);
              }
              setHomes(remaining);
              await safeStorage.setItem(HOMES_STORAGE_KEY, JSON.stringify(remaining));
              await firebaseService.removeHome(targetHome.id);
              Alert.alert('Đã xóa', `Đã xóa ngôi nhà ${targetHome.name}.`);
            },
          },
        ]
      );
    },
    [homes, updateHomeName]
  );

  const handleShareQR = useCallback(async () => {
    try {
      const shareMessage = `Tham gia điều khiển ngôi nhà thông minh "${overview.homeName}" trên ứng dụng Tú SmartHome.\nMã nhà: TU-HOME-ESP32\nCơ sở dữ liệu: Cloud RTDB`;
      await Share.share({
        message: shareMessage,
        title: `Mời tham gia điều khiển ${overview.homeName}`,
      });
    } catch {
      Alert.alert(
        'Chia sẻ mã nhà',
        `Mã ngôi nhà của bạn: TU-HOME-ESP32. Hãy gửi mã này cho người thân qua Zalo hoặc tin nhắn.`
      );
    }
  }, [overview.homeName]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#E8ECF2" />
      <Header
        showBack
        onBackPress={() => navigation.goBack()}
        title="Quản lý Ngôi nhà"
        subtitle={`${homes.length} ngôi nhà trong hệ thống`}
      />

      {/* Segmented Neumorphic Tabs */}
      <View style={[styles.tabContainer, NeuStyles.cavity]}>
        {TABS.map((tab) => {
          const isSelected = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tabBtn,
                isSelected ? [NeuStyles.pressed, styles.tabBtnActive] : styles.tabBtnInactive,
              ]}
              onPress={() => setActiveTab(tab.id)}
              accessibilityRole="button"
              accessibilityLabel={`Chuyển sang tab ${tab.label}`}
              activeOpacity={0.85}
            >
              <Text style={[styles.tabText, isSelected && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'my_home' ? (
          <View>
            <View style={styles.headingRow}>
              <Text style={styles.sectionHeading}>NGÔI NHÀ CỦA BẠN ({homes.length})</Text>
              {isLoading && <ActivityIndicator size="small" color="#2563EB" />}
            </View>

            {homes.map((h) => {
              const isSelectedHome = h.isCurrent || (homes.length === 1 && h.id === homes[0].id);

              return (
                <View key={h.id} style={[styles.homeCard, NeuStyles.raised]}>
                  <TouchableOpacity
                    style={styles.homeHeaderTouch}
                    onPress={() => handleSwitchHome(h)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.iconBox, NeuStyles.raisedSoft]}>
                      <Ionicons
                        name={h.icon || 'home'}
                        size={24}
                        color={isSelectedHome ? '#2563EB' : '#64748B'}
                      />
                    </View>

                    <View style={styles.homeInfo}>
                      <View style={styles.homeNameRow}>
                        <Text
                          style={[
                            Typography.titleMedium,
                            styles.homeName,
                            isSelectedHome && { color: '#1E293B' },
                          ]}
                          numberOfLines={1}
                        >
                          {h.name}
                        </Text>
                        <TouchableOpacity
                          style={[styles.editNameBtn, NeuStyles.circleRaised]}
                          onPress={() => {
                            setSelectedHomeForEdit(h);
                            setEditedHomeName(h.name);
                            setIsEditModalVisible(true);
                          }}
                          accessibilityRole="button"
                          accessibilityLabel="Đổi tên ngôi nhà"
                        >
                          <Ionicons name="pencil" size={11} color="#2563EB" />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.homeAddress}>{h.address || 'Việt Nam'}</Text>
                    </View>

                    {isSelectedHome ? (
                      <View style={[styles.currentBadge, NeuStyles.cavity]}>
                        <View style={styles.currentDot} />
                        <Text style={styles.currentText}>Đang chọn</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[styles.deleteHomeBtn, NeuStyles.raisedSoft]}
                        onPress={() => handleDeleteHome(h)}
                        accessibilityRole="button"
                        accessibilityLabel="Xóa ngôi nhà"
                      >
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>

                  {/* Stats & Members for Selected Home */}
                  {isSelectedHome && (
                    <>
                      <View style={styles.statsRow}>
                        <View style={[styles.statCol, NeuStyles.cavity]}>
                          <Text style={styles.statVal}>{devices.length}</Text>
                          <Text style={styles.statLbl}>Thiết bị</Text>
                        </View>
                        <View style={[styles.statCol, NeuStyles.cavity]}>
                          <Text style={styles.statVal}>{rooms.length}</Text>
                          <Text style={styles.statLbl}>Phòng</Text>
                        </View>
                        <View style={[styles.statCol, NeuStyles.cavity]}>
                          <Text style={styles.statVal}>{Math.max(1, membersList.length)}</Text>
                          <Text style={styles.statLbl}>Thành viên</Text>
                        </View>
                      </View>

                      {/* Members Preview */}
                      <View style={styles.membersPreviewRow}>
                        <Text style={styles.membersHeading}>
                          GIA ĐÌNH ({Math.max(1, membersList.length)})
                        </Text>
                        <View style={styles.avatarRow}>
                          {membersList.slice(0, 4).map((m, index) => (
                            <View key={m.id || index} style={[styles.avatarDot, NeuStyles.cavity]}>
                              <Text style={styles.avatarText}>{m.avatarInitials}</Text>
                            </View>
                          ))}
                          <TouchableOpacity
                            style={[styles.addMemberSmallBtn, NeuStyles.circleRaised]}
                            onPress={() => navigation.navigate('MemberRoles')}
                            accessibilityRole="button"
                            accessibilityLabel="Quản lý thành viên"
                          >
                            <Ionicons name="add" size={14} color="#2563EB" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </>
                  )}
                </View>
              );
            })}

            <TouchableOpacity
              style={[styles.addHomeBtn, NeuStyles.raisedSoft]}
              onPress={() => setIsAddModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Thêm ngôi nhà mới"
              activeOpacity={0.85}
            >
              <Ionicons name="add-circle" size={20} color="#2563EB" />
              <Text style={styles.addHomeText}>Thêm ngôi nhà mới</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.qrSection}>
            <View style={[styles.qrCard, NeuStyles.raised]}>
              <Text style={[Typography.titleMedium, styles.qrTitle]}>
                Mã QR Nhà của bạn
              </Text>
              <Text style={styles.qrDesc}>
                Các thành viên trong gia đình chỉ cần quét mã QR này hoặc nhập mã nhà để cùng điều khiển thiết bị.
              </Text>

              <View style={[styles.qrPlaceholder, NeuStyles.cavity]}>
                <MaterialIcons name="qr-code-2" size={QR_CODE_SIZE} color="#1E293B" />
              </View>

              <Text style={styles.qrHomeName}>{overview.homeName}</Text>
              <View style={[styles.codeBadge, NeuStyles.cavity]}>
                <Text style={styles.qrCodeString}>MÃ NHÀ: TU-HOME-ESP32</Text>
              </View>

              <TouchableOpacity
                style={[styles.shareBtn, NeuStyles.raisedSoft]}
                onPress={handleShareQR}
                accessibilityRole="button"
                accessibilityLabel="Chia sẻ mã QR nhà"
                activeOpacity={0.85}
              >
                <Ionicons name="share-social-outline" size={18} color="#FFFFFF" />
                <Text style={styles.shareBtnText}>Chia sẻ mã mời</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Add Home Modal */}
      <Modal
        visible={isAddModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsAddModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, NeuStyles.raised]}>
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalTitleGroup}>
                <Ionicons name="home-outline" size={20} color="#2563EB" />
                <Text style={styles.modalTitle}>Thêm ngôi nhà mới</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsAddModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSub}>
              Tạo không gian điều khiển cho căn hộ, nhà riêng hoặc nơi nghỉ dưỡng khác của bạn.
            </Text>

            <Text style={styles.inputLabel}>TÊN NGÔI NHÀ</Text>
            <View style={[styles.modalInputWrap, NeuStyles.cavity]}>
              <TextInput
                style={styles.modalInput}
                value={newHomeName}
                onChangeText={setNewHomeName}
                placeholder="Ví dụ: Căn hộ 204, Biệt thự Đà Lạt..."
                placeholderTextColor="#94A3B8"
              />
            </View>

            <Text style={styles.inputLabel}>ĐỊA CHỈ / KHU VỰC</Text>
            <View style={[styles.modalInputWrap, NeuStyles.cavity]}>
              <TextInput
                style={styles.modalInput}
                value={newHomeAddress}
                onChangeText={setNewHomeAddress}
                placeholder="Ví dụ: Hoàng Mai, Hà Nội"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <Text style={styles.inputLabel}>LOẠI KIẾN TRÚC</Text>
            <View style={styles.iconSelectionRow}>
              {HOME_ICONS.map((item) => {
                const isSelected = newHomeIcon === item.name;
                return (
                  <TouchableOpacity
                    key={item.name}
                    style={[
                      styles.iconOptionBtn,
                      isSelected ? styles.iconOptionSelected : NeuStyles.raisedSoft,
                    ]}
                    onPress={() => setNewHomeIcon(item.name)}
                  >
                    <Ionicons
                      name={item.name}
                      size={18}
                      color={isSelected ? '#FFFFFF' : '#2563EB'}
                    />
                    <Text
                      style={[
                        styles.iconOptionLabel,
                        { color: isSelected ? '#FFFFFF' : '#64748B' },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, NeuStyles.raisedSoft]}
                onPress={() => setIsAddModalVisible(false)}
                disabled={isCreatingHome}
              >
                <Text style={styles.modalCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, NeuStyles.raised]}
                onPress={handleCreateHomeSubmit}
                disabled={isCreatingHome}
              >
                {isCreatingHome ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSaveText}>Tạo ngôi nhà</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Home Name Modal */}
      <Modal
        visible={isEditModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, NeuStyles.raised]}>
            <Text style={styles.modalTitle}>Đổi tên ngôi nhà</Text>
            <Text style={styles.modalSub}>
              Tên ngôi nhà sẽ được hiển thị trên bảng điều khiển của tất cả thành viên.
            </Text>

            <View style={[styles.modalInputWrap, NeuStyles.cavity]}>
              <TextInput
                style={styles.modalInput}
                value={editedHomeName}
                onChangeText={setEditedHomeName}
                placeholder="Ví dụ: Tú SmartHome"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, NeuStyles.raisedSoft]}
                onPress={() => setIsEditModalVisible(false)}
                disabled={isSavingName}
              >
                <Text style={styles.modalCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, NeuStyles.raised]}
                onPress={handleSaveEditedHomeName}
                disabled={isSavingName}
              >
                {isSavingName ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSaveText}>Lưu thay đổi</Text>
                )}
              </TouchableOpacity>
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
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: Spacing.marginMobile,
    padding: 4,
    marginBottom: 14,
    borderRadius: BorderRadius.xl,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
  },
  tabBtnInactive: {
    backgroundColor: 'transparent',
  },
  tabBtnActive: {
    backgroundColor: '#E8ECF2',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
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
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  homeCard: {
    padding: 16,
    borderRadius: BorderRadius.xl,
    marginBottom: 14,
  },
  homeHeaderTouch: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBox: {
    width: ICON_BOX_SIZE,
    height: ICON_BOX_SIZE,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  homeInfo: {
    flex: 1,
  },
  homeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editNameBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8ECF2',
  },
  deleteHomeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    marginLeft: 8,
  },
  homeName: {
    color: '#1E293B',
    fontWeight: '800',
    fontSize: 15,
  },
  homeAddress: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  currentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  currentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  currentText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: STATS_ROW_GAP,
    marginTop: 14,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
  },
  statVal: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2563EB',
  },
  statLbl: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  membersPreviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.6)',
  },
  membersHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  avatarDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2563EB',
  },
  addMemberSmallBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addHomeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: BorderRadius.xl,
    marginTop: 6,
    backgroundColor: '#E8ECF2',
  },
  addHomeText: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '800',
  },
  qrSection: {
    alignItems: 'center',
  },
  qrCard: {
    alignItems: 'center',
    width: '100%',
    padding: 24,
    borderRadius: BorderRadius.xxl,
  },
  qrTitle: {
    color: '#1E293B',
    fontWeight: '800',
  },
  qrDesc: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
    lineHeight: 18,
    fontWeight: '500',
  },
  qrPlaceholder: {
    padding: QR_PADDING,
    borderRadius: 20,
    marginBottom: 16,
  },
  qrHomeName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
  },
  codeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 6,
  },
  qrCodeString: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1E293B',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
    marginTop: 20,
  },
  shareBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: '#E8ECF2',
    borderRadius: BorderRadius.xxl,
    padding: 22,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  modalTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1E293B',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalSub: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 14,
    lineHeight: 18,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 4,
  },
  modalInputWrap: {
    height: 46,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: 14,
    justifyContent: 'center',
    marginBottom: 12,
    backgroundColor: '#DFE5EC',
  },
  modalInput: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '700',
  },
  iconSelectionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
    marginTop: 4,
  },
  iconOptionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: BorderRadius.lg,
    backgroundColor: '#E8ECF2',
    gap: 4,
  },
  iconOptionSelected: {
    backgroundColor: '#2563EB',
  },
  iconOptionLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8ECF2',
  },
  modalCancelText: {
    color: '#64748B',
    fontWeight: '700',
    fontSize: 14,
  },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
  },
  modalSaveText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});
