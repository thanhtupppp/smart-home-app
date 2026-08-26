import { StyleSheet, Platform, ViewStyle } from 'react-native';
import { Colors } from './colors';

/**
 * Neumorphism (Soft UI) Design System Styles & Tokens
 * Simulates a fixed top-left light source:
 * - Highlight (Light shadow / reflection) on top-left (-x, -y)
 * - Shadow (Dark shadow / depression) on bottom-right (+x, +y)
 */

export const NeuPalette = {
  bg: '#E8ECF2',
  bgDark: '#1A1E29',
  surface: '#E8ECF2',
  surfacePressed: '#DCE2EC',
  surfaceHighlight: '#FFFFFF',
  shadowDark: '#B8C4D4',
  shadowDarkDeep: '#9EADBF',
  shadowLight: '#FFFFFF',
  
  // LED & Accent Glows
  accentBlue: '#3B82F6',
  accentCyan: '#06B6D4',
  accentAmber: '#F59E0B',
  accentGreen: '#10B981',
  accentRed: '#EF4444',
  accentPurple: '#8B5CF6',
  
  // Text on Neumorphism
  textPrimary: '#1E293B',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
};

export const NeuStyles = StyleSheet.create({
  // Raised Surface (Embossed / Nổi) - Dành cho Cards, Buttons
  raised: {
    backgroundColor: NeuPalette.bg,
    borderRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: NeuPalette.shadowDarkDeep,
        shadowOffset: { width: 6, height: 6 },
        shadowOpacity: 0.45,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
      default: {
        boxShadow: '6px 6px 14px #B8C4D4, -6px -6px 14px #FFFFFF',
      },
    }),
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderTopColor: 'rgba(255, 255, 255, 0.95)',
    borderLeftColor: 'rgba(255, 255, 255, 0.95)',
    borderBottomWidth: 1.5,
    borderRightWidth: 1.5,
    borderBottomColor: 'rgba(184, 196, 212, 0.4)',
    borderRightColor: 'rgba(184, 196, 212, 0.4)',
  },

  // Soft Raised (Nổi nhẹ) - Dành cho chip nhỏ, icon container
  raisedSoft: {
    backgroundColor: NeuPalette.bg,
    borderRadius: 14,
    ...Platform.select({
      ios: {
        shadowColor: NeuPalette.shadowDarkDeep,
        shadowOffset: { width: 3, height: 3 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
      default: {
        boxShadow: '3px 3px 8px #BAC6D6, -3px -3px 8px #FFFFFF',
      },
    }),
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.95)',
    borderLeftColor: 'rgba(255, 255, 255, 0.95)',
    borderBottomWidth: 1,
    borderRightWidth: 1,
    borderBottomColor: 'rgba(184, 196, 212, 0.3)',
    borderRightColor: 'rgba(184, 196, 212, 0.3)',
  },

  // Pressed / Inset Surface (Lõm xuống) - Dành cho nút đã chọn, rãnh ô input
  pressed: {
    backgroundColor: NeuPalette.surfacePressed,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#FFFFFF',
        shadowOffset: { width: -2, height: -2 },
        shadowOpacity: 0.6,
        shadowRadius: 4,
      },
      android: {
        elevation: 0,
      },
      default: {
        boxShadow: 'inset 3px 3px 6px #B8C4D4, inset -3px -3px 6px #FFFFFF',
      },
    }),
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderTopColor: 'rgba(166, 180, 200, 0.5)',
    borderLeftColor: 'rgba(166, 180, 200, 0.5)',
    borderBottomWidth: 1.5,
    borderRightWidth: 1.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.8)',
    borderRightColor: 'rgba(255, 255, 255, 0.8)',
  },

  // Cavity / Groove (Rãnh lõm hiển thị thông tin như nhiệt kế, metric box)
  cavity: {
    backgroundColor: '#DFE5EE',
    borderRadius: 14,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderTopColor: 'rgba(160, 175, 195, 0.5)',
    borderLeftColor: 'rgba(160, 175, 195, 0.5)',
    borderBottomWidth: 1.5,
    borderRightWidth: 1.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.9)',
    borderRightColor: 'rgba(255, 255, 255, 0.9)',
  },

  // Circle Raised Button (Nút tròn nổi cơ học)
  circleRaised: {
    backgroundColor: NeuPalette.bg,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: NeuPalette.shadowDarkDeep,
        shadowOffset: { width: 4, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      default: {
        boxShadow: '4px 4px 10px #B8C4D4, -4px -4px 10px #FFFFFF',
      },
    }),
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderTopColor: 'rgba(255, 255, 255, 0.95)',
    borderLeftColor: 'rgba(255, 255, 255, 0.95)',
    borderBottomWidth: 1.5,
    borderRightWidth: 1.5,
    borderBottomColor: 'rgba(184, 196, 212, 0.4)',
    borderRightColor: 'rgba(184, 196, 212, 0.4)',
  },

  // Circle Pressed (Nút tròn đang ấn / lõm)
  circlePressed: {
    backgroundColor: NeuPalette.surfacePressed,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
    borderTopColor: 'rgba(166, 180, 200, 0.5)',
    borderLeftColor: 'rgba(166, 180, 200, 0.5)',
    borderBottomWidth: 1.5,
    borderRightWidth: 1.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.85)',
    borderRightColor: 'rgba(255, 255, 255, 0.85)',
  },

  // LED Glow on Active (Phát quang khi BẬT)
  glowActive: {
    borderWidth: 1.5,
    borderColor: NeuPalette.accentBlue,
    ...Platform.select({
      ios: {
        shadowColor: NeuPalette.accentBlue,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.45,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
      default: {
        boxShadow: '0 0 12px rgba(59, 130, 246, 0.5), 4px 4px 10px #B8C4D4',
      },
    }),
  },
});
