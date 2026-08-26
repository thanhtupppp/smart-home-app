import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { MaterialIcons, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Typography, BorderRadius, NeuStyles, NeuPalette } from '../theme';
import { Room } from '../types';

interface RoomCardProps {
  room: Room;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

export const RoomCard: React.FC<RoomCardProps> = React.memo(({ room, onPress, style }) => {
  const renderRoomIcon = () => {
    const icon = room.iconName || room.id;
    switch (icon) {
      case 'room_living':
      case 'meeting-room':
        return <MaterialIcons name="weekend" size={22} color="#3B82F6" />;
      case 'room_bedroom_master':
      case 'bed':
        return <Ionicons name="bed" size={22} color="#8B5CF6" />;
      case 'room_kitchen':
      case 'kitchen':
        return <MaterialCommunityIcons name="silverware-fork-knife" size={22} color="#F59E0B" />;
      case 'room_balcony':
      case 'yard':
        return <MaterialCommunityIcons name="flower-tulip" size={22} color="#10B981" />;
      case 'bathtub':
        return <MaterialIcons name="bathtub" size={22} color="#06B6D4" />;
      case 'work':
        return <MaterialIcons name="computer" size={22} color="#6366F1" />;
      default:
        return <MaterialIcons name="meeting-room" size={22} color="#3B82F6" />;
    }
  };

  return (
    <TouchableOpacity
      style={[styles.card, NeuStyles.raised, style]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Phòng ${room.name}, ${room.activeCount} trên ${room.deviceCount} thiết bị đang bật`}
      activeOpacity={0.85}
    >
      <View style={styles.headerRow}>
        <View style={[styles.iconContainer, NeuStyles.raisedSoft]}>
          {renderRoomIcon()}
        </View>

        <View style={[styles.badge, NeuStyles.cavity]}>
          <Text style={styles.badgeText}>
            <Text
              style={{
                color: room.activeCount > 0 ? '#2563EB' : '#64748B',
                fontWeight: '800',
              }}
            >
              {room.activeCount}
            </Text>
            /{room.deviceCount} bật
          </Text>
        </View>
      </View>

      <Text style={[Typography.titleMedium, styles.roomName]} numberOfLines={1}>
        {room.name}
      </Text>

      <View style={styles.sensorRow}>
        {room.temperature !== undefined && (
          <View style={[styles.sensorItem, NeuStyles.cavity]}>
            <MaterialIcons name="thermostat" size={13} color="#EA580C" />
            <Text style={styles.sensorText}>{room.temperature}°C</Text>
          </View>
        )}
        {room.humidity !== undefined && (
          <View style={[styles.sensorItem, NeuStyles.cavity]}>
            <Ionicons name="water" size={12} color="#0284C7" />
            <Text style={styles.sensorText}>{room.humidity}%</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    padding: 14,
    borderRadius: BorderRadius.xl,
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  roomName: {
    color: '#1E293B',
    fontWeight: '800',
    fontSize: 14,
    marginBottom: 8,
  },
  sensorRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  sensorItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderRadius: 8,
  },
  sensorText: {
    fontSize: 11,
    color: '#334155',
    fontWeight: '700',
  },
});
