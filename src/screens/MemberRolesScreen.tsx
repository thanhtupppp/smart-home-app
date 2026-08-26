import React, { useState, useEffect, useMemo, useCallback, useReducer } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  StatusBar,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, NeuStyles, NeuPalette } from '../theme';
import { Header } from '../components/Header';
import { AppNavigationProp } from '../navigation/types';
import { useAuth } from '../context/AuthContext';
import { firebaseService } from '../services/firebaseService';
import { safeStorage } from '../services/storageService';

// Constants
const AVATAR_SIZE = 44;
const AVATAR_FONT_SIZE = 15;
const BADGE_PADDING_H = 8;
const BADGE_PADDING_V = 4;
const MEMBERS_STORAGE_KEY = 'tu_smarthome_members_cache';

type RoleType = 'owner' | 'admin' | 'member' | 'guest';

interface Member {
  id: string;
  name: string;
  email: string;
  role: RoleType;
  avatarInitials: string;
  roomsCount: number;
  isActivated?: boolean;
  lastLoginAt?: string;
  createdAt?: string;
}

const ROLE_CONFIG: Record<
  RoleType,
  { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  owner: { label: 'Chủ nhà', color: '#2563EB', icon: 'ribbon' },
  admin: { label: 'Quản trị viên', color: '#059669', icon: 'shield-checkmark' },
  member: { label: 'Thành viên', color: '#D97706', icon: 'person' },
  guest: { label: 'Khách', color: '#64748B', icon: 'person-outline' },
};

const ROLE_TEXT_STYLES = StyleSheet.create({
  owner: { color: '#2563EB' },
  admin: { color: '#059669' },
  member: { color: '#D97706' },
  guest: { color: '#64748B' },
});

const STATUS_STYLES = StyleSheet.create({
  dotActive: { backgroundColor: '#10B981' },
  dotPending: { backgroundColor: '#F59E0B' },
  textActive: { color: '#059669' },
  textPending: { color: '#D97706' },
});

