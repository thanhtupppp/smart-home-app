import React from 'react';
import { Text, StyleSheet, Pressable, View } from 'react-native';
import { MaterialIcons, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, Typography, BorderRadius, NeuStyles, NeuPalette } from '../theme';
import { Scene } from '../types';

interface QuickSceneButtonProps {
  scene: Scene;
  onPress: (id: string) => void;
}

export const QuickSceneButton: React.FC<QuickSceneButtonProps> = React.memo(({ scene, onPress }) => {
  const handlePress = React.useCallback(() => {
    onPress(scene.id);
  }, [onPress, scene.id]);

  const renderIcon = () => {
    const iconColor = scene.isActive ? '#FFFFFF' : '#475569';
    switch (scene.id) {
      case 'scene_arrive_home':
        return <Ionicons name="home" size={18} color={iconColor} />;
      case 'scene_leave_home':
        return <Ionicons name="exit-outline" size={18} color={iconColor} />;
      case 'scene_sleep':
        return <Ionicons name="moon" size={18} color={iconColor} />;
      case 'scene_movie':
        return <MaterialIcons name="movie" size={18} color={iconColor} />;
      default:
        return <Ionicons name="flash" size={18} color={iconColor} />;
    }
  };

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        scene.isActive
          ? [NeuStyles.pressed, styles.activeContainer]
          : pressed
          ? [NeuStyles.pressed, styles.pressedContainer]
          : NeuStyles.raisedSoft,
      ]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Ngữ cảnh ${scene.name}`}
    >
      <View
        style={[
          styles.iconWrapper,
          scene.isActive ? styles.activeIconWrapper : NeuStyles.cavity,
        ]}
      >
        {renderIcon()}
      </View>
      <Text
        style={[
          Typography.titleMedium,
          styles.text,
          scene.isActive && styles.activeText,
        ]}
        numberOfLines={1}
      >
        {scene.name}
      </Text>
      {scene.isActive && (
        <View style={styles.activeGlowWrapper}>
          <View style={styles.activeDot} />
        </View>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: BorderRadius.xl,
    marginRight: 12,
  },
  activeContainer: {
    backgroundColor: '#1E293B',
    borderColor: 'rgba(59, 130, 246, 0.4)',
    borderWidth: 1.5,
  },
  pressedContainer: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  activeIconWrapper: {
    backgroundColor: '#3B82F6',
  },
  text: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '700',
  },
  activeText: {
    color: '#FFFFFF',
  },
  activeGlowWrapper: {
    marginLeft: 8,
    boxShadow: '0 0 6px #38BDF8',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#38BDF8',
  },
});
