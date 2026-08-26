import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Switch,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, NeuStyles, NeuPalette } from '../theme';
import { useHome } from '../context/HomeContext';
import { GlassCard } from '../components/GlassCard';

// Constants
const ADD_BTN_SIZE = 44;
const SCENE_ICON_SIZE = 22;
const AUTO_ICON_SIZE = 20;
const MODAL_MAX_WIDTH = 360;
const MODAL_INPUT_HEIGHT = 48;
const DAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] as const;

type SceneIconName = 'home' | 'exit' | 'moon' | 'sunny' | 'movie' | 'restaurant' | 'flash' | string;

export const AutomationScreen: React.FC = () => {
  const { scenes, automations, activateScene, toggleAutomation } = useHome();
  const [activeTab, setActiveTab] = useState<'scenes' | 'schedules'>('scenes');
  const [modalVisible, setModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTime, setNewTime] = useState('06:30');

  const handleActivateScene = useCallback(
    (sceneId: string) => {
      activateScene(sceneId);
    },
    [activateScene]
  );

  const handleToggleAutomation = useCallback(
    (autoId: string) => {
      toggleAutomation(autoId);
    },
    [toggleAutomation]
  );

  const handleOpenModal = useCallback(() => {
    setNewTitle('');
    setNewTime('06:30');
    setModalVisible(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
    setNewTitle('');
  }, []);

  const handleAddSchedule = useCallback(() => {
    if (!newTitle.trim()) {
      Alert.alert('Thông báo', 'Vui lòng nhập tên lịch trình');
      return;
    }

    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(newTime.trim())) {
      Alert.alert('Thông báo', 'Định dạng giờ không hợp lệ. Vui lòng nhập theo dạng HH:MM (VD: 06:30, 23:00)');
      return;
    }

    Alert.alert('Thành công', `Đã tạo tự động hóa: "${newTitle.trim()}" lúc ${newTime.trim()}`);
    setNewTitle('');
    setModalVisible(false);
  }, [newTitle, newTime]);

  const renderSceneIcon = useCallback((iconName: string, isActive: boolean) => {
    const iconColor = isActive ? '#2563EB' : '#475569';
    switch (iconName) {
      case 'home':
        return <Ionicons name="home" size={SCENE_ICON_SIZE} color={iconColor} />;
      case 'exit':
        return <Ionicons name="exit-outline" size={SCENE_ICON_SIZE} color={iconColor} />;
      case 'moon':
        return <Ionicons name="moon" size={SCENE_ICON_SIZE} color={iconColor} />;
      case 'sunny':
        return <Ionicons name="sunny" size={SCENE_ICON_SIZE} color={iconColor} />;
      case 'movie':
        return <MaterialIcons name="movie" size={SCENE_ICON_SIZE} color={iconColor} />;
      case 'restaurant':
        return <Ionicons name="restaurant" size={SCENE_ICON_SIZE} color={iconColor} />;
      default:
        return <Ionicons name="flash" size={SCENE_ICON_SIZE} color={iconColor} />;
    }
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#E8ECF2" />
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSubtitle}>Kịch bản & Lịch trình tự động</Text>
          <Text style={[Typography.displayLarge, styles.headerTitle]}>
            Tự Động Hóa
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, NeuStyles.circleRaised]}
          onPress={handleOpenModal}
          accessibilityRole="button"
          accessibilityLabel="Thêm tự động hóa mới"
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={22} color="#2563EB" />
        </TouchableOpacity>
      </View>

      {/* Segmented Neumorphic Tab Bar */}
      <View style={[styles.tabContainer, NeuStyles.cavity]}>
        <TouchableOpacity
          style={[
            styles.tabBtn,
            activeTab === 'scenes' ? [NeuStyles.pressed, styles.tabBtnActive] : styles.tabBtnInactive,
          ]}
          onPress={() => setActiveTab('scenes')}
          accessibilityRole="button"
          accessibilityLabel="Xem kịch bản thông minh"
          activeOpacity={0.85}
        >
          <Text style={[styles.tabText, activeTab === 'scenes' && styles.tabTextActive]}>
            Kịch bản ({scenes.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabBtn,
            activeTab === 'schedules' ? [NeuStyles.pressed, styles.tabBtnActive] : styles.tabBtnInactive,
          ]}
          onPress={() => setActiveTab('schedules')}
          accessibilityRole="button"
          accessibilityLabel="Xem lịch trình tự động"
          activeOpacity={0.85}
        >
          <Text style={[styles.tabText, activeTab === 'schedules' && styles.tabTextActive]}>
            Lịch trình ({automations.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'scenes' ? (
          scenes.length === 0 ? (
            <View style={[styles.emptyState, NeuStyles.raised]}>
              <MaterialIcons name="flash-off" size={48} color="#94A3B8" />
              <Text style={[Typography.titleMedium, styles.emptyTitle]}>
                Chưa có kịch bản nào
              </Text>
              <Text style={styles.emptyDesc}>
                Tạo các ngữ cảnh thông minh để kích hoạt hàng loạt thiết bị chỉ với một chạm.
              </Text>
            </View>
          ) : (
            <View style={styles.scenesList}>
              {scenes.map((scene) => (
                <View
                  key={scene.id}
                  style={[
                    styles.sceneCard,
                    NeuStyles.raised,
                    scene.isActive && styles.sceneCardActive,
                  ]}
                >
                  <View style={styles.sceneCardHeader}>
                    <View style={[styles.sceneIconBox, NeuStyles.cavity]}>
                      {renderSceneIcon(scene.icon, scene.isActive)}
                    </View>

                    <View style={styles.sceneInfo}>
                      <View style={styles.sceneTitleRow}>
                        <Text style={[Typography.titleMedium, styles.sceneTitle]}>
                          {scene.name}
                        </Text>
                        {scene.isActive && (
                          <View style={styles.activeLedBadge}>
                            <View style={styles.activeLedDot} />
                            <Text style={styles.activeLedText}>ĐANG CHẠY</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.sceneDesc}>{scene.description}</Text>
                    </View>
                  </View>

                  <View style={styles.sceneCardFooter}>
                    <View style={[styles.actionCountBadge, NeuStyles.cavity]}>
                      <Ionicons name="options-outline" size={13} color="#2563EB" />
                      <Text style={styles.actionCountText}>
                        {scene.actionsCount} hành động
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.activateBtn,
                        scene.isActive ? [NeuStyles.pressed, styles.activateBtnActive] : NeuStyles.raisedSoft,
                      ]}
                      onPress={() => handleActivateScene(scene.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Kích hoạt kịch bản ${scene.name}`}
                      activeOpacity={0.85}
                    >
                      <Text
                        style={[
                          styles.activateBtnText,
                          scene.isActive && styles.activateBtnTextActive,
                        ]}
                      >
                        {scene.isActive ? 'Đang chạy' : 'Kích hoạt'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )
        ) : (
          automations.length === 0 ? (
            <View style={[styles.emptyState, NeuStyles.raised]}>
              <MaterialIcons name="schedule" size={48} color="#94A3B8" />
              <Text style={[Typography.titleMedium, styles.emptyTitle]}>
                Chưa có lịch trình nào
              </Text>
              <Text style={styles.emptyDesc}>
                Tạo lịch hẹn giờ và tự động hóa theo thời gian trong ngày.
              </Text>
            </View>
          ) : (
            <View style={styles.automationsList}>
              {automations.map((auto) => (
                <View key={auto.id} style={[styles.autoCard, NeuStyles.raised]}>
                  <View style={styles.autoCardHeader}>
                    <View style={styles.autoTitleWrap}>
                      <Text style={[Typography.titleMedium, styles.autoTitle]}>
                        {auto.title}
                      </Text>
                      {auto.executionTime && (
                        <View style={[styles.timeBadge, NeuStyles.cavity]}>
                          <MaterialIcons name="schedule" size={13} color="#2563EB" />
                          <Text style={styles.timeBadgeText}>
                            {auto.executionTime}
                          </Text>
                        </View>
                      )}
                    </View>

                    <Switch
                      value={auto.isEnabled}
                      onValueChange={() => handleToggleAutomation(auto.id)}
                      trackColor={{ false: '#CBD5E1', true: '#93C5FD' }}
                      thumbColor={auto.isEnabled ? '#2563EB' : '#F8FAFC'}
                    />
                  </View>

                  <View style={styles.ruleBoxesRow}>
                    <View style={[styles.ruleBox, NeuStyles.cavity]}>
                      <Text style={styles.ruleLabel}>ĐIỀU KIỆN (KHI)</Text>
                      <Text style={styles.ruleValue}>{auto.triggerDescription}</Text>
                    </View>
                    <View style={[styles.ruleBox, NeuStyles.cavity]}>
                      <Text style={styles.ruleLabel}>HÀNH ĐỘNG (THÌ)</Text>
                      <Text style={styles.ruleValue}>{auto.actionDescription}</Text>
                    </View>
                  </View>

                  <View style={styles.daysRow}>
                    {DAY_LABELS.map((day) => {
                      const isRepeat = auto.repeatDays.includes(day);
                      return (
                        <View
                          key={day}
                          style={[
                            styles.dayChip,
                            isRepeat ? [NeuStyles.pressed, styles.dayChipActive] : NeuStyles.cavity,
                          ]}
                        >
                          <Text
                            style={[
                              styles.dayChipText,
                              isRepeat && styles.dayChipTextActive,
                            ]}
                          >
                            {day}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          )
        )}
      </ScrollView>

      {/* Modal Add Automation Schedule with Neumorphic Inset Inputs */}
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
          <View style={[styles.modalContent, NeuStyles.raised]}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIconWrap, NeuStyles.cavity]}>
                <MaterialIcons name="auto-fix-high" size={22} color="#2563EB" />
              </View>
              <Text style={[Typography.titleMedium, styles.modalTitle]}>
                Thêm Tự Động Hóa
              </Text>
            </View>

            <Text style={styles.modalLabel}>TÊN LỊCH TRÌNH</Text>
            <TextInput
              style={[styles.modalInput, NeuStyles.cavity]}
              placeholder="VD: Tự động tắt đèn ban đêm..."
              placeholderTextColor="#94A3B8"
              value={newTitle}
              onChangeText={setNewTitle}
              autoFocus
              returnKeyType="next"
            />

            <Text style={styles.modalLabel}>THỜI GIAN THỰC HIỆN (HH:MM)</Text>
            <TextInput
              style={[styles.modalInput, NeuStyles.cavity]}
              placeholder="VD: 06:30 hoặc 23:00"
              placeholderTextColor="#94A3B8"
              value={newTime}
              onChangeText={setNewTime}
              keyboardType="numbers-and-punctuation"
              onSubmitEditing={handleAddSchedule}
              returnKeyType="done"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.cancelBtn, NeuStyles.raisedSoft]}
                onPress={handleCloseModal}
                accessibilityRole="button"
                accessibilityLabel="Hủy tạo lịch trình"
                activeOpacity={0.85}
              >
                <Text style={styles.cancelBtnText}>Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, NeuStyles.raisedSoft]}
                onPress={handleAddSchedule}
                accessibilityRole="button"
                accessibilityLabel="Lưu lịch trình mới"
                activeOpacity={0.85}
              >
                <Text style={styles.saveBtnText}>Tạo lịch trình</Text>
              </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.marginMobile,
    paddingTop: 10,
    paddingBottom: 16,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  headerTitle: {
    color: '#1E293B',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 2,
  },
  addBtn: {
    width: ADD_BTN_SIZE,
    height: ADD_BTN_SIZE,
    borderRadius: ADD_BTN_SIZE / 2,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: Spacing.marginMobile,
    padding: 4,
    marginBottom: 16,
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
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
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
  scenesList: {
    gap: 14,
  },
  sceneCard: {
    padding: 16,
    borderRadius: BorderRadius.xl,
  },
  sceneCardActive: {
    borderWidth: 1.5,
    borderColor: 'rgba(59, 130, 246, 0.5)',
  },
  sceneCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sceneIconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sceneInfo: {
    flex: 1,
  },
  sceneTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sceneTitle: {
    color: '#1E293B',
    fontWeight: '800',
  },
  activeLedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activeLedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 3,
  },
  activeLedText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#2563EB',
    letterSpacing: 0.5,
  },
  sceneDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
    fontWeight: '500',
  },
  sceneCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.6)',
  },
  actionCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  actionCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  activateBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  activateBtnActive: {
    backgroundColor: '#1E293B',
  },
  activateBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2563EB',
  },
  activateBtnTextActive: {
    color: '#FFFFFF',
  },
  automationsList: {
    gap: 14,
  },
  autoCard: {
    padding: 16,
    borderRadius: BorderRadius.xl,
  },
  autoCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  autoTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  autoTitle: {
    color: '#1E293B',
    fontWeight: '800',
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  timeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563EB',
  },
  ruleBoxesRow: {
    gap: 8,
    marginBottom: 12,
  },
  ruleBox: {
    padding: 10,
    borderRadius: 10,
  },
  ruleLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  ruleValue: {
    fontSize: 12,
    color: '#1E293B',
    fontWeight: '600',
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  dayChip: {
    flex: 1,
    paddingVertical: 5,
    alignItems: 'center',
    borderRadius: 6,
  },
  dayChipActive: {
    backgroundColor: '#1E293B',
  },
  dayChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  dayChipTextActive: {
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.marginMobile,
  },
  modalContent: {
    width: '100%',
    maxWidth: MODAL_MAX_WIDTH,
    borderRadius: BorderRadius.xxl,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
  },
  modalIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    color: '#1E293B',
    fontWeight: '800',
    fontSize: 18,
  },
  modalLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  modalInput: {
    height: MODAL_INPUT_HEIGHT,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 14,
    fontSize: 14,
    marginBottom: 16,
    color: '#1E293B',
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  cancelBtnText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '700',
  },
  saveBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    borderColor: 'rgba(59, 130, 246, 0.4)',
    borderWidth: 1,
  },
  saveBtnText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