const getInitials = (name: string): string => {
  if (!name) return 'TV';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

interface InviteFormState {
  isModalVisible: boolean;
  inviteName: string;
  inviteEmail: string;
  inviteRole: RoleType;
  isSubmitting: boolean;
}

type InviteFormAction =
  | { type: 'OPEN_MODAL' }
  | { type: 'CLOSE_MODAL' }
  | { type: 'SET_NAME'; payload: string }
  | { type: 'SET_EMAIL'; payload: string }
  | { type: 'SET_ROLE'; payload: RoleType }
  | { type: 'SET_SUBMITTING'; payload: boolean }
  | { type: 'RESET' };

const initialInviteState: InviteFormState = {
  isModalVisible: false,
  inviteName: '',
  inviteEmail: '',
  inviteRole: 'member',
  isSubmitting: false,
};

const inviteReducer = (state: InviteFormState, action: InviteFormAction): InviteFormState => {
  switch (action.type) {
    case 'OPEN_MODAL':
      return { ...state, isModalVisible: true };
    case 'CLOSE_MODAL':
      return { ...state, isModalVisible: false };
    case 'SET_NAME':
      return { ...state, inviteName: action.payload };
    case 'SET_EMAIL':
      return { ...state, inviteEmail: action.payload };
    case 'SET_ROLE':
      return { ...state, inviteRole: action.payload };
    case 'SET_SUBMITTING':
      return { ...state, isSubmitting: action.payload };
    case 'RESET':
      return initialInviteState;
    default:
      return state;
  }
};

interface MemberRowItemProps {
  member: Member;
  onEdit: (m: Member) => void;
  onDelete: (m: Member) => void;
}

const MemberRowItem = React.memo<MemberRowItemProps>(({ member: m, onEdit, onDelete }) => {
  const roleInfo = ROLE_CONFIG[m.role] || ROLE_CONFIG.member;
  const isOwner = m.role === 'owner';

  const handleEdit = useCallback(() => {
    onEdit(m);
  }, [m, onEdit]);

  const handleDelete = useCallback(() => {
    onDelete(m);
  }, [m, onDelete]);

  const isActivatedOrOwner = isOwner || m.isActivated;
  const statusDotStyle = isActivatedOrOwner ? STATUS_STYLES.dotActive : STATUS_STYLES.dotPending;
  const statusTextStyle = isActivatedOrOwner ? STATUS_STYLES.textActive : STATUS_STYLES.textPending;
  const roleTextStyle = ROLE_TEXT_STYLES[m.role] || ROLE_TEXT_STYLES.member;

  return (
    <View style={[styles.memberCard, NeuStyles.raised]}>
      <Pressable
        style={({ pressed }) => [
          styles.memberMainTouch,
          pressed && { opacity: 0.7 },
        ]}
        onPress={handleEdit}
      >
        <View style={[styles.avatar, NeuStyles.circleRaised]}>
          <Text style={styles.avatarText}>{m.avatarInitials}</Text>
        </View>

        <View style={styles.infoCol}>
          <View style={styles.nameRow}>
            <Text style={[Typography.titleMedium, styles.memberName]} numberOfLines={1}>
              {m.name}
            </Text>
            <View style={[styles.badge, NeuStyles.cavity]}>
              <Ionicons name={roleInfo.icon} size={11} color={roleInfo.color} />
              <Text style={[styles.badgeText, roleTextStyle]}>
                {roleInfo.label}
              </Text>
            </View>
          </View>

          <Text style={styles.emailText} numberOfLines={1}>{m.email}</Text>
          
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, statusDotStyle]} />
            <Text style={[styles.statusText, statusTextStyle]}>
              {isOwner
                ? 'Chủ nhà sở hữu'
                : m.isActivated
                ? 'Đã kích hoạt'
                : 'Chờ đăng nhập'}
            </Text>
            <Text style={styles.dotDivider}>•</Text>
            <Text style={styles.accessText}>
              {m.roomsCount} phòng
            </Text>
          </View>
        </View>
      </Pressable>

      {/* Action Buttons */}
      <View style={styles.actionButtonsCol}>
        <Pressable
          style={({ pressed }) => [
            styles.editRoleBtn,
            NeuStyles.raisedSoft,
            pressed && { opacity: 0.85 },
          ]}
          onPress={handleEdit}
          accessibilityRole="button"
          accessibilityLabel="Chỉnh sửa quyền"
        >
          <Ionicons name="shield-outline" size={16} color="#2563EB" />
        </Pressable>

        {!isOwner && (
          <Pressable
            style={({ pressed }) => [
              styles.deleteBtn,
              NeuStyles.raisedSoft,
              pressed && { opacity: 0.85 },
            ]}
            onPress={handleDelete}
            accessibilityRole="button"
            accessibilityLabel="Xóa thành viên"
          >
            <Ionicons name="trash-outline" size={16} color="#EF4444" />
          </Pressable>
        )}
      </View>
    </View>
  );
});

