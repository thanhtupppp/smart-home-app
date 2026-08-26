import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, NeuStyles, NeuPalette } from '../theme';
import { Header } from '../components/Header';
import { GlassCard } from '../components/GlassCard';
import { AppNavigationProp } from '../navigation/types';

// Constants
const DPAD_BTN_SIZE = 44;
const DPAD_CENTER_SIZE = 36;
const PLAY_BTN_SIZE = 32;
const CAMERA_HEIGHT = 200;

type EventType = 'person' | 'motion' | 'vehicle' | 'animal';

interface MotionEvent {
  id: string;
  type: EventType;
  title: string;
  time: string;
  duration: string;
}

const getEventIcon = (type: EventType): any => {
  switch (type) {
    case 'person':
      return 'account';
    case 'motion':
      return 'motion-sensor';
    case 'vehicle':
      return 'car';
    case 'animal':
      return 'dog-side';
    default:
      return 'alert-circle';
  }
};

const getEventColor = (type: EventType): string => {
  switch (type) {
    case 'person':
      return '#EF4444'; // Red
    case 'motion':
      return '#F59E0B'; // Amber
    case 'vehicle':
      return '#3B82F6'; // Blue
    case 'animal':
      return '#10B981'; // Green
    default:
      return '#64748B';
  }
};

