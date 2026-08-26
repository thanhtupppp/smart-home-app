import { StyleSheet, Platform } from 'react-native';

export const Typography = StyleSheet.create({
  displayLarge: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: -0.5,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  headlineMedium: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600',
    letterSpacing: -0.25,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  headlineSmall: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  titleMedium: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  bodyLarge: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  bodyMedium: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  bodySmall: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  labelCaps: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
  statusNumber: {
    fontSize: 48,
    lineHeight: 52,
    fontWeight: '300',
    letterSpacing: -1,
    fontFamily: Platform.select({ ios: 'System', android: 'Roboto' }),
  },
});