export const MemberRolesScreen: React.FC = () => {
  const navigation = useNavigation<AppNavigationProp>();
  const { user } = useAuth();

  const userInitials = useMemo(() => {
    return getInitials(user?.displayName || 'Chủ nhà');
  }, [user?.displayName]);

  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [inviteState, dispatchInvite] = useReducer(inviteReducer, initialInviteState);

  const { isModalVisible, inviteName, inviteEmail, inviteRole, isSubmitting } = inviteState;

  // Load Members from Cache & Firebase
  // react-doctor-disable-next-line react-doctor/no-set-state-after-await-in-effect
  useEffect(() => {
    let isMounted = true;

    const loadMembers = async () => {
      setIsLoading(true);

      const ownerMember: Member = {
        id: user?.uid || 'user_owner',
        name: user?.displayName || 'Chủ nhà (Bạn)',
        email: user?.email || 'owner@smarthome.vn',
        role: 'owner',
        avatarInitials: userInitials,
        roomsCount: 4,
        isActivated: true,
        lastLoginAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      let currentMembers: Member[] = [ownerMember];

      // 1. Load cached
      try {
        const cached = await safeStorage.getItem(MEMBERS_STORAGE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            currentMembers = parsed;
            if (isMounted) setMembers(currentMembers);
          }
        }
      } catch {
        // Ignore
      }

      if (isMounted) setMembers(currentMembers);

      // 2. Fetch Firebase remote
      try {
        const remoteMembers = await firebaseService.fetchMembers();
        if (remoteMembers && Object.keys(remoteMembers).length > 0 && isMounted) {
          const list: Member[] = Object.values(remoteMembers);
          const hasOwner = list.some((m) => m.role === 'owner');
          const merged = hasOwner ? list : [ownerMember, ...list];
          setMembers(merged);
          await safeStorage.setItem(MEMBERS_STORAGE_KEY, JSON.stringify(merged));
        }
      } catch {
        // Fallback
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadMembers();

    return () => {
      isMounted = false;
    };
  }, [user, userInitials]);

  // Handle Delete Member
  const handleDeleteMember = useCallback((member: Member) => {
    if (member.role === 'owner') {
      Alert.alert('Không thể xóa', 'Bạn là Chủ nhà sở hữu toàn quyền quản trị, không thể tự xóa.');
      return;
    }

    Alert.alert(
      'Xóa thành viên',
      `Bạn có chắc chắn muốn xóa "${member.name}" (${member.email}) khỏi hệ thống ngôi nhà? Toàn bộ quyền truy cập sẽ bị thu hồi ngay lập tức.`,
      [
        { text: 'Hủy bỏ', style: 'cancel' },
        {
          text: 'Xóa thành viên',
          style: 'destructive',
          onPress: async () => {
            const updated = members.filter((m) => m.id !== member.id);
            setMembers(updated);
            await safeStorage.setItem(MEMBERS_STORAGE_KEY, JSON.stringify(updated));
            await firebaseService.removeMember(member.id);
            Alert.alert('Thành công', `Đã xóa thành viên ${member.name} khỏi gia đình.`);
          },
        },
      ]
    );
  }, [members]);

  // Handle Edit Role
  const handleEditRole = useCallback((member: Member) => {
    if (member.role === 'owner') {
      Alert.alert('Chủ nhà', 'Tài khoản sở hữu có toàn bộ quyền quản trị tối cao.');
      return;
    }

    Alert.alert(
      `Phân quyền cho ${member.name}`,
      `Chọn vai trò mới cho tài khoản:`,
      [
        { text: 'Đóng', style: 'cancel' },
        {
          text: 'Quản trị viên (Admin)',
          onPress: async () => {
            const updated: Member = { ...member, role: 'admin' };
            const list = members.map((m) => (m.id === member.id ? updated : m));
            setMembers(list);
            await safeStorage.setItem(MEMBERS_STORAGE_KEY, JSON.stringify(list));
            await firebaseService.saveMember(updated);
            Alert.alert('Thành công', `Đã nâng quyền Quản trị viên cho ${member.name}.`);
          },
        },
        {
          text: 'Thành viên thường (Member)',
          onPress: async () => {
            const updated: Member = { ...member, role: 'member' };
            const list = members.map((m) => (m.id === member.id ? updated : m));
            setMembers(list);
            await safeStorage.setItem(MEMBERS_STORAGE_KEY, JSON.stringify(list));
            await firebaseService.saveMember(updated);
            Alert.alert('Thành công', `Đã đổi thành viên ${member.name} thành Thành viên thường.`);
          },
        },
        {
          text: 'Khách (Guest)',
          onPress: async () => {
            const updated: Member = { ...member, role: 'guest' };
            const list = members.map((m) => (m.id === member.id ? updated : m));
            setMembers(list);
            await safeStorage.setItem(MEMBERS_STORAGE_KEY, JSON.stringify(list));
            await firebaseService.saveMember(updated);
            Alert.alert('Thành công', `Đã đặt vai trò Khách cho ${member.name}.`);
          },
        },
        {
          text: 'Xóa khỏi nhà',
          style: 'destructive',
          onPress: () => handleDeleteMember(member),
        },
      ]
    );
  }, [members, handleDeleteMember]);

  // Submit Invite Member
  const handleSubmitInvite = useCallback(async () => {
    if (!inviteName.trim() || !inviteEmail.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập đầy đủ Tên và Email thành viên.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail.trim())) {
      Alert.alert('Email không hợp lệ', 'Vui lòng kiểm tra lại định dạng email.');
      return;
    }

    if (members.some((m) => m.email.toLowerCase() === inviteEmail.trim().toLowerCase())) {
      Alert.alert('Đã tồn tại', 'Thành viên này đã có trong danh sách gia đình.');
      return;
    }

    dispatchInvite({ type: 'SET_SUBMITTING', payload: true });
    try {
      const newMember: Member = {
        id: `member_${Date.now()}`,
        name: inviteName.trim(),
        email: inviteEmail.trim(),
        role: inviteRole,
        avatarInitials: getInitials(inviteName.trim()),
        roomsCount: inviteRole === 'admin' ? 4 : 2,
        isActivated: false,
        createdAt: new Date().toISOString(),
      };

      const updated = [...members, newMember];
      setMembers(updated);
      await safeStorage.setItem(MEMBERS_STORAGE_KEY, JSON.stringify(updated));
      await firebaseService.saveMember(newMember);

      dispatchInvite({ type: 'RESET' });
      Alert.alert('Đã mời thành công', `Đã thêm ${newMember.name} vào danh sách gia đình với vai trò ${ROLE_CONFIG[newMember.role].label}.`);
    } catch {
      Alert.alert('Lỗi', 'Không thể kết nối lưu thành viên vào Firebase.');
    } finally {
      dispatchInvite({ type: 'SET_SUBMITTING', payload: false });
    }
  }, [inviteName, inviteEmail, inviteRole, members]);

  const renderMemberItem = useCallback(
    ({ item }: { item: Member }) => (
      <MemberRowItem
        member={item}
        onEdit={handleEditRole}
        onDelete={handleDeleteMember}
      />
    ),
    [handleEditRole, handleDeleteMember]
  );

  const renderHeader = () => (
    <View style={styles.headingRow}>
      <Text style={styles.sectionHeading}>DANH SÁCH THÀNH VIÊN ({members.length})</Text>
      {isLoading && <ActivityIndicator size="small" color="#2563EB" />}
    </View>
  );

  const renderFooter = () => (
    <Pressable
      style={({ pressed }) => [
        styles.inviteBtn,
        NeuStyles.raisedSoft,
        pressed && { opacity: 0.85 },
      ]}
      onPress={() => dispatchInvite({ type: 'OPEN_MODAL' })}
      accessibilityRole="button"
      accessibilityLabel="Mời thành viên mới vào gia đình"
    >
      <Ionicons name="person-add-outline" size={18} color="#FFFFFF" />
      <Text style={styles.inviteBtnText}>Mời thành viên mới</Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#E8ECF2" />
      <Header
        showBack
        onBackPress={() => navigation.goBack()}
        title="Thành viên & Phân quyền"
        subtitle={`${members.length} tài khoản trong gia đình`}
      />

      <FlatList
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        data={members}
        keyExtractor={(m) => m.id}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        renderItem={renderMemberItem}
      />

      {/* Invite Member Modal */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => dispatchInvite({ type: 'CLOSE_MODAL' })}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalCard, NeuStyles.raised]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleWrap}>
                <Ionicons name="person-add" size={20} color="#2563EB" />
                <Text style={styles.modalTitle}>Mời thành viên mới</Text>
              </View>
              <Pressable
                onPress={() => dispatchInvite({ type: 'CLOSE_MODAL' })}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={20} color="#64748B" />
              </Pressable>
            </View>

            <Text style={styles.modalDesc}>
              Cấp quyền điều khiển nhà thông minh và chia sẻ thiết bị cho người thân.
            </Text>

            {/* Input Name */}
            <Text style={styles.inputLabel}>HỌ VÀ TÊN</Text>
            <View style={[styles.inputBox, NeuStyles.cavity]}>
              <Ionicons name="person-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
              <TextInput
                style={styles.inputField}
                placeholder="Ví dụ: Nguyễn Văn A"
                placeholderTextColor="#94A3B8"
                value={inviteName}
                onChangeText={(text) => dispatchInvite({ type: 'SET_NAME', payload: text })}
              />
            </View>

            {/* Input Email */}
            <Text style={styles.inputLabel}>ĐỊA CHỈ EMAIL</Text>
            <View style={[styles.inputBox, NeuStyles.cavity]}>
              <Ionicons name="mail-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
              <TextInput
                style={styles.inputField}
                placeholder="user@gmail.com"
                placeholderTextColor="#94A3B8"
                keyboardType="email-address"
                autoCapitalize="none"
                value={inviteEmail}
                onChangeText={(text) => dispatchInvite({ type: 'SET_EMAIL', payload: text })}
              />
            </View>

            {/* Select Role */}
            <Text style={styles.inputLabel}>VAI TRÒ & QUYỀN HẠN</Text>
            <View style={styles.roleSelectionRow}>
              {(['admin', 'member', 'guest'] as RoleType[]).map((r) => {
                const config = ROLE_CONFIG[r];
                const isSelected = inviteRole === r;
                return (
                  <Pressable
                    key={r}
                    style={({ pressed }) => [
                      styles.roleOptionBtn,
                      isSelected ? styles.roleOptionSelected : NeuStyles.raisedSoft,
                      pressed && { opacity: 0.85 },
                    ]}
                    onPress={() => dispatchInvite({ type: 'SET_ROLE', payload: r })}
                  >
                    <Ionicons
                      name={config.icon}
                      size={14}
                      color={isSelected ? '#FFFFFF' : config.color}
                    />
                    <Text
                      style={[
                        styles.roleOptionText,
                        { color: isSelected ? '#FFFFFF' : '#475569' },
                      ]}
                    >
                      {config.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Submit Buttons */}
            <View style={styles.modalFooter}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalCancelBtn,
                  NeuStyles.raisedSoft,
                  pressed && { opacity: 0.85 },
                ]}
                onPress={() => dispatchInvite({ type: 'CLOSE_MODAL' })}
                disabled={isSubmitting}
              >
                <Text style={styles.modalCancelText}>Hủy</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.modalConfirmBtn,
                  NeuStyles.raised,
                  pressed && { opacity: 0.85 },
                ]}
                onPress={handleSubmitInvite}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmText}>Gửi lời mời</Text>
                )}
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
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: BorderRadius.xl,
    marginBottom: 12,
  },
  memberMainTouch: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: AVATAR_FONT_SIZE,
    fontWeight: '800',
    color: '#2563EB',
  },
  infoCol: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  memberName: {
    color: '#1E293B',
    fontWeight: '800',
    fontSize: 14,
    flex: 1,
    paddingRight: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: BADGE_PADDING_H,
    paddingVertical: BADGE_PADDING_V,
    borderRadius: BorderRadius.full,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  emailText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  dotDivider: {
    fontSize: 11,
    color: '#CBD5E1',
    fontWeight: '700',
  },
  accessText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  actionButtonsCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 8,
  },
  editRoleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8ECF2',
  },
  deleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
  },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1E293B',
    paddingVertical: 14,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
    marginTop: 8,
  },
  inviteBtnText: {
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
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  modalTitleWrap: {
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
  modalDesc: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
    lineHeight: 18,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 8,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.lg,
    backgroundColor: '#DFE5EC',
  },
  inputIcon: {
    marginRight: 8,
  },
  inputField: {
    flex: 1,
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
  },
  roleSelectionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    marginBottom: 16,
  },
  roleOptionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: BorderRadius.lg,
    backgroundColor: '#E8ECF2',
  },
  roleOptionSelected: {
    backgroundColor: '#2563EB',
  },
  roleOptionText: {
    fontSize: 11,
    fontWeight: '700',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
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
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
  },
  modalConfirmText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});