export const CameraDetailScreen: React.FC = () => {
  const navigation = useNavigation<AppNavigationProp>();
  const [isNightVision, setIsNightVision] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isPTZMoving, setIsPTZMoving] = useState(false);

  // Recording timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingTime(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  const formatRecordingTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const PTZ_DIRECTIONS = useMemo(
    () => ({
      up: { icon: 'chevron-up', label: 'Xoay camera lên trên' },
      down: { icon: 'chevron-down', label: 'Xoay camera xuống dưới' },
      left: { icon: 'chevron-back', label: 'Xoay camera sang trái' },
      right: { icon: 'chevron-forward', label: 'Xoay camera sang phải' },
    }),
    []
  );

  const motionEvents: MotionEvent[] = useMemo(
    () => [
      {
        id: 'ev_1',
        type: 'person',
        title: 'Phát hiện người ở khu vực Ban công',
        time: '20:15 Hôm nay',
        duration: '15s',
      },
      {
        id: 'ev_2',
        type: 'motion',
        title: 'Cảnh báo chuyển động góc trái',
        time: '17:30 Hôm nay',
        duration: '8s',
      },
      {
        id: 'ev_3',
        type: 'vehicle',
        title: 'Phương tiện đỗ trước cửa nhà',
        time: '12:10 Hôm nay',
        duration: '22s',
      },
    ],
    []
  );

  const handleSnapshot = useCallback(() => {
    Alert.alert('Chụp ảnh', 'Đã lưu ảnh chụp khung hình camera vào thư viện điện thoại.');
  }, []);

  const handleToggleRecording = useCallback(() => {
    setIsRecording((prev) => !prev);
  }, []);

  const handleTwoWayTalk = useCallback(() => {
    Alert.alert('Đàm thoại 2 chiều', 'Giữ nút để truyền giọng nói qua loa ESP32.');
  }, []);

  const handleToggleNightVision = useCallback(() => {
    setIsNightVision((prev) => !prev);
  }, []);

  const handlePTZMove = useCallback(
    (direction: keyof typeof PTZ_DIRECTIONS) => {
      setIsPTZMoving(true);
      Alert.alert('Điều khiển PTZ', PTZ_DIRECTIONS[direction].label);
      setTimeout(() => setIsPTZMoving(false), 400);
    },
    [PTZ_DIRECTIONS]
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#E8ECF2" />
      <Header
        showBack
        onBackPress={() => navigation.goBack()}
        title="Camera AI Giám Sát"
        subtitle="ESP32-CAM • 1080p Full HD"
      />

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Neumorphic Camera Frame with Deep Dark Live Feed */}
        <View style={[styles.cameraOuterFrame, NeuStyles.raised]}>
          <View style={styles.cameraScreenBezel}>
            <View style={styles.cameraFeedMock}>
              <MaterialCommunityIcons name="cctv" size={56} color="#334155" />

              {/* Status Header Overlay */}
              <View style={styles.feedTopOverlay}>
                <View style={styles.liveBadge}>
                  <View style={styles.liveRedDot} />
                  <Text style={styles.liveText}>TRỰC TIẾP</Text>
                </View>

                {isRecording && (
                  <View style={styles.recordingBadge}>
                    <View style={styles.recDot} />
                    <Text style={styles.recText}>
                      REC {formatRecordingTime(recordingTime)}
                    </Text>
                  </View>
                )}

                <View style={styles.resolutionBadge}>
                  <Text style={styles.resolutionText}>1080P • 30FPS</Text>
                </View>
              </View>

              {/* Night Vision Active Tag */}
              {isNightVision && (
                <View style={styles.nightVisionTag}>
                  <MaterialIcons name="nightlight-round" size={13} color="#38BDF8" />
                  <Text style={styles.nightVisionText}>HỒNG NGOẠI BẬT</Text>
                </View>
              )}

              {/* Timestamp Overlay */}
              <View style={styles.timestampOverlay}>
                <Text style={styles.timestampText}>
                  ESP32-CAM • 2026-08-24 12:30:00
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Actions Control Toolbar */}
        <View style={[styles.toolbarCard, NeuStyles.raised]}>
          <TouchableOpacity
            style={[styles.toolBtn, NeuStyles.raisedSoft]}
            onPress={handleSnapshot}
            accessibilityRole="button"
            accessibilityLabel="Chụp ảnh khung hình"
            activeOpacity={0.85}
          >
            <View style={[styles.toolIconWrap, NeuStyles.cavity]}>
              <Ionicons name="camera" size={20} color="#2563EB" />
            </View>
            <Text style={styles.toolLabel}>Chụp ảnh</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toolBtn,
              isRecording ? [NeuStyles.pressed, styles.toolBtnRecording] : NeuStyles.raisedSoft,
            ]}
            onPress={handleToggleRecording}
            accessibilityRole="button"
            accessibilityLabel={isRecording ? 'Dừng ghi hình' : 'Bắt đầu ghi hình'}
            activeOpacity={0.85}
          >
            <View style={[styles.toolIconWrap, NeuStyles.cavity]}>
              <Ionicons
                name={isRecording ? 'stop-circle' : 'videocam'}
                size={20}
                color={isRecording ? '#EF4444' : '#2563EB'}
              />
            </View>
            <Text style={[styles.toolLabel, isRecording && styles.toolLabelRecording]}>
              {isRecording ? 'Dừng REC' : 'Ghi hình'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toolBtn, NeuStyles.raisedSoft]}
            onPress={handleTwoWayTalk}
            accessibilityRole="button"
            accessibilityLabel="Đàm thoại 2 chiều"
            activeOpacity={0.85}
          >
            <View style={[styles.toolIconWrap, NeuStyles.cavity]}>
              <Ionicons name="mic" size={20} color="#2563EB" />
            </View>
            <Text style={styles.toolLabel}>Đàm thoại</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toolBtn,
              isNightVision ? [NeuStyles.pressed, styles.toolBtnActive] : NeuStyles.raisedSoft,
            ]}
            onPress={handleToggleNightVision}
            accessibilityRole="button"
            accessibilityLabel="Bật tắt hồng ngoại ban đêm"
            activeOpacity={0.85}
          >
            <View style={[styles.toolIconWrap, NeuStyles.cavity]}>
              <MaterialIcons
                name="remove-red-eye"
                size={20}
                color={isNightVision ? '#2563EB' : '#64748B'}
              />
            </View>
            <Text style={[styles.toolLabel, isNightVision && styles.toolLabelActive]}>
              Hồng ngoại
            </Text>
          </TouchableOpacity>
        </View>

        {/* PTZ 4-Way Mechanical D-Pad */}
        <GlassCard style={styles.ptzCard}>
          <Text style={[Typography.titleMedium, styles.ptzTitle]}>
            Điều hướng góc quay (PTZ)
          </Text>

          <View style={styles.dpadContainer}>
            {/* Up Button */}
            <TouchableOpacity
              style={[styles.dpadBtn, styles.dpadUp, NeuStyles.circleRaised]}
              onPress={() => handlePTZMove('up')}
              accessibilityRole="button"
              accessibilityLabel="Xoay camera lên"
              activeOpacity={0.85}
            >
              <Ionicons name="chevron-up" size={24} color="#1E293B" />
            </TouchableOpacity>

            {/* Middle Row (Left - Center - Right) */}
            <View style={styles.dpadMiddleRow}>
              <TouchableOpacity
                style={[styles.dpadBtn, NeuStyles.circleRaised]}
                onPress={() => handlePTZMove('left')}
                accessibilityRole="button"
                accessibilityLabel="Xoay camera sang trái"
                activeOpacity={0.85}
              >
                <Ionicons name="chevron-back" size={24} color="#1E293B" />
              </TouchableOpacity>

              <View style={[styles.dpadCenter, NeuStyles.cavity]}>
                <MaterialCommunityIcons name="axis-arrow" size={18} color="#2563EB" />
              </View>

              <TouchableOpacity
                style={[styles.dpadBtn, NeuStyles.circleRaised]}
                onPress={() => handlePTZMove('right')}
                accessibilityRole="button"
                accessibilityLabel="Xoay camera sang phải"
                activeOpacity={0.85}
              >
                <Ionicons name="chevron-forward" size={24} color="#1E293B" />
              </TouchableOpacity>
            </View>

            {/* Down Button */}
            <TouchableOpacity
              style={[styles.dpadBtn, styles.dpadDown, NeuStyles.circleRaised]}
              onPress={() => handlePTZMove('down')}
              accessibilityRole="button"
              accessibilityLabel="Xoay camera xuống"
              activeOpacity={0.85}
            >
              <Ionicons name="chevron-down" size={24} color="#1E293B" />
            </TouchableOpacity>
          </View>
        </GlassCard>

        {/* Motion Events Timeline with Color-Coded Types */}
        <GlassCard style={styles.eventsCard}>
          <View style={styles.eventsHeader}>
            <MaterialIcons name="history" size={20} color="#2563EB" />
            <Text style={[Typography.titleMedium, styles.eventsTitle]}>
              Nhật ký phát hiện chuyển động
            </Text>
          </View>

          <View style={styles.eventsList}>
            {motionEvents.map((event, index) => {
              const color = getEventColor(event.type);
              return (
                <View key={event.id}>
                  <View style={styles.eventItem}>
                    <View style={[styles.eventIconWrap, NeuStyles.cavity]}>
                      <MaterialCommunityIcons
                        name={getEventIcon(event.type)}
                        size={18}
                        color={color}
                      />
                    </View>

                    <View style={styles.eventInfo}>
                      <Text style={styles.eventTitle}>{event.title}</Text>
                      <Text style={styles.eventTime}>
                        {event.time} • Thời lượng: {event.duration}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={[styles.playBtn, NeuStyles.circleRaised]}
                      onPress={() => Alert.alert('Xem lại video', `Đang tải đoạn video ${event.duration}`)}
                      accessibilityRole="button"
                      accessibilityLabel={`Phát lại video ${event.title}`}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="play" size={14} color="#2563EB" />
                    </TouchableOpacity>
                  </View>

                  {index < motionEvents.length - 1 && <View style={styles.divider} />}
                </View>
              );
            })}
          </View>
        </GlassCard>
      </ScrollView>
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
  cameraOuterFrame: {
    padding: 8,
    borderRadius: BorderRadius.xxl,
    marginBottom: 16,
  },
  cameraScreenBezel: {
    backgroundColor: '#0F172A',
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  cameraFeedMock: {
    height: CAMERA_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#090D16',
    position: 'relative',
  },
  feedTopOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#EF4444',
    gap: 5,
  },
  liveRedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  liveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F87171',
    letterSpacing: 0.5,
  },
  recordingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  recDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  recText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  resolutionBadge: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  resolutionText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
  },
  nightVisionTag: {
    position: 'absolute',
    bottom: 34,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  nightVisionText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '800',
  },
  timestampOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 10,
  },
  timestampText: {
    color: '#64748B',
    fontSize: 10,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  toolbarCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: BorderRadius.xl,
    marginBottom: 16,
  },
  toolBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 14,
    marginHorizontal: 3,
  },
  toolBtnActive: {
    backgroundColor: '#E8ECF2',
    borderWidth: 1.5,
    borderColor: '#2563EB',
  },
  toolBtnRecording: {
    backgroundColor: '#E8ECF2',
    borderWidth: 1.5,
    borderColor: '#EF4444',
  },
  toolIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  toolLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
  },
  toolLabelActive: {
    color: '#2563EB',
  },
  toolLabelRecording: {
    color: '#EF4444',
  },
  ptzCard: {
    marginBottom: 16,
  },
  ptzTitle: {
    color: '#1E293B',
    fontWeight: '800',
    marginBottom: 16,
  },
  dpadContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  dpadBtn: {
    width: DPAD_BTN_SIZE,
    height: DPAD_BTN_SIZE,
    borderRadius: DPAD_BTN_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dpadUp: {
    marginBottom: 10,
  },
  dpadMiddleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 36,
  },
  dpadCenter: {
    width: DPAD_CENTER_SIZE,
    height: DPAD_CENTER_SIZE,
    borderRadius: DPAD_CENTER_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dpadDown: {
    marginTop: 10,
  },
  eventsCard: {
    marginBottom: 16,
  },
  eventsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  eventsTitle: {
    color: '#1E293B',
    fontWeight: '800',
  },
  eventsList: {
    gap: 2,
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 12,
  },
  eventIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  eventTime: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  playBtn: {
    width: PLAY_BTN_SIZE,
    height: PLAY_BTN_SIZE,
    borderRadius: PLAY_BTN_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    marginVertical: 10,
  },
});
